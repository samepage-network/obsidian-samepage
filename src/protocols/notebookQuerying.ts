import atJsonParser from "samepage/utils/atJsonParser";
import leafGrammar from "../utils/leafGrammar";
import setupNotebookQuerying from "samepage/protocols/notebookQuerying";
import { TFile } from "obsidian";
import type SamePagePlugin from "../main";

const setup = (plugin: SamePagePlugin) => {
  const { unload, query } = setupNotebookQuerying({
    onQuery: async (notebookPageId) => {
      const abstractFile = plugin.app.vault.getAbstractFileByPath(
        `${notebookPageId}.md`
      );
      const content =
        abstractFile instanceof TFile
          ? await plugin.app.vault.cachedRead(abstractFile)
          : "";
      return atJsonParser(leafGrammar, content || "");
    },
    onQueryResponse: async ({ data, request }) => {
      document.body.dispatchEvent(
        new CustomEvent("samepage:reference", {
          detail: {
            request,
            data,
          },
        })
      );
    },
  });
  // how to show it?
  return () => {
    unload();
  };
};

export default setup;
