import "./index.css";
import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import defaultSettings, {
  DefaultSetting,
} from "samepage/utils/defaultSettings";
import setupSamePageClient from "samepage/protocols/setupSamePageClient";
import setupSharePageWithNotebook from "samepage/protocols/sharePageWithNotebook";
import UsageChart from "samepage/components/UsageChart";
import { onAppEvent } from "samepage/internal/registerAppEventListener";
import renderOverlay from "./utils/renderOverlay";
import Loading from "./components/Loading";

class SamePageSettingTab extends PluginSettingTab {
  plugin: SamePagePlugin;

  constructor(app: App, plugin: SamePagePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "SamePage Settings" });
    defaultSettings.forEach((s) => {
      const setting = new Setting(containerEl)
        .setName(s.name)
        .setDesc(s.description);
      if (s.type === "boolean") {
        setting.addToggle((toggle) =>
          toggle.setValue(s.default).onChange((value) => {
            this.plugin.settings[s.id] = value;
            this.plugin.saveData(this.plugin.settings);
          })
        );
      }
    });
  }
}

class SamePagePlugin extends Plugin {
  settings: Record<DefaultSetting["id"], boolean>;
  async onload() {
    console.log("loadData", await this.loadData());
    this.settings = {
      ...Object.fromEntries(defaultSettings.map((s) => [s.id, s.default])),
      ...(await this.loadData()),
    };

    this.addSettingTab(new SamePageSettingTab(this.app, this));

    const self = this;
    const checkCallback: Record<string, boolean> = {};
    const { unload: unloadSamePageClient } = await setupSamePageClient({
      isAutoConnect: this.settings["auto-connect"],
      addCommand: ({ label, callback }) => {
        if (label in checkCallback) checkCallback[label] = true;
        else {
          checkCallback[label] = true;
          self.addCommand({
            id: label.toLowerCase().replace(/ /g, "-"),
            name: label,
            checkCallback: (checking) => {
                if (checkCallback[label]) {
                    if (!checking) {
                        callback();
                    }
                    return true;
                }
                return false;
            },
          });
        }
      },
      removeCommand: ({ label }) => {
        checkCallback[label] = false;
      },
      app: "Obsidian",
      workspace: this.app.vault.getName(),
    });
    onAppEvent("log", (evt) => new Notice(evt.content));
    onAppEvent("usage", (evt) =>
      renderOverlay({ Overlay: UsageChart, props: evt })
    );
    let removeLoadingCallback: (() => void) | undefined;
    onAppEvent("connection", (evt) => {
      if (evt.status === "PENDING")
        removeLoadingCallback = renderOverlay({ Overlay: Loading });
      else removeLoadingCallback?.();
    });

    // const unloadSharePageWithNotebook = setupSharePageWithNotebook();

    this.onunload = () => {
      unloadSamePageClient();
    };
  }
}

export default SamePagePlugin;
