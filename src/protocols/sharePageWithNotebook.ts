import type { AppId } from "samepage/types";
import loadSharePageWithNotebook from "samepage/protocols/sharePageWithNotebook";
import type SamePagePlugin from "..";

const setupSharePageWithNotebook = (plugin: SamePagePlugin) => {
  const { unload, rejectPage, joinPage } = loadSharePageWithNotebook({
    overlayProps: {
      viewSharedPageProps: {
        onLinkClick: (title, e) => {
          if (e.shiftKey) {
            app.workspace.getLeaf("split", "vertical");
          } else {
            app.workspace.openLinkText(title, title);
          }
        },
        linkNewPage: (_, title) =>
          app.vault.create(title, "").then((f) => f.basename),
      },
      notificationContainerProps: {
        actions: {
          accept: ({ app, workspace, pageUuid }) =>
            plugin.app.vault.create(pageUuid, "").then((file) =>
              joinPage({
                pageUuid,
                notebookPageId: file.basename,
                source: { app: Number(app) as AppId, workspace },
              }).catch((e) => {
                plugin.app.vault.delete(file);
                return Promise.reject(e);
              })
            ),

          reject: async ({ workspace, app, pageUuid }) =>
            rejectPage({
              source: { app: Number(app) as AppId, workspace },
              pageUuid,
            }),
        },
        api: {
          addNotification: (n) => {
            plugin.data.notifications[n.uuid] = n;
            return plugin.save();
          },
          deleteNotification: (uuid) => {
            delete plugin.data.notifications[uuid];
            return plugin.save();
          },
          getNotifications: async () =>
            Object.values(plugin.data.notifications),
        },
      },
      sharedPageStatusProps: {
        selector: "div.view-header-title",
        getPath: (el) =>
          el.closest<HTMLElement>(".view-header-title-container") || null,
        getHtmlElement: async (title) =>
          Array.from(
            document.querySelectorAll<HTMLHeadingElement>(
              "div.view-header-title"
            )
          ).find((h) => h.textContent === title),
        getNotebookPageId: async (el) => el.textContent,
      },
    },
  });
  return () => {
    unload();
  };
};

export default setupSharePageWithNotebook;
