const axios = require('axios');
const { env } = require('../config/env');
const { normalizeProviderName } = require('./platformService');

function hasWatchmodeConfig() {
  return Boolean(env.watchmodeApiKey);
}

function createWatchmodeClient() {
  return axios.create({
    baseURL: env.watchmodeBaseUrl,
    timeout: 10000
  });
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function isAppScheme(value) {
  return typeof value === 'string' && /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

function getSourceTypeRank(source) {
  const sourceType = String(source?.type || '').toLowerCase();
  if (sourceType === 'sub') return 3;
  if (sourceType === 'free' || sourceType === 'tve') return 2;
  if (sourceType === 'buy' || sourceType === 'rent') return 1;
  return 1;
}

function getSourcePlatformName(source) {
  const raw = source?.name || source?.source_name || source?.display_name || '';
  return normalizeProviderName(raw);
}

function pickAppUrl(source) {
  const candidates = [source?.android_url, source?.ios_url];
  const valid = candidates.find((candidate) => isAppScheme(candidate));
  return valid || null;
}

async function findWatchmodeTitleIdByTmdb(client, tmdbId, mediaType) {
  const searchField = mediaType === 'tv' ? 'tmdb_tv_id' : 'tmdb_movie_id';

  const { data } = await client.get('/search/', {
    params: {
      apiKey: env.watchmodeApiKey,
      search_field: searchField,
      search_value: String(tmdbId)
    }
  });

  const list = Array.isArray(data?.title_results) ? data.title_results : [];
  const first = list[0];
  return first?.id ? Number(first.id) : null;
}

function mergeDirectLinks(current, next) {
  if (!next) return current;
  if (!current) return next;

  if ((next.rank || 0) > (current.rank || 0)) {
    return next;
  }

  return {
    app: current.app || next.app || null,
    web: current.web || next.web || null,
    rank: current.rank || next.rank || 0
  };
}

async function getDirectLinksByPlatform({ tmdbId, mediaType, allowedPlatforms = [] }) {
  if (!hasWatchmodeConfig() || !tmdbId || (mediaType !== 'movie' && mediaType !== 'tv')) {
    return {};
  }

  try {
    const client = createWatchmodeClient();
    const watchmodeTitleId = await findWatchmodeTitleIdByTmdb(client, tmdbId, mediaType);
    if (!watchmodeTitleId) return {};

    const { data } = await client.get(`/title/${watchmodeTitleId}/sources/`, {
      params: {
        apiKey: env.watchmodeApiKey,
        regions: env.tmdbWatchRegion || 'BR'
      }
    });

    const sources = Array.isArray(data) ? data : [];
    const links = {};
    const allowedSet = new Set((allowedPlatforms || []).map((name) => normalizeProviderName(name)));

    sources.forEach((source) => {
      const rank = getSourceTypeRank(source);
      const platform = getSourcePlatformName(source);
      if (!platform) return;
      if (allowedSet.size > 0 && !allowedSet.has(platform)) return;

      const webUrl = isHttpUrl(source?.web_url) ? source.web_url : null;
      if (!webUrl) return;

      const next = {
        app: pickAppUrl(source),
        web: webUrl,
        rank
      };

      links[platform] = mergeDirectLinks(links[platform], next);
    });

    const normalizedLinks = {};
    Object.entries(links).forEach(([platform, data]) => {
      normalizedLinks[platform] = {
        app: data?.app || null,
        web: data?.web || null
      };
    });

    return normalizedLinks;
  } catch (error) {
    return {};
  }
}

module.exports = {
  hasWatchmodeConfig,
  getDirectLinksByPlatform
};
