import {
  useCallback, useEffect, useRef, useState,
} from "react";
import { zustandStorage } from "stores/useStore";

interface LayoutHook {
  layout: string | null;
  writeLayoutToStorage: ( newValue: string ) => void;
}

const MAP_DEFAULT_STORAGE_KEYS = ["exploreObservationsLayout", "exploreV2ObservationsLayout"];

const readStoredLayout = ( storageKey: string ) => {
  // Casting is necessary because zustandStorage.getItem returns string | number | null
  const storedLayout = zustandStorage.getItem( storageKey ) as string | null;
  const defaultLayout = MAP_DEFAULT_STORAGE_KEYS.includes( storageKey )
    ? "map"
    : "grid";
  return storedLayout || defaultLayout;
};

const useStoredLayout = ( storageKey: string ): LayoutHook => {
  // MMKV reads are synchronous, so read on the first render instead of rendering
  // a null layout and immediately re-rendering from an effect.
  const [layout, setLayout] = useState<string | null>( ( ) => readStoredLayout( storageKey ) );
  const previousStorageKey = useRef( storageKey );

  const writeLayoutToStorage = useCallback( ( newValue: string ) => {
    zustandStorage.setItem( storageKey, newValue );
    setLayout( newValue );
  }, [storageKey] );

  useEffect( ( ) => {
    if ( previousStorageKey.current === storageKey ) return;
    previousStorageKey.current = storageKey;
    setLayout( readStoredLayout( storageKey ) );
  }, [storageKey] );

  return {
    layout,
    writeLayoutToStorage,
  };
};

export default useStoredLayout;
