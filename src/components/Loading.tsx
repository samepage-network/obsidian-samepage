import { Spinner, SpinnerSize } from "@blueprintjs/core";
import React from "react";

const Loading = () => {
  return (
    <Spinner
      size={SpinnerSize.SMALL}
      style={{ position: "absolute", top: 16, right: 16 }}
    />
  );
};

export default Loading;
