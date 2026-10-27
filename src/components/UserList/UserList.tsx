import type { ParamListBase } from "@react-navigation/native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ListRenderItem } from "@shopify/flash-list";
import {
  CustomFlashList,
} from "components/SharedComponents";
import { View } from "components/styledComponents";
import UserListItem from "components/UserList/UserListItem";
import has from "lodash/has";
import React, { useCallback } from "react";
import type { ViewStyle } from "react-native";
import { useTranslation } from "sharedHooks";

const CONTAINER_STYLE = {
  backgroundColor: "white",
};

interface UserItem {
  id?: number | null;
  count?: number;
  observation_count?: number;
  observations_count?: number;
  user?: {
    id?: number | null;
    icon_url?: string | null;
    login?: string | null;
  };
}

interface Props {
  ListEmptyComponent?: React.ReactElement;
  ListFooterComponent?: React.ReactElement;
  onEndReached?: ( ) => void;
  refreshing?: boolean;
  users: UserItem[];
  onPress?: ( item: object ) => void;
  accessibilityLabel?: string;
  keyboardShouldPersistTaps?: "handled";
  contentContainerStyle?: ViewStyle;
}

const UserList = ( {
  ListEmptyComponent,
  ListFooterComponent,
  onEndReached,
  refreshing,
  users,
  onPress,
  accessibilityLabel,
  keyboardShouldPersistTaps,
  contentContainerStyle,
}: Props ) => {
  const { t } = useTranslation( );
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>( );

  const renderItem: ListRenderItem<UserItem> = useCallback( ( { item } ) => {
    // results in explore search are nested differently
    // than in project members at the moment
    const userItem = ( has( item, "user" )
      ? item
      : { user: item } ) as React.ComponentProps<typeof UserListItem>["item"];
    const observationCount = item?.observation_count || item?.observations_count;
    return (
      <UserListItem
        item={userItem}
        countText={
          item?.count
            ? t( "X-Identifications", { count: item?.count } )
            : t( "X-Observations", { count: observationCount } )
        }
        onPress={( ) => {
          if ( onPress ) {
            onPress( item );
          } else {
            navigation.navigate( "UserProfile", { userId: userItem?.user?.id as number } );
          }
        }}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }, [
    accessibilityLabel,
    navigation,
    onPress,
    t,
  ] );

  const renderItemSeparator = useCallback(
    ( ) => <View className="border-b border-lightGray" />,
    [],
  );

  const keyExtractor = useCallback(
    ( item: UserItem ) => String( item?.user?.id ?? item?.id ?? "" ),
    [],
  );

  return (
    <CustomFlashList
      ItemSeparatorComponent={renderItemSeparator}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={ListFooterComponent}
      contentContainerStyle={contentContainerStyle || CONTAINER_STYLE}
      data={users}
      keyExtractor={keyExtractor}
      onEndReached={onEndReached}
      refreshing={refreshing}
      renderItem={renderItem}
      testID="UserList"
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
    />
  );
};

export default UserList;
