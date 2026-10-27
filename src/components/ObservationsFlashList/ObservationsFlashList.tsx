/* eslint-disable react/no-unused-prop-types */
import { useNavigation } from "@react-navigation/native";
import type { FlashListRef } from "@shopify/flash-list";
import {
  ActivityIndicator,
  Body3,
  CustomFlashList,
  CustomRefreshControl,
  InfiniteScrollLoadingWheel,
} from "components/SharedComponents";
import { View } from "components/styledComponents";
import { RealmContext } from "providers/contexts";
import React, {
  useCallback,
  useMemo,
  useState,
} from "react";
import type {
  LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, StyleProp, ViewStyle,
} from "react-native";
import { Animated } from "react-native";
import type { RealmObservation as RealmObservationType } from "realmModels/types";
import {
  useCurrentUser,
  useGridLayout,
  useNavigateToObsEdit,
  useTranslation,
} from "sharedHooks";
import useStore from "stores/useStore";

import ObsFlashListCell from "./ObsFlashListCell";

const { useRealm } = RealmContext;

const AnimatedFlashList = Animated.createAnimatedComponent( CustomFlashList );

// unlike the other FlashList Component props, Separator does _not_ accept an Element
const ItemSeparator = () => <View className="border-b border-lightGray" />;

interface Props {
  contentContainerStyle?: StyleProp<ViewStyle>;
  data: ( { uuid: string } )[];
  dataCanBeFetched?: boolean;
  fetchFromLastObservation?: ( observationId?: number ) => void;
  explore: boolean;
  handlePullToRefresh: () => void;
  handleIndividualUploadPress: ( observationUuid: string ) => void;
  hideLoadingWheel?: boolean;
  hideMetadata?: boolean;
  hideObsUploadStatus?: boolean;
  hideObsStatus?: boolean;
  isSimpleObsStatus?: boolean;
  hideRGLabel?: boolean;
  isConnected: boolean;
  layout: "list" | "grid";
  obsListKey: string;
  onEndReached: () => void;
  onLayout?: ( event: LayoutChangeEvent ) => void;
  onScroll?: ( event: NativeSyntheticEvent<NativeScrollEvent> ) => void;
  // this ref is being forwarded to the underlying CustomFlashList and used as an imperative handle
  // so the parent can control behavior like scrolling
  // TODO: type data / observations
  ref?: React.Ref<FlashListRef<( { uuid: string} )>>;
  listHeaderContent?: React.ReactElement | null;
  showNoResults?: boolean;
  testID: string;
}

const ObservationsFlashList = ( {
  contentContainerStyle: contentContainerStyleProp = {},
  data,
  dataCanBeFetched,
  explore,
  fetchFromLastObservation,
  handlePullToRefresh,
  handleIndividualUploadPress,
  hideLoadingWheel,
  hideMetadata,
  hideObsUploadStatus,
  hideObsStatus,
  isSimpleObsStatus,
  hideRGLabel,
  isConnected,
  layout,
  obsListKey = "unknown",
  onEndReached,
  onLayout,
  onScroll,
  ref,
  listHeaderContent,
  showNoResults,
  testID,
}: Props ) => {
  const isDefaultMode = useStore( state => state.layout.isDefaultMode );
  const realm = useRealm( );
  const currentUser = useCurrentUser( );
  const navigation = useNavigation( );
  const navigateToObsEdit = useNavigateToObsEdit( );
  const [refreshing, setRefreshing] = useState( false );

  const onRefresh = async ( ) => {
    setRefreshing( true );
    await handlePullToRefresh( );
    setRefreshing( false );
  };

  const {
    flashListStyle,
    gridItemStyle,
    numColumns,
  } = useGridLayout( layout );
  const { t } = useTranslation( );

  // Keep this identity stable: FlashList re-renders visible cells when renderItem changes, and
  // the only fast-changing data (upload progress) is now subscribed per cell in
  // ObsFlashListCell.
  const handleItemPress = useCallback( (
    uuid: string,
    obsNeedsSync: boolean,
    observation: RealmObservationType | null,
  ) => {
    if ( obsNeedsSync && !isDefaultMode && observation ) {
      navigateToObsEdit( observation );
    } else {
      // Uniquely identify the list this observation appears in so we can ensure
      // ObsDetails doesn't get pushed onto the stack twice after multiple taps
      navigation.navigate( {
        key: `Obs-${obsListKey}-${uuid}`,
        name: "ObsDetails",
        params: { uuid },
      } );
    }
  }, [
    isDefaultMode,
    navigateToObsEdit,
    navigation,
    obsListKey,
  ] );

  const renderItem = useCallback( ( { item }: { item: { uuid: string; empty: boolean } } ) => {
    // Empty box
    if ( item.empty ) {
      return (
        <View
          className="rounded-[15px] border-dotted border-4 border-lightGray"
          style={gridItemStyle}
        />
      );
    }

    return (
      <ObsFlashListCell
        currentUser={currentUser}
        explore={explore}
        gridItemStyle={gridItemStyle}
        handleIndividualUploadPress={handleIndividualUploadPress}
        handleItemPress={handleItemPress}
        hideMetadata={hideMetadata}
        hideObsStatus={hideObsStatus}
        hideObsUploadStatus={hideObsUploadStatus}
        hideRGLabel={hideRGLabel}
        isSimpleObsStatus={isSimpleObsStatus}
        item={item}
        layout={layout}
      />
    );
  }, [
    currentUser,
    explore,
    gridItemStyle,
    handleIndividualUploadPress,
    handleItemPress,
    hideMetadata,
    hideObsUploadStatus,
    hideObsStatus,
    isSimpleObsStatus,
    hideRGLabel,
    layout,
  ] );

  const itemSeparatorComponent = useMemo( ( ) => {
    if ( layout === "grid" ) {
      return null;
    }
    return ItemSeparator;
  }, [layout] );

  const footerContent = useMemo( ( ) => (
    <InfiniteScrollLoadingWheel
      explore={explore}
      hideLoadingWheel={hideLoadingWheel}
      isConnected={isConnected}
      layout={layout}
    />
  ), [
    explore,
    hideLoadingWheel,
    isConnected,
    layout,
  ] );

  const isEmpty = data.length === 0;

  const contentContainerStyle = useMemo( ( ) => {
    // flexGrow so the content container fills the available height when
    // there's no data -- otherwise it shrinks to fit only the empty state,
    // and the centering below has no room to center within.
    // Grid's extra padding (item gutters, tab bar clearance) only matters
    // when there are grid items to space out -- skip it while empty so the
    // empty state doesn't need to compensate for padding it doesn't need.
    if ( layout === "list" || isEmpty ) {
      return { flexGrow: 1, ...contentContainerStyleProp };
    }
    return {
      flexGrow: 1,
      ...flashListStyle,
      ...contentContainerStyleProp,
    };
  }, [
    contentContainerStyleProp,
    flashListStyle,
    isEmpty,
    layout,
  ] );

  const emptyContent = useMemo( ( ) => (
    <View className="flex-1 items-center justify-center">
      {showNoResults
        ? (
          <Body3 className="text-center px-10">
            {t( "No-results-found-try-different-search" )}
          </Body3>
        )
        : (
          <ActivityIndicator size={50} testID="ObservationsFlashList.loading" />
        )}
    </View>
  ), [
    showNoResults,
    t,
  ] );

  // only used id as a fallback key because after upload
  // react thinks we've rendered a second item w/ a duplicate key
  const keyExtractor = useCallback(
    ( item: unknown ): string => {
      const { uuid, id } = item as { uuid?: string; id?: number };
      return uuid || String( id ?? "" );
    },
    [],
  );

  const onMomentumScrollEnd = useCallback( ( ) => {
    if ( dataCanBeFetched ) {
      onEndReached( );
    }
  }, [dataCanBeFetched, onEndReached] );

  const handleEndReached = useCallback( ( ) => {
    if ( !dataCanBeFetched || explore ) return;

    if ( fetchFromLastObservation && data.length > 0 ) {
      const lastItem = data[data.length - 1];
      if ( lastItem?.uuid && !lastItem?.empty ) {
        const lastObs = realm.objectForPrimaryKey( "Observation", lastItem.uuid );
        const lastId = lastObs?.id;
        if ( lastId ) {
          fetchFromLastObservation( lastId );
          return;
        }
      }
    }

    onEndReached( );
  }, [dataCanBeFetched, explore, fetchFromLastObservation, data, onEndReached, realm] );

  const refreshControl = (
    <CustomRefreshControl
      accessibilityLabel={t( "Pull-to-refresh-and-sync-observations" )}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  );

  return (
    <AnimatedFlashList
      ItemSeparatorComponent={itemSeparatorComponent}
      ListEmptyComponent={emptyContent}
      ListFooterComponent={footerContent}
      ListHeaderComponent={listHeaderContent}
      contentContainerStyle={contentContainerStyle}
      data={data}
      ref={ref}
      key={numColumns}
      keyExtractor={keyExtractor}
      numColumns={numColumns}
      onLayout={onLayout}
      onEndReached={handleEndReached}
      onMomentumScrollEnd={onMomentumScrollEnd}
      onScroll={onScroll}
      renderItem={renderItem}
      refreshControl={refreshControl}
      testID={testID}
    />
  );
};

export default ObservationsFlashList;
