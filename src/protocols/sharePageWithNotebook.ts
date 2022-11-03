import type { Schema } from "samepage/internal/types";
import loadSharePageWithNotebook from "samepage/protocols/sharePageWithNotebook";
import atJsonParser from "samepage/utils/atJsonParser";
// @ts-ignore figure this out later - it compiles at least
import leafGrammar from "../utils/leafGrammar.ne";
import type SamePagePlugin from "../main";
import { EventRef, MarkdownView, TFile } from "obsidian";
import Automerge from "automerge";
import { v4 } from "uuid";
import renderAtJson from "samepage/utils/renderAtJson";
import atJsonToObsidian from "../utils/atJsonToObsidian";

const applyState = async (
  notebookPageId: string,
  state: Schema,
  plugin: SamePagePlugin
) => {
  const expectedText = atJsonToObsidian(
    {
      content: state.content.toString(),
      annotations: state.annotations,
    },
    plugin
  );
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
  const { unload, isShared, updatePage, insertContent, deleteContent } =
    loadSharePageWithNotebook({
      applyState: (id, state) => applyState(id, state, plugin),
      calculateState: (id) => calculateState(id, plugin),
      getCurrentNotebookPageId: async () =>
        plugin.app.workspace.getActiveFile()?.basename || "",
      createPage: (title) => plugin.app.vault.create(`${title}.md`, ""),
      deletePage: async (title) => {
        const newFile = plugin.app.vault.getAbstractFileByPath(`${title}.md`);
        if (newFile instanceof TFile) {
          return plugin.app.vault.delete(newFile);
        }
      },
      openPage: async (title) => {
        const active = plugin.app.workspace.getActiveViewOfType(MarkdownView);
        const newFile = plugin.app.vault.getAbstractFileByPath(`${title}.md`);
        if (newFile instanceof TFile) {
          if (active) {
            return active.leaf.openFile(newFile);
          } else {
            return plugin.app.workspace.revealLeaf;
          }
        }
      },
      doesPageExist: async (title) =>
        !!plugin.app.vault.getAbstractFileByPath(`${title}.md`),
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
        sharedPageStatusProps: {
          selector: ".workspace-leaf div.inline-title",
          getPath: (el) => {
            const workleafRoot =
              el.parentElement &&
              el.parentElement.closest<HTMLElement>(".workspace-leaf");
            if (workleafRoot) {
              const sel = v4();
              workleafRoot.setAttribute("data-samepage-shared", sel);
              return `div[data-samepage-shared="${sel}"] .cm-contentContainer`;
            }
            return null;
          },
          getHtmlElement: async (title) =>
            Array.from(
              document.querySelectorAll<HTMLHeadingElement>(
                ".workspace-leaf div.inline-title"
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
  const refreshState = (notebookPageId: string) => {
    refreshRef = plugin.app.vault.on("modify", async () => {
      clearRefreshRef();
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
    });
  };
  const previousSelection = {
    selectionStart: 0,
    selectionEnd: 0,
    blockStart: 0,
    blockEnd: 0,
  };
  const bodyKeyDownListener = async (e: KeyboardEvent) => {
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
          refreshState(notebookPageId);
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
  plugin.registerDomEvent(document.body, "keydown", bodyKeyDownListener);
  const bodyPasteListener = (e: ClipboardEvent) => {
    const el = e.target as HTMLElement;
    const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      // no-op
    } else if (el.tagName === "DIV" && el.classList.contains("cm-content")) {
      const notebookPageId = plugin.app.workspace.getActiveFile()?.basename;
      if (notebookPageId && isShared(notebookPageId)) {
        clearRefreshRef();
        refreshState(notebookPageId);
      }
    }
  };
  plugin.registerDomEvent(document.body, "paste", bodyPasteListener);
  return () => {
    clearRefreshRef();
    unload();
  };
};

export default setupSharePageWithNotebook;
