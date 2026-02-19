const tmdbService = require('../services/tmdbService');
const {
  platforms,
  mapPlatformsToTitle,
  normalizeProviderName,
  getProviderIdsByPlatformName
} = require('../services/platformService');
const { getRecommendations } = require('../services/recommendationService');
const { getDirectLinksByPlatform } = require('../services/watchmodeService');
const userService = require('../services/userService');

async function health(req, res) {
  res.json({ status: 'ok', service: 'streamhub-api' });
}

async function getPlatforms(req, res, next) {
  try {
    res.json({ data: platforms });
  } catch (error) {
    next(error);
  }
}

async function getTrending(req, res, next) {
  try {
    const trending = await tmdbService.getTrending();
    const enriched = await tmdbService.enrichTitlesWithProviders(trending);
    const withPlatforms = enriched.map(mapPlatformsToTitle);
    res.json({ data: withPlatforms });
  } catch (error) {
    next(error);
  }
}

async function mostWatched(req, res, next) {
  try {
    const titles = await tmdbService.getMostWatchedNow();
    const enriched = await tmdbService.enrichTitlesWithProviders(titles);
    const withPlatforms = enriched.map(mapPlatformsToTitle);
    res.json({ data: withPlatforms });
  } catch (error) {
    next(error);
  }
}

async function catalogByPlatform(req, res, next) {
  try {
    const name = String(req.query.name || '').trim();
    if (!name) {
      return res.status(400).json({ message: 'Informe o parâmetro name com a plataforma' });
    }

    const normalized = normalizeProviderName(name);
    const providerIds = getProviderIdsByPlatformName(normalized);
    if (!providerIds.length) {
      return res.status(404).json({ message: 'Plataforma não suportada para catálogo dedicado' });
    }

    const page = Math.max(1, Number(req.query.page || 1));
    const pages = Math.max(1, Number(req.query.pages || 2));
    const limit = Math.max(20, Number(req.query.limit || 240));
    const catalog = await tmdbService.getCatalogByProviders(providerIds, normalized, pages, limit, page);
    const withPlatforms = catalog.map(mapPlatformsToTitle);
    res.json({ data: withPlatforms, meta: { platform: normalized, page, pages, limit } });
  } catch (error) {
    next(error);
  }
}

async function search(req, res, next) {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) {
      return res.status(400).json({ message: 'Informe o parâmetro q para busca' });
    }

    const results = await tmdbService.searchTitles(query);
    const enriched = await tmdbService.enrichTitlesWithProviders(results);
    const withPlatforms = enriched.map(mapPlatformsToTitle);
    await userService.addSearchHistory(query);

    res.json({ data: withPlatforms });
  } catch (error) {
    next(error);
  }
}

async function getTitle(req, res, next) {
  try {
    const { id } = req.params;
    const mediaType = req.query.mediaType === 'movie' || req.query.mediaType === 'tv'
      ? req.query.mediaType
      : undefined;
    const title = await tmdbService.getTitleById(id, mediaType);

    if (!title) {
      return res.status(404).json({ message: 'Título não encontrado' });
    }

    const enriched = await tmdbService.enrichTitleWithProviders(title);
    const directLinksByPlatform = await getDirectLinksByPlatform({
      tmdbId: enriched.id,
      mediaType: enriched.mediaType,
      allowedPlatforms: enriched.providerNames || []
    });

    res.json({
      data: mapPlatformsToTitle(enriched, { directLinksByPlatform })
    });
  } catch (error) {
    next(error);
  }
}

async function recommendations(req, res, next) {
  try {
    const preferences = await userService.getPreferences(1);
    const trending = await tmdbService.getTrending();
    const enriched = await tmdbService.enrichTitlesWithProviders(trending);
    const withPlatforms = enriched.map(mapPlatformsToTitle);
    const recommended = getRecommendations(
      withPlatforms,
      preferences.favoriteGenre,
      preferences.selectedPlatforms
    );

    res.json({
      data: recommended,
      meta: { favoriteGenre: preferences.favoriteGenre }
    });
  } catch (error) {
    next(error);
  }
}

async function getPreferences(req, res, next) {
  try {
    const data = await userService.getPreferences(1);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function updatePreferences(req, res, next) {
  try {
    const { favoriteGenre, theme, selectedPlatforms } = req.body;
    const data = await userService.updatePreferences({
      userId: 1,
      favoriteGenre,
      theme,
      selectedPlatforms
    });

    res.json({ data });
  } catch (error) {
    next(error);
  }
}

async function recentSearches(req, res, next) {
  try {
    const data = await userService.getRecentSearches(1);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  health,
  getPlatforms,
  getTrending,
  mostWatched,
  catalogByPlatform,
  search,
  getTitle,
  recommendations,
  getPreferences,
  updatePreferences,
  recentSearches
};

