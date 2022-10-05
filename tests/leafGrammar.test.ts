// TODO make this test friendly - https://github.com/microsoft/playwright/issues/17852
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
        `Some text to start${String.fromCharCode(0)}${String.fromCharCode(0)}${String.fromCharCode(0)}Text after newline {{no component support}} word${String.fromCharCode(0)}A block quote - handle later${String.fromCharCode(0)}Text after blockquote${String.fromCharCode(0)}Here's some bold an italics a strike a ^^highlight^^. No highlighting!- First bullet- Second bulletSome regular text to end.`,
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
          end: 19,
          start: 18,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 20,
          start: 19,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 21,
          start: 20,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 69,
          start: 21,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 70,
          start: 69,
          type: "block",
        },
        {
          attributes: {
            level: 2,
            viewType: "document",
          },
          end: 98,
          start: 70,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 99,
          start: 98,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 120,
          start: 99,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 121,
          start: 120,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 191,
          start: 121,
          type: "block",
        },
        { type: "bold", start: 133, end: 137 },
        { type: "italics", start: 141, end: 148 },
        { type: "strikethrough", start: 151, end: 157 },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 205,
          start: 191,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 220,
          start: 205,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 245,
          start: 220,
          type: "block",
        },
      ],
    }
  )
);

test(
  "Extra new lines at the end",
  runTest("Extra new line\n\n", {
    content: `Extra new line${String.fromCharCode(0)}`,
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
        end: 15,
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

test(
  "Aliasless link",
  runTest("A [](https://samepage.network) text", {
    content: "A [](https://samepage.network) text",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 35,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  })
);

test(
  "Just a link",
  runTest("Just a link: https://samepage.network", {
    content: "Just a link: https://samepage.network",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 37,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  })
);

test(
  "Image with alias",
  runTest("![alias](https://samepage.network/images/logo.png)", {
    content: "alias",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 5,
        attributes: { level: 1, viewType: "document" },
      },
      {
        type: "image",
        start: 0,
        end: 5,
        attributes: {
          src: "https://samepage.network/images/logo.png",
        },
      },
    ],
  })
);

test(
  "Image without alias",
  runTest("![](https://samepage.network/images/logo.png)", {
    content: String.fromCharCode(0),
    annotations: [
      {
        type: "block",
        start: 0,
        end: 1,
        attributes: { level: 1, viewType: "document" },
      },
      {
        type: "image",
        start: 0,
        end: 1,
        attributes: {
          src: "https://samepage.network/images/logo.png",
        },
      },
    ],
  })
);
