import { tailwindFontBold } from "appConstants/fontFamilies";
import classnames from "classnames";
import React from "react";
import type { TextProps } from "react-native";

import InatText from "./InatText";

const UNDERLINE_STYLE = { textDecorationLine: "underline" } as const;

const UnderlinedLink = ( { style, ...props }: TextProps ) => (
  <InatText
    // eslint-disable-next-line react/jsx-props-no-spreading
    {...props}
    className={classnames( "text-md underline", tailwindFontBold, props.className )}
    style={[UNDERLINE_STYLE, style]}
  />
);

export default UnderlinedLink;
