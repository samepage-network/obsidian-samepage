import React from "react";
import { createRoot } from "react-dom/client";
import { RenderOverlay } from "samepage/internal/types";
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
  parent.id = id.replace(/^\d*/, "");
  let onClose: () => void;
  const finishRendering = () => {
    const pathElement =
      typeof path === "undefined"
        ? document.body.lastElementChild
        : typeof path === "string"
        ? document.querySelector(path)
        : path;
    if (
      pathElement &&
      pathElement.parentElement &&
      !pathElement.parentElement.querySelector(`#${parent.id}`)
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
  };
  // TODO - need a better way to solve this race condition
  if (parent.id === "samepage-notification-container") {
    setTimeout(finishRendering, 1000);
  } else {
    finishRendering();
  }

  return () => {
    onClose?.();
  };
};

export default renderOverlay;
