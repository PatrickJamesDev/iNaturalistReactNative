import classNames from "classnames";
import { Body3 } from "components/SharedComponents";
import React from "react";
import type { TextProps } from "react-native";
import Taxon from "realmModels/Taxon";
import { translatedRank } from "sharedHelpers/taxon";
import useTranslation from "sharedHooks/useTranslation";

interface Props {
  fontComponent: React.ComponentType<TextProps>;
  isHorizontal: boolean;
  isFirst?: boolean;
  isTitle?: boolean;
  keyBase: string;
  rank?: string;
  rankLevel?: number;
  rankPiece?: string;
  scientificNamePieces?: string[];
  taxonId: string | number;
  textClassName: string;
  maxFontSizeMultiplier: number;
}

const ScientificName = ( {
  fontComponent,
  isHorizontal,
  isTitle,
  isFirst,
  keyBase,
  rank,
  rankLevel,
  rankPiece,
  scientificNamePieces,
  taxonId,
  textClassName,
  maxFontSizeMultiplier,
}: Props ) => {
  const { t } = useTranslation( );
  const scientificNameArray = scientificNamePieces?.map( ( piece, index ) => {
    const isItalics = piece !== rankPiece && rankLevel && (
      rankLevel <= Taxon.SPECIES_LEVEL || rankLevel === Taxon.GENUS_LEVEL
    );
    const spaceChar = ( ( index !== scientificNamePieces.length - 1 ) || isHorizontal )
      ? " "
      : "";
    const text = ( isFirst || index !== scientificNamePieces.length - 1 )
      ? piece + spaceChar
      : piece;
    const FontComponent = fontComponent || Body3;
    // Include the position so repeated name pieces (e.g. "Bison bison bison") keep
    // stable, unique keys without regenerating a random key on every render.
    const pieceKey = `DisplayTaxonName-${keyBase}-${taxonId}-${rankLevel}-${index}-${piece}`;

    return (
      <FontComponent
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        key={pieceKey}
        className={classNames(
          "font-normal",
          textClassName,
          {
            "font-light": !isTitle,
            italic: isItalics,
          },
        )}
      >
        {text}
      </FontComponent>
    );
  } );

  if ( rank && rankLevel && rankLevel > Taxon.SPECIES_LEVEL && scientificNameArray ) {
    scientificNameArray.unshift( " " );
    scientificNameArray.unshift( translatedRank( rank, t ) );
  }

  return (
    scientificNameArray
  );
};

export default ScientificName;
