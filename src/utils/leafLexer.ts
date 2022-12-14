import {
  compileLexer,
  DEFAULT_TOKENS,
  createBoldToken as parentCreateBoldToken,
  createItalicsToken as parentCreateItalicsToken,
} from "samepage/utils/atJsonTokens";
import nearley from "nearley";
import { Annotation, InitialSchema } from "samepage/internal/types";
import { disambiguateTokens as defaultDisambiguateTokens } from "samepage/utils/atJsonTokens";
import { getSetting } from "samepage/internal/registry";

const lexer = compileLexer(
  {
    alias: /\[[^\]]*\]\([^\)]*\)/,
    asset: /!\[[^\]]*\]\([^\)]*\)/,
    url: DEFAULT_TOKENS.url,
    reference: /\[\[[^\]]+\]\]/,
    bullet: { match: /- / },
    numbered: { match: /\d+\. / },
    codeBlock: {
      match: /```[\w ]*\n(?:[^`]|`(?!``)|``(?!`))*\n```/,
      lineBreaks: true,
    },
    openUnder: { match: /_(?=[^_]+_(?!_))/, lineBreaks: true },
    openStar: { match: /\*(?=[^*]+\*(?!\*))/, lineBreaks: true },
    openDoubleUnder: { match: /__(?=(?:[^_]|_[^_])*__)/, lineBreaks: true },
    openDoubleStar: { match: /\*\*(?=(?:[^*]|\*[^*])*\*\*)/, lineBreaks: true },
    openDoubleTilde: { match: /~~(?=(?:[^~]|~[^~])*~~)/, lineBreaks: true },
    text: { match: /(?:[^~_*[\]\n\t!()`]|`(?!``)|``(?!`))+/, lineBreaks: true },
    newLine: { match: /\n/, lineBreaks: true },
    tab: { match: /\t/ },
  },
  ["highlight"]
);

type Processor<T> = (
  ...args: Parameters<nearley.Postprocessor>
) => T | Parameters<nearley.Postprocessor>[2];

export const createEmpty: Processor<InitialSchema> = (data) => {
  return {
    content: "",
    annotations: [],
  };
};

type InitialSchemaAugmented = InitialSchema & {
  tabs: number;
  viewType: "document" | "bullet" | "numbered";
};

export const createBoldToken: Processor<InitialSchema> = (data, _, reject) => {
  const result = parentCreateBoldToken(data, _, reject);
  if (result === reject) return reject;
  const [bold] = (result as InitialSchema).annotations;
  bold.appAttributes = {
    obsidian: {
      kind: (data as [moo.Token])[0].value,
    },
  };
  return result;
};

export const createItalicsToken: Processor<InitialSchema> = (
  data,
  _,
  reject
) => {
  const result = parentCreateItalicsToken(data, _, reject);
  if (result === reject) return reject;
  const [ital] = (result as InitialSchema).annotations;
  ital.appAttributes = {
    obsidian: {
      kind: (data as [moo.Token])[0].value,
    },
  };
  return result;
};

export const createBlockTokens: Processor<InitialSchema> = (data) => {
  const tokens = (data as (InitialSchemaAugmented[] | InitialSchemaAugmented)[])
    .flatMap((d) => (Array.isArray(d) ? d : d ? [d] : undefined))
    .filter((d): d is InitialSchemaAugmented => !!d);
  return tokens.reduce(
    (total, current) => {
      const content = `${current.content}\n`;
      return {
        content: `${total.content}${content}`,
        annotations: total.annotations
          .concat({
            type: "block",
            start: total.content.length,
            end: total.content.length + content.length,
            attributes: {
              level: current.tabs + 1,
              viewType: current.viewType,
            },
          })
          .concat(
            current.annotations.map((a) => ({
              ...a,
              start: a.start + total.content.length,
              end: a.end + total.content.length,
            }))
          ),
      };
    },
    {
      content: "",
      annotations: [],
    } as InitialSchema
  );
};

export const disambiguateTokens: Processor<InitialSchema> =
  defaultDisambiguateTokens;

export const createAliasToken: Processor<InitialSchema> = (data) => {
  const { value } = (data as [moo.Token])[0];
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
};

export const createAssetToken: Processor<InitialSchema> = (data) => {
  const { value } = (data as [moo.Token])[0];
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
};

export const createReferenceToken: Processor<InitialSchema> = (_data) => {
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
      } as Annotation,
    ],
  };
};

export const createNull: Processor<InitialSchema> = () => ({
  content: String.fromCharCode(0),
  annotations: [],
});

export const createCodeBlockToken: Processor<InitialSchema> = (data) => {
  const { value } = (data as [moo.Token])[0];
  const language = /^```([\w ]*)\n/.exec(value)?.[1] || "";
  const content = value.replace(/^```[\w ]*\n/, "").replace(/```$/, "");
  return {
    content,
    annotations: [
      {
        start: 0,
        end: content.length,
        type: "code",
        attributes: {
          language,
        },
      },
    ],
  };
};

export default lexer;
