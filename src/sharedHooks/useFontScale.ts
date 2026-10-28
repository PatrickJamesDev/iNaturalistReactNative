import { useMemo, useSyncExternalStore } from "react";
import { Dimensions } from "react-native";

const LARGE_FONT_SCALE = 1.3;

interface FontScale {
  isLargeFontScale: boolean;
}

// Every taxon tile in a grid used to register its own Dimensions listener. Keep
// one module-level listener and share the current value between all tiles.
let currentFontScale = Dimensions.get( "window" ).fontScale;
const listeners = new Set<() => void>( );
let dimensionSubscription: ReturnType<typeof Dimensions.addEventListener> | null = null;

const subscribe = ( listener: () => void ) => {
  if ( listeners.size === 0 ) {
    // Catch up on any change that happened while nothing was subscribed.
    currentFontScale = Dimensions.get( "window" ).fontScale;
  }
  listeners.add( listener );
  if ( listeners.size === 1 ) {
    dimensionSubscription = Dimensions.addEventListener( "change", ( { window } ) => {
      if ( window.fontScale === currentFontScale ) return;
      currentFontScale = window.fontScale;
      listeners.forEach( notify => notify( ) );
    } );
  }
  return ( ) => {
    listeners.delete( listener );
    if ( listeners.size === 0 && dimensionSubscription ) {
      dimensionSubscription.remove( );
      dimensionSubscription = null;
    }
  };
};

const getSnapshot = ( ) => currentFontScale;

const useFontScale = ( ): FontScale => {
  const fontScale = useSyncExternalStore( subscribe, getSnapshot, getSnapshot );
  const isLargeFontScale = fontScale > LARGE_FONT_SCALE;
  return useMemo( ( ) => ( { isLargeFontScale } ), [isLargeFontScale] );
};

export default useFontScale;
