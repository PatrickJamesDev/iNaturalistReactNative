import { getNextUserPageParam } from "sharedHooks/useInfiniteUserScroll";

describe( "getNextUserPageParam", ( ) => {
  it( "requests the next page while total_results says there is more", ( ) => {
    expect( getNextUserPageParam( {
      page: 1,
      total_results: 250,
      results: new Array( 200 ).fill( {} ),
    } ) ).toBe( 2 );
  } );

  it( "stops when total_results has been reached", ( ) => {
    expect( getNextUserPageParam( {
      page: 2,
      total_results: 250,
      results: new Array( 50 ).fill( {} ),
    } ) ).toBeUndefined( );
  } );

  it( "stops on an empty page even without total_results", ( ) => {
    expect( getNextUserPageParam( { page: 3, results: [] } ) ).toBeUndefined( );
  } );

  it( "keeps paginating without total_results while pages are full", ( ) => {
    expect( getNextUserPageParam( {
      page: 1,
      results: new Array( 200 ).fill( {} ),
    } ) ).toBe( 2 );
  } );
} );
