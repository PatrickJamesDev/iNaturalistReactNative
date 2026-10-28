import { CustomFlashList } from "components/SharedComponents";
import { View } from "components/styledComponents";
import { RealmContext } from "providers/contexts";
import React, {
  useCallback, useMemo,
} from "react";
import type { RealmTaxon } from "realmModels/types";

import IconicSuggestion from "./IconicSuggestion";

const { useRealm } = RealmContext;

const keyExtractor = ( item: RealmTaxon ) => `${item?.id}`;
const renderHeader = ( ) => <View className="ml-4" />;

interface Props {
  iconicTaxonChosen?: RealmTaxon;
  onIconicTaxonChosen: ( taxon: RealmTaxon ) => void;
}

const IconicSuggestionsScroll = ( {
  iconicTaxonChosen,
  onIconicTaxonChosen,
}: Props ) => {
  const realm = useRealm();

  const iconicTaxa = useMemo( ( ) => (
    realm?.objects( "Taxon" ).filtered( "isIconic = true" )
  ) as unknown as RealmTaxon[], [realm] );

  const renderItem = useCallback( ( info: { item: RealmTaxon } ) => {
    const taxon = info.item;
    const selected = iconicTaxonChosen?.id === taxon?.id;
    return (
      <IconicSuggestion
        handlePress={() => onIconicTaxonChosen( taxon )}
        taxon={taxon}
        selected={selected}
      />
    );
  }, [iconicTaxonChosen?.id, onIconicTaxonChosen] );
  return (
    <View className="mt-4">
      <CustomFlashList
        ListHeaderComponent={renderHeader}
        horizontal
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        data={iconicTaxa}
      />
    </View>
  );
};

export default IconicSuggestionsScroll;
