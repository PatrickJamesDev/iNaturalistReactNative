@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem Build an installable iNaturalist Android APK on Windows.
rem Usage: build-apk.bat [release|debug] [all|x86_64|arm64-v8a|...] [clean] [deps] [install]
rem Run build-apk.bat help for details.

cd /d "%~dp0"
set "ROOT=%CD%"
set "VARIANT=release"
set "ARCHS=arm64-v8a"
set "DO_CLEAN=0"
set "DO_INSTALL=0"
set "FORCE_DEPS=0"

if not exist "env.example" (
  echo ERROR: env.example not found. Is this the iNaturalist repo root?
  goto fail
)
if not exist "package.json" (
  echo ERROR: package.json not found. Put this script in the repo root.
  goto fail
)
if not exist "android\gradlew.bat" (
  echo ERROR: android\gradlew.bat not found. Is this the iNaturalist repo root?
  goto fail
)

:parse_args
if "%~1"=="" goto args_done
set "ARG=%~1"

if /i "%ARG%"=="help" goto usage
if /i "%ARG%"=="--help" goto usage
if /i "%ARG%"=="-h" goto usage
if /i "%ARG%"=="/?" goto usage
if /i "%ARG%"=="release" (
  set "VARIANT=release"
  shift
  goto parse_args
)
if /i "%ARG%"=="debug" (
  set "VARIANT=debug"
  shift
  goto parse_args
)
if /i "%ARG%"=="--release" (
  set "VARIANT=release"
  shift
  goto parse_args
)
if /i "%ARG%"=="--debug" (
  set "VARIANT=debug"
  shift
  goto parse_args
)
if /i "%ARG%"=="all" (
  set "ARCHS=all"
  shift
  goto parse_args
)
if /i "%ARG%"=="--all" (
  set "ARCHS=all"
  shift
  goto parse_args
)
if /i "%ARG%"=="clean" (
  set "DO_CLEAN=1"
  shift
  goto parse_args
)
if /i "%ARG%"=="--clean" (
  set "DO_CLEAN=1"
  shift
  goto parse_args
)
if /i "%ARG%"=="deps" (
  set "FORCE_DEPS=1"
  shift
  goto parse_args
)
if /i "%ARG%"=="--deps" (
  set "FORCE_DEPS=1"
  shift
  goto parse_args
)
if /i "%ARG%"=="install" (
  set "DO_INSTALL=1"
  shift
  goto parse_args
)
if /i "%ARG%"=="--install" (
  set "DO_INSTALL=1"
  shift
  goto parse_args
)
if /i "%ARG%"=="--arch" goto parse_arch
if /i "!ARG:~0,7!"=="--arch=" (
  set "ARCHS=!ARG:~7!"
  shift
  goto parse_args
)
if /i "%ARG%"=="arm64-v8a" (
  set "ARCHS=arm64-v8a"
  shift
  goto parse_args
)
if /i "%ARG%"=="arm64" (
  set "ARCHS=arm64-v8a"
  shift
  goto parse_args
)
if /i "%ARG%"=="x86_64" (
  set "ARCHS=x86_64"
  shift
  goto parse_args
)
if /i "%ARG%"=="x86" (
  set "ARCHS=x86"
  shift
  goto parse_args
)
if /i "%ARG%"=="armeabi-v7a" (
  set "ARCHS=armeabi-v7a"
  shift
  goto parse_args
)

echo ERROR: Unknown argument "%ARG%".
echo Run build-apk.bat help for usage.
goto fail

:parse_arch
shift
if "%~1"=="" (
  echo ERROR: --arch requires a value, e.g. --arch x86_64
  goto fail
)
set "ARCHS=%~1"
shift
goto parse_args

:args_done
if /i "%ARCHS%"=="all" set "ARCHS=armeabi-v7a,arm64-v8a,x86,x86_64"
if /i "%VARIANT%"=="release" (set "GRADLE_TASK=assembleRelease") else (set "GRADLE_TASK=assembleDebug")
set "APK_PATH=android\app\build\outputs\apk\%VARIANT%\app-%VARIANT%.apk"

echo.
echo ============================================================
echo  iNaturalist Android APK build
echo  Variant: %VARIANT%
echo  ABIs:    %ARCHS%
echo  Clean:   %DO_CLEAN%
echo  Install: %DO_INSTALL%
echo ============================================================
echo.

rem ---------------------------------------------------------------
rem Toolchain checks
rem ---------------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: node was not found on PATH. Install Node 24 ^(see .nvmrc^) and retry.
  goto fail
)
for /f "tokens=*" %%v in ('node -v') do set "NODE_VER=%%v"
for /f "tokens=1 delims=." %%v in ("!NODE_VER:v=!") do set "NODE_MAJOR=%%v"
if not defined NODE_MAJOR (
  echo ERROR: Could not determine the Node version.
  goto fail
)
if !NODE_MAJOR! LSS 20 (
  echo ERROR: Node !NODE_VER! is too old. This project needs Node 20+ ^(24 recommended^).
  goto fail
)
set /p EXPECTED_NODE=<.nvmrc
if defined EXPECTED_NODE (
  if /i not "!NODE_VER!"=="v!EXPECTED_NODE!" (
    echo WARNING: Node !NODE_VER! differs from .nvmrc ^(!EXPECTED_NODE!^).
    echo          If the build fails, install the exact Node version from .nvmrc.
  )
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm was not found on PATH.
  goto fail
)

set "JAVA_CMD=java"
rem JAVA_HOME is sometimes set with surrounding quotes or a trailing backslash.
if defined JAVA_HOME set "JAVA_HOME=%JAVA_HOME:"=%"
if defined JAVA_HOME if "!JAVA_HOME:~-1!"=="\" set "JAVA_HOME=!JAVA_HOME:~0,-1!"
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" set "JAVA_CMD=%JAVA_HOME%\bin\java.exe"
"%JAVA_CMD%" -version >nul 2>nul
if errorlevel 1 (
  rem Fall back to Android Studio's bundled JDK.
  if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" (
    set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
    set "JAVA_CMD=%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe"
  ) else if exist "%LOCALAPPDATA%\Programs\Android Studio\jbr\bin\java.exe" (
    set "JAVA_HOME=%LOCALAPPDATA%\Programs\Android Studio\jbr"
    set "JAVA_CMD=%LOCALAPPDATA%\Programs\Android Studio\jbr\bin\java.exe"
  )
)
"%JAVA_CMD%" -version >nul 2>nul
if errorlevel 1 (
  echo ERROR: Java was not found. Install JDK 17 and set JAVA_HOME.
  goto fail
)
rem Do not place "%JAVA_CMD%" inside for /f: cmd /c strips the outer quotes when
rem the command starts with a quoted path and breaks paths that contain spaces.
set "JAVA_VER_FILE=%TEMP%\inat-java-version.txt"
"%JAVA_CMD%" -version >"%JAVA_VER_FILE%" 2>&1
for /f "tokens=3" %%v in ('findstr /i "version" "%JAVA_VER_FILE%"') do if not defined JAVA_VER set "JAVA_VER=%%~v"
del "%JAVA_VER_FILE%" >nul 2>nul
if not defined JAVA_VER (
  echo ERROR: Could not determine the Java version.
  goto fail
)
for /f "tokens=1 delims=." %%v in ("!JAVA_VER!") do set "JAVA_MAJOR=%%v"
if "!JAVA_MAJOR!"=="1" for /f "tokens=2 delims=." %%v in ("!JAVA_VER!") do set "JAVA_MAJOR=%%v"
if !JAVA_MAJOR! LSS 17 (
  echo ERROR: Java !JAVA_VER! is too old. Install JDK 17 and point JAVA_HOME at it.
  goto fail
)
if not "!JAVA_MAJOR!"=="17" (
  echo WARNING: Java !JAVA_VER! detected. CI uses JDK 17; use JDK 17 if Gradle fails.
)

rem Environment variables are sometimes set with surrounding quotes.
if defined ANDROID_HOME set "ANDROID_HOME=%ANDROID_HOME:"=%"
if defined ANDROID_SDK_ROOT set "ANDROID_SDK_ROOT=%ANDROID_SDK_ROOT:"=%"
set "SDK_DIR=%ANDROID_HOME%"
if not defined SDK_DIR set "SDK_DIR=%ANDROID_SDK_ROOT%"
if not defined SDK_DIR if exist "%LOCALAPPDATA%\Android\Sdk" set "SDK_DIR=%LOCALAPPDATA%\Android\Sdk"
if not exist "%SDK_DIR%" (
  echo ERROR: Android SDK not found.
  echo        Set ANDROID_HOME or install the SDK via Android Studio.
  goto fail
)
set "ANDROID_HOME=%SDK_DIR%"
set "ANDROID_SDK_ROOT=%SDK_DIR%"

if not exist "%SDK_DIR%\platforms\android-36\android.jar" (
  echo ERROR: Android SDK platform 36 is missing.
  echo        Install it with Android Studio SDK Manager or:
  echo        "%SDK_DIR%\cmdline-tools\latest\bin\sdkmanager.bat" "platforms;android-36"
  goto fail
)
if not exist "%SDK_DIR%\build-tools\36.0.0" (
  echo ERROR: Android build-tools 36.0.0 are missing.
  echo        Install them with Android Studio SDK Manager or:
  echo        "%SDK_DIR%\cmdline-tools\latest\bin\sdkmanager.bat" "build-tools;36.0.0"
  goto fail
)
if not exist "%SDK_DIR%\ndk\27.1.12297006" (
  echo ERROR: Android NDK 27.1.12297006 is missing.
  echo        Install it with Android Studio SDK Manager or:
  echo        "%SDK_DIR%\cmdline-tools\latest\bin\sdkmanager.bat" "ndk;27.1.12297006"
  goto fail
)
if not exist "%SDK_DIR%\licenses\android-sdk-license" (
  echo WARNING: SDK licenses may not be accepted. If Gradle fails, run:
  echo          "%SDK_DIR%\cmdline-tools\latest\bin\sdkmanager.bat" --licenses
)

set "SDK_PROP=!SDK_DIR:\=/!"
> "android\local.properties" echo sdk.dir=!SDK_PROP!
echo Android SDK: %SDK_DIR%

rem ---------------------------------------------------------------
rem Generated config (safe to keep locally; do not commit secrets)
rem ---------------------------------------------------------------
if not exist ".env" (
  copy /y "env.example" ".env" >nul
  echo WARNING: Created .env from env.example. Replace the OAuth/JWT values.
)
if not exist ".env.staging" (
  copy /y "env.example" ".env.staging" >nul
  echo WARNING: Created .env.staging from env.example. Replace the OAuth/JWT values.
)

if exist "android\app\google-services.json" goto google_services_done
powershell -NoProfile -Command "$c=Get-Content -Raw 'android\app\google-services.example.json'; $c=$c.Replace('your_project_number','123456789012'); $c=$c.Replace('your_project_id','inaturalist-local'); $c=$c.Replace('your_storage_bucket','inaturalist-local.appspot.com'); $c=$c.Replace('your_mobilesdk_app_id','1:123456789012:android:0123456789abcdef'); $c=$c.Replace('your_package_name','org.inaturalist.iNaturalistMobile'); $c=$c.Replace('your_current_key','AIzaSyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'); Set-Content -NoNewline 'android\app\google-services.json' $c"
if errorlevel 1 (
  echo ERROR: Could not create android\app\google-services.json.
  goto fail
)
echo WARNING: Using placeholder google-services.json. Firebase/CV features may not work.
echo          Replace it with a real Firebase config for production builds.
:google_services_done

if exist "android\keystore.properties" goto keystore_done
echo Creating a local signing keystore for release builds...
set "KEYTOOL=keytool"
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\keytool.exe" set "KEYTOOL=%JAVA_HOME%\bin\keytool.exe"
if not exist "android\app\release.keystore" (
  "!KEYTOOL!" -genkeypair -v -noprompt -storetype PKCS12 -keystore "android\app\release.keystore" -alias inaturalist -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android -dname "CN=iNaturalist,O=iNaturalist,C=US"
  if errorlevel 1 (
    echo ERROR: Could not generate android\app\release.keystore.
    goto fail
  )
)
>"android\keystore.properties" (
  echo storePassword=android
  echo keyPassword=android
  echo keyAlias=inaturalist
  echo storeFile=release.keystore
)
echo WARNING: Generated a throwaway signing key. Replace it before publishing.
:keystore_done

if /i "%VARIANT%"=="release" (
  for /f "tokens=1,* delims==" %%a in ('findstr /b /i "storeFile=" "android\keystore.properties"') do set "STORE_FILE=%%b"
  if defined STORE_FILE (
    set "STORE_PATH=android\app\!STORE_FILE!"
    if "!STORE_FILE:~1,1!"==":" set "STORE_PATH=!STORE_FILE!"
    if not exist "!STORE_PATH!" (
      echo ERROR: keystore.properties points at !STORE_PATH!, which does not exist.
      goto fail
    )
  )
)

rem ---------------------------------------------------------------
rem JS dependencies
rem ---------------------------------------------------------------
if not exist "node_modules\react-native\package.json" set "FORCE_DEPS=1"
if "%FORCE_DEPS%"=="1" (
  echo Installing npm dependencies with npm ci...
  call npm ci
  if errorlevel 1 goto fail
) else (
  echo node_modules found; skipping npm ci. Run "build-apk.bat deps" to reinstall.
)

rem ---------------------------------------------------------------
rem Native build preflight
rem ---------------------------------------------------------------
set "PREFLIGHT_ARGS="
if "%DO_CLEAN%"=="1" set "PREFLIGHT_ARGS=-Clean"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\android-build-preflight.ps1" -Root "%ROOT%" %PREFLIGHT_ARGS%
if errorlevel 1 goto fail

rem ---------------------------------------------------------------
rem Build
rem ---------------------------------------------------------------
if "%DO_CLEAN%"=="1" (
  echo Cleaning Gradle build outputs...
  pushd android
  call gradlew.bat clean --console=plain
  set "CLEAN_EXIT=!ERRORLEVEL!"
  popd
  if not "!CLEAN_EXIT!"=="0" goto fail
)

echo Building %GRADLE_TASK% for %ARCHS%...
pushd android
call gradlew.bat %GRADLE_TASK% -PreactNativeArchitectures=%ARCHS% --console=plain
set "GRADLE_EXIT=%ERRORLEVEL%"
popd
if not "%GRADLE_EXIT%"=="0" (
  echo.
  echo HINT: If the build failed while compiling native code, stale caches copied
  echo       from another folder or a long project path are likely. Run:
  echo         build-apk.bat clean
  echo       or copy the repo to a short real folder such as C:\src\inat.
  goto fail
)

if not exist "%APK_PATH%" (
  echo ERROR: Expected APK not found at %APK_PATH%
  echo        Check the Gradle output for a different output path.
  goto fail
)

if not exist "dist" mkdir "dist"
set "TS="
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"`) do set "TS=%%i"
if not defined TS set "TS=%RANDOM%"
set "OUT_APK=dist\iNaturalist-%VARIANT%-%TS%.apk"
copy /y "%APK_PATH%" "%OUT_APK%" >nul
if errorlevel 1 (
  echo ERROR: Could not copy the APK to %OUT_APK%.
  goto fail
)

echo.
echo BUILD SUCCESSFUL
echo APK: %ROOT%\%OUT_APK%
if /i "%VARIANT%"=="debug" echo NOTE: Debug APKs need Metro. Use the release variant for a standalone app.

if "%DO_INSTALL%"=="1" (
  where adb >nul 2>nul
  if errorlevel 1 (
    echo WARNING: adb not found on PATH; skipping install.
  ) else (
    echo Installing APK...
    adb install -r "%OUT_APK%"
    if errorlevel 1 (
      echo ERROR: adb install failed. Uninstall the existing app or check connected devices.
      goto fail
    )
    echo Installed.
  )
)

echo.
exit /b 0

:usage
echo.
echo Build an installable iNaturalist Android APK.
echo.
echo Usage:
echo   build-apk.bat [release^|debug] [ABI^|all] [clean] [deps] [install]
echo.
echo Variants:
echo   release             Standalone signed APK ^(default^)
echo   debug               Dev APK; needs Metro ^(npm start^)
echo.
echo ABIs:
echo   arm64-v8a           Most modern phones ^(default^)
echo   x86_64              Android Studio emulator
echo   all                 armeabi-v7a,arm64-v8a,x86,x86_64
echo   --arch ^<abi^>        Any valid Gradle ABI list
echo.
echo Options:
echo   clean               Remove Gradle and native build caches, then rebuild
echo   deps                Force npm ci
echo   install             Install on the connected device with adb
echo   help                Show this help
echo.
echo Examples:
echo   build-apk.bat
echo   build-apk.bat install
echo   build-apk.bat debug x86_64 install
echo   build-apk.bat release all clean
echo.
echo Requirements: JDK 17, Node 20+ ^(24 recommended^), Android SDK
echo   platform 36, build-tools 36.0.0, NDK 27.1.12297006.
echo Keep the repo in a short path such as C:\src\inat to avoid Windows path limits.
echo.
exit /b 0

:fail
echo.
echo BUILD FAILED
exit /b 1
