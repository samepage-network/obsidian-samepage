import moo from "moo";
import type { Annotation, InitialSchema } from "samepage/internal/types";
import { getSetting } from "samepage/internal/registry";
import atJsonParser, {
  combineAtJsons,
  createEmptyAtJson,
  createNullAtJson,
  createTextAtJson,
  head,
  URL_REGEX,
} from "./samePageUtils/atJsonParser";

const getLevel = (t?: moo.Token) => {
  if (!t) return 1;
  return t.text.split(/\t|    /).length;
};

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
    openDoubleTilde: { match: /~~(?=(?:[^~]|~[^~])*~~)/, lineBreaks: true },
    tab: { match: /(?:\t|    )/ },
    text: { match: /(?:[^~_*[\]\n\t!()`]|`(?!``)|``(?!`))+/, lineBreaks: true },
    paragraph: { match: /\n\n\t*(?!- |\d+\.)/, lineBreaks: true },
    newLine: { match: /\n/, lineBreaks: true },
    strike: "~~",
    boldUnder: "__",
    boldStar: "**",
    openUnder: /(?<!\w)_/,
    closeUnder: /_(?!\w)/,
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
  grammarRules: [
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
    { name: "additionalBlock", symbols: [], postprocess: createEmptyAtJson },
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
      name: "additionalBlock",
      symbols: ["additionalBlock", "additionalBlockType"],
      postprocess: combineAtJsons,
      preprocess: (ctx, dot) => {
        if (dot === 1) {
          return { ...ctx, flags: new Set() };
        }
        return ctx;
      },
    },
    {
      name: "main",
      symbols: ["firstBlock", "additionalBlock"],
      postprocess: combineAtJsons,
    },
    { name: "additionalToken", symbols: ["token"], postprocess: head },
    {
      name: "additionalToken",
      symbols: ["additionalToken", "token"],
      postprocess: combineAtJsons,
    },
    {
      name: "tokenStar",
      symbols: ["additionalToken"],
      postprocess: head,
    },
    { name: "tokenStar", symbols: [], postprocess: createEmptyAtJson },
    { name: "block", symbols: ["tokenStar"], postprocess: head },
    {
      name: "block",
      symbols: ["tokenStar", { type: "boldStar" }, "additionalToken"],
      postprocess: (data) => {
        const [first, token, second] = data as [
          InitialSchema,
          moo.Token,
          InitialSchema
        ];
        const bold: InitialSchema = {
          content: second.content,
          annotations: (
            [
              {
                type: "bold",
                start: 0,
                end: second.content.length,
                attributes: {
                  open: true,
                  delimiter: token.value,
                },
              },
            ] as InitialSchema["annotations"]
          ).concat(second.annotations),
        };
        return combineAtJsons([first, bold]);
      },
      preprocess: (ctx, dot) => {
        if (dot === 2 && ctx.flags.has("doubleStar")) return undefined;
        else if (dot === 2) {
          return {
            ...ctx,
            flags: new Set(Array.from(ctx.flags).concat("doubleStar")),
          };
        }
        return ctx;
      },
    },
    {
      name: "block",
      symbols: [
        "tokenStar",
        { type: "boldStar" },
        "additionalToken",
        { type: "star" },
      ],
      postprocess: (data) => {
        const [first, token, second] = data as [
          InitialSchema,
          moo.Token,
          InitialSchema,
          moo.Token
        ];
        const bold: InitialSchema = {
          content: `${second.content}*`,
          annotations: (
            [
              {
                type: "bold",
                start: 0,
                end: second.content.length + 1,
                attributes: {
                  open: true,
                  delimiter: token.value,
                },
              },
            ] as InitialSchema["annotations"]
          ).concat(second.annotations),
        };
        return combineAtJsons([first, bold]);
      },
      preprocess: (ctx, dot) => {
        if (dot === 2 && ctx.flags.has("doubleStar")) return undefined;
        else if (dot === 2) {
          return {
            ...ctx,
            flags: new Set(Array.from(ctx.flags).concat("doubleStar")),
          };
        }
        return ctx;
      },
    },
    {
      name: "block",
      symbols: ["tokenStar", { type: "boldStar" }],
      postprocess: (data) => {
        const [first] = data as [InitialSchema, moo.Token];
        const text: InitialSchema = {
          content: "**",
          annotations: [],
        };
        return combineAtJsons([first, text]);
      },
    },
    {
      name: "block",
      symbols: ["tokenStar", { type: "boldUnder" }, "additionalToken"],
      postprocess: (data) => {
        const [first, token, second] = data as [
          InitialSchema,
          moo.Token,
          InitialSchema
        ];
        const bold: InitialSchema = {
          content: second.content,
          annotations: (
            [
              {
                type: "bold",
                start: 0,
                end: second.content.length,
                attributes: {
                  open: true,
                  delimiter: token.value,
                },
              },
            ] as InitialSchema["annotations"]
          ).concat(second.annotations),
        };
        return combineAtJsons([first, bold]);
      },
      preprocess: (ctx, dot) => {
        if (dot === 2 && ctx.flags.has("doubleUnder")) return undefined;
        else if (dot === 2) {
          return {
            ...ctx,
            flags: new Set(Array.from(ctx.flags).concat("doubleUnder")),
          };
        }
        return ctx;
      },
    },
    {
      name: "block",
      symbols: ["tokenStar", { type: "boldUnder" }],
      postprocess: (data) => {
        const [first] = data as [InitialSchema, moo.Token];
        const text: InitialSchema = {
          content: "__",
          annotations: [],
        };
        return combineAtJsons([first, text]);
      },
    },
    {
      name: "block",
      symbols: ["tokenStar", { type: "star" }],
      postprocess: (data) => {
        const [first] = data as [InitialSchema, moo.Token];
        const text: InitialSchema = {
          content: "*",
          annotations: [],
        };
        return combineAtJsons([first, text]);
      },
    },
    {
      name: "block",
      symbols: ["tokenStar", { type: "under" }],
      postprocess: (data) => {
        const [first] = data as [InitialSchema, moo.Token];
        const text: InitialSchema = {
          content: "_",
          annotations: [],
        };
        return combineAtJsons([first, text]);
      },
    },
    {
      name: "block",
      symbols: ["tokenStar", { type: "star" }, "additionalToken"],
      postprocess: (data) => {
        const [first, token, second] = data as [
          InitialSchema,
          moo.Token,
          InitialSchema
        ];
        const bold: InitialSchema = {
          content: second.content,
          annotations: (
            [
              {
                type: "italics",
                start: 0,
                end: second.content.length,
                attributes: {
                  open: true,
                  delimiter: token.value,
                },
              },
            ] as InitialSchema["annotations"]
          ).concat(second.annotations),
        };
        return combineAtJsons([first, bold]);
      },
      preprocess: (ctx, dot) => {
        if (dot === 2 && ctx.flags.has("singleStar")) return undefined;
        else if (dot === 2) {
          return {
            ...ctx,
            flags: new Set(Array.from(ctx.flags).concat("singleStar")),
          };
        }
        return ctx;
      },
    },
    {
      name: "block",
      symbols: ["tokenStar", { type: "openUnder" }, "additionalToken"],
      postprocess: (data) => {
        const [first, token, second] = data as [
          InitialSchema,
          moo.Token,
          InitialSchema
        ];
        const bold: InitialSchema = {
          content: second.content,
          annotations: (
            [
              {
                type: "italics",
                start: 0,
                end: second.content.length,
                attributes: {
                  open: true,
                  delimiter: token.value,
                },
              },
            ] as InitialSchema["annotations"]
          ).concat(second.annotations),
        };
        return combineAtJsons([first, bold]);
      },
      preprocess: (ctx, dot) => {
        if (dot === 2 && ctx.flags.has("singleUnder")) return undefined;
        else if (dot === 2) {
          return {
            ...ctx,
            flags: new Set(Array.from(ctx.flags).concat("singleUnder")),
          };
        }
        return ctx;
      },
    },
    {
      name: "strikeBoundary",
      symbols: [{ type: "strike" }],
      postprocess: createEmptyAtJson,
    },
    {
      name: "strikeBoundary",
      symbols: [{ type: "openDoubleTilde" }],
      postprocess: createEmptyAtJson,
    },
    {
      name: "token",
      symbols: [
        { type: "openDoubleTilde" },
        "additionalToken",
        "strikeBoundary",
      ],
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
      name: "boldUnderExpression",
      symbols: ["additionalToken", { type: "boldUnder" }],
      postprocess: (d) => {
        const [first] = d as [InitialSchema, moo.Token];
        return first;
      },
      preprocess: (ctx, dot) => {
        if (dot === 2) {
          const flags = new Set(ctx.flags);
          flags.delete("doubleUnder");
          return { ...ctx, flags };
        }
        return ctx;
      },
    },
    {
      name: "boldUnderExpression",
      symbols: [
        "additionalToken",
        { type: "openUnder" },
        "additionalToken",
        { type: "boldUnder" },
      ],
      postprocess: (d) => {
        const [first, _, second] = d as [
          InitialSchema,
          moo.Token,
          InitialSchema,
          moo.Token
        ];
        return combineAtJsons([
          first,
          {
            content: second.content,
            annotations: (
              [
                {
                  type: "italics",
                  start: 0,
                  end: second.content.length,
                  attributes: { delimiter: "_", open: true },
                },
              ] as Annotation[]
            ).concat(second.annotations),
          },
        ]);
      },
      preprocess: (ctx, dot) => {
        if (dot === 4) {
          const flags = new Set(ctx.flags);
          flags.delete("doubleStar");
          return { ...ctx, flags };
        }
        if (dot === 2) {
          const flags = new Set(ctx.flags);
          flags.add("singleStar");
          return { ...ctx, flags };
        }
        return ctx;
      },
    },
    {
      name: "token",
      symbols: [{ type: "boldUnder" }, "boldUnderExpression"],
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
      preprocess: (ctx, dot) => {
        if (dot === 1 && ctx.flags.has("doubleUnder")) return undefined;
        else if (dot === 1) {
          const flags = new Set(ctx.flags);
          flags.add("doubleUnder");
          return { ...ctx, flags };
        }
        return ctx;
      },
    },
    {
      name: "boldStarExpression",
      symbols: ["additionalToken", { type: "boldStar" }],
      postprocess: (d) => {
        const [first] = d as [InitialSchema, moo.Token];
        return first;
      },
      preprocess: (ctx, dot) => {
        if (dot === 2) {
          const flags = new Set(ctx.flags);
          flags.delete("doubleStar");
          return { ...ctx, flags };
        }
        return ctx;
      },
    },
    {
      name: "boldStarExpression",
      symbols: [
        "additionalToken",
        { type: "star" },
        "additionalToken",
        { type: "boldStar" },
      ],
      postprocess: (d) => {
        const [first, _, second] = d as [
          InitialSchema,
          moo.Token,
          InitialSchema,
          moo.Token
        ];
        return combineAtJsons([
          first,
          {
            content: second.content,
            annotations: (
              [
                {
                  type: "italics",
                  start: 0,
                  end: second.content.length,
                  attributes: { delimiter: "*", open: true },
                },
              ] as Annotation[]
            ).concat(second.annotations),
          },
        ]);
      },
      preprocess: (ctx, dot) => {
        if (dot === 4) {
          const flags = new Set(ctx.flags);
          flags.delete("doubleStar");
          return { ...ctx, flags };
        }
        if (dot === 2) {
          const flags = new Set(ctx.flags);
          flags.add("singleStar");
          return { ...ctx, flags };
        }
        return ctx;
      },
    },
    {
      name: "token",
      symbols: [{ type: "boldStar" }, "boldStarExpression"],
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
      preprocess: (ctx, dot) => {
        if (dot === 1 && ctx.flags.has("doubleStar")) return undefined;
        else if (dot === 1) {
          const flags = new Set(ctx.flags);
          flags.add("doubleStar");
          return { ...ctx, flags };
        }
        return ctx;
      },
    },
    {
      name: "italicUnderExpression",
      symbols: ["additionalToken", { type: "closeUnder" }],
      postprocess: (d) => {
        const [first] = d as [InitialSchema, moo.Token];
        return first;
      },
      preprocess: (ctx, dot) => {
        if (dot === 2) {
          const flags = new Set(ctx.flags);
          flags.delete("singleUnder");
          return { ...ctx, flags };
        }
        return ctx;
      },
    },
    {
      name: "token",
      symbols: [{ type: "openUnder" }, "italicUnderExpression"],
      postprocess: (d) => {
        const [_, first] = d as [moo.Token, InitialSchema, InitialSchema];
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
      preprocess: (ctx, dot) => {
        if (dot === 1 && ctx.flags.has("singleUnder")) return undefined;
        else if (dot === 1) {
          const flags = new Set(ctx.flags);
          flags.add("singleUnder");
          return { ...ctx, flags };
        }
        return ctx;
      },
    },
    {
      name: "italicStarExpression",
      symbols: ["additionalToken", { type: "star" }],
      postprocess: (d) => {
        const [first] = d as [InitialSchema, moo.Token];
        return first;
      },
      preprocess: (ctx, dot) => {
        if (dot === 2) {
          const flags = new Set(ctx.flags);
          flags.delete("singleStar");
          return { ...ctx, flags };
        }
        return ctx;
      },
    },
    {
      name: "token",
      symbols: [{ type: "star" }, "italicStarExpression"],
      postprocess: (d) => {
        const [_, first] = d as [moo.Token, InitialSchema, InitialSchema];
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
      preprocess: (ctx, dot) => {
        if (dot === 1 && ctx.flags.has("singleStar")) return undefined;
        else if (dot === 1) {
          const flags = new Set(ctx.flags);
          flags.add("singleStar");
          return { ...ctx, flags };
        }
        return ctx;
      },
    },

    {
      name: "token",
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
        const content = _content || String.fromCharCode(0);
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
      name: "token",
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
        const content = _content || String.fromCharCode(0);
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
      name: "token",
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
      name: "imageAlias",
      symbols: ["additionalToken"],
      postprocess: head,
    },
    {
      name: "imageAlias",
      symbols: [],
      postprocess: createNullAtJson,
    },
    {
      name: "token",
      symbols: [
        { type: "exclamationMark" },
        { type: "leftBracket" },
        "imageAlias",
        { type: "rightBracket" },
        { type: "leftParen" },
        { type: "url" },
        { type: "rightParen" },
      ],
      postprocess: (_data) => {
        const data = _data as [
          moo.Token,
          moo.Token,
          InitialSchema,
          moo.Token,
          moo.Token,
          moo.Token,
          moo.Token
        ];
        const { content: _content, annotations = [] } = data[2] || {};
        const content = _content || String.fromCharCode(0);
        return {
          content,
          annotations: [
            {
              type: "image",
              start: 0,
              end: content.length,
              attributes: {
                src: data[5].text,
              },
            } as Annotation,
          ].concat(annotations),
        };
      },
    },
    {
      name: "token",
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
          content: String.fromCharCode(0),
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
      name: "token",
      symbols: ["textToken"],
      postprocess: head,
    },
    {
      name: "textToken",
      symbols: [{ type: "text" }],
      postprocess: createTextAtJson,
    },
    {
      name: "textToken",
      symbols: [{ type: "carot" }],
      postprocess: createTextAtJson,
    },
    {
      name: "textToken",
      symbols: [{ type: "tilde" }],
      postprocess: createTextAtJson,
    },
    {
      name: "textToken",
      symbols: [{ type: "strike" }],
      postprocess: createTextAtJson,
    },
    {
      name: "textToken",
      symbols: [{ type: "under" }],
      postprocess: createTextAtJson,
    },
    {
      name: "textToken",
      symbols: [{ type: "closeUnder" }],
      postprocess: (data, ctx, reject) =>
        ctx.flags.has("singleUnder") ? reject : createTextAtJson(data),
    },
    {
      name: "textToken",
      symbols: [{ type: "leftParen" }],
      postprocess: createTextAtJson,
    },
    {
      name: "textToken",
      symbols: [{ type: "leftBracket" }],
      postprocess: createTextAtJson,
    },
    {
      name: "textToken",
      symbols: [{ type: "rightParen" }],
      postprocess: createTextAtJson,
    },
    {
      name: "textToken",
      symbols: [{ type: "rightBracket" }],
      postprocess: createTextAtJson,
    },
    {
      name: "textToken",
      symbols: [{ type: "exclamationMark" }],
      postprocess: createTextAtJson,
    },
    {
      name: "token",
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
      name: "textToken",
      symbols: [{ type: "url" }],
      postprocess: createTextAtJson,
    },
    {
      name: "textToken",
      symbols: [{ type: "tab" }],
      postprocess: createTextAtJson,
    },
    {
      name: "textToken",
      symbols: [{ type: "newLine" }],
      postprocess: createTextAtJson,
    },
  ],
});

export default leafParser;
