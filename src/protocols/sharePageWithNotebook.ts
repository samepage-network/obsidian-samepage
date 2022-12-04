import type { Schema } from "samepage/internal/types";
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

const hashes: Record<number, string> = {};

const hashFn = (s: string) => sha256(s).toString();

const applyState = async (
  notebookPageId: string,
  state: Schema,
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
  const { unload, isShared, updatePage } = loadSharePageWithNotebook({
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
          )
            .map((el) =>
              (el.nodeName === "DIV" ? (el as HTMLElement) : el.parentElement)
                ?.closest(`.workspace-leaf-content`)
                ?.querySelector<HTMLDivElement>(
                  "div.view-header-title-container"
                )
            )
            .find((h) => h?.textContent === title) || undefined,
        getNotebookPageId: async (el) =>
          (el.nodeName === "DIV" ? (el as HTMLElement) : el.parentElement)
            ?.closest(`.workspace-leaf-content`)
            ?.querySelector(".view-header-title-container")?.textContent ||
          null,
      },
    },
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
        const doc = await calculateState(notebookPageId, plugin);
        updatePage({
          notebookPageId,
          label: "Modify",
          callback: (oldDoc) => {
            oldDoc.content.deleteAt?.(0, oldDoc.content.length);
            oldDoc.content.insertAt?.(0, ...new Automerge.Text(doc.content));
            if (!oldDoc.annotations) oldDoc.annotations = [];
            oldDoc.annotations.splice(0, oldDoc.annotations.length);
            doc.annotations.forEach((a) => oldDoc.annotations.push(a));
          },
        });
      }
    })
  );
  return unload;
};

export default setupSharePageWithNotebook;
