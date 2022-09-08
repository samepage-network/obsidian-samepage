import type { AppId, Schema } from "samepage/types";
import loadSharePageWithNotebook from "samepage/protocols/sharePageWithNotebook";
import atJsonParser from "samepage/utils/atJsonParser";
// @ts-ignore figure this out later - it compiles at least
import leafGrammar from "../utils/leafGrammar.ne";
import type SamePagePlugin from "../main";
import { TFile } from "obsidian";
import { setBlockUuidGenerator } from "../utils/leafLexer";
import { v4 } from "uuid";
import Automerge from "automerge";

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
        ? { suffix: "\n", prefix: "" }
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
    plugin.app.vault.modify(abstractFile, expectedText);
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
      ? await plugin.app.vault.read(abstractFile)
      : "";

  let needsSaving = false;
  setBlockUuidGenerator((index) => {
    const obsidianId = `${notebookPageId}~${index}`;
    const existingUuid = plugin.data.obsidianToSamepage[obsidianId];
    if (existingUuid) return existingUuid;
    needsSaving = true;
    const samepageUuid = v4();
    plugin.data.samepageToObsidian[samepageUuid] = obsidianId;
    plugin.data.obsidianToSamepage[obsidianId] = samepageUuid;
    return samepageUuid;
  });
  const schema = atJsonParser(leafGrammar, content);
  if (needsSaving) await plugin.save();
  return schema;
};

const setupSharePageWithNotebook = (plugin: SamePagePlugin) => {
  const { unload, rejectPage, joinPage, isShared, updatePage } =
    loadSharePageWithNotebook({
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
            accept: ({ app, workspace, pageUuid }) =>
              plugin.app.vault.create(pageUuid, "").then((file) =>
                joinPage({
                  pageUuid,
                  notebookPageId: file.basename,
                  source: { app: Number(app) as AppId, workspace },
                }).catch((e) => {
                  plugin.app.vault.delete(file);
                  return Promise.reject(e);
                })
              ),

            reject: async ({ workspace, app, pageUuid }) =>
              rejectPage({
                source: { app: Number(app) as AppId, workspace },
                pageUuid,
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

  let updateTimeout = 0;
  const bodyListener = async (e: KeyboardEvent) => {
    const el = e.target as HTMLElement;
    if (/^Arrow/.test(e.key)) return;
    if (el.tagName === "DIV" && el.classList.contains("cm-content")) {
      const notebookPageId =
        // el
        //   .closest("div.view-content")
        //   ?.parentElement?.querySelector(
        //     "div.view-header div.view-header-title"
        //   )?.textContent || "";
        plugin.app.workspace.getActiveFile()?.basename;
      if (notebookPageId && isShared(notebookPageId)) {
        window.clearTimeout(updateTimeout);
        updateTimeout = window.setTimeout(async () => {
          const doc = await calculateState(notebookPageId, plugin);
          updatePage({
            notebookPageId,
            label: `Refresh`,
            callback: (oldDoc) => {
              oldDoc.content.deleteAt?.(0, oldDoc.content.length);
              oldDoc.content.insertAt?.(0, ...new Automerge.Text(doc.content));
              if (!oldDoc.annotations) oldDoc.annotations = [];
              oldDoc.annotations.splice(0, oldDoc.annotations.length);
              doc.annotations.forEach((a) => oldDoc.annotations.push(a));
            },
          });
        }, 1000);
      }
    }
  };
  plugin.registerDomEvent(document.body, "keydown", bodyListener);
  return () => {
    window.clearTimeout(updateTimeout);
    unload();
  };
};

export default setupSharePageWithNotebook;
