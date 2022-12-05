import { _electron, test, expect } from "@playwright/test";
import { PluginManifest } from "obsidian";
// import SamePagePlugin from "../src/main";

test.beforeAll(() => {
  // mock obsidian environment
});

test.skip('"End to end" obsidian test', async ({ page }) => {
  // TODO - need to do more research on how to test against a built electron app
  //
  // await page.goto("app://obsidian.md/index.html");
  // expect(await page.title()).toEqual(
  //   "New tab - obsidian-vargas - Obsidian v1.0.3"
  // );
  //   const app = await _electron.launch({
  //     executablePath: "/usr/bin/open",
  //     args: ["/Applications/Obsidian.app"],
  //   });
  //   const window = await app.firstWindow();
  //   // Print the title.
  //   console.log(await window.title());
  //   await window.screenshot({ path: "intro.png" });
  const manifest: PluginManifest = {
    id: "samepage",
    author: "SamePage",
    name: "SamePage",
    version: "test",
    minAppVersion: "1.0",
    description: "testing",
  };
  expect(manifest).toBeTruthy();
  // const plugin = new SamePagePlugin(app, manifest);
  // expect(plugin).toBeTruthy();
});
