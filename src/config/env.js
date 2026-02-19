const dotenv = require('dotenv');

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  tmdbApiKey: process.env.TMDB_API_KEY || '',
  tmdbBaseUrl: process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
  tmdbWatchRegion: process.env.TMDB_WATCH_REGION || 'US',
  tmdbCatalogPages: Number(process.env.TMDB_CATALOG_PAGES || 3),
  tmdbCatalogMaxItems: Number(process.env.TMDB_CATALOG_MAX_ITEMS || 180),
  tmdbProviderConcurrency: Number(process.env.TMDB_PROVIDER_CONCURRENCY || 8),
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS || 300)
};

module.exports = { env };
