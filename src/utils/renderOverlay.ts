import React from "react";
import { createRoot } from "react-dom/client";
import { RenderOverlay } from "samepage/types";
import { v4 } from "uuid";

export type OverlayProps<T extends Record<string, unknown>> = {
  onClose: () => void;
} & T;

const renderOverlay: RenderOverlay = ({
  id = v4(),
  Overlay = (props) => React.createElement("div", props),
  props = {},
  path,
} = {}) => {
  const parent = document.createElement("div");
  parent.id = id;
  const pathElement =
    typeof path === undefined
      ? document.body.lastElementChild
      : typeof path === "string"
      ? document.querySelector(path)
      : path;
  let onClose: () => void;
  if (
    pathElement &&
    pathElement.parentElement &&
    !pathElement.parentElement.querySelector(`#${id}`)
  ) {
    pathElement.parentElement.insertBefore(parent, pathElement);
    const root = createRoot(parent);
    onClose = () => {
      root.unmount();
      parent.remove();
    };
    root.render(
      //@ts-ignore what is happening here...
      React.createElement(Overlay, {
        ...props,
        onClose,
        isOpen: true,
      })
    );
  }
  return () => {
    onClose?.();
  };
};

export default renderOverlay;
