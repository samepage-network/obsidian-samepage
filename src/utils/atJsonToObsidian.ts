import { getSetting } from "samepage/internal/registry";
import type { InitialSchema } from "samepage/internal/types";
import renderAtJson from "samepage/utils/renderAtJson";

const atJsonToObsidian = (state: InitialSchema) => {
  const firstBlockIndex = state.annotations.findIndex(
    (a) => a.type === "block"
  );
  return renderAtJson({
    state: {
      annotations: state.annotations,
      content: state.content.toString(),
    },
    applyAnnotation: {
      bold: ({ content, attributes }) => {
        const validDelimiters = new Set(["**", "__"]);
        const delimiter = attributes?.delimiter || "**";
        const prefix = validDelimiters.has(delimiter) ? delimiter : "**";
        return {
          prefix,
          suffix: attributes?.open ? "" : prefix,
          replace: content === String.fromCharCode(0),
        };
      },
      italics: ({ content, attributes }) => {
        const validDelimiters = new Set(["*", "_"]);
        const delimiter = attributes?.delimiter || "**";
        const prefix = validDelimiters.has(delimiter) ? delimiter : "**";
        return ({
          prefix,
          suffix: attributes?.open ? "" : prefix,
          replace: content === String.fromCharCode(0),
        });
      },
      strikethrough: ({ content }) => ({
        prefix: "~~",
        suffix: `~~`,
        replace: content === String.fromCharCode(0),
      }),
      link: ({ attributes: { href }, content }) => ({
        prefix: "[",
        suffix: `](${href})`,
        replace: content === String.fromCharCode(0),
      }),
      image: ({ attributes: { src }, content }) => ({
        prefix: "![",
        suffix: `](${src})`,
        replace: content === String.fromCharCode(0),
      }),
      block: ({
        attributes: { level, viewType },
        content,
        index,
        appAttributes: { spacing } = {},
      }) => {
        const firstBlock = firstBlockIndex === index;
        return {
          suffix: content.replace(/\n$/, ""),
          prefix: `${firstBlock ? "" : "\n"}${
            firstBlock || viewType !== "document" ? "" : "\n"
          }${level === 1 ? "" : spacing || "".padStart(level - 1, "\t")}${
            viewType === "bullet" ? "- " : viewType === "numbered" ? "1. " : ""
          }`,
          replace: true,
        };
      },
      reference: ({
        attributes: { notebookPageId, notebookUuid },
        content,
      }) => ({
        prefix: "[[",
        suffix: `${
          notebookUuid === getSetting("uuid")
            ? notebookPageId
            : `${notebookUuid}:${notebookPageId}`
        }]]`,
        replace: content === String.fromCharCode(0),
      }),
      code: ({ attributes: { language, ticks = 3 } }) => {
        const ending = Array(ticks).fill("`").join("");
        return {
          prefix: `${ending}${language}\n`,
          suffix: ending,
        };
      },
    },
  });
};

export default atJsonToObsidian;
