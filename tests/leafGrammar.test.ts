// TODO make this jest friendly
import leafGrammar from "../src/utils/leafGrammar";
import type { InitialSchema } from "samepage/types";
import atJsonParser from "samepage/utils/atJsonParser";
import { setBlockUuidGenerator } from "../src/utils/leafLexer";

const runTest = (md: string, expected: InitialSchema) => () => {
  setBlockUuidGenerator((i) => i.toString());
  const output = atJsonParser(leafGrammar, md);
  expect(output).toBeTruthy();
  expect(output.content).toEqual(expected.content);
  expected.annotations.forEach((e, i) => {
    expect(output.annotations[i]).toEqual(e);
  });
  expect(output.annotations[expected.annotations.length]).toBeUndefined();
  expect(expected.annotations[output.annotations.length]).toBeUndefined();
};

test(
  "Hello World Example",
  runTest(
    `Some text to start



Text after newline {{no component support}} word

\tA block quote - handle later

Text after blockquote

Here's some **bold** an *italics* a ~~strike~~ a ^^highlight^^. No highlighting!
- First bullet
- Second bullet
Some regular text to end.`,
    {
      content:
        "Some text to startText after newline {{no component support}} word\tA block quote - handle laterText after blockquoteHere's some bold an italics a strike a ^^highlight^^. No highlighting!- First bullet- Second bulletSome regular text to end.",
      annotations: [
        {
          type: "block",
          start: 0,
          end: 18,
          attributes: { level: 1, viewType: "document" },
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 18,
          start: 18,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 18,
          start: 18,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 18,
          start: 18,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 66,
          start: 18,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 66,
          start: 66,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 95,
          start: 66,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 95,
          start: 95,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 116,
          start: 95,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 116,
          start: 116,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 186,
          start: 116,
          type: "block",
        },
        { type: "bold", start: 128, end: 132 },
        { type: "italics", start: 136, end: 143 },
        { type: "strikethrough", start: 146, end: 152 },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 200,
          start: 186,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 215,
          start: 200,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 240,
          start: 215,
          type: "block",
        },
      ],
    }
  )
);

test(
  "Extra new lines at the end",
  runTest("Extra new line\n\n", {
    content: "Extra new line",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 14,
        attributes: { level: 1, viewType: "document" },
      },
      {
        type: "block",
        start: 14,
        end: 14,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  })
);
