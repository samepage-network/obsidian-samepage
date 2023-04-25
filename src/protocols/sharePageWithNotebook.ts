import type { SamePageSchema } from "samepage/internal/types";
import loadSharePageWithNotebook from "samepage/protocols/sharePageWithNotebook";
import type SamePagePlugin from "../main";
import { Keymap, MarkdownView, TFile } from "obsidian";
import { v4 } from "uuid";
import atJsonToObsidian from "../utils/atJsonToObsidian";
import sha256 from "crypto-js/sha256";
import { has as isShared } from "samepage/utils/localAutomergeDb";
import leafParser from "../utils/leafParser";

const hashes: Record<number, string> = {};
const hashFn = (s: string) => sha256(s).toString();

const applyState = async (
  notebookPageId: string,
  state: SamePageSchema,
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

  return leafParser(content);
};

const getCurrentNotebookPageId = (plugin: SamePagePlugin) =>
  (plugin.app.workspace.getActiveFile()?.path || "")?.replace(/\.md$/, "");

const sharedPagePaths: Record<string, string> = {};

const setupSharePageWithNotebook = (plugin: SamePagePlugin) => {
  const unloads: Record<string, (() => void) | undefined> = {};
  const { unload, refreshContent } = loadSharePageWithNotebook({
    decodeState: (id, state) => applyState(id, state.$body, plugin),
    encodeState: (id) =>
      calculateState(id, plugin).then(($body) => ({ $body })),
    getCurrentNotebookPageId: async () => getCurrentNotebookPageId(plugin),
    ensurePageByTitle: async (title) => {
      const notebookPageId = `${title.content}.md`;
      const exists = !!plugin.app.vault.getAbstractFileByPath(notebookPageId);
      if (exists) return { notebookPageId, preExisting: true };
      const pathParts = title.content.split("/");
      await Promise.all(
        pathParts.slice(0, -1).map((_, i, a) => {
          const path = a.slice(0, i + 1).join("/");
          if (!plugin.app.vault.getAbstractFileByPath(path)) {
            return plugin.app.vault.createFolder(path);
          }
        })
      );
      await plugin.app.vault.create(notebookPageId, "");
      return { notebookPageId, preExisting: false };
    },
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
          await active.leaf.openFile(newFile);
        } else {
          await app.workspace.openLinkText(title, title);
        }
      }
      return title;
    },
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
        getPaths: (notebookPageId) => {
          const leaf = plugin.app.workspace.getActiveViewOfType(MarkdownView);
          if (leaf && leaf.file.path.replace(/\.md/, "") === notebookPageId) {
            const sel = v4();
            leaf.containerEl.setAttribute("data-samepage-shared", sel);
            sharedPagePaths[sel] = notebookPageId;
            return [`div[data-samepage-shared="${sel}"] .cm-contentContainer`];
          }
          return [];
        },
        observer({ onload, onunload }) {
          const ref = plugin.app.workspace.on("active-leaf-change", (leaf) => {
            if (!leaf) return;
            const { view } = leaf;
            if (!(view instanceof MarkdownView)) return;
            const notebookPageId = view.file.path.replace(/\.md$/, "");
            const sel = view.containerEl.getAttribute("data-samepage-shared");
            if (sel) {
              const existingNotebookPageId = sharedPagePaths[sel];
              if (existingNotebookPageId === notebookPageId) return;
              if (existingNotebookPageId) onunload(existingNotebookPageId);
            }
            onload(notebookPageId);
          });
          return () => plugin.app.workspace.offref(ref);
        },
      },
    },
  });
  plugin.registerEvent(
    plugin.app.vault.on("modify", async (file) => {
      const notebookPageId = file.path.replace(/\.md$/, "");
      if (file instanceof TFile && (await isShared(notebookPageId))) {
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
  return () => {
    Object.values(unloads).forEach((u) => u?.());
    unload();
  };
};

export default setupSharePageWithNotebook;
