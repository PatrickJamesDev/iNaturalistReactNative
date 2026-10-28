import i18n from "i18next";
import type Realm from "realm";
import { zustandStorage } from "stores/useStore";

const changeLanguage = ( newLocale: string ) => {
  i18n.changeLanguage( newLocale );
  zustandStorage.setItem( "currentLocale", newLocale );
};

// Keep the app language in sync with the account's web preference, unless the
// user has a locale change queued locally that has not reached the server yet.
export const syncLanguageFromRemoteUser = (
  remoteUser: { locale?: string | null } | null | undefined,
  realm: Realm,
) => {
  if ( !remoteUser?.locale || remoteUser.locale === i18n.language ) {
    return;
  }
  if ( realm?.isClosed ) {
    return;
  }
  const pendingLocaleChanges = realm
    .objects( "QueueItem" )
    .filtered( "type == 'locale-change'" );
  if ( pendingLocaleChanges.length > 0 ) {
    return;
  }
  changeLanguage( remoteUser.locale );
};

export default changeLanguage;
