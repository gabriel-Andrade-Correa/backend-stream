const platforms = [
  { id: 'netflix', name: 'Netflix', color: '#E50914' },
  { id: 'max', name: 'HBO Max', color: '#6C3BFF' },
  { id: 'prime', name: 'Prime Video', color: '#00A8E1' },
  { id: 'disney', name: 'Disney+', color: '#113CCF' },
  { id: 'apple', name: 'Apple TV+', color: '#A3A3A3' }
];

function mapPlatformsToTitle(title) {
  const rawProviders = Array.isArray(title.providerNames) ? title.providerNames : [];
  const availableOn = Array.from(
    new Set(rawProviders.map(normalizeProviderName).filter(Boolean))
  );

  const deepLinks = availableOn.map((name) => ({
    platform: name,
    app: getPlatformDeepLink(name, title.title),
    web: getPlatformWebLink(name, title.title),
    directApp: null,
    directWeb: title.providerLink || null
  }));

  return {
    ...title,
    availableOn,
    deepLinks
  };
}

function normalizeProviderName(name) {
  const normalized = String(name || '').trim();

  const aliasMap = {
    Max: 'HBO Max',
    'HBO Max': 'HBO Max',
    Netflix: 'Netflix',
    'Amazon Prime Video': 'Prime Video',
    'Prime Video': 'Prime Video',
    'Disney Plus': 'Disney+',
    'Disney+': 'Disney+',
    'Apple TV Plus': 'Apple TV+',
    'Apple TV+': 'Apple TV+'
  };

  return aliasMap[normalized] || normalized;
}

function getPlatformDeepLink(platformName, title) {
  const q = encodeURIComponent(title);
  const map = {
    Netflix: `nflx://www.netflix.com/search?q=${q}`,
    'HBO Max': `hbomax://search/${q}`,
    'Prime Video': `primevideo://search?phrase=${q}`,
    'Disney+': `disneyplus://search?q=${q}`,
    'Apple TV+': `videos://search?term=${q}`
  };

  return map[platformName] || `https://www.google.com/search?q=${q}+streaming`;
}

function getPlatformWebLink(platformName, title) {
  const q = encodeURIComponent(title);
  const map = {
    Netflix: `https://www.netflix.com/search?q=${q}`,
    'HBO Max': `https://play.max.com/search?q=${q}`,
    'Prime Video': `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q}`,
    'Disney+': `https://www.disneyplus.com/search/${q}`,
    'Apple TV+': `https://tv.apple.com/search?term=${q}`
  };

  return map[platformName] || `https://www.google.com/search?q=${q}+streaming`;
}

module.exports = {
  platforms,
  mapPlatformsToTitle,
  getPlatformWebLink,
  getPlatformDeepLink,
  normalizeProviderName
};
