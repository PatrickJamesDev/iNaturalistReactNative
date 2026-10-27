import flatten from "lodash/flatten";
import { useMemo } from "react";
import { useAuthenticatedInfiniteQuery } from "sharedHooks";

interface UserPage {
  page?: number;
  total_results?: number;
  results?: object[];
}

export const getNextUserPageParam = (
  lastPage?: UserPage,
  perPage = 200,
): number | undefined => {
  const results = lastPage?.results || [];
  const page = lastPage?.page || 1;
  const totalResults = lastPage?.total_results;
  const hasMore = results.length > 0
    && ( typeof totalResults !== "number"
      || page * perPage < totalResults );
  return hasMore
    ? page + 1
    : undefined;
};

const useInfiniteUserScroll = (
  queryKey: string,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  apiCall: Function,
  ids: object[],
  newInputParams: object,
  options: {
    enabled: boolean;
  },
): object => {
  const baseParams = {
    ...newInputParams,
    // TODO: can change this once API pagination is working
    per_page: 200,
  };

  const {
    data,
    isFetching,
    fetchNextPage,
    status,
  } = useAuthenticatedInfiniteQuery(
    [queryKey, baseParams],
    async ( { pageParam }, optsWithAuth ) => {
      const params = {
        ...baseParams,
      };

      if ( pageParam ) {
        params.page = pageParam;
      } else {
        params.page = 1;
      }

      return apiCall( ids, params, optsWithAuth );
    },
    {
      getNextPageParam: lastPage => getNextUserPageParam( lastPage, baseParams.per_page ),
      enabled: options.enabled,
    },
  );

  const pages = data?.pages;

  const flattenedData = useMemo(
    ( ) => flatten( pages?.map( page => page?.results ) ) || [],
    [pages],
  );

  return {
    data: flattenedData,
    isFetching,
    fetchNextPage,
    status,
    totalResults: pages?.[0]
      ? pages?.[0].total_results
      : null,
  };
};

export default useInfiniteUserScroll;
