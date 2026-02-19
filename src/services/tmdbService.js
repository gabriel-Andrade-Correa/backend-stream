const { http } = require('../utils/httpClient');
const { env } = require('../config/env');

function ensureTmdbConfigured() {
  if (!env.tmdbApiKey) {
    const error = new Error('TMDB_API_KEY não configurada. Defina no arquivo .env do backend.');
    error.status = 503;
    throw error;
  }
}

function normalizeTitle(item) {
  const mediaType = item.media_type === 'tv' || item.first_air_date ? 'tv' : 'movie';

  return {
    id: item.id,
    title: item.title || item.name,
    type: mediaType === 'tv' ? 'serie' : 'filme',
    mediaType,
    overview: item.overview,
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
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

async function fetchPagedList(endpoint, mediaType, pages, extraParams = {}) {
  const list = [];

  for (let page = 1; page <= pages; page += 1) {
    const { data } = await http.get(endpoint, {
      params: {
        ...extraParams,
        page
      }
    });

    const results = data.results || [];
    results.forEach((item) => {
      list.push(normalizeTitle({ ...item, media_type: item.media_type || mediaType }));
    });
  }

  return list;
}

async function getWatchProviders(mediaType, id) {
  const { data } = await http.get(`/${mediaType}/${id}/watch/providers`);
  const results = data.results || {};

  const regionData = results[env.tmdbWatchRegion] || results.US || results.BR || null;

  const providerItems = uniqueProviders([
    ...(regionData?.flatrate || []),
    ...(regionData?.ads || [])
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
  const pages = Math.max(1, env.tmdbCatalogPages || 3);
  const maxItems = Math.max(30, env.tmdbCatalogMaxItems || 180);

  const [trendingItems, moviePopularItems, tvPopularItems, movieTopRatedItems, tvTopRatedItems] = await Promise.all([
    fetchPagedList('/trending/all/week', null, Math.min(2, pages)),
    fetchPagedList('/movie/popular', 'movie', pages),
    fetchPagedList('/tv/popular', 'tv', pages),
    fetchPagedList('/movie/top_rated', 'movie', Math.min(2, pages)),
    fetchPagedList('/tv/top_rated', 'tv', Math.min(2, pages))
  ]);

  return dedupeTitles([
    ...trendingItems,
    ...moviePopularItems,
    ...tvPopularItems,
    ...movieTopRatedItems,
    ...tvTopRatedItems
  ]).slice(0, maxItems);
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

  return dedupeTitles(all).slice(0, 100);
}

async function getTitleById(id) {
  ensureTmdbConfigured();

  const [movieRes, tvRes] = await Promise.allSettled([
    http.get(`/movie/${id}`),
    http.get(`/tv/${id}`)
  ]);

  if (movieRes.status === 'fulfilled') {
    const item = movieRes.value.data;
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

  if (tvRes.status === 'fulfilled') {
    const item = tvRes.value.data;
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

  return null;
}

module.exports = {
  getTrending,
  searchTitles,
  getTitleById,
  enrichTitleWithProviders,
  enrichTitlesWithProviders
};
