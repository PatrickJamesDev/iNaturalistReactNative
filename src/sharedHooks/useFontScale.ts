import { useWindowDimensions } from "react-native";

const LARGE_FONT_SCALE = 1.3;

interface FontScale {
  isLargeFontScale: boolean;
}

// Read the system font scale synchronously from window dimensions instead of
// asking DeviceInfo and setting state on mount. This hook is used by every
// taxon tile in a grid, where the old version did a native bridge round trip
// and an extra render per mounted (and recycled) cell.
const useFontScale = ( ): FontScale => {
  const { fontScale } = useWindowDimensions( );
  return {
    isLargeFontScale: fontScale > LARGE_FONT_SCALE,
  };
};

export default useFontScale;
