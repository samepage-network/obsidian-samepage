import setupNotebookQuerying from "samepage/protocols/notebookQuerying";
import { TFile } from "obsidian";
import type SamePagePlugin from "../main";
import createHTMLObserver from "samepage/utils/createHTMLObserver";
import ExternalNotebookReference from "../components/ExternalNotebookReference";
import renderOverlay from "../utils/renderOverlay";
import leafParser from "../utils/leafParser";

const setup = (plugin: SamePagePlugin) => {
  const { unload } = setupNotebookQuerying({
    onQuery: async (notebookPageId) => {
      const abstractFile = plugin.app.vault.getAbstractFileByPath(
        `${notebookPageId}.md`
      );
      const content =
        abstractFile instanceof TFile
          ? await plugin.app.vault.cachedRead(abstractFile)
          : "";
      return leafParser(content);
    },
    onQueryResponse: async ({ data, request }) => {
      document.body.dispatchEvent(
        new CustomEvent("samepage:reference:response", {
          detail: {
            request,
            data,
          },
        })
      );
    },
  });
  // can't use data attributes bc codemirror removes em
  const listeners: {
    el: HTMLSpanElement;
    listener: (e: MouseEvent) => void;
  }[] = [];
  const observer = createHTMLObserver<HTMLSpanElement>({
    callback: (s) => {
      const text = s.textContent;
      if (text && !listeners.some((l) => l.el === s)) {
        const [notebookUuid, notebookPageId] = text.split(":");
        if (notebookPageId) {
          const listener = (e: MouseEvent) => {
            renderOverlay({
              Overlay: ExternalNotebookReference,
              props: { notebookPageId, notebookUuid },
            });
            e.preventDefault();
            e.stopPropagation();
          };
          s.addEventListener("mousedown", listener);
          listeners.push({ listener, el: s });
        }
      }
    },
    selector: "span.cm-hmd-internal-link",
    onRemove: (s) => {
      const index = listeners.findIndex((l) => l.el === s);
      if (index >= 0) {
        s.removeEventListener("mousedown", listeners[index].listener);
        listeners.splice(index, 1);
      }
    },
    observeClassName: true,
  });
  return () => {
    observer.disconnect();
    unload();
  };
};

export default setup;
