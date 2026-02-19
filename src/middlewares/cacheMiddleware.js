const { env } = require('../config/env');
const { getCache, setCache } = require('../services/cacheService');

function cacheMiddleware(ttlSeconds = env.cacheTtlSeconds) {
  return (req, res, next) => {
    const key = req.originalUrl;
    const cached = getCache(key);

    if (cached) {
      return res.json(cached);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      setCache(key, body, ttlSeconds);
      return originalJson(body);
    };

    next();
  };
}

module.exports = { cacheMiddleware };
