import isEqual from "lodash/isEqual";
import { RealmContext } from "providers/contexts";
import { useEffect, useState, useSyncExternalStore } from "react";
import type Realm from "realm";
import type { UserPojo } from "realmModels/User";
import User from "realmModels/User";

const { useRealm } = RealmContext;

// The signed-in user is read by a huge number of components, including every
// TaxonGridItem/DisplayTaxon in a list. If each hook instance subscribed to
// Realm itself, a screen with twenty tiles would register twenty listeners and
// run twenty queries, and FlashList recycling would churn them as the user
// scrolls. Instead there is one Realm listener per active realm and one
// immutable snapshot shared through useSyncExternalStore.
interface RealmResultsLike {
  addListener: ( _listener: ( ) => void ) => void;
  removeListener: ( _listener: ( ) => void ) => void;
}

let listeningRealm: Realm | null = null;
let realmResults: RealmResultsLike | null = null;
let realmListener: ( ( ) => void ) | null = null;
let snapshot: UserPojo | null = null;
const subscribers = new Set<( ) => void>( );
// Realm change notifications are delivered asynchronously, so the shared
// snapshot can lag behind the database when a new screen mounts right after a
// write (e.g. sign-in). Re-read it at most once per render tick so every cell
// mounted in that tick gets a fresh value without each one issuing its own
// query.
let resyncedThisTick = false;

const notifySubscribers = ( ) => {
  subscribers.forEach( subscriber => subscriber( ) );
};

const resyncSnapshot = ( ) => {
  if ( !listeningRealm || !realmResults || resyncedThisTick ) return;
  resyncedThisTick = true;
  queueMicrotask( ( ) => {
    resyncedThisTick = false;
  } );
  const next = User.mapRealmToPojo( User.currentUser( listeningRealm ) );
  if ( isEqual( snapshot, next ) ) return;
  snapshot = next;
  // Wake already-mounted consumers from a microtask, never during render.
  if ( subscribers.size > 0 ) queueMicrotask( notifySubscribers );
};

const stopListening = ( ) => {
  if ( realmResults && realmListener ) {
    try {
      realmResults.removeListener( realmListener );
    } catch {
      // The realm may already be closed, e.g. when a test tears down
    }
  }
  realmResults = null;
  realmListener = null;
  listeningRealm = null;
};

const startListening = ( realm: Realm | null, notify = false ) => {
  if ( !realm || realm.isClosed ) {
    const hadUser = snapshot !== null;
    snapshot = null;
    if ( notify && hadUser ) notifySubscribers( );
    return;
  }
  if ( listeningRealm === realm && realmResults ) {
    resyncSnapshot( );
    return;
  }

  stopListening( );
  listeningRealm = realm;
  // Compute synchronously so the first render already sees the user, matching
  // the previous hook's lazy state initializer.
  const previousSnapshot = snapshot;
  snapshot = User.mapRealmToPojo( User.currentUser( realm ) );

  realmResults = realm.objects( User ).filtered( "signedIn == true" );
  realmListener = ( ) => {
    const next = User.mapRealmToPojo( User.currentUser( realm ) );
    if ( isEqual( snapshot, next ) ) return;
    snapshot = next;
    notifySubscribers( );
  };
  realmResults.addListener( realmListener );
  // When the realm is swapped after mount we're in an effect, so it's safe (and
  // necessary) to wake up components that rendered against the old realm.
  if ( notify && !isEqual( previousSnapshot, snapshot ) ) notifySubscribers( );
};

const subscribe = ( subscriber: ( ) => void ) => {
  subscribers.add( subscriber );
  return ( ) => {
    subscribers.delete( subscriber );
  };
};

const getSnapshot = ( ) => snapshot;

const useCurrentUser = ( ): UserPojo | null => {
  const realm = useRealm( );

  // Initialize (or re-initialize, if the Realm instance is replaced) before the
  // snapshot is read, so the first render returns the signed-in user.
  const [initializedRealm] = useState( ( ) => {
    startListening( realm );
    return realm;
  } );

  useEffect( ( ) => {
    if ( initializedRealm !== realm ) startListening( realm, true );
  }, [initializedRealm, realm] );

  return useSyncExternalStore( subscribe, getSnapshot, getSnapshot );
};

export default useCurrentUser;
