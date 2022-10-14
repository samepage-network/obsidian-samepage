import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import defaultSettings, {
  DefaultSetting,
} from "samepage/utils/defaultSettings";
import setupSamePageClient from "samepage/protocols/setupSamePageClient";
import type { NotificationContainerProps } from "samepage/components/NotificationContainer";
import setupSharePageWithNotebook, {
  granularChanges,
} from "./protocols/sharePageWithNotebook";
import { onAppEvent } from "samepage/internal/registerAppEventListener";
import renderOverlay from "./utils/renderOverlay";
import Loading from "./components/Loading";

type Notifications = Awaited<
  ReturnType<Required<NotificationContainerProps>["api"]["getNotifications"]>
>;

const IGNORED_LOGS = new Set([
  "list-pages-success",
  "load-remote-message",
  "update-success",
]);

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
            this.plugin.data.settings[s.id] = value;
            if (s.id === "granular-changes") {
              granularChanges.enabled = value;
            }
            this.plugin.save();
          })
        );
      }
    });
  }
}

type PluginData = {
  settings: { [k in DefaultSetting["id"]]?: boolean };
  notifications: Record<string, Notifications[number]>;
};

type RawPluginData = {
  settings?: { [k in DefaultSetting["id"]]?: boolean };
  notifications?: Record<string, Notifications[number]>;
} | null;

class SamePagePlugin extends Plugin {
  data: PluginData = {
    settings: {},
    notifications: {},
  };
  async onload() {
    const { settings = {}, notifications = {} } =
      ((await this.loadData()) as RawPluginData) || {};
    this.data = {
      settings: {
        ...Object.fromEntries(defaultSettings.map((s) => [s.id, s.default])),
        ...settings,
      },
      notifications,
    };

    this.addSettingTab(new SamePageSettingTab(this.app, this));

    const self = this;
    const checkCallback: Record<string, boolean> = {};
    const { unload: unloadSamePageClient } = await setupSamePageClient({
      isAutoConnect: this.data.settings["auto-connect"],
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
        if (label in checkCallback) checkCallback[label] = false;
      },
      app: "Obsidian",
      workspace: this.app.vault.getName(),
      renderOverlay,
    });
    onAppEvent(
      "log",
      (evt) => !IGNORED_LOGS.has(evt.id) && new Notice(evt.content)
    );
    let removeLoadingCallback: (() => void) | undefined;
    onAppEvent("connection", (evt) => {
      if (evt.status === "PENDING")
        removeLoadingCallback = renderOverlay({
          Overlay: Loading,
        }) as () => void;
      else removeLoadingCallback?.();
    });

    const unloadSharePageWithNotebook = setupSharePageWithNotebook(this);

    this.onunload = () => {
      unloadSharePageWithNotebook();
      unloadSamePageClient();
    };
  }
  async save() {
    this.saveData(this.data);
  }
}

export default SamePagePlugin;
