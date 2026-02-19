const platforms = [
  { id: 'netflix', name: 'Netflix', color: '#E50914' },
  { id: 'max', name: 'HBO Max', color: '#6C3BFF' },
  { id: 'prime', name: 'Prime Video', color: '#00A8E1' },
  { id: 'disney', name: 'Disney+', color: '#113CCF' },
  { id: 'apple', name: 'Apple TV+', color: '#A3A3A3' }
];

const PROVIDER_IDS_BY_PLATFORM = {
  Netflix: [8],
  'HBO Max': [1899, 384],
  'Prime Video': [119],
  'Disney+': [337],
  'Apple TV+': [350]
};

// Optional direct links for known titles. Fallback remains search links.
const directLinksByTitle = {
  arcane: {
    Netflix: {
      app: 'nflx://www.netflix.com/title/81435684',
      web: 'https://www.netflix.com/title/81435684'
    }
  },
  'game of thrones': {
    'HBO Max': {
      app: 'hbomax://series/urn:hbo:series:GVU2cggagzYNJjhsJATwo',
      web: 'https://play.max.com/show/6d6d9f7f-7f8f-4c54-96a6-2f4f44b4a8bc'
    }
  }
};

function mapPlatformsToTitle(title, options = {}) {
  const rawProviders = Array.isArray(title.providerNames) ? title.providerNames : [];
  const fromTmdb = rawProviders.map(normalizeProviderName).filter(Boolean);

  const rawDynamic = options.directLinksByPlatform || {};
  const normalizedDynamic = {};
  Object.entries(rawDynamic).forEach(([name, links]) => {
    const normalizedName = normalizeProviderName(name);
    if (!normalizedName) return;
    normalizedDynamic[normalizedName] = links;
  });

  const availableOn = Array.from(new Set([...fromTmdb, ...Object.keys(normalizedDynamic)]));

  const deepLinks = availableOn.map((name) => {
    const manualDirect = getPlatformDirectLink(title.title, name);
    const dynamicDirect = normalizedDynamic[name] || null;
    const direct = dynamicDirect || manualDirect;

    return {
      platform: name,
      app: getPlatformDeepLink(name, title.title),
      web: getPlatformWebLink(name, title.title),
      directApp: direct?.app || null,
      directWeb: direct?.web || null
    };
  });

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
    'HBO MAX': 'HBO Max',
    Netflix: 'Netflix',
    'Netflix Standard with Ads': 'Netflix',
    'Amazon Prime Video': 'Prime Video',
    'Prime Video': 'Prime Video',
    'Amazon Prime Video with Ads': 'Prime Video',
    'Amazon Prime': 'Prime Video',
    Amazon: 'Prime Video',
    PrimeVideo: 'Prime Video',
    'Disney Plus': 'Disney+',
    'Disney+': 'Disney+',
    'Apple TV Plus': 'Apple TV+',
    'Apple TV+': 'Apple TV+',
    AppleTV: 'Apple TV+',
    'HBO Max Amazon Channel': 'Prime Video'
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

function getPlatformDirectLink(titleName, platformName) {
  const key = String(titleName || '').trim().toLowerCase();
  return directLinksByTitle[key]?.[platformName] || null;
}

function getProviderIdsByPlatformName(platformName) {
  const normalized = normalizeProviderName(platformName);
  return PROVIDER_IDS_BY_PLATFORM[normalized] || [];
}

module.exports = {
  platforms,
  mapPlatformsToTitle,
  getPlatformWebLink,
  getPlatformDeepLink,
  normalizeProviderName,
  getPlatformDirectLink,
  getProviderIdsByPlatformName
};
