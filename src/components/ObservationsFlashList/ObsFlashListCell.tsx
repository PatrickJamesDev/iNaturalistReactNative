import React, { useCallback } from "react";
import type { RealmObservation } from "realmModels/types";
import type { UserPojo } from "realmModels/User";
import { useListItemObservation } from "sharedHooks";
import useStore from "stores/useStore";

import ObsPressable from "./ObsPressable";

interface Props {
  currentUser: UserPojo | null;
  explore: boolean;
  gridItemStyle?: object;
  handleIndividualUploadPress?: ( observationUuid: string ) => void;
  handleItemPress: (
    uuid: string,
    unsynced: boolean,
    observation: RealmObservation | null,
  ) => void;
  hideMetadata?: boolean;
  hideObsStatus?: boolean;
  hideObsUploadStatus?: boolean;
  hideRGLabel?: boolean;
  isSimpleObsStatus?: boolean;
  item: { uuid: string };
  layout: "list" | "grid" | "smallGrid";
}

// One cell of ObservationsFlashList. It owns the subscriptions that change while the list is
// on screen - upload queue membership and progress for *this* observation - so an upload
// progress tick only re-renders the cell that's uploading. It also reads the observation from
// Realm itself (when the caller didn't already supply an API observation), replacing a separate
// isUnsyncedObservation query per cell per render.
const ObsFlashListCell = ( {
  currentUser,
  explore,
  gridItemStyle,
  handleIndividualUploadPress,
  handleItemPress,
  hideMetadata,
  hideObsStatus,
  hideObsUploadStatus,
  hideRGLabel,
  isSimpleObsStatus,
  item,
  layout,
}: Props ) => {
  const { uuid } = item;
  // Explore tiles are API observations and can't be unsynced, so only subscribe to Realm for
  // observations that live in it.
  const observation = useListItemObservation( explore
    ? null
    : uuid );
  const obsNeedsSync = !explore && ( observation?.needsSync( ) ?? false );

  // Subscribe to membership as a boolean so queue changes only re-render the
  // cells whose queued state actually changed, not every visible cell.
  const queued = useStore( state => state.uploadQueue.includes( uuid ) );
  const activeProgress = useStore(
    state => state.totalUploadProgress.find( o => o.uuid === uuid )?.totalProgress,
  );
  // undefined means "not currently uploading"; only coalesce to 0 for observations that need
  // syncing, so the upload icon doesn't appear for already-synced observations
  const uploadProgress = obsNeedsSync
    ? activeProgress ?? 0
    : activeProgress;

  const onUploadButtonPress = useCallback( ( ) => {
    handleIndividualUploadPress?.( uuid );
  }, [handleIndividualUploadPress, uuid] );

  const onItemPress = useCallback( ( ) => {
    handleItemPress( uuid, obsNeedsSync, observation );
  }, [handleItemPress, obsNeedsSync, observation, uuid] );

  return (
    <ObsPressable
      apiObservation={explore
        ? item
        : undefined}
      currentUser={currentUser}
      explore={explore}
      gridItemStyle={gridItemStyle}
      hideMetadata={hideMetadata}
      hideObsStatus={hideObsStatus}
      hideObsUploadStatus={hideObsUploadStatus}
      hideRGLabel={hideRGLabel}
      isSimpleObsStatus={isSimpleObsStatus}
      layout={layout}
      observation={explore
        ? undefined
        : observation}
      onItemPress={onItemPress}
      onUploadButtonPress={onUploadButtonPress}
      queued={queued}
      unsynced={obsNeedsSync}
      uploadProgress={uploadProgress}
      uuid={uuid}
    />
  );
};

const MemoizedObsFlashListCell = React.memo( ObsFlashListCell );

export default MemoizedObsFlashListCell;
