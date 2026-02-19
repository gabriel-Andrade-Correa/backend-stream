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

async function getWatchProviders(mediaType, id) {
  const { data } = await http.get(`/${mediaType}/${id}/watch/providers`);
  const results = data.results || {};

  const regionData =
    results[env.tmdbWatchRegion] ||
    results.US ||
    results.BR ||
    null;

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
  return Promise.all(list.map((title) => enrichTitleWithProviders(title)));
}

async function getTrending() {
  ensureTmdbConfigured();
  const [trendWeek, moviePopular, tvPopular] = await Promise.all([
    http.get('/trending/all/week'),
    http.get('/movie/popular', { params: { page: 1 } }),
    http.get('/tv/popular', { params: { page: 1 } })
  ]);

  const weekItems = (trendWeek.data.results || [])
    .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
    .map(normalizeTitle);

  const movieItems = (moviePopular.data.results || []).map((item) =>
    normalizeTitle({ ...item, media_type: 'movie' })
  );

  const tvItems = (tvPopular.data.results || []).map((item) =>
    normalizeTitle({ ...item, media_type: 'tv' })
  );

  const unique = new Map();
  [...weekItems, ...movieItems, ...tvItems].forEach((item) => {
    if (!unique.has(item.id)) {
      unique.set(item.id, item);
    }
  });

  return Array.from(unique.values()).slice(0, 60);
}

async function searchTitles(query) {
  ensureTmdbConfigured();

  const { data } = await http.get('/search/multi', {
    params: { query, include_adult: false }
  });

  return (data.results || [])
    .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
    .map(normalizeTitle);
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
