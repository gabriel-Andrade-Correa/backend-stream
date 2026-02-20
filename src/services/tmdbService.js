const { http } = require('../utils/httpClient');
const { env } = require('../config/env');

const DISCOVER_PROVIDER_HINTS = [
  { id: 8, name: 'Netflix' },
  { id: 119, name: 'Prime Video' },
  { id: 337, name: 'Disney+' },
  { id: 384, name: 'HBO Max' },
  { id: 1899, name: 'HBO Max' },
  { id: 350, name: 'Apple TV+' }
];

function ensureTmdbConfigured() {
  if (!env.tmdbApiKey) {
    const error = new Error('TMDB_API_KEY não configurada. Defina no arquivo .env do backend.');
    error.status = 503;
    throw error;
  }
}

function normalizeTitle(item) {
  const mediaType = item.media_type === 'tv' || item.first_air_date ? 'tv' : 'movie';
  const releaseDate = item.release_date || item.first_air_date || null;

  return {
    id: item.id,
    title: item.title || item.name,
    type: mediaType === 'tv' ? 'serie' : 'filme',
    mediaType,
    overview: item.overview,
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
    releaseDate,
    genreIds: item.genre_ids || [],
    popularity: item.popularity || 0,
    voteAverage: item.vote_average || 0
  };
}

function uniqueProviders(list) {
  const map = new Map();
  list.forEach((item) => {
    if (!item?.provider_id) return;
    map.set(item.provider_id, item);
  });
  return Array.from(map.values());
}

function dedupeTitles(items) {
  const map = new Map();
  (items || []).forEach((item) => {
    const key = `${item.mediaType}:${item.id}`;
    if (!map.has(key)) {
      map.set(key, item);
    }
  });
  return Array.from(map.values());
}

async function fetchPagedList(endpoint, mediaType, pages, extraParams = {}, startPage = 1) {
  const list = [];

  for (let currentPage = startPage; currentPage < startPage + pages; currentPage += 1) {
    const { data } = await http.get(endpoint, {
      params: {
        ...extraParams,
        page: currentPage
      }
    });

    const results = data.results || [];
    results.forEach((item) => {
      list.push(normalizeTitle({ ...item, media_type: item.media_type || mediaType }));
    });
  }

  return list;
}

async function fetchDiscoverByProvider(providerId, providerName, pages, startPage = 1) {
  const [movies, tv] = await Promise.all([
    fetchPagedList('/discover/movie', 'movie', pages, {
      watch_region: env.tmdbWatchRegion,
      with_watch_providers: String(providerId),
      with_watch_monetization_types: 'flatrate',
      sort_by: 'popularity.desc'
    }, startPage),
    fetchPagedList('/discover/tv', 'tv', pages, {
      watch_region: env.tmdbWatchRegion,
      with_watch_providers: String(providerId),
      with_watch_monetization_types: 'flatrate',
      sort_by: 'popularity.desc'
    }, startPage)
  ]);

  return [...movies, ...tv].map((item) => ({
    ...item,
    providerNames: [providerName]
  }));
}

async function fetchRecentByProvider(providerId, providerName, pages, startPage = 1) {
  const today = new Date().toISOString().slice(0, 10);
  const [movies, tv] = await Promise.all([
    fetchPagedList('/discover/movie', 'movie', pages, {
      watch_region: env.tmdbWatchRegion,
      with_watch_providers: String(providerId),
      with_watch_monetization_types: 'flatrate',
      sort_by: 'primary_release_date.desc',
      'release_date.lte': today,
      include_adult: false
    }, startPage),
    fetchPagedList('/discover/tv', 'tv', pages, {
      watch_region: env.tmdbWatchRegion,
      with_watch_providers: String(providerId),
      with_watch_monetization_types: 'flatrate',
      sort_by: 'first_air_date.desc',
      'first_air_date.lte': today,
      include_adult: false
    }, startPage)
  ]);

  return [...movies, ...tv].map((item) => ({
    ...item,
    providerNames: [providerName]
  }));
}

async function getCatalogByProviders(providerIds, platformName, pages = 3, maxItems = 240, startPage = 1) {
  ensureTmdbConfigured();
  const safePages = Math.max(1, Math.min(8, pages));
  const safeMax = Math.max(20, Math.min(800, maxItems));
  const safeStartPage = Math.max(1, Math.min(80, Number(startPage) || 1));
  const ids = Array.isArray(providerIds) ? providerIds.filter(Boolean) : [];
  if (!ids.length) return [];

  const discovered = await Promise.all(
    ids.map((providerId) => fetchDiscoverByProvider(providerId, platformName, safePages, safeStartPage))
  );

  return dedupeTitles(discovered.flat()).slice(0, safeMax);
}

function sortByReleaseDateAndPopularity(items) {
  return [...(items || [])].sort((a, b) => {
    const aTime = a?.releaseDate ? Date.parse(a.releaseDate) || 0 : 0;
    const bTime = b?.releaseDate ? Date.parse(b.releaseDate) || 0 : 0;
    if (aTime !== bTime) return bTime - aTime;
    return (b?.popularity || 0) - (a?.popularity || 0);
  });
}

async function getNewReleasesByProviders(providerIds, platformName, pages = 2, maxItems = 90, startPage = 1) {
  ensureTmdbConfigured();
  const safePages = Math.max(1, Math.min(5, pages));
  const safeMax = Math.max(20, Math.min(300, maxItems));
  const safeStartPage = Math.max(1, Math.min(50, Number(startPage) || 1));
  const ids = Array.isArray(providerIds) ? providerIds.filter(Boolean) : [];
  if (!ids.length) return [];

  const discovered = await Promise.all(
    ids.map((providerId) => fetchRecentByProvider(providerId, platformName, safePages, safeStartPage))
  );

  return sortByReleaseDateAndPopularity(dedupeTitles(discovered.flat())).slice(0, safeMax);
}

async function getWatchProviders(mediaType, id) {
  const { data } = await http.get(`/${mediaType}/${id}/watch/providers`);
  const results = data.results || {};

  const regionData = results[env.tmdbWatchRegion] || results.US || results.BR || null;

  const providerItems = uniqueProviders([
    ...(regionData?.flatrate || []),
    ...(env.tmdbIncludeAds ? (regionData?.ads || []) : [])
  ]);

  return {
    providerNames: providerItems.map((item) => item.provider_name),
    providerLink: regionData?.link || null,
    watchRegion: regionData ? (results[env.tmdbWatchRegion] ? env.tmdbWatchRegion : results.US ? 'US' : 'BR') : null
  };
}

async function enrichTitleWithProviders(title) {
  if (!title?.id || !title?.mediaType) {
    return { ...title, providerNames: [], providerLink: null, watchRegion: null };
  }

  if (!env.tmdbEnrichFullProviders && Array.isArray(title.providerNames) && title.providerNames.length) {
    return {
      ...title,
      providerNames: title.providerNames,
      providerLink: null,
      watchRegion: env.tmdbWatchRegion
    };
  }

  try {
    const watch = await getWatchProviders(title.mediaType, title.id);
    return {
      ...title,
      providerNames: watch.providerNames,
      providerLink: watch.providerLink,
      watchRegion: watch.watchRegion
    };
  } catch (error) {
    return {
      ...title,
      providerNames: [],
      providerLink: null,
      watchRegion: null
    };
  }
}

async function enrichTitlesWithProviders(titles) {
  const list = Array.isArray(titles) ? titles : [];
  const concurrency = Math.max(1, env.tmdbProviderConcurrency || 8);
  const output = [];

  for (let i = 0; i < list.length; i += concurrency) {
    const chunk = list.slice(i, i + concurrency);
    const enrichedChunk = await Promise.all(chunk.map((title) => enrichTitleWithProviders(title)));
    output.push(...enrichedChunk);
  }

  return output;
}

async function getTrending() {
  ensureTmdbConfigured();
  const pages = Math.max(1, env.tmdbCatalogPages || 5);
  const maxItems = Math.max(80, env.tmdbCatalogMaxItems || 420);

  const [
    trendingItems,
    moviePopularItems,
    tvPopularItems,
    movieTopRatedItems,
    tvTopRatedItems,
    discoverLists
  ] = await Promise.all([
    fetchPagedList('/trending/all/week', null, Math.min(2, pages)),
    fetchPagedList('/movie/popular', 'movie', pages),
    fetchPagedList('/tv/popular', 'tv', pages),
    fetchPagedList('/movie/top_rated', 'movie', Math.min(2, pages)),
    fetchPagedList('/tv/top_rated', 'tv', Math.min(2, pages)),
    Promise.all(
      DISCOVER_PROVIDER_HINTS.map((provider) =>
        fetchDiscoverByProvider(provider.id, provider.name, Math.min(3, pages))
      )
    )
  ]);

  return dedupeTitles([
    ...trendingItems,
    ...moviePopularItems,
    ...tvPopularItems,
    ...movieTopRatedItems,
    ...tvTopRatedItems,
    ...discoverLists.flat()
  ]).slice(0, maxItems);
}

async function getMostWatchedNow() {
  ensureTmdbConfigured();
  const [trendMovieDay, trendTvDay, movieNowPlaying, tvOnTheAir] = await Promise.all([
    fetchPagedList('/trending/movie/day', 'movie', 1),
    fetchPagedList('/trending/tv/day', 'tv', 1),
    fetchPagedList('/movie/now_playing', 'movie', 1),
    fetchPagedList('/tv/on_the_air', 'tv', 1)
  ]);

  return dedupeTitles([
    ...trendMovieDay,
    ...trendTvDay,
    ...movieNowPlaying,
    ...tvOnTheAir
  ]).slice(0, 120);
}

async function searchTitles(query) {
  ensureTmdbConfigured();
  const pages = Math.max(1, Math.min(3, env.tmdbCatalogPages || 3));
  const all = [];

  for (let page = 1; page <= pages; page += 1) {
    const { data } = await http.get('/search/multi', {
      params: { query, include_adult: false, page }
    });

    all.push(
      ...(data.results || [])
        .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
        .map(normalizeTitle)
    );
  }

  return dedupeTitles(all).slice(0, 40);
}

function mapMovieDetails(item) {
  return {
    id: item.id,
    title: item.title,
    type: 'filme',
    mediaType: 'movie',
    overview: item.overview,
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
    genreIds: (item.genres || []).map((g) => g.id),
    genres: (item.genres || []).map((g) => g.name),
    voteAverage: item.vote_average || 0,
    popularity: item.popularity || 0
  };
}

function mapTvDetails(item) {
  return {
    id: item.id,
    title: item.name,
    type: 'serie',
    mediaType: 'tv',
    overview: item.overview,
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
    genreIds: (item.genres || []).map((g) => g.id),
    genres: (item.genres || []).map((g) => g.name),
    voteAverage: item.vote_average || 0,
    popularity: item.popularity || 0
  };
}

async function getTitleById(id, mediaType) {
  ensureTmdbConfigured();

  if (mediaType === 'movie') {
    try {
      const { data } = await http.get(`/movie/${id}`);
      return mapMovieDetails(data);
    } catch (error) {
      return null;
    }
  }

  if (mediaType === 'tv') {
    try {
      const { data } = await http.get(`/tv/${id}`);
      return mapTvDetails(data);
    } catch (error) {
      return null;
    }
  }

  const [movieRes, tvRes] = await Promise.allSettled([
    http.get(`/movie/${id}`),
    http.get(`/tv/${id}`)
  ]);

  if (movieRes.status === 'fulfilled') {
    return mapMovieDetails(movieRes.value.data);
  }

  if (tvRes.status === 'fulfilled') {
    return mapTvDetails(tvRes.value.data);
  }

  return null;
}

module.exports = {
  getTrending,
  getMostWatchedNow,
  getCatalogByProviders,
  getNewReleasesByProviders,
  searchTitles,
  getTitleById,
  enrichTitleWithProviders,
  enrichTitlesWithProviders
};
