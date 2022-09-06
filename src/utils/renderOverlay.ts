import React from "react";
import { createRoot } from "react-dom/client";
import { v4 } from "uuid";

export type OverlayProps<T extends Record<string, unknown>> = {
  onClose: () => void;
} & T;

const renderOverlay = <T extends Record<string, unknown>>({
  id = v4(),
  Overlay = (props) => React.createElement("div", props),
  props = {} as T,
}: {
  id?: string;
  Overlay?: (props: OverlayProps<T>) => React.ReactElement;
  props?: T;
} = {}) => {
  const parent = document.createElement("div");
  parent.id = id;
  document.body.appendChild(parent);
  const root = createRoot(parent);
  const onClose = () => {
    root.unmount();
    parent.remove();
  };
  root.render(
    React.createElement(Overlay, {
      ...props,
      onClose,
    })
  );
  return onClose;
};

export default renderOverlay;
