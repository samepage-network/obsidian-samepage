import atJsonToObsidian from "../src/utils/atJsonToObsidian";
import leafParser from "../src/utils/leafParser";
import type { InitialSchema } from "samepage/internal/types";
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
    const output = leafParser(md, opts);
    expect(output).toBeTruthy();
    expect(output).toEqual(expected);
    if (!opts.skipInverse) expect(atJsonToObsidian(output)).toEqual(md);
  };

test.beforeAll(() =>
  setupRegistry({ app: "obsidian", getSetting: () => notebookUuid })
);

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
          attributes: { delimiter: "**" },
        },
        {
          type: "italics",
          start: 140,
          end: 147,
          attributes: { delimiter: "*" },
        },
        {
          type: "strikethrough",
          start: 150,
          end: 156,
          attributes: { delimiter: "~~" },
        },
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
        attributes: { delimiter: "_" },
      },
      {
        start: 14,
        end: 18,
        type: "italics",
        attributes: { delimiter: "_" },
      },
    ],
  })
);

test(
  "Just double underscore should be valid",
  runTest("Review __public pages", {
    content: "Review public pages\n",
    annotations: [
      {
        attributes: {
          level: 1,
          viewType: "document",
        },
        end: 20,
        start: 0,
        type: "block",
      },
      {
        type: "bold",
        start: 7,
        end: 19,
        attributes: {
          delimiter: "__",
          open: true,
        },
      },
    ],
  })
);

test(
  "Just double asterisk should be valid",
  runTest("Review **public pages", {
    content: "Review public pages\n",
    annotations: [
      {
        attributes: {
          level: 1,
          viewType: "document",
        },
        end: 20,
        start: 0,
        type: "block",
      },
      {
        attributes: {
          delimiter: "**",
          open: true,
        },
        end: 19,
        start: 7,
        type: "bold",
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
    content: "Deal with odd underscores\n",
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
        type: "italics",
        attributes: { delimiter: "_" },
      },
      {
        start: 14,
        end: 25,
        type: "italics",
        attributes: { delimiter: "_", open: true },
      },
    ],
  })
);

test(
  "Odd number asterisks",
  runTest("Deal *with* odd *asterisks", {
    content: "Deal with odd asterisks\n",
    annotations: [
      {
        attributes: {
          level: 1,
          viewType: "document",
        },
        end: 24,
        start: 0,
        type: "block",
      },
      {
        start: 5,
        end: 9,
        type: "italics",
        attributes: { delimiter: "*" },
      },
      {
        start: 14,
        end: 23,
        type: "italics",
        attributes: { delimiter: "*", open: true },
      },
    ],
  })
);

test(
  "Odd number double underscores",
  runTest("Deal __with__ odd __underscores", {
    content: `Deal with odd underscores\n`,
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
        attributes: { delimiter: "__" },
      },
      {
        start: 14,
        end: 25,
        type: "bold",
        attributes: { delimiter: "__", open: true },
      },
    ],
  })
);

test(
  "Odd number double asterisks",
  runTest("Deal **with** odd **asterisks", {
    content: `Deal with odd asterisks\n`,
    annotations: [
      {
        attributes: {
          level: 1,
          viewType: "document",
        },
        end: 24,
        start: 0,
        type: "block",
      },
      {
        start: 5,
        end: 9,
        type: "bold",
        attributes: { delimiter: "**" },
      },
      {
        start: 14,
        end: 23,
        type: "bold",
        attributes: { delimiter: "**", open: true },
      },
    ],
  })
);

test(
  "Odd number double tilde",
  runTest("Deal ~~with~~ odd ~~tildes", {
    content: `Deal with odd tildes\n`,
    annotations: [
      {
        attributes: {
          level: 1,
          viewType: "document",
        },
        end: 21,
        start: 0,
        type: "block",
      },
      {
        start: 5,
        end: 9,
        type: "strikethrough",
        attributes: { delimiter: "~~" },
      },
      {
        start: 14,
        end: 20,
        type: "strikethrough",
        attributes: { delimiter: "~~", open: true },
      },
    ],
  })
);

test(
  "Underscore within bold underscores",
  runTest("__hello _world__", {
    content: "hello world\n",
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
        attributes: {
          delimiter: "__",
        },
      },
      {
        end: 11,
        start: 6,
        type: "italics",
        attributes: {
          delimiter: "_",
          open: true,
        },
      },
    ],
  })
);

test(
  "Asterisk within bold stars",
  runTest("**hello *world**", {
    content: "hello world\n",
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
        attributes: { delimiter: "**" },
      },
      {
        end: 11,
        start: 6,
        type: "italics",
        attributes: {
          delimiter: "*",
          open: true,
        },
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
        end: 7,
        attributes: {
          viewType: "document",
          level: 1,
        },
      },
      {
        type: "block",
        start: 7,
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
        end: 7,
        attributes: {
          viewType: "document",
          level: 1,
        },
      },
      {
        type: "block",
        start: 7,
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
  runTest(`[unclosed alias](https://samepage.network`, {
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
  })
);

test("Lots of blocks", () => {
  const blocks = Array(30).fill(null);
  const md = blocks.reduce((p) => `${p}Hello\n\n`, "");
  const content = blocks.reduce((p) => `${p}Hello\n`, "") + "\n";
  const annotations = blocks
    .map((_, i) => ({
      attributes: {
        level: 1,
        viewType: "document" as const,
      },
      end: (i + 1) * 6,
      start: i * 6,
      type: "block" as const,
    }))
    .concat({
      attributes: {
        level: 1,
        viewType: "document" as const,
      },
      end: 181,
      start: 180,
      type: "block" as const,
    });
  runTest(md, {
    annotations,
    content,
  })();
});

test(
  "Code block with hyphen",
  runTest(
    `\`\`\`ad-icon
<svg></svg>
\`\`\``,
    {
      content: "<svg></svg>\n\n",
      annotations: [
        {
          attributes: {
            level: 1,
            viewType: "document",
          },
          end: 13,
          start: 0,
          type: "block",
        },
        {
          attributes: {
            language: "ad-icon",
          },
          end: 12,
          start: 0,
          type: "code",
        },
      ],
    }
  )
);

test(
  "Code block without newline before close",
  runTest("```dataviewjs\nlet setting = {};\n>```", {
    content: "let setting = {};\n>\n",
    annotations: [
      {
        attributes: {
          level: 1,
          viewType: "document",
        },
        end: 20,
        start: 0,
        type: "block",
      },
      {
        attributes: {
          language: "dataviewjs",
        },
        end: 19,
        start: 0,
        type: "code",
      },
    ],
  })
);

test(
  "Code block with four ticks",
  runTest(
    `\`\`\`\`adgrid
> [!profile-card|cards]
\`\`\`\``,
    {
      content: "> [!profile-card|cards]\n\n",
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
          attributes: {
            language: "adgrid",
            ticks: 4,
          },
          end: 24,
          start: 0,
          type: "code",
        },
      ],
    }
  )
);

test(
  "Unclosed bolding (star)",
  runTest("**Important!\n\nParagraph", {
    content: `Important!\nParagraph\n`,
    annotations: [
      {
        type: "block",
        start: 0,
        end: 11,
        attributes: { level: 1, viewType: "document" },
      },
      {
        type: "bold",
        start: 0,
        end: 10,
        attributes: { delimiter: "**", open: true },
      },
      {
        type: "block",
        start: 11,
        end: 21,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  })
);

test(
  "End line with single asterisk",
  runTest("Important*\n\nParagraph", {
    content: `Important*\nParagraph\n`,
    annotations: [
      {
        type: "block",
        start: 0,
        end: 11,
        attributes: { level: 1, viewType: "document" },
      },
      {
        type: "block",
        start: 11,
        end: 21,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  })
);

test(
  "Unclosed bolding (underscore)",
  runTest("__Important!\n\nParagraph", {
    content: `Important!\nParagraph\n`,
    annotations: [
      {
        type: "block",
        start: 0,
        end: 11,
        attributes: { level: 1, viewType: "document" },
      },
      {
        type: "bold",
        start: 0,
        end: 10,
        attributes: { delimiter: "__", open: true },
      },
      {
        type: "block",
        start: 11,
        end: 21,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  })
);

test(
  "Unclosed italics (star)",
  runTest("*Important!\n\nParagraph", {
    content: `Important!\nParagraph\n`,
    annotations: [
      {
        type: "block",
        start: 0,
        end: 11,
        attributes: { level: 1, viewType: "document" },
      },
      {
        type: "italics",
        start: 0,
        end: 10,
        attributes: { delimiter: "*", open: true },
      },
      {
        type: "block",
        start: 11,
        end: 21,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  })
);

test(
  "Unclosed italics (underscore)",
  runTest("_Important!\n\nParagraph", {
    content: `Important!\nParagraph\n`,
    annotations: [
      {
        type: "block",
        start: 0,
        end: 11,
        attributes: { level: 1, viewType: "document" },
      },
      {
        type: "italics",
        start: 0,
        end: 10,
        attributes: { delimiter: "_", open: true },
      },
      {
        type: "block",
        start: 11,
        end: 21,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  })
);

test(
  "end line with double asterisk",
  runTest("Important**\n\nParagraph", {
    content: `Important**\nParagraph\n`,
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
        end: 22,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  })
);

test(
  "end line with double underscore",
  runTest("Important__\n\nParagraph", {
    content: `Important__\nParagraph\n`,
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
        end: 22,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  })
);

test(
  "Underscore preceeded by word character does not italicize",
  runTest("Hello_world", {
    content: `Hello_world\n`,
    annotations: [
      {
        type: "block",
        start: 0,
        end: 12,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  })
);

test(
  "Underscore at end of word is text",
  runTest("Hello_ _world_", {
    content: `Hello_ world\n`,
    annotations: [
      {
        type: "block",
        start: 0,
        end: 13,
        attributes: { level: 1, viewType: "document" },
      },
      {
        type: "italics",
        start: 7,
        end: 12,
        attributes: { delimiter: "_" },
      },
    ],
  })
);

test.skip(
  "three dash",
  runTest("---", {
    content: `${String.fromCharCode(0)}\n`,
    annotations: [
      {
        type: "block",
        start: 0,
        end: 2,
        attributes: { level: 1, viewType: "document" },
      },
      {
        type: "custom",
        start: 0,
        end: 1,
        attributes: { name: "horizontalLine" },
      },
    ],
  })
);

test.skip(
  "three underscore",
  runTest("___", {
    content: `${String.fromCharCode(0)}\n`,
    annotations: [
      {
        type: "block",
        start: 0,
        end: 2,
        attributes: { level: 1, viewType: "document" },
      },
      {
        type: "custom",
        start: 0,
        end: 1,
        attributes: { name: "horizontalLine" },
      },
    ],
  })
);

test.skip(
  "three star",
  runTest("***", {
    content: `${String.fromCharCode(0)}\n`,
    annotations: [
      {
        type: "block",
        start: 0,
        end: 2,
        attributes: { level: 1, viewType: "document" },
      },
      {
        type: "custom",
        start: 0,
        end: 1,
        attributes: { name: "horizontalLine" },
      },
    ],
  })
);

test.skip(
  "Asterisk bullets",
  runTest("* First\n* Second", {
    content: `First\nSecond\n`,
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
        attributes: { level: 1, viewType: "bullet" },
      },
    ],
  })
);

test(
  "Start bolding end with asterisk",
  runTest("**Important*\n\nParagraph", {
    content: `Important*\nParagraph\n`,
    annotations: [
      {
        type: "block",
        start: 0,
        end: 11,
        attributes: { level: 1, viewType: "document" },
      },
      {
        type: "bold",
        start: 0,
        end: 10,
        attributes: { delimiter: "**", open: true },
      },
      {
        type: "block",
        start: 11,
        end: 21,
        attributes: { level: 1, viewType: "document" },
      },
    ],
  })
);

// This is a tricky problem to solve - our lexer reads this as boldAsterisk, boldAsterisk, text.
// We somehow need read this as boldAsterisk, italicsAsterisk, text.
test.skip(
  "Four asterisks to start",
  runTest("****text", {
    content: "*text\n",
    annotations: [
      {
        type: "block",
        start: 0,
        end: 6,
        attributes: { level: 1, viewType: "document" },
      },
      { type: "bold", start: 0, end: 5, attributes: { delimiter: "**" } },
      { type: "italics", start: 0, end: 5, attributes: { delimiter: "**" } },
    ],
  })
);
