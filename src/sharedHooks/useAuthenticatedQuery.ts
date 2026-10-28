import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { getJWT, isLoggedIn } from "components/LoginSignUp/AuthenticationService";
import { useEffect, useSyncExternalStore } from "react";
import {
  getAuthStateSnapshot,
  subscribeToAuthState,
} from "sharedHelpers/authState";
import { handleRetryDelay, reactQueryRetry } from "sharedHelpers/logging";

const LOGGED_IN_UNKNOWN = null;

export type AuthenticatedQueryOptions<Response> = Omit<
  UseQueryOptions<Response>,
  "queryKey" | "queryFn" | "enabled" | "retry"
> & {
  allowAnonymousJWT?: boolean;
  enabled?: boolean;
  retry?: boolean;
  refetchInterval?: number;
}

export type QueryFunction<Response>
  = ( options: { api_token: string | null } ) => Promise<Response>;

// Should work like React Query's useQuery except it calls the queryFunction
// with an object that includes the JWT
const useAuthenticatedQuery = <Response>(
  queryKey: QueryKey,
  queryFunction: QueryFunction<Response>,
  queryOptions: AuthenticatedQueryOptions<Response> = {},
) => {
  // Read the shared auth snapshot synchronously. Once any query has checked
  // auth, later screens mount with the known value and skip the async effect
  // and extra render they used to do on every navigation.
  const userLoggedIn = useSyncExternalStore(
    subscribeToAuthState,
    getAuthStateSnapshot,
    getAuthStateSnapshot,
  );

  useEffect( ( ) => {
    let cancelled = false;
    const checkAuth = async ( ) => {
      try {
        await isLoggedIn( );
      } catch ( error ) {
        if ( !cancelled ) console.warn( "Auth check failed:", error );
      }
    };

    if ( userLoggedIn === null ) checkAuth( );
    return ( ) => {
      cancelled = true;
    };
  }, [userLoggedIn] );

  // The results will probably be different depending on whether the user is
  // signed in or we wouldn't be using useAuthenticatedQuery in the first
  // place, so we need to redo this request if the auth state changed
  const authQueryKey = [...queryKey, queryOptions.allowAnonymousJWT, userLoggedIn];

  return useQuery( {
    queryKey: authQueryKey,
    queryFn: async ( ) => {
      // Note, getJWT() takes care of fetching a new token if the existing
      // one is expired. We *could* store the token in state with useState if
      // fetching from RNSInfo becomes a performance issue
      const apiToken = await getJWT( queryOptions.allowAnonymousJWT );
      const options = {
        api_token: apiToken,
      };
      return queryFunction( options );
    },
    ...queryOptions,
    retry: queryOptions.retry !== false
      ? ( failureCount, error ) => reactQueryRetry( failureCount, error, {
        queryKey,
      } )
      : false,
    retryDelay: ( failureCount, error ) => handleRetryDelay( failureCount, error ),
    // Authenticated queries should not run until we know whether or not the
    // user is signed in
    enabled: userLoggedIn !== LOGGED_IN_UNKNOWN && queryOptions.enabled,
  } );
};

export default useAuthenticatedQuery;
