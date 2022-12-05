import type {
  Annotation,
  InitialSchema,
  Schema,
} from "samepage/internal/types";
import loadSharePageWithNotebook from "samepage/protocols/sharePageWithNotebook";
import atJsonParser from "samepage/utils/atJsonParser";
// @ts-ignore figure this out later - it compiles at least
import leafGrammar from "../utils/leafGrammar.ne";
import type SamePagePlugin from "../main";
import { EventRef, Keymap, MarkdownView, TFile } from "obsidian";
import Automerge from "automerge";
import { v4 } from "uuid";
import atJsonToObsidian from "../utils/atJsonToObsidian";
import sha256 from "crypto-js/sha256";
import { has as isShared } from "samepage/utils/localAutomergeDb";
import { renderOverlay } from "samepage/internal/registry";
import SharedPageStatus from "samepage/components/SharedPageStatus";

const hashes: Record<number, string> = {};

const hashFn = (s: string) => sha256(s).toString();

const applyState = async (
  notebookPageId: string,
  state: InitialSchema,
  plugin: SamePagePlugin
) => {
  const expectedText = atJsonToObsidian({
    content: state.content.toString(),
    annotations: state.annotations,
  });
  const abstractFile = plugin.app.vault.getAbstractFileByPath(
    `${notebookPageId}.md`
  );
  if (abstractFile instanceof TFile) {
    const hash = hashFn(expectedText);
    const mtime = new Date().valueOf();
    hashes[mtime] = hash;
    return plugin.app.vault
      .modify(abstractFile, expectedText, { mtime })
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

const getCurrentNotebookPageId = (plugin: SamePagePlugin) =>
  (plugin.app.workspace.getActiveFile()?.path || "")?.replace(/\.md$/, "");

const setupSharePageWithNotebook = (plugin: SamePagePlugin) => {
  const { unload, refreshContent } = loadSharePageWithNotebook({
    applyState: (id, state) => applyState(id, state, plugin),
    calculateState: (id) => calculateState(id, plugin),
    getCurrentNotebookPageId: async () => getCurrentNotebookPageId(plugin),
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
          return app.workspace.openLinkText(title, title);
        }
      }
    },
    doesPageExist: async (title) =>
      !!plugin.app.vault.getAbstractFileByPath(`${title}.md`),
    overlayProps: {
      viewSharedPageProps: {
        onLinkClick: (title, e) => {
          if (e.shiftKey) {
            app.workspace.getLeaf(Keymap.isModEvent(e));
          } else {
            app.workspace.openLinkText(title, title);
          }
        },
        linkNewPage: (_, title) =>
          app.vault.create(title, "").then((f) => f.path.replace(/\.md$/, "")),
      },
      sharedPageStatusProps: {
        ignoreObserver: true,
        getPath: (el) => {
          if (el) {
            const sel = v4();
            (el as HTMLElement).setAttribute("data-samepage-shared", sel);
            return `div[data-samepage-shared="${sel}"] .cm-contentContainer`;
          }
          return null;
        },
        getHtmlElement: async () =>
          plugin.app.workspace.getActiveViewOfType(MarkdownView)?.containerEl,
      },
    },
  });
  plugin.app.workspace.on("file-open", (tfile) => {
    if (!tfile) return;
    const notebookPageId = tfile.path.replace(/\.md$/, "");
    if (isShared(notebookPageId)) {
      const workleaf = plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (workleaf && workleaf.file.path === tfile.path) {
        const sel = v4();
        workleaf.containerEl.setAttribute("data-samepage-shared", sel);

        renderOverlay({
          id: `samepage-shared-${notebookPageId.replace(/[^\w_-]/g, "")}`,
          Overlay: SharedPageStatus,
          props: {
            notebookPageId,
          },
          path: `div[data-samepage-shared="${sel}"] .cm-contentContainer`,
        });
      }
    }
  });
  plugin.registerEvent(
    plugin.app.vault.on("modify", async (file) => {
      const notebookPageId = file.path.replace(/\.md$/, "");
      if (file instanceof TFile && isShared(notebookPageId)) {
        if (
          hashes[file.stat.mtime] ===
          hashFn(await plugin.app.vault.cachedRead(file))
        ) {
          delete hashes[file.stat.mtime];
          return;
        }
        refreshContent({ notebookPageId });
      }
    })
  );
  return unload;
};

export default setupSharePageWithNotebook;
