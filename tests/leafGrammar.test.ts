import leafGrammar from "../src/utils/leafGrammar";
import atJsonToObsidian from "../src/utils/atJsonToObsidian";
import lexer from "../src/utils/leafLexer";
import type { InitialSchema } from "samepage/internal/types";
import atJsonParser from "samepage/utils/atJsonParser";
import { test, expect } from "@playwright/test";
import { v4 } from "uuid";
import setupRegistry from "samepage/internal/registry";

const notebookUuid = v4();
// @ts-ignore
global.localStorage = {
  getItem: () => JSON.stringify({ uuid: notebookUuid }),
};

const runTest =
  (
    md: string,
    expected: InitialSchema,
    opts: { debug?: true; skipInverse?: true } = {}
  ) =>
  () => {
    if (opts.debug) {
      const buffer = lexer.reset(md);
      let token = buffer.next();
      while (token) {
        console.log(token);
        token = buffer.next();
      }
    }
    const output = atJsonParser(leafGrammar, md);
    expect(output).toBeTruthy();
    expect(output).toEqual(expected);
    if (!opts.skipInverse) expect(atJsonToObsidian(output)).toEqual(md);
  };

test.beforeAll(() => setupRegistry({ app: 3, getSetting: () => notebookUuid }));

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
          appAttributes: {
            obsidian: {
              spacing: "\t",
            },
          },
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
        {
          type: "bold",
          start: 132,
          end: 136,
          appAttributes: { obsidian: { kind: "**" } },
        },
        {
          type: "italics",
          start: 140,
          end: 147,
          appAttributes: { obsidian: { kind: "*" } },
        },
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
    content: `A ${String.fromCharCode(0)} text\n`,
    annotations: [
      {
        type: "block",
        start: 0,
        end: 9,
        attributes: { level: 1, viewType: "document" },
      },
      {
        type: "link",
        start: 2,
        end: 3,
        attributes: { href: "https://samepage.network" },
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

test("A normal block reference", () => {
  runTest("A block [[page title#^abcdef]] to content", {
    content: `A block ${String.fromCharCode(0)} to content\n`,
    annotations: [
      {
        start: 0,
        end: 21,
        type: "block",
        attributes: {
          viewType: "document",
          level: 1,
        },
      },
      {
        start: 8,
        end: 9,
        type: "reference",
        attributes: {
          notebookPageId: "page title#^abcdef",
          notebookUuid,
        },
      },
    ],
  })();
});

test("A cross app block reference", () => {
  runTest("A [[abcd1234-abcd-1234-abcd-1234abcd1234:reference]] to content", {
    content: `A ${String.fromCharCode(0)} to content\n`,
    annotations: [
      {
        start: 0,
        end: 15,
        type: "block",
        attributes: {
          viewType: "document",
          level: 1,
        },
      },
      {
        start: 2,
        end: 3,
        type: "reference",
        attributes: {
          notebookPageId: "reference",
          notebookUuid: "abcd1234-abcd-1234-abcd-1234abcd1234",
        },
      },
    ],
  })();
});

test(
  "Double italics",
  runTest("Deal _with_ two _sets_ of italics", {
    content: "Deal with two sets of italics\n",
    annotations: [
      {
        attributes: {
          level: 1,
          viewType: "document",
        },
        end: 30,
        start: 0,
        type: "block",
      },
      {
        start: 5,
        end: 9,
        type: "italics",
        appAttributes: { obsidian: { kind: "_" } },
      },
      {
        start: 14,
        end: 18,
        type: "italics",
        appAttributes: { obsidian: { kind: "_" } },
      },
    ],
  })
);

test(
  "Just double underscore should be valid",
  runTest("Review __public pages", {
    content: "Review __public pages\n",
    annotations: [
      {
        attributes: {
          level: 1,
          viewType: "document",
        },
        end: 22,
        start: 0,
        type: "block",
      },
    ],
  })
);

test(
  "Just double asterisk should be valid",
  runTest("Review **public pages", {
    content: "Review **public pages\n",
    annotations: [
      {
        attributes: {
          level: 1,
          viewType: "document",
        },
        end: 22,
        start: 0,
        type: "block",
      },
    ],
  })
);

test(
  "Double page tags",
  runTest("One [[page]] and two [[pages]]", {
    content: `One ${String.fromCharCode(0)} and two ${String.fromCharCode(
      0
    )}\n`,
    annotations: [
      {
        attributes: {
          level: 1,
          viewType: "document",
        },
        end: 16,
        start: 0,
        type: "block",
      },
      {
        start: 4,
        end: 5,
        type: "reference",
        attributes: {
          notebookPageId: "page",
          notebookUuid,
        },
      },
      {
        start: 14,
        end: 15,
        type: "reference",
        attributes: {
          notebookPageId: "pages",
          notebookUuid,
        },
      },
    ],
  })
);

test(
  "Odd number underscores",
  runTest("Deal _with_ odd _underscores", {
    content: "Deal with odd _underscores\n",
    annotations: [
      {
        attributes: {
          level: 1,
          viewType: "document",
        },
        end: 27,
        start: 0,
        type: "block",
      },
      {
        start: 5,
        end: 9,
        type: "italics",
        appAttributes: { obsidian: { kind: "_" } },
      },
    ],
  })
);

test(
  "Odd number asterisks",
  runTest("Deal *with* odd *asterisks", {
    content: "Deal with odd *asterisks\n",
    annotations: [
      {
        attributes: {
          level: 1,
          viewType: "document",
        },
        end: 25,
        start: 0,
        type: "block",
      },
      {
        start: 5,
        end: 9,
        type: "italics",
        appAttributes: { obsidian: { kind: "*" } },
      },
    ],
  })
);

test(
  "Odd number double underscores",
  runTest("Deal __with__ odd __underscores", {
    content: `Deal with odd __underscores\n`,
    annotations: [
      {
        attributes: {
          level: 1,
          viewType: "document",
        },
        end: 28,
        start: 0,
        type: "block",
      },
      {
        start: 5,
        end: 9,
        type: "bold",
        appAttributes: { obsidian: { kind: "__" } },
      },
    ],
  })
);

test(
  "Odd number double asterisks",
  runTest("Deal **with** odd **asterisks", {
    content: `Deal with odd **asterisks\n`,
    annotations: [
      {
        attributes: {
          level: 1,
          viewType: "document",
        },
        end: 26,
        start: 0,
        type: "block",
      },
      {
        start: 5,
        end: 9,
        type: "bold",
        appAttributes: { obsidian: { kind: "**" } },
      },
    ],
  })
);

test(
  "Odd number double tilde",
  runTest("Deal ~~with~~ odd ~~tildes", {
    content: `Deal with odd ~~tildes\n`,
    annotations: [
      {
        attributes: {
          level: 1,
          viewType: "document",
        },
        end: 23,
        start: 0,
        type: "block",
      },
      { start: 5, end: 9, type: "strikethrough" },
    ],
  })
);

test(
  "Underscore within bold underscores",
  runTest("__hello_world__", {
    content: "hello_world\n",
    annotations: [
      {
        attributes: {
          level: 1,
          viewType: "document",
        },
        end: 12,
        start: 0,
        type: "block",
      },
      {
        end: 11,
        start: 0,
        type: "bold",
        appAttributes: { obsidian: { kind: "__" } },
      },
    ],
  })
);

test(
  "Asterisk within bold stars",
  runTest("**hello*world**", {
    content: "hello*world\n",
    annotations: [
      {
        attributes: {
          level: 1,
          viewType: "document",
        },
        end: 12,
        start: 0,
        type: "block",
      },
      {
        end: 11,
        start: 0,
        type: "bold",
        appAttributes: { obsidian: { kind: "**" } },
      },
    ],
  })
);

test(
  "Two new lines before bullet",
  runTest(
    "So this is a test share page.\n\n- So how does this work\n- And this\n\n",
    {
      content:
        "So this is a test share page.\n\nSo how does this work\nAnd this\n\n",
      annotations: [
        {
          type: "block",
          start: 0,
          end: 31,
          attributes: { viewType: "document", level: 1 },
        },
        {
          type: "block",
          start: 31,
          end: 53,
          attributes: { viewType: "bullet", level: 1 },
        },
        {
          type: "block",
          start: 53,
          end: 62,
          attributes: { viewType: "bullet", level: 1 },
        },
        {
          type: "block",
          start: 62,
          end: 63,
          attributes: { viewType: "document", level: 1 },
        },
      ],
    }
  )
);

test(
  "multiple aliases",
  runTest(
    "links: [one]([nested] some text - https://samepage.network), [two](https://samepage.network), [three](https://samepage.network)",
    {
      content: "links: one, two, three\n",
      annotations: [
        {
          start: 0,
          end: 23,
          type: "block",
          attributes: { viewType: "document", level: 1 },
        },
        {
          start: 7,
          end: 10,
          type: "link",
          attributes: { href: "[nested] some text - https://samepage.network" },
        },
        {
          start: 12,
          end: 15,
          type: "link",
          attributes: { href: "https://samepage.network" },
        },
        {
          start: 17,
          end: 22,
          type: "link",
          attributes: { href: "https://samepage.network" },
        },
      ],
    }
  )
);

test(
  "Code Blocks",
  runTest(
    `\`\`\`python
class SubClass(SuperClass):

    def __init__(self, **kwargs):
        super(SubClass, self).__init__(**kwargs)

    def method(self, *args, **kwargs):
        # A comment about what's going on
        self.field = Method(*pool_args, **pool_kwargs)
\`\`\``,
    {
      content:
        "class SubClass(SuperClass):\n\n    def __init__(self, **kwargs):\n        super(SubClass, self).__init__(**kwargs)\n\n    def method(self, *args, **kwargs):\n        # A comment about what's going on\n        self.field = Method(*pool_args, **pool_kwargs)\n\n",
      annotations: [
        {
          type: "block",
          start: 0,
          end: 250,
          attributes: {
            viewType: "document",
            level: 1,
          },
        },
        {
          type: "code",
          start: 0,
          end: 249,
          attributes: {
            language: "python",
          },
        },
      ],
    }
  )
);

test(
  "Triple new line at end",
  runTest("A page\n\n\n", {
    content: "A page\n\n\n",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 8,
        attributes: {
          viewType: "document",
          level: 1,
        },
      },
      {
        type: "block",
        start: 8,
        end: 9,
        attributes: {
          viewType: "document",
          level: 1,
        },
      },
    ],
  })
);

test(
  "Triple new line in the middle",
  runTest("A page\n\n\nA paragraph", {
    content: "A page\n\nA paragraph\n",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 8,
        attributes: {
          viewType: "document",
          level: 1,
        },
      },
      {
        type: "block",
        start: 8,
        end: 20,
        attributes: {
          viewType: "document",
          level: 1,
        },
      },
    ],
  })
);

test(
  "tabbing with spaces",
  runTest("- Block\n    - Nested", {
    content: "Block\nNested\n",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 6,
        attributes: { level: 1, viewType: "bullet" },
      },
      {
        type: "block",
        start: 6,
        end: 13,
        attributes: { level: 2, viewType: "bullet" },
        appAttributes: {
          obsidian: {
            spacing: `    `,
          },
        },
      },
    ],
  })
);

test(
  "Empty bullet with newline",
  runTest("\n- \n", {
    content: "\n\n\n",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 1,
        attributes: { level: 1, viewType: "document" },
      },
      {
        type: "block",
        start: 1,
        end: 3,
        attributes: { level: 1, viewType: "bullet" },
      },
    ],
  })
);

test(
  "Single new line after line",
  runTest("Single new line\n\n\t\n", {
    content: "Single new line\n\n\n",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 16,
        attributes: {
          level: 1,
          viewType: "document",
        },
      },
      {
        type: "block",
        start: 16,
        end: 18,
        attributes: {
          level: 2,
          viewType: "document",
        },
        appAttributes: {
          obsidian: {
            spacing: `\t`,
          },
        },
      },
    ],
  })
);

test(
  "Unclosed alias",
  runTest(
    `[unclosed alias](https://samepage.network`,
    {
      content: "[unclosed alias](https://samepage.network\n",
      annotations: [
        {
          type: "block",
          start: 0,
          end: 42,
          attributes: {
            level: 1,
            viewType: "document",
          },
        },
      ],
    }
  )
);
