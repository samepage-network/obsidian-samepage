import type { AppId, Schema } from "samepage/types";
import loadSharePageWithNotebook from "samepage/protocols/sharePageWithNotebook";
import atJsonParser from "samepage/utils/atJsonParser";
// @ts-ignore figure this out later - it compiles at least
import leafGrammar from "../utils/leafGrammar.ne";
import type SamePagePlugin from "../main";
import { EventRef, MarkdownView, TFile, WorkspaceLeaf } from "obsidian";
import Automerge from "automerge";
import apps from "samepage/internal/apps";

const applyState = async (
  notebookPageId: string,
  state: Schema,
  plugin: SamePagePlugin
) => {
  const expectedText = state.annotations.reduce((p, c, index, all) => {
    const appliedAnnotation =
      c.type === "bold"
        ? {
            prefix: "**",
            suffix: `**`,
          }
        : c.type === "italics"
        ? {
            prefix: "_",
            suffix: `_`,
          }
        : c.type === "strikethrough"
        ? {
            prefix: "~~",
            suffix: `~~`,
          }
        : c.type === "link"
        ? {
            prefix: "[",
            suffix: `](${c.attributes.href})`,
          }
        : c.type === "block"
        ? { suffix: "\n", prefix: "".padStart(c.attributes.level - 1, "\t") }
        : { prefix: "", suffix: "" };
    all.slice(index + 1).forEach((a) => {
      a.start +=
        (a.start >= c.start ? appliedAnnotation.prefix.length : 0) +
        (a.start >= c.end ? appliedAnnotation.suffix.length : 0);
      a.end +=
        (a.end >= c.start ? appliedAnnotation.prefix.length : 0) +
        (a.end > c.end ? appliedAnnotation.suffix.length : 0);
    });
    return `${p.slice(0, c.start)}${appliedAnnotation.prefix}${p.slice(
      c.start,
      c.end
    )}${appliedAnnotation.suffix}${p.slice(c.end)}`;
  }, state.content.toString());
  const abstractFile = plugin.app.vault.getAbstractFileByPath(
    `${notebookPageId}.md`
  );
  if (abstractFile instanceof TFile) {
    return plugin.app.vault
      .modify(abstractFile, expectedText)
      .then(() => plugin.save());
  }
};

const calculateState = async (
  notebookPageId: string,
  plugin: SamePagePlugin
) => {
  const abstractFile = plugin.app.vault.getAbstractFileByPath(
    `${notebookPageId}.md`
  );
  const content =
    abstractFile instanceof TFile
      ? await plugin.app.vault.cachedRead(abstractFile)
      : "";

  return atJsonParser(leafGrammar, content);
};

export let granularChanges = { enabled: false };

const setupSharePageWithNotebook = (plugin: SamePagePlugin) => {
  const {
    unload,
    rejectPage,
    joinPage,
    isShared,
    updatePage,
    insertContent,
    deleteContent,
  } = loadSharePageWithNotebook({
    applyState: (id, state) => applyState(id, state, plugin),
    calculateState: (id) => calculateState(id, plugin),
    getCurrentNotebookPageId: async () =>
      plugin.app.workspace.getActiveFile()?.basename || "",
    loadState: async (notebookPageId) => {
      return new Uint8Array(plugin.data.pages[notebookPageId]);
    },
    saveState: (notebookPageId, state) => {
      plugin.data.pages[notebookPageId] = Array.from(state);
      return plugin.save();
    },
    removeState: (notebookPageId) => {
      delete plugin.data.pages[notebookPageId];
      return plugin.save();
    },
    overlayProps: {
      viewSharedPageProps: {
        onLinkClick: (title, e) => {
          if (e.shiftKey) {
            app.workspace.getLeaf("split", "vertical");
          } else {
            app.workspace.openLinkText(title, title);
          }
        },
        linkNewPage: (_, title) =>
          app.vault.create(title, "").then((f) => f.basename),
      },
      notificationContainerProps: {
        actions: {
          accept: ({ app, workspace, pageUuid, title }) =>
            plugin.app.vault
              .create(`${title}.md`, "")
              .then((file) =>
                joinPage({
                  pageUuid,
                  notebookPageId: file.basename,
                }).catch((e) => {
                  plugin.app.vault.delete(file);
                  return Promise.reject(e);
                })
              )
              .then(() => {
                const active = plugin.app.workspace.getActiveFile();
                if (active) {
                  active.vault.append(
                    active,
                    `\nAccepted page [[${title}]] from ${
                      apps[Number(app)].name
                    } / ${workspace}`
                  );
                }
              }),
          reject: async ({ title }) =>
            rejectPage({
              notebookPageId: title,
            }),
        },
        api: {
          addNotification: (n) => {
            plugin.data.notifications[n.uuid] = n;
            return plugin.save();
          },
          deleteNotification: (uuid) => {
            delete plugin.data.notifications[uuid];
            return plugin.save();
          },
          getNotifications: async () =>
            Object.values(plugin.data.notifications),
        },
      },
      sharedPageStatusProps: {
        selector: "div.view-header-title#text",
        getPath: (el) =>
          (el.parentElement &&
            el.parentElement.closest<HTMLElement>(
              ".view-header-title-container"
            )) ||
          null,
        getHtmlElement: async (title) =>
          Array.from(
            document.querySelectorAll<HTMLHeadingElement>(
              "div.view-header-title"
            )
          ).find((h) => h.textContent === title),
        getNotebookPageId: async (el) => el.nodeValue,
      },
    },
  });

  let refreshRef: EventRef | undefined;
  const clearRefreshRef = () => {
    if (refreshRef) {
      plugin.app.vault.offref(refreshRef);
      refreshRef = undefined;
    }
  };
  const previousSelection = {
    selectionStart: 0,
    selectionEnd: 0,
    blockStart: 0,
    blockEnd: 0,
  };
  const bodyListener = async (e: KeyboardEvent) => {
    const el = e.target as HTMLElement;
    const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      // no-op
    } else if (e.metaKey) {
      // no-op
    } else if (/^Arrow/.test(e.key)) {
      // no-op
    } else if (el.tagName === "DIV" && el.classList.contains("cm-content")) {
      const notebookPageId = plugin.app.workspace.getActiveFile()?.basename;
      if (notebookPageId && isShared(notebookPageId)) {
        clearRefreshRef();
        const { selectionStart, selectionEnd, blockStart, blockEnd } =
          previousSelection;
        const getBlockAnnotationStart = () => {
          const md = view.editor.getValue();
          const { annotations } = atJsonParser(leafGrammar, md);
          return (
            annotations.filter((b) => b.type === "block")[blockStart]?.start ||
            0
          );
        };
        if (granularChanges.enabled && /^[a-zA-Z0-9 ]$/.test(e.key)) {
          const start = getBlockAnnotationStart();
          (selectionStart !== selectionEnd
            ? deleteContent({
                notebookPageId,
                index: start + Math.min(selectionStart, selectionEnd),
                count: Math.abs(selectionEnd - selectionStart),
              })
            : Promise.resolve()
          ).then(() =>
            insertContent({
              notebookPageId,
              content: e.key,
              index: start + view.editor.getCursor().ch,
            })
          );
        } else if (granularChanges.enabled && /^Backspace$/.test(e.key)) {
          const index =
            getBlockAnnotationStart() + Math.min(selectionStart, selectionEnd);
          deleteContent({
            notebookPageId,
            index:
              selectionEnd === selectionStart && blockStart === blockEnd
                ? index - 1
                : index,
            count:
              selectionEnd === selectionStart && blockStart === blockEnd
                ? 1
                : Math.abs(selectionStart - selectionEnd),
          });
        } else {
          refreshRef = plugin.app.vault.on("modify", async () => {
            clearRefreshRef();
            const doc = await calculateState(notebookPageId, plugin);
            updatePage({
              notebookPageId,
              label: `Refresh`,
              callback: (oldDoc) => {
                oldDoc.content.deleteAt?.(0, oldDoc.content.length);
                oldDoc.content.insertAt?.(
                  0,
                  ...new Automerge.Text(doc.content)
                );
                if (!oldDoc.annotations) oldDoc.annotations = [];
                oldDoc.annotations.splice(0, oldDoc.annotations.length);
                doc.annotations.forEach((a) => oldDoc.annotations.push(a));
              },
            });
          });
        }
      }
    }
    if (view) {
      const [sel] = view.editor.listSelections();
      previousSelection.selectionStart = sel.head.ch;
      previousSelection.selectionEnd = sel.anchor.ch;
      previousSelection.blockEnd = sel.anchor.line;
      previousSelection.blockStart = sel.head.line;
    }
  };
  plugin.registerDomEvent(document.body, "keydown", bodyListener);
  return () => {
    clearRefreshRef();
    unload();
  };
};

export default setupSharePageWithNotebook;
