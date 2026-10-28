// Shared, synchronous snapshot of whether the user is signed in.
//
// Authenticated query hooks mount on almost every screen. Giving each one its
// own async secure-storage check meant a screen with several queries started
// in the "unknown" state, ran several effects, and re-rendered after each one
// resolved. This store lets new hooks read the already-known value on their
// first render.
type AuthStateListener = () => void;

let authStateSnapshot: boolean | null = null;
const listeners = new Set<AuthStateListener>( );

const getAuthStateSnapshot = ( ) => authStateSnapshot;

const subscribeToAuthState = ( listener: AuthStateListener ) => {
  listeners.add( listener );
  return ( ) => {
    listeners.delete( listener );
  };
};

const setAuthStateSnapshot = ( next: boolean | null ) => {
  if ( authStateSnapshot === next ) return;
  authStateSnapshot = next;
  listeners.forEach( listener => listener( ) );
};

export {
  getAuthStateSnapshot,
  setAuthStateSnapshot,
  subscribeToAuthState,
};
