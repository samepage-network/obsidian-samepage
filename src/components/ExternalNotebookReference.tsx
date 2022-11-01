import React, { useEffect, useState, useCallback } from "react";
import { Classes, Dialog } from "@blueprintjs/core";
import type { InitialSchema, OverlayProps } from "samepage/internal/types";
import apiClient from "samepage/internal/apiClient";
import atJsonToObsidian from "../utils/atJsonToObsidian";
import type { default as SamePagePlugin } from "../main";
import renderOverlay from "../utils/renderOverlay";

export const references: Record<string, Record<string, InitialSchema>> = {};

const ExternalNotebookReference = ({
  notebookUuid,
  notebookPageId,
  plugin,
  isOpen,
  onClose,
}: OverlayProps<{
  notebookUuid: string;
  notebookPageId: string;
  plugin: SamePagePlugin;
}>) => {
  const [data, setData] = useState<InitialSchema>(
    references[notebookUuid]?.[notebookPageId] || {
      content: `Loading reference from external notebook...`,
      annotations: [],
    }
  );
  const setReferenceData = useCallback(
    (data: InitialSchema) => {
      if (!references[notebookUuid]) references[notebookUuid] = {};
      setData((references[notebookUuid][notebookPageId] = data));
    },
    [notebookPageId, notebookUuid]
  );
  useEffect(() => {
    apiClient<{
      found: boolean;
      data: InitialSchema;
    }>({
      method: "query",
      request: `${notebookUuid}:${notebookPageId}`,
    }).then((e) => {
      const { found, data } = e;
      const newData = found
        ? data
        : { content: "Notebook reference not found", annotations: [] };
      setReferenceData(newData);
    });
    const queryResponseListener = ((e: CustomEvent) => {
      const { request, data } = e.detail as {
        request: string;
        data: InitialSchema;
      };
      if (request === `${notebookUuid}:${notebookPageId}`) {
        setReferenceData(
          data || { content: "Notebook reference not found", annotations: [] }
        );
      }
    }) as EventListener;
    document.body.addEventListener(
      "samepage:reference:response",
      queryResponseListener
    );
    return () =>
      document.body.removeEventListener(
        "samepage:reference:response",
        queryResponseListener
      );
  }, [setReferenceData, notebookUuid, notebookPageId]);
  return (
    <Dialog
      className="obsidian-connected-ref"
      isOpen={isOpen}
      title={notebookPageId}
      onClose={onClose}
    >
      <div className={`text-black ${Classes.DIALOG_BODY}`}>
        {atJsonToObsidian(data, plugin)}
      </div>
    </Dialog>
  );
};

export const render = (s: HTMLSpanElement, plugin: SamePagePlugin) => {
  const text = s.textContent;
  if (text) {
    const [notebookUuid, notebookPageId] = text.split(":");
    if (notebookPageId) {
      s.onmousedown = (e) => {
        renderOverlay({
          Overlay: ExternalNotebookReference,
          props: { notebookPageId, notebookUuid, plugin },
        });
        e.preventDefault();
        e.stopPropagation();
      };
    }
  }
};

export default ExternalNotebookReference;
