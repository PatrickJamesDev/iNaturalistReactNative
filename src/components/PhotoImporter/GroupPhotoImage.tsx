import ObsImagePreview from "components/ObservationsFlashList/ObsImagePreview";
import { Pressable } from "components/styledComponents";
import React from "react";
import type { ViewStyle } from "react-native";
import type { GroupedPhoto } from "stores/createObservationFlowSlice";

interface Props {
  item: GroupedPhoto;
  isSelected: boolean;
  selectObservationPhotos: ( isSelected: boolean, item: GroupedPhoto ) => void;
  style?: ViewStyle;
}

const GroupPhotoImage = ( {
  item,
  isSelected,
  selectObservationPhotos,
  style,
}: Props ) => {
  const firstPhoto = item.photos[0];
  const handlePress = ( ) => selectObservationPhotos( isSelected, item );

  const source = firstPhoto && { uri: firstPhoto.image.uri };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      testID={`GroupPhotos.${firstPhoto.image.uri}`}
      className="rounded-[17px] overflow-hidden"
    >
      <ObsImagePreview
        source={source}
        style={style}
        selected={isSelected}
        obsPhotosCount={item.photos.length}
        selectable
        hideGradientOverlay
      />
    </Pressable>
  );
};

export default React.memo( GroupPhotoImage );
