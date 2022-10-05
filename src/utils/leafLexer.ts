import { compileLexer, DEFAULT_TOKENS } from "samepage/utils/atJsonTokens";
import nearley from "nearley";
import { InitialSchema } from "samepage/types";

const lexer = compileLexer(
  {
    url: DEFAULT_TOKENS.url,
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
  const [tabs] = data as [moo.Token[]];
  return {
    content: "",
    annotations: [],
    tabs: tabs.length,
  };
};

type InitialSchemaWithTabs = InitialSchema & { tabs: number };

export const createBlockTokens: Processor<InitialSchema> = (data) => {
  const tokens = (data as (InitialSchemaWithTabs[] | InitialSchemaWithTabs)[])
    .flatMap((d) => (Array.isArray(d) ? d : d ? [d] : undefined))
    .filter((d): d is InitialSchemaWithTabs => !!d);
  return tokens.reduce(
    (total, current) => {
      const content = current.content.length
        ? current.content
        : String.fromCharCode(0);
      return {
        content: `${total.content}${content}`,
        annotations: total.annotations
          .concat({
            type: "block",
            start: total.content.length,
            end: total.content.length + content.length,
            attributes: {
              level: current.tabs + 1,
              viewType: "document",
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

export default lexer;
