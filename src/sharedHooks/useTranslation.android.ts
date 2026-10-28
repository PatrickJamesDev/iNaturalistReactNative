import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

// Wrap react-i18next's useTranslation to catch a mysterious exception that
// often gets thrown on initialization on Android only. https://github.com/inaturalist/iNaturalistReactNative/pull/515
const useCustomTranslation = ( ) => {
  const original = useTranslation( );
  const { t } = original;
  const customT = useCallback( ( key: string, options = {} ) => {
    try {
      return t( key, options );
    } catch ( translationError ) {
      if ( translationError instanceof Error && !translationError.message.match( /NoClassDefFoundError/ ) ) {
        throw translationError;
      }
    }
    return "";
  }, [t] );
  return useMemo( ( ) => ( {
    ...original,
    t: customT,
  } ), [original, customT] );
};

export default useCustomTranslation;
