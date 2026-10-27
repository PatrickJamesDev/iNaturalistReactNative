import { activateKeepAwake, deactivateKeepAwake } from "@sayem314/react-native-keep-awake";
import type { RealmObservation } from "realmModels/types";
import filterDirtyPos from "uploaders/dataTransformation/filterDirtyPos";
import type { StateCreator } from "zustand";

export const UPLOAD_CANCELLED = "cancelled";
export const UPLOAD_PENDING = "pending";
export const UPLOAD_COMPLETE = "complete";
export const UPLOAD_IN_PROGRESS = "in-progress";

type UploadStatus = typeof UPLOAD_PENDING
  | typeof UPLOAD_IN_PROGRESS
  | typeof UPLOAD_COMPLETE
  | typeof UPLOAD_CANCELLED;

interface TotalUploadProgress {
  uuid: string;
  currentIncrements: number;
  totalIncrements: number;
  totalProgress: number;
}

interface UploadObservationsState {
  abortController: AbortController | null;
  currentUpload: RealmObservation | null;
  errorsByUuid: object;
  multiError: string | null;
  initialNumObservationsInQueue: number;
  numUploadsAttempted: number;
  totalToolbarIncrements: number;
  totalToolbarProgress: number;
  totalUploadProgress: TotalUploadProgress[];
  uploadQueue: string[];
  uploadStatus: UploadStatus;
}

interface UploadObservationsActions {
  resetUploadObservationsSlice: ( ) => void;
  addUploadError: ( error: string, obsUUID: string ) => void;
  stopAllUploads: ( ) => void;
  setCannotUploadObservations: ( ) => void;
  setStartUploadObservations: ( ) => void;
  completeUploads: ( ) => void;
  updateTotalUploadProgress: ( uuid: string, increment: number ) => void;
  setUploadStatus: ( uploadStatus: UploadStatus ) => void;
  addToUploadQueue: ( uuids: string | string[] ) => void;
  removeFromUploadQueue: ( ) => void;
  setCurrentUpload: ( observation: RealmObservation ) => void;
  setTotalToolbarIncrements: ( queuedObservations: RealmObservation[] ) => void;
  addTotalToolbarIncrements: ( observation: RealmObservation | null ) => void;
  removeDeletedObsFromUploadQueue: ( uuid: string ) => void;
  getTotalUploadErrors: ( ) => number;
  getNumUploadedWithoutErrors: ( ) => number;
  getCompletedUploads: ( ) => number;
}

export type UploadObservationsSlice = UploadObservationsState & UploadObservationsActions;

const DEFAULT_STATE: UploadObservationsState = {
  abortController: null,
  currentUpload: null,
  errorsByUuid: {},
  // Single error caught during multiple obs upload
  multiError: null,
  initialNumObservationsInQueue: 0,
  // Increments even if there was an error, so here "attempted" means we tried
  // to upload it, not that it succeeded
  numUploadsAttempted: 0,
  totalToolbarIncrements: 0,
  totalToolbarProgress: 0,
  totalUploadProgress: [],
  uploadQueue: [],
  uploadStatus: UPLOAD_PENDING,
};

const countEvidenceIncrements = (
  upload: RealmObservation | null,
  evidence: "observationPhotos" | "observationSounds",
): number => {
  const evidenceToUpload = upload?.[evidence];
  if ( evidenceToUpload && evidenceToUpload.length > 0 ) {
    const evidenceNeedsUpdate = evidenceToUpload
      .filter( e => e.wasSynced( ) ).length;
    const evidenceNeedsSync = evidenceToUpload
      .filter( e => !e.wasSynced( ) ).length;
    // since we're incrementing by half when evidence is attached to
    // an observation, we also want to count half the total increments for previously
    // synced evidence
    return evidenceNeedsSync + ( evidenceNeedsUpdate / 2 );
  }
  return 0;
};

const countProjectAttachmentIncrements = (
  upload: RealmObservation | null,
): number => {
  if ( !upload ) {
    return 0;
  }
  return filterDirtyPos( upload ).length > 0
    ? 1
    : 0;
};

const countTotalIncrements = ( upload: RealmObservation | null ): number => 1
  + countEvidenceIncrements( upload, "observationPhotos" )
  + countEvidenceIncrements( upload, "observationSounds" )
  + countProjectAttachmentIncrements( upload );

const createUploadProgressObj = ( upload: RealmObservation, increment: number ) => ( {
  uuid: upload.uuid,
  currentIncrements: increment,
  totalIncrements: countTotalIncrements( upload ),
} );

const countMappedIncrements = ( list: number[] ): number => list.reduce(
  ( count, current ) => count + Number( current ),
  0,
);

const setCurrentToolbarIncrements = (
  totalUploadProgress: TotalUploadProgress[],
): number => countMappedIncrements(
  totalUploadProgress.map( u => u.currentIncrements ),
);

const calculateTotalToolbarIncrements = (
  uploads: ( RealmObservation | null )[],
): number => countMappedIncrements(
  uploads.map( u => countTotalIncrements( u ) ),
);

const setTotalToolbarProgress = (
  totalToolbarIncrements: number,
  totalUploadProgress: TotalUploadProgress[],
): number => (
  totalToolbarIncrements > 0
    ? setCurrentToolbarIncrements( totalUploadProgress ) / totalToolbarIncrements
    : 0
);

const createUploadObservationsSlice: StateCreator<UploadObservationsSlice> = ( set, get ) => ( {
  ...DEFAULT_STATE,
  resetUploadObservationsSlice: ( ) => {
    // Preserve the abortController just in case something might try and use it
    const { abortController } = get( );
    const defaultStateWithController = {
      abortController,
      currentUpload: null,
      errorsByUuid: {},
      multiError: null,
      initialNumObservationsInQueue: 0,
      numUploadsAttempted: 0,
      totalToolbarIncrements: 0,
      totalToolbarProgress: 0,
      totalUploadProgress: [],
      uploadQueue: [],
      uploadStatus: UPLOAD_PENDING,
    };

    return set( defaultStateWithController );
  },
  addUploadError: ( error, obsUUID ) => set( state => ( {
    errorsByUuid: {
      ...state.errorsByUuid,
      [obsUUID]: [
        ...( state.errorsByUuid[obsUUID] || [] ),
        error,
      ],
    },
    multiError: error,
  } ) ),
  stopAllUploads: ( ) => {
    deactivateKeepAwake( );
    const { abortController } = get( );
    abortController?.abort();

    const cancelledStateWithController = {
      // Preserve the abort controller in case in might still get used. It
      // should only get regenerated when the uploads start
      abortController,
      currentUpload: null,
      errorsByUuid: {},
      multiError: null,
      initialNumObservationsInQueue: 0,
      numUploadsAttempted: 0,
      totalToolbarIncrements: 0,
      totalToolbarProgress: 0,
      totalUploadProgress: [],
      uploadQueue: [],
      uploadStatus: UPLOAD_CANCELLED,
    };

    return set( cancelledStateWithController );
  },
  // Sets state to indicate that upload is needed without necessarily
  // resetting the state, as there might still be observations to upload
  setCannotUploadObservations: ( ) => set( { uploadStatus: UPLOAD_PENDING } ),
  // Sets the state to start uploading observations
  setStartUploadObservations: ( ) => {
    activateKeepAwake( );
    return set( {
      // Make a new abort controller for this upload session
      abortController: new AbortController( ),
      uploadStatus: UPLOAD_IN_PROGRESS,
    } );
  },
  completeUploads: ( ) => {
    deactivateKeepAwake( );
    set( { uploadStatus: UPLOAD_COMPLETE } );
  },
  updateTotalUploadProgress: ( uuid: string, increment: number ) => set( state => {
    const {
      currentUpload,
      totalToolbarIncrements,
      totalUploadProgress: existingTotalUploadProgress,
    } = state;
    // Build new objects instead of mutating the existing progress entries. Mutating them in
    // place kept the same object identities in state, which defeats memoized cells and makes
    // it possible for two subscribers to observe different values for the same entry.
    const currentObsProgressObj = existingTotalUploadProgress.find( o => o.uuid === uuid );
    let totalUploadProgress = existingTotalUploadProgress || [];
    if ( currentObsProgressObj ) {
      totalUploadProgress = totalUploadProgress.map( o => {
        if ( o.uuid !== uuid ) return o;
        const currentIncrements = o.currentIncrements + increment;
        return {
          ...o,
          currentIncrements,
          totalProgress: currentIncrements / o.totalIncrements,
        };
      } );
    } else if ( currentUpload ) {
      const progressObj = createUploadProgressObj( currentUpload, increment );
      totalUploadProgress = [
        ...totalUploadProgress,
        {
          ...progressObj,
          totalProgress: progressObj.currentIncrements / progressObj.totalIncrements,
        },
      ];
    }
    return {
      totalUploadProgress,
      totalToolbarProgress: setTotalToolbarProgress( totalToolbarIncrements, totalUploadProgress ),
    };
  } ),
  setUploadStatus: ( uploadStatus: UploadStatus ) => set( ( ) => ( {
    uploadStatus,
  } ) ),
  addToUploadQueue: ( uuids: string | string[] ) => set( state => ( {
    // Never mutate the array that's already in state: subscribers that select uploadQueue by
    // reference would miss the change
    uploadQueue: typeof uuids === "string"
      ? [uuids, ...state.uploadQueue]
      : [...state.uploadQueue, ...uuids],
    initialNumObservationsInQueue: state.initialNumObservationsInQueue
      + ( typeof uuids === "string"
        ? 1
        : uuids.length ),
  } ) ),
  removeFromUploadQueue: ( ) => set( state => ( {
    uploadQueue: state.uploadQueue.slice( 0, -1 ),
    currentUpload: null,
  } ) ),
  setCurrentUpload: observation => set( state => ( {
    currentUpload: observation,
    numUploadsAttempted: state.numUploadsAttempted + 1,
  } ) ),
  setTotalToolbarIncrements: queuedObservations => set( ( ) => ( {
    totalToolbarIncrements: calculateTotalToolbarIncrements( queuedObservations ),
  } ) ),
  addTotalToolbarIncrements: observation => set( state => {
    const { totalToolbarIncrements: previousToolbarIncrements } = state;

    const additionalToolbarIncrements = calculateTotalToolbarIncrements( [observation] );

    return ( {
      totalToolbarIncrements: previousToolbarIncrements + additionalToolbarIncrements,
    } );
  } ),
  removeDeletedObsFromUploadQueue: uuid => set( state => {
    const {
      initialNumObservationsInQueue,
      numUploadsAttempted,
      totalToolbarIncrements,
      totalUploadProgress: existingTotalUploadProgress,
      uploadQueue,
    } = state;
    // Zustand does *not* make deep copies when making supposedly immutable
    // state changes, so for nested objects like this, we need to create a
    // new object explicitly.
    // https://github.com/pmndrs/zustand/blob/main/docs/guides/immutable-state-and-merging.md#nested-objects
    const totalUploadProgress = ( existingTotalUploadProgress || [] ).map( o => (
      o.uuid === uuid
        ? { ...o, totalProgress: o.totalIncrements, currentIncrements: o.totalIncrements }
        : o
    ) );

    // return the new queue without the uuid of the object already deleted remotely
    const queueWithDeleted = uploadQueue.filter( uuidInQueue => uuidInQueue !== uuid );

    return ( {
      uploadQueue: queueWithDeleted,
      currentUpload: null,
      totalUploadProgress,
      totalToolbarProgress: setTotalToolbarProgress( totalToolbarIncrements, totalUploadProgress ),
      uploadStatus: numUploadsAttempted === initialNumObservationsInQueue
        ? UPLOAD_COMPLETE
        : UPLOAD_IN_PROGRESS,
    } );
  } ),
  getTotalUploadErrors: () => Object.keys( get().errorsByUuid ).length,
  getNumUploadedWithoutErrors: () => get().numUploadsAttempted - get().getTotalUploadErrors(),
  getCompletedUploads: () => {
    const uploads = get().numUploadsAttempted;
    const errors = get().getTotalUploadErrors();
    const inQueue = get().uploadQueue.length;

    // An upload is considered complete if:
    // 1. It was attempted (increments numUploadsAttempted)
    // 2. It's no longer in the queue (removed from uploadQueue)
    // 3. It didn't error (not counted in errorsByUuid)
    return Math.max( 0, uploads - inQueue - errors );
  },
} );

export default createUploadObservationsSlice;
