import { ScrollView, View } from "components/styledComponents";
import type { PropsWithChildren } from "react";
import * as React from "react";
import type { ScrollView as RNScrollView, ViewStyle } from "react-native";
import { Keyboard, StatusBar } from "react-native";

interface Props extends PropsWithChildren {
  testID?: string;
  style?: ViewStyle;
  scrollRef?: React.Ref<RNScrollView>;
}

const CONTENT_CONTAINER_STYLE = {
  display: "flex",
  minHeight: "100%",
} as const;

const ScrollViewWrapper = ( {
  children,
  testID,
  style,
  scrollRef,
}: Props ) => {
  // Dismissing the keyboard on every scroll frame means a native call per frame even once the
  // keyboard is gone. Track visibility so scrolling stays free of native work when it's hidden.
  const keyboardVisible = React.useRef( false );
  React.useEffect( ( ) => {
    // The keyboard may already be up when this mounts (e.g. an autofocused input)
    keyboardVisible.current = Keyboard.isVisible( );
    const showSubscription = Keyboard.addListener( "keyboardDidShow", ( ) => {
      keyboardVisible.current = true;
    } );
    const hideSubscription = Keyboard.addListener( "keyboardDidHide", ( ) => {
      keyboardVisible.current = false;
    } );
    return ( ) => {
      showSubscription.remove( );
      hideSubscription.remove( );
    };
  }, [] );

  const dismissKeyboard = ( ) => {
    if ( keyboardVisible.current ) Keyboard.dismiss( );
  };

  return (
    <View className="flex-1 bg-white" style={style} testID={testID}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        ref={scrollRef}
        keyboardDismissMode="on-drag"
        onScroll={dismissKeyboard}
        scrollEventThrottle={16}
        contentContainerStyle={CONTENT_CONTAINER_STYLE}
      >
        {children}
      </ScrollView>
    </View>
  );
};

export default ScrollViewWrapper;
