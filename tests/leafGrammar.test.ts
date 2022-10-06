// TODO make this test friendly - https://github.com/microsoft/playwright/issues/17852
import leafGrammar from "../src/utils/leafGrammar";
import type { InitialSchema } from "samepage/types";
import atJsonParser from "samepage/utils/atJsonParser";
import { test, expect } from "@playwright/test";

const runTest = (md: string, expected: InitialSchema) => () => {
  const output = atJsonParser(leafGrammar, md);
  expect(output).toBeTruthy();
  expect(output).toEqual(expected);
  // expect(output.content).toEqual(expected.content);
  // expected.annotations.forEach((e, i) => {
  //   expect(output.annotations[i]).toEqual(e);
  // });
  // expect(output.annotations[expected.annotations.length]).toBeUndefined();
  // expect(expected.annotations[output.annotations.length]).toBeUndefined();
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
      content: `Some text to start\n\nText after newline {{no component support}} word\nA block quote - handle later\nText after blockquote\nHere's some bold an italics a strike a ^^highlight^^. No highlighting!\nFirst bullet\nSecond bullet\nSome regular text to end.\n`,
      annotations: [
        {
          type: "block",
          start: 0,
          end: 19,
          attributes: { level: 1, viewType: "document" },
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
          end: 69,
          start: 20,
          type: "block",
        },
        {
          attributes: {
            level: 2,
            viewType: "document",
          },
          end: 98,
          start: 69,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 120,
          start: 98,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 191,
          start: 120,
          type: "block",
        },
        { type: "bold", start: 132, end: 136 },
        { type: "italics", start: 140, end: 147 },
        { type: "strikethrough", start: 150, end: 156 },
        {
          attributes: {
            level: 1,
            viewType: "bullet",
          },
          end: 204,
          start: 191,
          type: "block",
        },
        {
          attributes: {
            level: 1,
            viewType: "bullet",
          },
          end: 244,
          start: 204,
          type: "block",
        },
      ],
    }
  )
);

test(
  "Extra new lines at the end",
  runTest("Extra new line\n\n", {
    content: `Extra new line\n\n`,
    annotations: [
      {
        type: "block",
        start: 0,
        end: 15,
        attributes: { level: 1, viewType: "document" },
      },
      {
        type: "block",
        start: 15,
        end: 16,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  })
);

test(
  "Empty page is one block",
  runTest("", {
    content: `\n`,
    annotations: [
      {
        type: "block",
        start: 0,
        end: 1,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  })
);

test(
  "Blocks, 1 indented",
  runTest("Some Content\n\tNested Content\nRoot Content", {
    content: "Some Content\n\tNested Content\nRoot Content\n",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 42,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  })
);

test(
  "Aliasless link",
  runTest("A [](https://samepage.network) text", {
    content: "A [](https://samepage.network) text\n",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 36,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  })
);

test(
  "Just a link",
  runTest("Just a link: https://samepage.network", {
    content: "Just a link: https://samepage.network\n",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 38,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  })
);

test(
  "Image with alias",
  runTest("![alias](https://samepage.network/images/logo.png)", {
    content: "alias\n",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 6,
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
    content: `${String.fromCharCode(0)}\n`,
    annotations: [
      {
        type: "block",
        start: 0,
        end: 2,
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

test(
  "Top level bullets",
  runTest(
    `- Top level bullet
- And another`,
    {
      content: "Top level bullet\nAnd another\n",
      annotations: [
        {
          type: "block",
          start: 0,
          end: 17,
          attributes: {
            level: 1,
            viewType: "bullet",
          },
        },
        {
          type: "block",
          start: 17,
          end: 29,
          attributes: {
            level: 1,
            viewType: "bullet",
          },
        },
      ],
    }
  )
);

test(
  "Single new line",
  runTest("Single new line\n", {
    content: "Single new line\n\n",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 17,
        attributes: {
          level: 1,
          viewType: "document",
        },
      },
    ],
  })
);
