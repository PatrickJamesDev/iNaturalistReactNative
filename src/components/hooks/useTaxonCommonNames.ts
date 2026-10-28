import { fetchSpeciesCounts } from "api/observations";
import { RealmContext } from "providers/contexts";
import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";
import { UpdateMode } from "realm";
import Taxon from "realmModels/Taxon";
import safeRealmWrite from "sharedHelpers/safeRealmWrite";
import { useAuthenticatedQuery, useLocationPermission } from "sharedHooks";
import { zustandStorage } from "stores/useStore";

import type { UserLocation } from "../../sharedHelpers/fetchCoarseUserLocation";
import fetchCoarseUserLocation from "../../sharedHelpers/fetchCoarseUserLocation";

const { useRealm } = RealmContext;

// Some of the following code might be repetitive with useTaxon
// since we're storing taxon data to realm in each case
const ONE_WEEK_MS = (
  1000 // ms / s
  * 60 // s / min
  * 60 // min / hr
  * 24 // hr / day
  * 7 // day / wk
);
const LAST_FETCH_KEY = "lastTaxonCommonNamesFetch";

interface CommonNameTaxon {
  id?: number;
  [key: string]: unknown;
}

const useTaxonCommonNames = ( ) => {
  const { hasPermissions } = useLocationPermission( );
  const [userLocation, setUserLocation] = useState<UserLocation | null>( null );
  const [locationResolved, setLocationResolved] = useState( false );
  // This runs at the root of the app, so wait until the initial navigation
  // transition is over before issuing the request and touching Realm. Starting
  // it immediately competed with the first screen mount on the JS thread.
  const [startupReady, setStartupReady] = useState( false );
  const [shouldFetchCommonNames] = useState( ( ) => {
    const lastFetch = Number( zustandStorage.getItem( LAST_FETCH_KEY ) );
    return !lastFetch || Date.now( ) - lastFetch > ONE_WEEK_MS;
  } );

  const params: {
    per_page: number;
    fields: {
      taxon: {
        iconic_taxon_name: boolean;
        id: boolean;
        preferred_common_name: boolean;
        name: boolean;
      };
    };
    lat?: number;
    lng?: number;
  } = {
    per_page: 500,
    fields: {
      taxon: {
        iconic_taxon_name: true,
        id: true,
        preferred_common_name: true,
        name: true,
      },
    },
  };

  if ( userLocation?.latitude ) {
    params.lat = userLocation.latitude;
    params.lng = userLocation.longitude;
  }

  useEffect( ( ) => {
    const interaction = InteractionManager.runAfterInteractions( ( ) => {
      setStartupReady( true );
    } );
    return ( ) => interaction.cancel( );
  }, [] );

  const realm = useRealm( );
  const { data } = useAuthenticatedQuery(
    ["fetchSpeciesCounts", userLocation],
    optsWithAuth => fetchSpeciesCounts(
      params,
      optsWithAuth,
    ),
    {
      // Wait for both the permission check and, when granted, the coarse
      // location. Fetching as soon as permissions are unknown caused a 500-row
      // request on every launch, immediately followed by a second request once
      // location resolved.
      enabled: startupReady
        && shouldFetchCommonNames
        && hasPermissions !== undefined
        && ( !hasPermissions || locationResolved ),
    },
  );

  useEffect( ( ) => {
    if ( !hasPermissions || !shouldFetchCommonNames ) return;
    const fetchLocation = async ( ) => {
      try {
        const location = await fetchCoarseUserLocation( );
        setUserLocation( location );
      } finally {
        setLocationResolved( true );
      }
    };
    fetchLocation( );
  }, [hasPermissions, shouldFetchCommonNames] );

  useEffect( ( ) => {
    if ( !data?.results ) return () => {};

    const now = Date.now( );
    const taxaToUpdate: object[] = [];
    data.results.forEach( ( { taxon }: { taxon?: CommonNameTaxon } ) => {
      const taxonId = taxon?.id;
      const localTaxon = taxonId && realm.objectForPrimaryKey( "Taxon", taxonId );
      const missingName = localTaxon
        ? ( !localTaxon.preferred_common_name || !localTaxon.name )
        : false;
      const outOfDate = localTaxon
        ? ( localTaxon._synced_at && ( now - Number( localTaxon._synced_at ) > ONE_WEEK_MS ) )
        : false;
      const localTaxonNeedsSync = (
        // Definitely sync if there's no local copy
        !localTaxon
          // Sync if the local copy hasn't been synced in a week
          || outOfDate
          // Sync if missing a common name or name
          || missingName
      );

      if ( localTaxonNeedsSync && taxon ) {
        taxaToUpdate.push( Taxon.forUpdate( Taxon.mapApiToRealm( taxon, realm ) ) );
      }
    } );

    if ( taxaToUpdate.length === 0 ) {
      zustandStorage.setItem( LAST_FETCH_KEY, Date.now( ) );
      return () => {};
    }

    // One transaction instead of up to 500, each of which notified Realm
    // listeners and competed with UI work. Also keep it out of the current
    // interaction so the write cannot stall a tap or navigation transition.
    const interaction = InteractionManager.runAfterInteractions( ( ) => {
      safeRealmWrite( realm, ( ) => {
        taxaToUpdate.forEach( mappedTaxon => {
          realm.create( "Taxon", mappedTaxon, UpdateMode.Modified );
        } );
      }, "saving taxa in useTaxonCommonNames" );
      zustandStorage.setItem( LAST_FETCH_KEY, Date.now( ) );
    } );
    return ( ) => interaction.cancel( );
  }, [data, realm] );

  return null;
};

export default useTaxonCommonNames;
