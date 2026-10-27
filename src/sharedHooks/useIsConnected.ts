import NetInfo from "@react-native-community/netinfo";
import { useSyncExternalStore } from "react";

// NetInfo's useNetInfo hook registers a native listener per component instance, and the small
// grid renders one connected wrapper per tile, so mounting and recycling tiles used to churn
// dozens of listeners while scrolling. Keep one listener for the app and share its snapshot.
let isConnected: boolean | null = null;
let listenerAttached = false;
let unsubscribeFromNetInfo: ( ( ) => void ) | null = null;
const subscribers = new Set<( ) => void>( );

const handleNetInfoChange = ( state: { isConnected: boolean | null } ) => {
  const { isConnected: nextIsConnected } = state;
  if ( nextIsConnected === isConnected ) return;
  isConnected = nextIsConnected;
  subscribers.forEach( subscriber => subscriber( ) );
};

const attachNetInfoListener = ( ) => {
  if ( listenerAttached ) return;
  listenerAttached = true;
  if ( typeof NetInfo?.addEventListener !== "function" ) return;
  const unsubscribe = NetInfo.addEventListener( handleNetInfoChange );
  unsubscribeFromNetInfo = typeof unsubscribe === "function"
    ? unsubscribe
    : null;
};

const detachNetInfoListener = ( ) => {
  unsubscribeFromNetInfo?.( );
  unsubscribeFromNetInfo = null;
  listenerAttached = false;
};

const subscribe = ( subscriber: ( ) => void ) => {
  subscribers.add( subscriber );
  attachNetInfoListener( );
  return ( ) => {
    subscribers.delete( subscriber );
    if ( subscribers.size === 0 ) detachNetInfoListener( );
  };
};

const getSnapshot = ( ) => isConnected;

const useIsConnected = ( ): boolean | null => useSyncExternalStore(
  subscribe,
  getSnapshot,
  getSnapshot,
);

export default useIsConnected;
