// @flow

import { fetchObservers } from "api/observationsTyped";
import { useMemo } from "react";
import { useAuthenticatedQuery } from "sharedHooks";

const params = {
  per_page: 3,
  fields: {
    user: {
      login: true,
      name: true,
    },
  },
};

const useObservers = ( taxonIds: number[] ): string[] => {
  const { data } = useAuthenticatedQuery(
    ["fetchObservers", taxonIds],
    ( ) => fetchObservers( {
      ...params,
      taxon_ids: taxonIds,
    } ),
    {
      enabled: !!( taxonIds?.length > 0 ),
    },
  );

  return useMemo( ( ) => data?.results?.map( result => result.user.login ), [
    data?.results,
  ] );
};

export default useObservers;
