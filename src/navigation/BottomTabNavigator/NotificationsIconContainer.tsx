import { fetchUnviewedObservationUpdatesCount } from "api/observations";
import NotificationsIcon from "navigation/BottomTabNavigator/NotificationsIcon";
import React, { useEffect, useState } from "react";
import { AppState } from "react-native";
import {
  useAuthenticatedQuery,
  useCurrentUser,
} from "sharedHooks";
import useStore from "stores/useStore";

interface Props {
  icon: string;
  active: boolean;
  size: number;
}

const NotificationsIconContainer = ( {
  size,
  icon,
  active,
}: Props ) => {
  const currentUser = useCurrentUser( );
  const observationMarkedAsViewedAt = useStore( state => state.observationMarkedAsViewedAt );
  const [isAppActive, setIsAppActive] = useState( AppState.currentState === "active" );

  useEffect( ( ) => {
    const subscription = AppState.addEventListener( "change", nextAppState => {
      setIsAppActive( nextAppState === "active" );
    } );
    return ( ) => subscription.remove( );
  }, [] );

  // TODO: enable fields if it makes sense
  // https://linear.app/inaturalist/issue/MOB-1362/enable-fields-for-unviewed-updates-count-in-notificationsicon
  const { data: unviewedUpdatesCount, refetch } = useAuthenticatedQuery(
    [
      "notificationsCount",
    ],
    optsWithAuth => fetchUnviewedObservationUpdatesCount( {}, optsWithAuth ),
    {
      enabled: !!currentUser && isAppActive,
      // We want to check for notifications at a set interval, but
      // keep a stable query key so we don't create unbounded cached queries.
      // Stop polling while the app is backgrounded so it doesn't drain the
      // battery or wake the network when the user isn't looking.
      refetchInterval: isAppActive
        ? 60_000
        : false,
    },
  );

  useEffect( () => {
    if ( currentUser ) {
      refetch();
    }
  }, [observationMarkedAsViewedAt, refetch, currentUser] );

  const hasUnread = ( unviewedUpdatesCount ?? 0 ) > 0;

  return (
    <NotificationsIcon
      icon={icon}
      unread={hasUnread}
      active={active}
      size={size}
    />
  );
};

export default NotificationsIconContainer;
