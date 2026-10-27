import { focusManager } from "@tanstack/react-query";
import useDeviceStorageFull from "components/Camera/hooks/useDeviceStorageFull";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { flushPersistedStoreWrites } from "stores/useStore";

const AppStateListener = ( ) => {
  const { deviceStorageFull, showStorageFullAlert } = useDeviceStorageFull( );
  const [deviceStorageFullShown, setDeviceStorageFullShown] = useState( false );

  useEffect( ( ) => {
    const subscription = AppState.addEventListener( "change", nextAppState => {
      if ( nextAppState === "active" ) {
        // Check storage and show alert as needed when app becomes active
        if ( deviceStorageFull && !deviceStorageFullShown ) {
          showStorageFullAlert( );
          setDeviceStorageFullShown( true );
        }

        focusManager.setFocused( true );
      } else {
        focusManager.setFocused( false );
        // Going to the background: don't leave debounced preference writes unsaved
        flushPersistedStoreWrites( );
      }
    } );

    return ( ) => subscription.remove( );
  }, [deviceStorageFull, deviceStorageFullShown, showStorageFullAlert] );

  return null;
};

export default AppStateListener;
