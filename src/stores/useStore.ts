import merge from "lodash/merge";
import { create } from "zustand";
import type { StateStorage } from "zustand/middleware";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ExploreSlice } from "./createExploreSlice";
import createExploreSlice from "./createExploreSlice";
import type { ExploreV2AdvancedSearchSlice } from "./createExploreV2AdvancedSearchSlice";
import createExploreV2AdvancedSearchSlice from "./createExploreV2AdvancedSearchSlice";
import type { ExploreV2SearchesSlice } from "./createExploreV2SearchesSlice";
import createExploreV2SearchesSlice from "./createExploreV2SearchesSlice";
import type { FeatureFlagSlice } from "./createFeatureFlagSlice";
import createFeatureFlagSlice from "./createFeatureFlagSlice";
import type { FirebaseTraceSlice } from "./createFirebaseTraceSlice";
import createFirebaseTraceSlice from "./createFirebaseTraceSlice";
import type { LayoutSlice } from "./createLayoutSlice";
import createLayoutSlice from "./createLayoutSlice";
import type { MyObservationsSlice } from "./createMyObservationsSlice";
import createMyObservationsSlice from "./createMyObservationsSlice";
import type { ObservationFlowSlice } from "./createObservationFlowSlice";
import createObservationFlowSlice from "./createObservationFlowSlice";
import type { RootExploreSlice } from "./createRootExploreSlice";
import createRootExploreSlice from "./createRootExploreSlice";
import type { SyncObservationsSlice } from "./createSyncObservationsSlice";
import createSyncObservationsSlice from "./createSyncObservationsSlice";
import type { UploadObservationsSlice } from "./createUploadObservationsSlice";
import createUploadObservationsSlice from "./createUploadObservationsSlice";
import storage from "./zustandMMKVBackingStorage";

type StoreState =
  ExploreSlice
  & ExploreV2AdvancedSearchSlice
  & ExploreV2SearchesSlice
  & FeatureFlagSlice
  & FirebaseTraceSlice
  & LayoutSlice
  & MyObservationsSlice
  & ObservationFlowSlice
  & RootExploreSlice
  & SyncObservationsSlice
  & UploadObservationsSlice;

// TODO do *not* export this. This allows any consumer to overwrite *any* part
// of state, circumventing any getter/setter logic we have in the stores. If
// you need to modify state, you should be doing so through a store.
const PERSISTED_STORE_KEY = "persisted-zustand";
const PERSIST_DEBOUNCE_MS = 250;

// zustand's persist middleware rewrites this key on every store update, including
// high-frequency ones like upload progress. Those writes serialize the persisted
// state and hit MMKV synchronously, so coalesce them. Direct reads flush first, so
// callers still observe fresh data.
let pendingPersistedWrite: string | number | null = null;
let lastPersistedWrite: string | number | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

const flushPendingPersistedWrite = ( ) => {
  if ( persistTimer ) {
    clearTimeout( persistTimer );
    persistTimer = null;
  }
  if ( pendingPersistedWrite !== null ) {
    storage.set( PERSISTED_STORE_KEY, pendingPersistedWrite );
    lastPersistedWrite = pendingPersistedWrite;
    pendingPersistedWrite = null;
  }
};

// Exported so the app can flush queued writes when it goes to the background,
// rather than relying on the debounce timer firing before the process is killed.
export const flushPersistedStoreWrites = ( ) => flushPendingPersistedWrite( );

export const zustandStorage = {
  setItem: ( name: string, value: string | number ) => {
    if ( name !== PERSISTED_STORE_KEY ) {
      storage.set( name, value );
      return;
    }
    // Upload progress and other unpersisted fields still make zustand call setItem, but the
    // serialized persisted subset doesn't change, so there's nothing to schedule or write.
    if ( value === lastPersistedWrite ) {
      // State reverted to what's already on disk; drop any queued distinct value so the timer
      // can't write stale data after this point.
      pendingPersistedWrite = null;
      if ( persistTimer ) {
        clearTimeout( persistTimer );
        persistTimer = null;
      }
      return;
    }
    pendingPersistedWrite = value;
    persistTimer ??= setTimeout( flushPendingPersistedWrite, PERSIST_DEBOUNCE_MS );
  },
  getItem: ( name: string ) => {
    if ( name === PERSISTED_STORE_KEY ) {
      flushPendingPersistedWrite( );
    }
    const value = storage.getString( name ) || storage.getNumber( name );
    return value ?? null;
  },
  removeItem: ( name: string ) => {
    if ( name === PERSISTED_STORE_KEY ) {
      pendingPersistedWrite = null;
      lastPersistedWrite = null;
      if ( persistTimer ) {
        clearTimeout( persistTimer );
        persistTimer = null;
      }
    }
    storage.delete( name );
  },
};

// Using slices to separate store for Explore and Observation creation flow
// https://docs.pmnd.rs/zustand/guides/slices-pattern
const useStore = create<StoreState>()( persist(
  ( ...args ) => {
    // Let's make our slices
    const slices = [
      createExploreV2SearchesSlice( ...args ),
      createExploreSlice( ...args ),
      createExploreV2AdvancedSearchSlice( ...args ),
      createFeatureFlagSlice( ...args ),
      createFirebaseTraceSlice( ...args ),
      createLayoutSlice( ...args ),
      createMyObservationsSlice( ...args ),
      createObservationFlowSlice( ...args ),
      createRootExploreSlice( ...args ),
      createSyncObservationsSlice( ...args ),
      createUploadObservationsSlice( ...args ),
    ];

    // Now let's make sure they're not clobbering each other because
    // everything in Zustand state exists in a single namespace and
    // clobbering can happen silently... which is bad.
    const allKeys = slices.map( slice => Object.keys( slice ) ).flat( );
    const keyCounts = allKeys.reduce(
      ( memo: Record<string, number>, curr ) => {
        memo[curr] ||= 0;
        memo[curr] += 1;
        return memo;
      },
      {},
    );
    const nonUniqueKeys = Object.keys( keyCounts ).reduce(
      ( memo: string[], curr ) => {
        if ( keyCounts[curr] > 1 ) memo.push( curr );
        return memo;
      },
      [],
    );
    if ( nonUniqueKeys.length > 0 ) {
      throw new Error(
        `You have multiple Zustand slices with the following keys: ${nonUniqueKeys}`,
      );
    }

    // All good? Now let's combine them into one enormous hideous object
    return slices.reduce(
      ( memo, curr ) => ( { ...memo, ...curr } ),
      {},
    ) as StoreState;
  },
  {
    name: "persisted-zustand",
    partialize: state => ( {
      // Vestigial un-namespaced values in the layout slice
      isAdvancedUser: state.isAdvancedUser,
      obsDetailsTab: state.obsDetailsTab,

      // Dynamically select all values in the layout slice's namespace
      layout: ( ( Object.keys( state.layout ) as ( keyof LayoutSlice["layout"] )[] ).reduce(
        ( memo: Record<string, unknown>, key ) => {
          if ( typeof ( state.layout[key] ) !== "function" ) {
            memo[key] = state.layout[key];
          }
          return memo;
        },
        {},
      ) ),

      exploreRecentSearches: {
        subjects: state.exploreRecentSearches.subjects,
        places: state.exploreRecentSearches.places,
      },

      exploreSavedSearches: {
        searches: state.exploreSavedSearches.searches,
      },
    } ),
    // zustandStorage's getItem actually returns string | number | null instead of zustand's
    // expected string | null. There are some keys in this store (at least `numOfUserObservations`)
    // which are now fully managed _outside_ of zustand which used to be a mix of both.
    // Fixing this situation is tracked in MOB-1372.
    // Casting this here allows for getting most of the useStore typing benefit w/o fixing that
    // functional change just yet.
    storage: createJSONStorage( () => zustandStorage as unknown as StateStorage ),
    // We need to deep merge to persist nested objects, like layout
    // https://zustand.docs.pmnd.rs/middlewares/persist#persisting-a-state-with-nested-objects
    merge: ( persisted, current ) => merge( current, persisted ),
  },
) );

export default useStore;
