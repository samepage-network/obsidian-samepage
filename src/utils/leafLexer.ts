import { compileLexer, DEFAULT_TOKENS } from "samepage/utils/atJsonTokens";
import nearley from "nearley";
import { Annotation, InitialSchema } from "samepage/internal/types";
import { disambiguateTokens as defaultDismabuagteTokens } from "samepage/utils/atJsonTokens";
import { getSetting } from "samepage/internal/registry";

const lexer = compileLexer(
  {
    url: DEFAULT_TOKENS.url,
    reference: /\[\[[^\]]+\]\]/,
    bullet: { match: /- / },
    numbered: { match: /\d+\. / },
    openUnder: { match: /_(?=[^_]+_(?!_))/, lineBreaks: true },
    openStar: { match: /\*(?=[^*]+\*(?!\*))/, lineBreaks: true },
    openDoubleUnder: { match: /__(?=(?:[^_]|_[^_])*__)/, lineBreaks: true },
    openDoubleStar: { match: /\*\*(?=(?:[^*]|\*[^*])*\*\*)/, lineBreaks: true },
    openDoubleTilde: { match: /~~(?=(?:[^~]|~[^~])*~~)/, lineBreaks: true },
    text: { match: /[^~_*[\]\n\t!()]+/, lineBreaks: true },
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

export const createBlockTokens: Processor<InitialSchema> = (
  data,
  _,
  reject
) => {
  const tokens = (data as (InitialSchemaAugmented[] | InitialSchemaAugmented)[])
    .flatMap((d) => (Array.isArray(d) ? d : d ? [d] : undefined))
    .filter((d): d is InitialSchemaAugmented => !!d);
  if (
    tokens
      .slice(0, -1)
      .some((t) => t.content.endsWith("\n") || t.content.startsWith("\t"))
  ) {
    return reject;
  }
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

export const disambiguateTokens: Processor<InitialSchema> = (
  data,
  _,
  reject
) => {
  const [tokens] = data as [InitialSchema[]];
  // console.log(reject, "tokens", JSON.stringify(tokens));
  if (
    tokens.some(
      (token, i, a) =>
        token.content === "\n" &&
        token.annotations.length === 0 &&
        a[i + 1] &&
        a[i + 1].content === "\n" &&
        a[i + 1].annotations.length === 0
    )
  ) {
    // console.log("REJECTED");
    return reject;
  }
  return defaultDismabuagteTokens(data, _, reject);
};

export const createLinkToken: Processor<InitialSchema> = (_data, _, reject) => {
  const data = _data as [
    moo.Token,
    InitialSchema,
    moo.Token,
    moo.Token,
    moo.Token,
    moo.Token
  ];
  const { content, annotations = [] } = data[1];
  if (!content) return reject;
  return {
    content,
    annotations: [
      {
        type: "link",
        start: 0,
        end: content.length,
        attributes: {
          href: data[4].text,
        },
      } as Annotation,
    ].concat(annotations),
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

export default lexer;
