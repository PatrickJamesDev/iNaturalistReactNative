import {
  copyFileAssets,
  DocumentDirectoryPath,
  MainBundlePath,
  readDirAssets,
  stat,
} from "@dr.pogodin/react-native-fs";
import i18next from "i18next";
import { Alert, Platform } from "react-native";
import Config from "react-native-config";
import type { Location } from "vision-camera-plugin-inatvision";
import {
  COMMON_ANCESTOR_RANK_TYPE,
  getPredictionsForImage,
  getPredictionsForLocation,
  MODE,
} from "vision-camera-plugin-inatvision";

const modelFiles = {
  // The iOS model and taxonomy files always have to be referenced in the
  // xcode project. To avoid constantly having to add new files every time we
  // change the model, we are keeping the files referenced in the xcode
  // project the same but linking them to the files specified in .env in a
  // build phase script. See ios/link-files-for-build-modes.sh
  IOSMODEL: "cvmodel.mlmodelc",
  IOSTAXONOMY: "taxonomy.json",
  IOSGEOMODEL: "geomodel.mlmodelc",
  ANDROIDMODEL: Config.ANDROID_MODEL_FILE_NAME,
  ANDROIDTAXONOMY: Config.ANDROID_TAXONOMY_FILE_NAME,
  ANDROIDGEOMODEL: Config.ANDROID_GEOMODEL_FILE_NAME,
};

export const modelPath: string = Platform.select( {
  ios: `${MainBundlePath}/${modelFiles.IOSMODEL}`,
  android: `${DocumentDirectoryPath}/${modelFiles.ANDROIDMODEL}`,
} );

export const taxonomyPath: string = Platform.select( {
  ios: `${MainBundlePath}/${modelFiles.IOSTAXONOMY}`,
  android: `${DocumentDirectoryPath}/${modelFiles.ANDROIDTAXONOMY}`,
} );

export const geomodelPath: string = Platform.select( {
  ios: `${MainBundlePath}/${modelFiles.IOSGEOMODEL}`,
  android: `${DocumentDirectoryPath}/${modelFiles.ANDROIDGEOMODEL}`,
} );

export const modelVersion = Config.CV_MODEL_VERSION;

export const predictImage = ( uri: string, location?: Location ) => {
  if ( !uri ) {
    return null;
  }
  // Ensure uri is actually well-formed and try to make it well-formed if it's
  // a path
  let url;
  try {
    url = new URL( uri );
  } catch ( _urlError ) {
    try {
      url = new URL( `file://${uri}` );
    } catch ( _urlError2 ) {
      // will handle when url is blank
    }
  }
  if ( !url ) {
    throw new Error( `predictImage received invalid URI: ${uri}` );
  }
  const hasLocation = location?.latitude != null && location?.longitude != null;
  return getPredictionsForImage( {
    uri: url.toString(),
    modelPath,
    taxonomyPath,
    version: modelVersion,
    useGeomodel: hasLocation,
    geomodelPath,
    location: hasLocation
      ? location
      : undefined,
    mode: MODE.COMMON_ANCESTOR,
    commonAncestorRankType: COMMON_ANCESTOR_RANK_TYPE.UNRESTRICTED,
  } );
};

export const predictLocation = ( location: Location ) => getPredictionsForLocation( {
  geomodelPath,
  taxonomyPath,
  location,
} );

const destinationMatchesAsset = async ( destination: string, assetSize: number ) => {
  try {
    const destinationStat = await stat( destination );
    return destinationStat.size === assetSize;
  } catch ( _error ) {
    return false;
  }
};

const addCameraFilesAndroid = async ( ) => {
  const results = await readDirAssets( "camera" );
  const files = [
    { name: modelFiles.ANDROIDMODEL, destination: modelPath },
    { name: modelFiles.ANDROIDTAXONOMY, destination: taxonomyPath },
    { name: modelFiles.ANDROIDGEOMODEL, destination: geomodelPath },
  ];
  const model = results.find( result => result.name === modelFiles.ANDROIDMODEL );

  if ( !model ) {
    Alert.alert(
      i18next.t( "No-model-found" ),
      i18next.t( "During-app-start-no-model-found" ),
    );
    return;
  }

  await Promise.all( files.map( async ( { name, destination } ) => {
    const asset = results.find( result => result.name === name );
    if ( !asset ) {
      console.log( `camera asset not found: ${name}` );
      return;
    }

    // Copying tens of MB on every launch blocks the camera and competes with
    // startup I/O. The asset size changes when a new model is bundled.
    if ( await destinationMatchesAsset( destination, asset.size ) ) return;

    try {
      await copyFileAssets( `camera/${name}`, destination );
      console.log( `moved file from camera/${name} to ${destination}` );
    } catch ( error ) {
      console.log( error, `error moving file from camera/${name} to ${destination}` );
    }
  } ) );
};

export const addARCameraFiles = async ( ) => {
  if ( Platform.OS !== "android" ) return;
  try {
    await addCameraFilesAndroid( );
  } catch ( error ) {
    console.log( error, "error adding Android camera files" );
  }
};
