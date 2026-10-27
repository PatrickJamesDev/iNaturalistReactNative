import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

const DEFAULT_MAX_PATH_LENGTH = 80;
const MAX_CMAKE_CACHE_DEPTH = 6;

let rootArg = "";
let clean = false;
let maxPathLength = DEFAULT_MAX_PATH_LENGTH;

const args = process.argv.slice( 2 );
for ( let i = 0; i < args.length; i += 1 ) {
  const arg = args[i];
  if ( arg === "--clean" ) {
    clean = true;
  } else if ( arg === "--max-path-length" && args[i + 1] ) {
    maxPathLength = Number( args[i + 1] ) || maxPathLength;
    i += 1;
  } else if ( arg.startsWith( "--max-path-length=" ) ) {
    maxPathLength = Number( arg.split( "=" )[1] ) || maxPathLength;
  } else if ( !rootArg && !arg.startsWith( "-" ) ) {
    rootArg = arg;
  } else {
    console.error( `ERROR: Unknown argument: ${arg}` );
    process.exit( 1 );
  }
}

if ( !rootArg ) {
  console.error( "ERROR: Project folder not provided." );
  process.exit( 1 );
}

const logicalRoot = path.resolve( rootArg );
if ( !fs.existsSync( logicalRoot ) ) {
  console.error( `ERROR: Project folder not found: ${logicalRoot}` );
  process.exit( 1 );
}

function normalizePath( value ) {
  let normalized = String( value || "" ).trim();
  normalized = normalized.replace( /^\\\\\?\\UNC\\/i, "//" );
  normalized = normalized.replace( /^\\\\\?\\/, "" );
  normalized = normalized.replace( /\\/g, "/" );
  normalized = normalized.replace( /\/+/g, "/" );
  if ( normalized.length > 1 ) {
    normalized = normalized.replace( /\/+$/, "" );
  }
  if ( /^[a-z]:$/i.test( normalized ) ) {
    normalized += "/";
  }
  return process.platform === "win32"
    ? normalized.toLowerCase()
    : normalized;
}

function samePath( first, second ) {
  return normalizePath( first ) === normalizePath( second );
}

function isUnder( child, parent ) {
  const normalizedChild = normalizePath( child );
  let normalizedParent = normalizePath( parent );
  if ( !normalizedParent.endsWith( "/" ) ) {
    normalizedParent += "/";
  }
  return normalizedChild === normalizePath( parent )
    || normalizedChild.startsWith( normalizedParent );
}

function isAbsolutePath( value ) {
  return /^[a-z]:[\\/]/i.test( value ) || /^[\\/]{1,2}/.test( value );
}

function listDirectories( directory ) {
  try {
    return fs.readdirSync( directory, { withFileTypes: true } )
      .filter( entry => entry.isDirectory() )
      .map( entry => path.join( directory, entry.name ) );
  } catch {
    return [];
  }
}

function addDirectory( directories, directory ) {
  try {
    if ( fs.statSync( directory ).isDirectory() ) {
      directories.add( directory );
    }
  } catch {
    // Directory does not exist.
  }
}

function getWindowsStagingRoot( root ) {
  if ( process.platform !== "win32" ) {
    return null;
  }
  // Must match the staging key in android/build.gradle.
  const digest = crypto.createHash( "sha256" )
    .update( path.resolve( root ).toLowerCase(), "utf8" )
    .digest( "hex" );
  return path.join( os.homedir(), ".inat-android-cxx", digest.slice( 0, 12 ) );
}

function findCxxDirectories( root, windowsStagingRoot ) {
  const directories = new Set();
  const nodeModules = path.join( root, "node_modules" );
  for ( const packageDirectory of listDirectories( nodeModules ) ) {
    addDirectory( directories, path.join( packageDirectory, "android", ".cxx" ) );
    if ( path.basename( packageDirectory ).startsWith( "@" ) ) {
      for ( const scopedDirectory of listDirectories( packageDirectory ) ) {
        addDirectory( directories, path.join( scopedDirectory, "android", ".cxx" ) );
      }
    }
    const nestedNodeModules = path.join( packageDirectory, "node_modules" );
    for ( const nestedDirectory of listDirectories( nestedNodeModules ) ) {
      addDirectory( directories, path.join( nestedDirectory, "android", ".cxx" ) );
      if ( path.basename( nestedDirectory ).startsWith( "@" ) ) {
        for ( const scopedDirectory of listDirectories( nestedDirectory ) ) {
          addDirectory( directories, path.join( scopedDirectory, "android", ".cxx" ) );
        }
      }
    }
  }
  addDirectory( directories, path.join( root, "android", "app", ".cxx" ) );
  addDirectory( directories, path.join( root, "android", ".cxx" ) );
  if ( windowsStagingRoot ) {
    for ( const moduleDirectory of listDirectories( windowsStagingRoot ) ) {
      addDirectory( directories, moduleDirectory );
    }
  }
  return Array.from( directories );
}

function findCMakeCache( directory ) {
  const pending = [{ directory, depth: 0 }];
  while ( pending.length > 0 ) {
    const current = pending.pop();
    let entries = [];
    try {
      entries = fs.readdirSync( current.directory, { withFileTypes: true } );
    } catch {
      entries = [];
    }
    for ( const entry of entries ) {
      const entryPath = path.join( current.directory, entry.name );
      if ( entry.isFile() && entry.name.toLowerCase() === "cmakecache.txt" ) {
        return entryPath;
      }
      if ( entry.isDirectory() && current.depth < MAX_CMAKE_CACHE_DEPTH ) {
        pending.push( { directory: entryPath, depth: current.depth + 1 } );
      }
    }
  }
  return null;
}

function readCMakeHome( cacheFile ) {
  try {
    const contents = fs.readFileSync( cacheFile, "utf8" );
    const match = contents.match( /^CMAKE_HOME_DIRECTORY:INTERNAL=(.*)$/m );
    return match
      ? match[1].trim()
      : null;
  } catch {
    return null;
  }
}

function getStaleReasons( root ) {
  const reasons = [];
  const autolinkingJson = path.join(
    root,
    "android",
    "build",
    "generated",
    "autolinking",
    "autolinking.json",
  );
  if ( fs.existsSync( autolinkingJson ) ) {
    try {
      const config = JSON.parse( fs.readFileSync( autolinkingJson, "utf8" ) );
      if ( config.root && isAbsolutePath( config.root ) && !samePath( config.root, root ) ) {
        reasons.push( `autolinking was generated for ${config.root}` );
      }
      if (
        config.reactNativePath
        && isAbsolutePath( config.reactNativePath )
        && !isUnder( config.reactNativePath, root )
      ) {
        reasons.push( `autolinking points react-native at ${config.reactNativePath}` );
      }
    } catch {
      reasons.push( "autolinking.json could not be read" );
    }
  }
  return reasons;
}

function removeTree( target ) {
  if ( !fs.existsSync( target ) ) {
    return;
  }
  try {
    fs.rmSync( target, { recursive: true, force: true, maxRetries: 3 } );
  } catch ( error ) {
    console.warn( `WARNING: Could not remove ${target}` );
    console.warn( `         ${error.message}` );
  }
}

function printLongPathInstructions( root ) {
  const copyCommand = `robocopy "${root}" "C:\\inat-build" /E /XD node_modules .git dist`;
  console.log( `           ${copyCommand}` );
  console.log( "           cd /d C:\\inat-build" );
  console.log( "           build-apk.bat deps" );
}

let physicalRoot = logicalRoot;
try {
  physicalRoot = fs.realpathSync( logicalRoot );
} catch {
  physicalRoot = logicalRoot;
}

const reparsePoints = [];
if ( !samePath( logicalRoot, physicalRoot ) ) {
  reparsePoints.push( { path: logicalRoot, target: physicalRoot } );
}

const nodeModules = path.join( logicalRoot, "node_modules" );
if ( fs.existsSync( nodeModules ) ) {
  try {
    const physicalNodeModules = fs.realpathSync( nodeModules );
    if ( !samePath( nodeModules, physicalNodeModules ) ) {
      reparsePoints.push( { path: nodeModules, target: physicalNodeModules } );
    }
  } catch {
    // Ignore unreadable node_modules.
  }
}

for ( const reparsePoint of reparsePoints ) {
  console.log( "WARNING: This build path is a junction or symlink:" );
  console.log( `         ${reparsePoint.path}` );
  if ( reparsePoint.target ) {
    console.log( `         -> ${reparsePoint.target}` );
  }
  console.log( "         Windows build tools may resolve the real target path, so the short" );
  console.log( "         name does not always avoid the 250-character native build limit." );
  if ( reparsePoint.target && reparsePoint.target.length > maxPathLength ) {
    console.log(
      `         The target path is ${reparsePoint.target.length} characters long. `
      + "Use a real folder instead:",
    );
    printLongPathInstructions( logicalRoot );
    process.exit( 1 );
  }
}

if ( logicalRoot.length > maxPathLength ) {
  console.log( `WARNING: The project path is ${logicalRoot.length} characters long:` );
  console.log( `         ${logicalRoot}` );
  console.log( "         Android native builds can fail when generated object paths exceed" );
  console.log( "         250 characters. If the build fails, move it to a short real folder:" );
  printLongPathInstructions( logicalRoot );
}

const windowsStagingRoot = getWindowsStagingRoot( logicalRoot );
const cxxDirectories = findCxxDirectories( logicalRoot, windowsStagingRoot );
const staleReasons = getStaleReasons( logicalRoot );
const staleCxxDirectories = [];

for ( const cxxDirectory of cxxDirectories ) {
  const cacheFile = findCMakeCache( cxxDirectory );
  if ( !cacheFile ) {
    staleCxxDirectories.push( cxxDirectory );
  } else {
    const cmakeHome = readCMakeHome( cacheFile );
    if ( !cmakeHome || !isUnder( cmakeHome, logicalRoot ) ) {
      staleCxxDirectories.push( cxxDirectory );
    }
  }
}

const needsClean = clean
  || staleReasons.length > 0
  || staleCxxDirectories.length > 0;

if ( clean ) {
  console.log( "  Cleaning native build caches..." );
} else if ( needsClean ) {
  console.log( "  Found build output from a different project folder:" );
  for ( const reason of [...new Set( staleReasons )] ) {
    console.log( `    ${reason}` );
  }
  if ( staleCxxDirectories.length > 0 ) {
    console.log( `    stale CMake caches: ${staleCxxDirectories.length}` );
  }
  console.log( `  Cleaning them so Gradle and CMake use ${logicalRoot} ...` );
}

if ( needsClean ) {
  removeTree( path.join( logicalRoot, "android", "build" ) );
  removeTree( path.join( logicalRoot, "android", ".gradle" ) );
  removeTree( path.join( logicalRoot, "android", "app", "build" ) );
  removeTree( path.join( logicalRoot, "android", "app", ".cxx" ) );

  const directoriesToRemove = clean
    ? cxxDirectories
    : staleCxxDirectories;
  for ( const cxxDirectory of directoriesToRemove ) {
    removeTree( cxxDirectory );
    removeTree( path.join( path.dirname( cxxDirectory ), "build" ) );
  }
  if ( windowsStagingRoot ) {
    removeTree( windowsStagingRoot );
  }
}

process.exit( 0 );
