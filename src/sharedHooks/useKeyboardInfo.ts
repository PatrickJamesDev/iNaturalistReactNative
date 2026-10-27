import {
  useEffect, useMemo, useRef, useState,
} from "react";
import {
  Dimensions,
  Keyboard,
} from "react-native";

// Returns info about the keyboard, like whether it's up and how tall it is
const useKeyboardInfo = ( targetNonKeyboardHeight = 0 ) => {
  const [keyboardShown, setKeyboardShown] = useState( false );
  const [keyboardHeight, setKeyboardHeight] = useState( 0 );
  const nonKeyboardHeight = useMemo(
    ( ) => Dimensions.get( "screen" ).height - keyboardHeight,
    [keyboardHeight],
  );

  const keyboardVerticalOffset = useMemo( ( ) => ( nonKeyboardHeight < targetNonKeyboardHeight
    ? nonKeyboardHeight - targetNonKeyboardHeight
    : 30 ), [nonKeyboardHeight, targetNonKeyboardHeight] );

  // Track visibility in a ref so the native listeners can be registered once
  // for the lifetime of the component instead of being torn down and re-added
  // on every keyboard transition.
  const keyboardShownRef = useRef( false );

  useEffect( ( ) => {
    const showSubscription = Keyboard.addListener( "keyboardDidShow", keyboardDidShowEvent => {
      if ( keyboardShownRef.current ) return;
      keyboardShownRef.current = true;
      setKeyboardHeight( keyboardDidShowEvent.endCoordinates.height );
      setKeyboardShown( true );
    } );
    const hideSubscription = Keyboard.addListener( "keyboardDidHide", keyboardDidHideEvent => {
      if ( !keyboardShownRef.current ) return;
      keyboardShownRef.current = false;
      setKeyboardHeight( keyboardDidHideEvent.endCoordinates.height );
      setKeyboardShown( false );
    } );

    return ( ) => {
      showSubscription.remove( );
      hideSubscription.remove( );
    };
  }, [] );

  return {
    keyboardHeight,
    keyboardShown,
    keyboardVerticalOffset,
    nonKeyboardHeight,
  };
};

export default useKeyboardInfo;
