// TODO make this test friendly
import leafGrammar from "../src/utils/leafGrammar";
import type { InitialSchema } from "samepage/types";
import atJsonParser from "samepage/utils/atJsonParser";
import { test, expect } from "@playwright/test";

const runTest = (md: string, expected: InitialSchema) => () => {
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
        "Some text to startText after newline {{no component support}} wordA block quote - handle laterText after blockquoteHere's some bold an italics a strike a ^^highlight^^. No highlighting!- First bullet- Second bulletSome regular text to end.",
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
            level: 2,
            viewType: "document",
          },
          end: 94,
          start: 66,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 94,
          start: 94,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 115,
          start: 94,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 115,
          start: 115,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 185,
          start: 115,
          type: "block",
        },
        { type: "bold", start: 127, end: 131 },
        { type: "italics", start: 135, end: 142 },
        { type: "strikethrough", start: 145, end: 151 },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 199,
          start: 185,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 214,
          start: 199,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 239,
          start: 214,
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

test(
  "Blocks, 1 indented",
  runTest("Some Content\n\tNested Content\nRoot Content", {
    content: "Some ContentNested ContentRoot Content",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 12,
        attributes: { level: 1, viewType: "document" },
      },
      {
        type: "block",
        start: 12,
        end: 26,
        attributes: { level: 2, viewType: "document" },
      },
      {
        type: "block",
        start: 26,
        end: 38,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  })
);
