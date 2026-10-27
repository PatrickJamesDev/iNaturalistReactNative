// @flow

import { useCallback, useState } from "react";

const useExploreHeaderCount = ( ): Object => {
  const [count, setCount] = useState( {
    observations: null,
    species: null,
    observers: null,
    identifiers: null,
  } );
  const [isFetching, setIsFetching] = useState( false );

  // Functional updates keep this callback stable, so the effects in the
  // view components that receive handleUpdateCount don't re-run every time
  // a count changes.
  const handleUpdateCount = useCallback( ( exploreView, totalResults ) => {
    if ( totalResults === null ) {
      return;
    }
    setCount( previousCount => (
      previousCount[exploreView] === totalResults
        ? previousCount
        : { ...previousCount, [exploreView]: totalResults }
    ) );
    setIsFetching( false );
  }, [] );

  return {
    count,
    isFetching,
    handleUpdateCount,
    setIsFetching,
  };
};

export default useExploreHeaderCount;
