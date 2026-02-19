const { http } = require('../utils/httpClient');

function normalizeTitle(item) {
  return {
    id: item.id,
    title: item.title || item.name,
    type: item.media_type === 'tv' || item.first_air_date ? 'serie' : 'filme',
    overview: item.overview,
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
    genreIds: item.genre_ids || [],
    popularity: item.popularity || 0,
    voteAverage: item.vote_average || 0
  };
}

async function getTrending() {
  const { data } = await http.get('/trending/all/day');
  return (data.results || []).slice(0, 20).map(normalizeTitle);
}

async function searchTitles(query) {
  const { data } = await http.get('/search/multi', {
    params: { query, include_adult: false }
  });

  return (data.results || [])
    .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
    .map(normalizeTitle);
}

async function getTitleById(id) {
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
      overview: item.overview,
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
      genres: (item.genres || []).map((g) => g.name),
      voteAverage: item.vote_average || 0
    };
  }

  if (tvRes.status === 'fulfilled') {
    const item = tvRes.value.data;
    return {
      id: item.id,
      title: item.name,
      type: 'serie',
      overview: item.overview,
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
      genres: (item.genres || []).map((g) => g.name),
      voteAverage: item.vote_average || 0
    };
  }

  return null;
}

module.exports = { getTrending, searchTitles, getTitleById };
