const dotenv = require('dotenv');

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  tmdbApiKey: process.env.TMDB_API_KEY || '',
  tmdbBaseUrl: process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
  tmdbWatchRegion: process.env.TMDB_WATCH_REGION || 'BR',
  tmdbIncludeAds: String(process.env.TMDB_INCLUDE_ADS || 'false').toLowerCase() === 'true',
  tmdbCatalogPages: Number(process.env.TMDB_CATALOG_PAGES || 5),
  tmdbCatalogMaxItems: Number(process.env.TMDB_CATALOG_MAX_ITEMS || 420),
  tmdbProviderConcurrency: Number(process.env.TMDB_PROVIDER_CONCURRENCY || 12),
  tmdbEnrichFullProviders: String(process.env.TMDB_ENRICH_FULL_PROVIDERS || 'false').toLowerCase() === 'true',
  watchmodeApiKey: process.env.WATCHMODE_API_KEY || '',
  watchmodeBaseUrl: process.env.WATCHMODE_BASE_URL || 'https://api.watchmode.com/v1',
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS || 300)
};

module.exports = { env };
