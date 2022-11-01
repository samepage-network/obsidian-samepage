import type { InitialSchema } from "samepage/internal/types";
import renderAtJson from "samepage/utils/renderAtJson";
import type { default as SamePagePlugin } from "../main";

const atJsonToObsidian = (state: InitialSchema, plugin: SamePagePlugin) =>
  renderAtJson({
    state: {
      annotations: state.annotations,
      content: state.content.toString(),
    },
    applyAnnotation: {
      bold: {
        prefix: "**",
        suffix: `**`,
      },
      italics: {
        prefix: "_",
        suffix: `_`,
      },
      strikethrough: {
        prefix: "~~",
        suffix: `~~`,
      },
      link: ({ href }) => ({
        prefix: "[",
        suffix: `](${href})`,
      }),
      image: ({ src }, content) => ({
        prefix: "![",
        suffix: `](${src})`,
        replace: content === String.fromCharCode(0),
      }),
      block: ({ level, viewType }) => ({
        suffix: viewType === "document" ? "\n" : "",
        prefix: `${"".padStart(level - 1, "\t")}${
          viewType === "bullet" ? "- " : viewType === "numbered" ? "1. " : ""
        }`,
      }),
      reference: ({ notebookPageId, notebookUuid }, content) => ({
        prefix: "[[",
        suffix: `${
          notebookUuid === plugin.data.settings["uuid"]
            ? notebookPageId
            : `${notebookUuid}:${notebookPageId}`
        }]]`,
        replace: content === String.fromCharCode(0),
      }),
    },
  });

export default atJsonToObsidian;
