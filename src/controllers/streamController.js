const tmdbService = require('../services/tmdbService');
const { platforms, mapPlatformsToTitle } = require('../services/platformService');
const { getRecommendations } = require('../services/recommendationService');
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
    const title = await tmdbService.getTitleById(id);

    if (!title) {
      return res.status(404).json({ message: 'Título não encontrado' });
    }

    const enriched = await tmdbService.enrichTitleWithProviders(title);
    res.json({ data: mapPlatformsToTitle(enriched) });
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
  search,
  getTitle,
  recommendations,
  getPreferences,
  updatePreferences,
  recentSearches
};
