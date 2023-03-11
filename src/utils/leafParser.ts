import moo from "moo";
import type { Annotation, InitialSchema } from "samepage/internal/types";
import { getSetting } from "samepage/internal/registry";
import atJsonParser, {
  combineAtJsons,
  createEmptyAtJson,
  createTextAtJson,
  head,
  URL_REGEX,
  NULL_TOKEN,
} from "samepage/utils/atJsonParser";

type Rule = Parameters<typeof atJsonParser>[0]["grammarRules"][number];

const getLevel = (t?: moo.Token) => {
  if (!t) return 1;
  return t.text.split(/\t|    /).length;
};

const baseRules: Rule[] = [
  {
    name: "initialParagraph",
    symbols: [],
    postprocess: () => ({
      content: "\n",
      annotations: [
        {
          type: "block",
          start: 0,
          end: 1,
          attributes: {
            level: 1,
            viewType: "document",
          },
        },
      ],
    }),
  },
  {
    name: "initialParagraph",
    symbols: ["initialParagraph", { type: "tab" }],
    postprocess: (d, _, reject) => {
      const [atJson] = d as [InitialSchema, moo.Token];
      const [block] = atJson.annotations;
      if (block.type !== "block") return reject;
      block.attributes.level++;
      return atJson;
    },
  },
  {
    name: "firstBlock",
    symbols: ["initialParagraph", "block"],
    postprocess: (d) => {
      const [initialAtJson, contentAtJson] = d as [
        InitialSchema,
        InitialSchema
      ];
      return {
        content: `${contentAtJson.content}${initialAtJson.content}`,
        annotations: initialAtJson.annotations
          .map((a) => ({
            ...a,
            end: a.end + contentAtJson.content.length,
          }))
          .concat(contentAtJson.annotations),
      };
    },
  },
  {
    name: "firstBlock",
    symbols: [{ type: "initialBullet" }, "block"],
    postprocess: (d) => {
      const [initialToken, contentAtJson] = d as [moo.Token, InitialSchema];
      return {
        content: `${contentAtJson.content}\n`,
        annotations: (
          [
            {
              type: "block",
              start: 0,
              end: contentAtJson.content.length + 1,
              attributes: {
                level: getLevel(initialToken),
                viewType: "bullet",
              },
            },
          ] as InitialSchema["annotations"]
        ).concat(contentAtJson.annotations),
      };
    },
  },
  {
    name: "firstBlock",
    symbols: [{ type: "initialNumbered" }, "block"],
    postprocess: (d) => {
      const [initialToken, contentAtJson] = d as [moo.Token, InitialSchema];
      return {
        content: `${contentAtJson.content}\n`,
        annotations: (
          [
            {
              type: "block",
              start: 0,
              end: contentAtJson.content.length + 1,
              attributes: {
                level: getLevel(initialToken),
                viewType: "numbered",
              },
            },
          ] as InitialSchema["annotations"]
        ).concat(contentAtJson.annotations),
      };
    },
  },
  { name: "additionalBlocks", symbols: [], postprocess: createEmptyAtJson },
  {
    name: "additionalBlockType",
    symbols: [{ type: "paragraph" }, "block"],
    postprocess: (d) => {
      const [initialToken, contentAtJson] = d as [moo.Token, InitialSchema];
      const level = getLevel(initialToken);
      return {
        content: `${contentAtJson.content}\n`,
        annotations: (
          [
            {
              type: "block",
              start: 0,
              end: contentAtJson.content.length + 1,
              attributes: {
                level,
                viewType: "document",
              },
              ...(level > 1
                ? {
                    appAttributes: {
                      obsidian: {
                        spacing: initialToken.text.replace(/^\n\n/s, ""),
                      },
                    },
                  }
                : undefined),
            },
          ] as InitialSchema["annotations"]
        ).concat(contentAtJson.annotations),
      };
    },
  },
  {
    name: "additionalBlockType",
    symbols: [{ type: "bullet" }, "block"],
    postprocess: (d) => {
      const [initialToken, contentAtJson] = d as [moo.Token, InitialSchema];
      const level = getLevel(initialToken);
      return {
        content: `${contentAtJson.content}\n`,
        annotations: (
          [
            {
              type: "block",
              start: 0,
              end: contentAtJson.content.length + 1,
              attributes: {
                level,
                viewType: "bullet",
              },
              ...(level > 1
                ? {
                    appAttributes: {
                      obsidian: {
                        spacing: initialToken.text
                          .replace(/^\n/s, "")
                          .replace(/- $/, ""),
                      },
                    },
                  }
                : undefined),
            },
          ] as InitialSchema["annotations"]
        ).concat(contentAtJson.annotations),
      };
    },
  },
  {
    name: "additionalBlockType",
    symbols: [{ type: "numbered" }, "block"],
    postprocess: (d) => {
      const [initialToken, contentAtJson] = d as [moo.Token, InitialSchema];
      const level = getLevel(initialToken);
      return {
        content: `${contentAtJson.content}\n`,
        annotations: (
          [
            {
              type: "block",
              start: 0,
              end: contentAtJson.content.length + 1,
              attributes: {
                level,
                viewType: "numbered",
              },
              ...(level > 1
                ? {
                    appAttributes: {
                      obsidian: {
                        spacing: initialToken.text
                          .replace(/^\n/s, "")
                          .replace(/\d+\. $/, ""),
                      },
                    },
                  }
                : undefined),
            },
          ] as InitialSchema["annotations"]
        ).concat(contentAtJson.annotations),
      };
    },
  },
  {
    name: "additionalBlocks",
    symbols: ["additionalBlockType", "additionalBlocks"],
    postprocess: combineAtJsons,
  },
  {
    name: "main",
    symbols: ["firstBlock", "additionalBlocks"],
    postprocess: combineAtJsons,
  },
  { name: "block", symbols: [], postprocess: createEmptyAtJson },
  { name: "block", symbols: ["blockElements"], postprocess: head },
  {
    name: "block",
    symbols: ["blockElements", "lastElement"],
    postprocess: combineAtJsons,
  },
  {
    name: "block",
    symbols: ["lastElement"],
    postprocess: head,
  },

  { name: "blockElements", symbols: ["blockElement"], postprocess: head },
  {
    name: "blockElements",
    symbols: ["blockElement", "blockElements"],
    postprocess: combineAtJsons,
  },

  {
    name: "blockElement",
    symbols: [{ type: "openUnder" }, "noCloseUnders", { type: "closeUnder" }],
    postprocess: (d) => {
      const [_, first] = d as [moo.Token, InitialSchema, moo.Token];
      return {
        content: first.content,
        annotations: (
          [
            {
              type: "italics",
              start: 0,
              end: first.content.length,
              attributes: {
                delimiter: "_",
              },
            },
          ] as InitialSchema["annotations"]
        ).concat(first.annotations),
      };
    },
  },
  {
    name: "lastElement",
    symbols: [{ type: "openUnder" }, "noCloseUnders"],
    postprocess: (d) => {
      const [_, first] = d as [moo.Token, InitialSchema];
      return {
        content: first.content,
        annotations: (
          [
            {
              type: "italics",
              start: 0,
              end: first.content.length,
              attributes: {
                delimiter: "_",
                open: true,
              },
            },
          ] as InitialSchema["annotations"]
        ).concat(first.annotations),
      };
    },
  },
  {
    name: "noCloseUnders",
    symbols: ["noCloseUnder", "noCloseUnders"],
    postprocess: combineAtJsons,
  },
  {
    name: "noCloseUnders",
    symbols: ["noCloseUnder"],
    postprocess: head,
  },
  {
    name: "blockElement",
    symbols: [{ type: "closeUnder" }],
    postprocess: createTextAtJson,
  },

  {
    name: "blockElement",
    symbols: [{ type: "star" }, "noStars", { type: "star" }],
    postprocess: (d) => {
      const [_, first] = d as [moo.Token, InitialSchema, moo.Token];
      return {
        content: first.content,
        annotations: (
          [
            {
              type: "italics",
              start: 0,
              end: first.content.length,
              attributes: {
                delimiter: "*",
              },
            },
          ] as InitialSchema["annotations"]
        ).concat(first.annotations),
      };
    },
  },
  {
    name: "noStars",
    symbols: ["noStar", "noStars"],
    postprocess: combineAtJsons,
  },
  {
    name: "noStars",
    symbols: ["noStar"],
    postprocess: head,
  },
  {
    name: "lastElement",
    symbols: [{ type: "star" }, "noStars"],
    postprocess: (data) => {
      const [_, first] = data as [moo.Token, InitialSchema];
      return {
        content: first.content,
        annotations: (
          [
            {
              type: "italics",
              start: 0,
              end: first.content.length,
              attributes: {
                delimiter: "*",
                open: true,
              },
            },
          ] as InitialSchema["annotations"]
        ).concat(first.annotations),
      };
    },
  },
  {
    name: "lastElement",
    symbols: [{ type: "star" }],
    postprocess: createTextAtJson,
  },

  {
    name: "blockElement",
    symbols: [{ type: "strike" }, "noStrikes", { type: "strike" }],
    postprocess: (d, _, reject) => {
      const data = d as [moo.Token, InitialSchema, moo.Token];
      const { content, annotations } = data[1];
      if (annotations.some((a) => a.type === "strikethrough")) {
        return reject;
      }
      return {
        content,
        annotations: [
          {
            type: "strikethrough",
            start: 0,
            end: content.length,
            attributes: {
              delimiter: "~~",
            },
          } as Annotation,
        ].concat(annotations),
      };
    },
  },
  {
    name: "noStrikes",
    symbols: ["noStrike", "noStrikes"],
    postprocess: combineAtJsons,
  },
  {
    name: "noStrikes",
    symbols: ["noStrike"],
    postprocess: head,
  },
  {
    name: "lastElement",
    symbols: [{ type: "strike" }, "noStrikes"],
    postprocess: (data) => {
      const [_, first] = data as [moo.Token, InitialSchema];
      return {
        content: first.content,
        annotations: (
          [
            {
              type: "strikethrough",
              start: 0,
              end: first.content.length,
              attributes: {
                delimiter: "~~",
                open: true,
              },
            },
          ] as InitialSchema["annotations"]
        ).concat(first.annotations),
      };
    },
  },
  {
    name: "lastElement",
    symbols: [{ type: "strike" }],
    postprocess: createTextAtJson,
  },

  {
    name: "blockElement",
    symbols: [{ type: "boldUnder" }, "noBoldUnders", { type: "boldUnder" }],
    postprocess: (d) => {
      const [_, first] = d as [moo.Token, InitialSchema, InitialSchema];
      return {
        content: first.content,
        annotations: (
          [
            {
              type: "bold",
              start: 0,
              end: first.content.length,
              attributes: {
                delimiter: "__",
              },
            },
          ] as InitialSchema["annotations"]
        ).concat(first.annotations),
      };
    },
  },
  {
    name: "noBoldUnders",
    symbols: ["noBoldUnder", "noBoldUnders"],
    postprocess: combineAtJsons,
  },
  {
    name: "noBoldUnders",
    symbols: ["noBoldUnder"],
    postprocess: head,
  },
  {
    name: "noBoldUnders",
    symbols: ["noBoldUnder", "noBoldUnderLast"],
    postprocess: combineAtJsons,
  },
  {
    name: "lastElement",
    symbols: [{ type: "boldUnder" }, "noBoldUnders"],
    postprocess: (data, __, reject) => {
      const [_, first] = data as [moo.Token, InitialSchema];
      if (first.content.includes("__")) return reject;
      return {
        content: first.content,
        annotations: (
          [
            {
              type: "bold",
              start: 0,
              end: first.content.length,
              attributes: {
                delimiter: "__",
                open: true,
              },
            },
          ] as InitialSchema["annotations"]
        ).concat(first.annotations),
      };
    },
  },
  {
    name: "lastElement",
    symbols: [{ type: "boldUnder" }],
    postprocess: createTextAtJson,
  },

  {
    name: "blockElement",
    symbols: [{ type: "boldStar" }, "noBoldStars", { type: "boldStar" }],
    postprocess: (d) => {
      const [_, first] = d as [moo.Token, InitialSchema, InitialSchema];
      return {
        content: first.content,
        annotations: (
          [
            {
              type: "bold",
              start: 0,
              end: first.content.length,
              attributes: {
                delimiter: "**",
              },
            },
          ] as InitialSchema["annotations"]
        ).concat(first.annotations),
      };
    },
  },
  {
    name: "noBoldStars",
    symbols: ["noBoldStar", "noBoldStars"],
    postprocess: combineAtJsons,
  },
  {
    name: "noBoldStars",
    symbols: ["noBoldStar"],
    postprocess: head,
  },
  {
    name: "noBoldStars",
    symbols: ["noBoldStar", "noBoldStarLast"],
    postprocess: combineAtJsons,
  },
  {
    name: "lastElement",
    symbols: [{ type: "boldStar" }, "noBoldStars"],
    postprocess: (data, __, reject) => {
      const [_, first] = data as [moo.Token, InitialSchema];
      if (first.content.includes("**")) return reject;
      return {
        content: first.content,
        annotations: (
          [
            {
              type: "bold",
              start: 0,
              end: first.content.length,
              attributes: {
                delimiter: "**",
                open: true,
              },
            },
          ] as InitialSchema["annotations"]
        ).concat(first.annotations),
      };
    },
  },
  {
    name: "lastElement",
    symbols: [{ type: "boldStar" }],
    postprocess: createTextAtJson,
  },
  // CONTINUE HERE

  {
    name: "blockElement",
    symbols: [{ type: "alias" }],
    postprocess: (data) => {
      const [{ value }] = data as [moo.Token];
      const arr = /\[([^\]]*)\]\(([^\)]*)\)/.exec(value);
      if (!arr) {
        return {
          content: "",
          annotations: [],
        };
      }
      const [_, _content, href] = arr;
      const content = _content || NULL_TOKEN;
      return {
        content,
        annotations: [
          {
            start: 0,
            end: content.length,
            type: "link",
            attributes: {
              href,
            },
          },
        ],
      };
    },
  },
  {
    name: "blockElement",
    symbols: [{ type: "asset" }],
    postprocess: (data) => {
      const [{ value }] = data as [moo.Token];
      const arr = /!\[([^\]]*)\]\(([^\)]*)\)/.exec(value);
      if (!arr) {
        return {
          content: "",
          annotations: [],
        };
      }
      const [_, _content, src] = arr;
      const content = _content || NULL_TOKEN;
      return {
        content,
        annotations: [
          {
            start: 0,
            end: content.length,
            type: "image",
            attributes: {
              src,
            },
          },
        ],
      };
    },
  },
  {
    name: "blockElement",
    symbols: [{ type: "codeBlock" }],
    postprocess: (data) => {
      const { value } = (data as [moo.Token])[0];
      const match = /^(`{3,})([\w -]*)\n/.exec(value);
      const ticks =
        match?.[1]?.length && match?.[1]?.length > 3
          ? match?.[1]?.length
          : undefined;
      const language = match?.[2] || "";
      const content = value
        .replace(/^`{3,}[\w -]*\n/, "")
        .replace(/`{3,}$/, "");
      return {
        content,
        annotations: [
          {
            start: 0,
            end: content.length,
            type: "code",
            attributes: {
              language,
              ticks,
            },
          },
        ],
      };
    },
  },
  {
    name: "blockElement",
    symbols: [{ type: "reference" }],
    postprocess: (_data) => {
      const [token] = _data as [moo.Token];
      const value = token.value.slice(2, -2);
      const parsedNotebookUuid = value.match(
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}:/
      )?.[0];
      const notebookUuid = parsedNotebookUuid
        ? parsedNotebookUuid.slice(0, -1)
        : getSetting("uuid");
      const notebookPageId = parsedNotebookUuid
        ? value.slice(parsedNotebookUuid.length)
        : value;
      return {
        content: NULL_TOKEN,
        annotations: [
          {
            type: "reference",
            start: 0,
            end: 1,
            attributes: {
              notebookPageId,
              notebookUuid,
            },
          },
        ],
      };
    },
  },
  {
    name: "blockElement",
    symbols: [{ type: "text" }],
    postprocess: createTextAtJson,
  },
  {
    name: "blockElement",
    symbols: [{ type: "carot" }],
    postprocess: createTextAtJson,
  },
  {
    name: "blockElement",
    symbols: [{ type: "tilde" }],
    postprocess: createTextAtJson,
  },
  {
    name: "blockElement",
    symbols: [{ type: "under" }],
    postprocess: createTextAtJson,
  },
  {
    name: "blockElement",
    symbols: [{ type: "leftParen" }],
    postprocess: createTextAtJson,
  },
  {
    name: "blockElement",
    symbols: [{ type: "leftBracket" }],
    postprocess: createTextAtJson,
  },
  {
    name: "blockElement",
    symbols: [{ type: "rightParen" }],
    postprocess: createTextAtJson,
  },
  {
    name: "blockElement",
    symbols: [{ type: "rightBracket" }],
    postprocess: createTextAtJson,
  },
  {
    name: "blockElement",
    symbols: [{ type: "exclamationMark" }],
    postprocess: createTextAtJson,
  },
  {
    name: "blockElement",
    symbols: [
      { type: "leftBracket" },
      { type: "rightBracket" },
      { type: "leftParen" },
      { type: "url" },
      { type: "rightParen" },
    ],
    postprocess: createTextAtJson,
  },
  {
    name: "blockElement",
    symbols: [{ type: "url" }],
    postprocess: createTextAtJson,
  },
  {
    name: "blockElement",
    symbols: [{ type: "tab" }],
    postprocess: createTextAtJson,
  },
  {
    name: "blockElement",
    symbols: [{ type: "newLine" }],
    postprocess: createTextAtJson,
  },
];

const noCloseUnderRules = baseRules
  .filter((b) => {
    const [symbol] = b.symbols;
    return (
      (b.name === "blockElement" || b.name === "lastElement") &&
      (typeof symbol !== "object" ||
        (symbol.type !== "closeUnder" && symbol.type !== "openUnder"))
    );
  })
  .map((r) => ({ ...r, name: "noCloseUnder" }));
const noStarRules = baseRules
  .filter((b) => {
    const [symbol] = b.symbols;
    return (
      (b.name === "blockElement" || b.name === "lastElement") &&
      (typeof symbol !== "object" || symbol.type !== "star")
    );
  })
  .map((r) => ({ ...r, name: "noStar" }));
const noStrikeRules = baseRules
  .filter((b) => {
    const [symbol] = b.symbols;
    return (
      (b.name === "blockElement" || b.name === "lastElement") &&
      (typeof symbol !== "object" || symbol.type !== "strike")
    );
  })
  .map((r) => ({ ...r, name: "noStrike" }));
const noBoldUnderRules = baseRules
  .filter((b) => {
    const [symbol] = b.symbols;
    return (
      (b.name === "blockElement" || b.name === "lastElement") &&
      (typeof symbol !== "object" || symbol.type !== "boldUnder")
    );
  })
  .map((r) => ({
    ...r,
    name: r.name === "blockElement" ? "noBoldUnder" : "noBoldUnderLast",
  }));
const noBoldStarRules = baseRules
  .filter((b) => {
    const [symbol] = b.symbols;
    return (
      (b.name === "blockElement" || b.name === "lastElement") &&
      (typeof symbol !== "object" || symbol.type !== "boldStar")
    );
  })
  .map((r) => ({
    ...r,
    name: r.name === "blockElement" ? "noBoldStar" : "noBoldStarLast",
  }));
const grammarRules = baseRules
  .concat(noStrikeRules)
  .concat(noStarRules)
  .concat(noBoldUnderRules)
  .concat(noBoldStarRules)
  .concat(noCloseUnderRules);

const leafParser = atJsonParser({
  lexerRules: {
    alias: /\[[^\]]*\]\([^\)]*\)/,
    asset: /!\[[^\]]*\]\([^\)]*\)/,
    url: URL_REGEX,
    reference: /\[\[[^\]]+\]\]/,
    initialBullet: { match: /^(?:\t|    )*- /, lineBreaks: true },
    initialNumbered: { match: /^(?:\t|    )*\d+\. /, lineBreaks: true },
    bullet: { match: /\n(?:\t|    )*- /, lineBreaks: true },
    numbered: { match: /\n(?:\t|    )*\d+\. /, lineBreaks: true },
    codeBlock: {
      match: /`{3,}[\w -]*\n(?:[^`]|`(?!``)|``(?!`))*`{3,}/,
      lineBreaks: true,
    },
    tab: { match: /(?:\t|    )/ },
    text: { match: /(?:[^~_*[\]\n\t!()`]|`(?!``)|``(?!`))+/, lineBreaks: true },
    paragraph: { match: /\n\n\t*(?!- |\d+\.)/, lineBreaks: true },
    newLine: { match: /\n/, lineBreaks: true },
    strike: "~~",
    boldUnder: "__",
    boldStar: "**",
    openUnder: /(?:(?<=\s)|^)_(?!\s)/,
    closeUnder: /(?<!\s)_(?:(?=\s)|$)/,
    star: /\*/,
    tilde: "~",
    carot: "^",
    under: "_",
    leftBracket: "[",
    leftParen: "(",
    rightBracket: "]",
    rightParen: ")",
    exclamationMark: "!",
  },
  grammarRules,
});

export default leafParser;
