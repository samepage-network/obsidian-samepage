import moo from "moo";
import { DEFAULT_TOKENS } from "samepage/utils/atJsonTokens";
import type { Annotation, InitialSchema } from "samepage/internal/types";
import sendExtensionError from "samepage/internal/sendExtensionError";
import { getSetting } from "samepage/internal/registry";

type LiteralData = moo.Token | Symbol | InitialSchema;
type Data = LiteralData | Data[];
type Context = { flags: Set<string>; index: number };
type PostProcess = (d: Data, context: Context, reject: Symbol) => Data;

const lexer = moo.compile({
  alias: /\[[^\]]*\]\([^\)]*\)/,
  asset: /!\[[^\]]*\]\([^\)]*\)/,
  url: DEFAULT_TOKENS.url,
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
});

const reject = Symbol("reject");

const createNull: PostProcess = () => ({
  content: String.fromCharCode(0),
  annotations: [],
});

const createEmpty: PostProcess = () => ({
  content: "",
  annotations: [],
});

const getLevel = (t?: moo.Token | moo.Token[]) => {
  if (!t) return 1;
  if (Array.isArray(t)) return t.length + 1;
  return t.text.split(/\t|    /).length;
};

const createTextToken = (_data: Data) => {
  const data = _data as moo.Token[];
  return {
    content: data.map((d) => d.text).join(""),
    annotations: [],
  };
};

const combineAtJsons = (d: Data) => {
  const [first, second] = d as [InitialSchema, InitialSchema];
  return {
    content: `${first.content}${second.content}`,
    annotations: first.annotations.concat(
      second.annotations.map((a) => ({
        ...a,
        start: a.start + first.content.length,
        end: a.end + first.content.length,
      }))
    ),
  };
};

const head: PostProcess = (d) => (Array.isArray(d) ? d[0] : d);

type PreProcess = (ctx: Context, dot: number) => Context | undefined;
type RuleSymbol = string | { type: string };
type Rule = {
  name: string;
  symbols: RuleSymbol[];
  postprocess?: PostProcess;
  preprocess?: PreProcess;
};

const getSymbolDisplay = (symbol: RuleSymbol) => {
  if (typeof symbol === "string") return symbol;
  else return `%${symbol.type}`;
};

const newContext = (index: number): Context => ({
  index,
  flags: new Set(),
});

type State = {
  rule?: Rule;
  dot?: number;
  context: Context;
  data: Data;
  wantedBy?: State[];
  isComplete?: boolean;
  left?: State;
  right?: State;
  source: string;
  id: number;
};

const ruleToString = (state: State) => {
  const symbolSequence =
    typeof state.dot === "undefined"
      ? (state.rule?.symbols || []).map(getSymbolDisplay).join(" ")
      : (state.rule?.symbols || [])
          .slice(0, state.dot)
          .map(getSymbolDisplay)
          .join(" ") +
        " ● " +
        (state.rule?.symbols || [])
          .slice(state.dot)
          .map(getSymbolDisplay)
          .join(" ");
  return `${state.rule?.name} → ${symbolSequence}`;
};

// Symbol[string] => InitialSchema
// Symbol[{type: string}] => moo.Token
const rules: Rule[] = [
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
  { name: "additionalBlock", symbols: [], postprocess: createEmpty },
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
  { name: "tokenStar", symbols: [], postprocess: createEmpty },
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
    postprocess: createEmpty,
  },
  {
    name: "strikeBoundary",
    symbols: [{ type: "openDoubleTilde" }],
    postprocess: createEmpty,
  },
  {
    name: "token",
    symbols: [{ type: "openDoubleTilde" }, "additionalToken", "strikeBoundary"],
    postprocess: (d) => {
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
    postprocess: createNull,
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
    postprocess: createTextToken,
  },
  {
    name: "textToken",
    symbols: [{ type: "carot" }],
    postprocess: createTextToken,
  },
  {
    name: "textToken",
    symbols: [{ type: "tilde" }],
    postprocess: createTextToken,
  },
  {
    name: "textToken",
    symbols: [{ type: "strike" }],
    postprocess: createTextToken,
  },
  {
    name: "textToken",
    symbols: [{ type: "under" }],
    postprocess: createTextToken,
  },
  {
    name: "textToken",
    symbols: [{ type: "closeUnder" }],
    postprocess: (data, ctx, reject) =>
      ctx.flags.has("singleUnder") ? reject : createTextToken(data),
  },
  {
    name: "textToken",
    symbols: [{ type: "leftParen" }],
    postprocess: createTextToken,
  },
  {
    name: "textToken",
    symbols: [{ type: "leftBracket" }],
    postprocess: createTextToken,
  },
  {
    name: "textToken",
    symbols: [{ type: "rightParen" }],
    postprocess: createTextToken,
  },
  {
    name: "textToken",
    symbols: [{ type: "rightBracket" }],
    postprocess: createTextToken,
  },
  {
    name: "textToken",
    symbols: [{ type: "exclamationMark" }],
    postprocess: createTextToken,
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
    postprocess: createTextToken,
  },
  {
    name: "textToken",
    symbols: [{ type: "url" }],
    postprocess: createTextToken,
  },
  {
    name: "textToken",
    symbols: [{ type: "tab" }],
    postprocess: createTextToken,
  },
  {
    name: "textToken",
    symbols: [{ type: "newLine" }],
    postprocess: createTextToken,
  },
];

const leafParser = (
  content: string,
  opts: { debug?: true } = {}
): InitialSchema => {
  // This is based on nearley, unrolled
  const buffer = lexer.reset(content);
  let stateIdGen = 0;
  const newState = ({
    rule,
    dot,
    context,
    wantedBy,
    source,
  }: {
    rule?: Rule;
    dot?: number;
    context: Context;
    wantedBy: State[];
    source: string;
  }): State => ({
    rule,
    dot,
    context,
    data: [],
    wantedBy,
    isComplete: dot === rule?.symbols.length,
    source,
    id: stateIdGen++,
  });
  type Column = {
    index: number;
    states: State[];
    wants: Record<string, State[]>; // states indexed by the non-terminal they expect
    scannable: State[]; // list of states that expect a token
    completed: Record<string, State[]>; // states that are nullable
  };
  const newColumn = (index: number, wants: Column["wants"] = {}): Column => ({
    index,
    states: [],
    wants,
    scannable: [],
    completed: {},
  });
  const getExp = (s: State) => {
    if (!s.rule) throw new Error("Failed to get rule from state");
    if (typeof s.dot === "undefined")
      throw new Error("Failed to get dot from state");
    return s.rule.symbols[s.dot] || "";
  };
  const grammar: { rules: Rule[]; start: string } = {
    rules,
    start: "main",
  };
  const grammarRulesByName: Record<string, Rule[]> = {};
  grammar.rules.forEach((r) => {
    grammarRulesByName[r.name] = (grammarRulesByName[r.name] || []).concat(r);
  });
  const predict = (col: Column, ruleName: string, context: Context) => {
    const rules = grammarRulesByName[ruleName] || [];
    rules.forEach((rule) => {
      const wantedBy = col.wants[ruleName];
      const s = newState({
        rule,
        dot: 0,
        context: {
          ...context,
          index: col.index,
        },
        wantedBy,
        source: `predict - ${ruleName}`,
      });
      col.states.push(s);
    });
  };
  const completeColumn = (col: Column, left: State, right: State) => {
    const copy = nextState(left, right, "completion");
    if (copy) col.states.push(copy);
  };
  const processColumn = (col: Column) => {
    const { states, wants, completed } = col;
    for (var w = 0; w < states.length; w++) {
      // we push() during iteration
      const state = states[w];

      if (state.isComplete) {
        if (state.rule?.postprocess) {
          state.data = state.rule.postprocess(
            state.data,
            state.context,
            reject
          );
        }
        if (state.data !== reject) {
          (state.wantedBy || []).forEach((s) => completeColumn(col, s, state));

          if (state.context.index === col.index) {
            const exp = state.rule?.name;
            if (exp)
              (col.completed[exp] = col.completed[exp] || []).push(state);
          }
        }
      } else {
        const exp = getExp(state);
        if (typeof exp === "object") {
          col.scannable.push(state);
          continue;
        }

        if (wants[exp]) {
          wants[exp].push(state);
          (completed[exp] || []).forEach((right) =>
            completeColumn(col, state, right)
          );
        } else {
          wants[exp] = [state];
          predict(col, exp, state.context);
        }
      }
    }
  };
  const buildFromState = (state: State) => {
    const children: Data[] = [];
    let node: State | undefined = state;
    do {
      children.push(node.right!.data);
      node = node.left;
    } while (node?.left && node.right);
    children.reverse();
    return children;
  };
  const nextState = (
    state: State,
    child: State,
    source: string
  ): State | undefined => {
    const nextDot = typeof state.dot === "number" ? state.dot + 1 : 1;
    const context = state.rule?.preprocess
      ? state.rule.preprocess(state.context, nextDot)
      : { ...state.context };
    if (!context) return undefined;
    const next = newState({
      rule: state.rule,
      dot: nextDot,
      context,
      wantedBy: state.wantedBy || [],
      source: `next state from ${source} - ${state.id}`,
    });
    next.left = state;
    next.right = child;
    if (next.isComplete) {
      next.data = buildFromState(next);
    }
    return next;
  };
  const getError = (token: moo.Token) => {
    const tokenDisplay =
      (token.type ? token.type + " token: " : "") +
      JSON.stringify(token.value !== undefined ? token.value : token);
    const lines: string[] = [];
    const lastColumnIndex = table.length - 2;
    const lastColumn = table[lastColumnIndex];
    const expectantStates = lastColumn.states.filter(function (state) {
      var nextSymbol = getExp(state);
      return nextSymbol && typeof nextSymbol !== "string";
    });

    const displayStateStack = function (stateStack: State[]) {
      let lastDisplay: string;
      let sameDisplayCount = 0;
      stateStack.forEach((state) => {
        const display = ruleToString(state);
        if (display === lastDisplay) {
          sameDisplayCount++;
        } else {
          if (sameDisplayCount > 0) {
            lines.push(
              "    ^ " + sameDisplayCount + " more lines identical to this"
            );
          }
          sameDisplayCount = 0;
          lines.push("    " + display);
        }
        lastDisplay = display;
      });
    };

    if (expectantStates.length === 0) {
      lines.push(
        "Unexpected " +
          tokenDisplay +
          ". I did not expect any more input. Here is the state of my parse table:\n"
      );
      displayStateStack(lastColumn.states);
    } else {
      lines.push(
        "Unexpected " +
          tokenDisplay +
          ". Instead, I was expecting to see one of the following:\n"
      );
      const buildFirstStateStack = (
        state: State,
        visited: State[]
      ): State[] | null => {
        if (visited.indexOf(state) !== -1) {
          return null;
        }
        if (!state.wantedBy?.length) {
          return [state];
        }
        const prevState = state.wantedBy[0];
        const childVisited = [state].concat(visited);
        const childResult = buildFirstStateStack(prevState, childVisited);
        if (childResult === null) {
          return null;
        }
        return [state].concat(childResult);
      };
      const stateStacks = expectantStates.map(function (state) {
        return buildFirstStateStack(state, []) || [state];
      });
      stateStacks.forEach(function (stateStack) {
        const state = stateStack[0];
        const nextSymbol = getExp(state);
        const symbolDisplay = getSymbolDisplay(nextSymbol);
        lines.push(`${symbolDisplay} based on:`);
        lines.push(
          `    [context]: { index: ${state.context.index}, flags: [${Array.from(
            state.context.flags
          ).join(", ")}]}`
        );
        displayStateStack(stateStack);
      });
    }
    lines.push("");
    return lines.join("\n");
  };
  const table = [newColumn(0, { main: [] })];
  predict(table[0], "main", newContext(0));
  processColumn(table[0]);
  let current = 0;
  while (true) {
    const token = buffer.next();
    if (!token) break;
    const { scannable } = table[current];
    if (!opts.debug) delete table[current - 1];
    else console.log(token);

    const nextColumn = newColumn(current + 1);
    table.push(nextColumn);

    scannable.reverse().forEach((state) => {
      const expect = getExp(state);
      if (typeof expect === "object" && expect.type === token.type) {
        const next = nextState(
          state,
          {
            data: token,
            context: { ...state.context, index: current },
            source: `scanned - ${state.id}`,
            id: stateIdGen++,
          },
          "scanning"
        );
        if (next) nextColumn.states.push(next);
      }
    });

    processColumn(nextColumn);

    if (nextColumn.states.length === 0) {
      // No states at all! This is not good.
      console.error(`Failed to parse - no parses:`);
      console.error(content);
      console.error("Table length: " + table.length + "\n");
      console.error("Parse Charts");
      table.forEach(function (column, index) {
        console.error("\nChart: " + index++ + "\n");
        column.states.forEach(function (state) {
          console.error(
            `${state.id}: {${ruleToString(state)}}, from: ${JSON.stringify(
              state.context
            )}, source: ${state.source}\n`
          );
        });
      });
      throw new Error(getError(token));
    }

    current++;
  }

  const results: State[] = [];
  const column = table[table.length - 1];
  column.states.forEach(function (t, i) {
    if (
      t.rule &&
      t.rule.name === "main" &&
      t.dot === t.rule.symbols.length &&
      t.context.index === 0 &&
      t.data !== reject
    ) {
      results.push(t);
    }
  });
  if (results.length > 1) {
    if (process.env.NODE_ENV === "production") {
      sendExtensionError({
        type: "At JSON Parser returned multiple ambiguous results",
        data: {
          input: content,
          results,
        },
      });
    } else {
      results.forEach((r) => {
        console.log("RESULT");
        console.log(JSON.stringify(r.data));
        console.log("");
      });
      console.error(`Failed to parse - multipe parses:`);
      console.error(content);
      console.error("Table length: " + table.length + "\n");
      console.error("Parse Charts");
      table.forEach(function (column, index) {
        console.error("\nChart: " + index++ + "\n");
        column.states.forEach(function (state) {
          console.error(
            `${state.id}: {${ruleToString(state)}}, from: ${JSON.stringify(
              state.context
            )}, source: ${state.source}, right: ${state.right?.id}\n`
          );
        });
      });
      throw new Error(
        `Failed to parse: Multiple results returned by grammar (${results.length})`
      );
    }
  }
  if (results.length === 0) {
    if (process.env.NODE_ENV === "production") {
      sendExtensionError({
        type: "At JSON Parser returned no results",
        data: {
          input: content,
        },
      });
    } else {
      console.error(`Failed to parse - no parses:`);
      console.error(content);
      console.error("Table length: " + table.length + "\n");
      console.error("Parse Charts");
      table.forEach(function (column, index) {
        console.error("\nChart: " + index++ + "\n");
        column.states.forEach(function (state) {
          console.error(
            `${state.id}: {${ruleToString(state)}}, from: ${JSON.stringify(
              state.context
            )}, source: ${state.source}\n`
          );
        });
      });
    }
    throw new Error(`Failed to parse: Unexpected end of text`);
  }
  const [{ data }] = results;
  if (!("content" in data)) {
    throw new Error(`Failed to parse: Result data is not formatted correctly`);
  }

  return data;
};

export default leafParser;
