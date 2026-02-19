const express = require('express');
const controller = require('../controllers/streamController');
const { cacheMiddleware } = require('../middlewares/cacheMiddleware');

const router = express.Router();

router.get('/health', controller.health);
router.get('/platforms', cacheMiddleware(), controller.getPlatforms);
router.get('/trending', cacheMiddleware(), controller.getTrending);
router.get('/most-watched', cacheMiddleware(180), controller.mostWatched);
router.get('/catalog/platform', cacheMiddleware(300), controller.catalogByPlatform);
router.get('/search', cacheMiddleware(120), controller.search);
router.get('/title/:id', cacheMiddleware(), controller.getTitle);
router.get('/recommendations', cacheMiddleware(), controller.recommendations);

router.get('/user/preferences', controller.getPreferences);
router.put('/user/preferences', controller.updatePreferences);
router.get('/user/search-history', controller.recentSearches);

module.exports = router;
