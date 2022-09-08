import { compileLexer } from "samepage/utils/atJsonTokens";
import nearley from "nearley";
import { InitialSchema } from "samepage/types";
import { v4 } from "uuid";

const lexer = compileLexer(
  {
    text: { match: /[^~_*[\]\n]+/, lineBreaks: true },
    newLine: { match: /\n/, lineBreaks: true },
  },
  ["highlight"]
);

type Processor<T> = (
  ...args: Parameters<nearley.Postprocessor>
) => T | Parameters<nearley.Postprocessor>[2];

const createBlockToken = () => {};

export const createEmpty: Processor<InitialSchema> = () => ({
  content: "",
  annotations: [],
});

let blockUuidGenerator = (_: number) => {
  return v4();
};

export const setBlockUuidGenerator = (fcn: typeof blockUuidGenerator) =>
  (blockUuidGenerator = fcn);

export const createBlockTokens: Processor<InitialSchema> = (data) => {
  const tokens = (data as (InitialSchema[] | InitialSchema)[]).flatMap((d) =>
    Array.isArray(d) ? d : [d]
  );
  return tokens.reduce(
    (total, current, index) => ({
      content: `${total.content}${current.content}`,
      annotations: total.annotations
        .concat({
          type: "block",
          start: total.content.length,
          end: total.content.length + current.content.length,
          attributes: {
            identifier: blockUuidGenerator(index),
            level: 1,
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
    }),
    {
      content: "",
      annotations: [],
    } as InitialSchema
  );
};

export default lexer;
