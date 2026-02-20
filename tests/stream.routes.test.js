jest.mock('../src/services/tmdbService', () => ({
  getTrending: jest.fn(),
  getMostWatchedNow: jest.fn(),
  getCatalogByProviders: jest.fn(),
  searchTitles: jest.fn(),
  getTitleById: jest.fn(),
  enrichTitleWithProviders: jest.fn(),
  enrichTitlesWithProviders: jest.fn()
}));

jest.mock('../src/services/userService', () => ({
  addSearchHistory: jest.fn(),
  getPreferences: jest.fn(),
  updatePreferences: jest.fn(),
  getRecentSearches: jest.fn()
}));

jest.mock('../src/services/watchmodeService', () => ({
  getDirectLinksByPlatform: jest.fn()
}));

const request = require('supertest');
const app = require('../src/app');
const tmdbService = require('../src/services/tmdbService');
const userService = require('../src/services/userService');
const watchmodeService = require('../src/services/watchmodeService');

describe('stream routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/health should return ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      service: 'streamhub-api'
    });
  });

  test('GET /api/search without q should return 400', async () => {
    const res = await request(app).get('/api/search');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/parâmetro q|parametro q/i);
  });

  test('GET /api/search should return mapped results', async () => {
    tmdbService.searchTitles.mockResolvedValue([
      {
        id: 123,
        mediaType: 'movie',
        type: 'filme',
        title: 'Harry Potter e a Pedra Filosofal',
        overview: '...',
        poster: null,
        availableOn: [],
        providerNames: ['HBO Max']
      }
    ]);
    tmdbService.enrichTitlesWithProviders.mockResolvedValue([
      {
        id: 123,
        mediaType: 'movie',
        type: 'filme',
        title: 'Harry Potter e a Pedra Filosofal',
        overview: '...',
        poster: null,
        providerNames: ['HBO Max']
      }
    ]);
    userService.addSearchHistory.mockResolvedValue(undefined);

    const res = await request(app).get('/api/search').query({ q: 'harry potter' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].title).toContain('Harry Potter');
    expect(res.body.data[0].availableOn).toContain('HBO Max');
  });

  test('GET /api/title/:id should include mapped deep links', async () => {
    tmdbService.getTitleById.mockResolvedValue({
      id: 94605,
      mediaType: 'tv',
      type: 'serie',
      title: 'Arcane',
      overview: '...',
      poster: null
    });
    tmdbService.enrichTitleWithProviders.mockResolvedValue({
      id: 94605,
      mediaType: 'tv',
      type: 'serie',
      title: 'Arcane',
      overview: '...',
      poster: null,
      providerNames: ['Netflix']
    });
    watchmodeService.getDirectLinksByPlatform.mockResolvedValue({
      Netflix: { app: null, web: 'https://www.netflix.com/title/81435684' }
    });

    const res = await request(app).get('/api/title/94605').query({ mediaType: 'tv' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Arcane');
    expect(res.body.data.deepLinks[0].platform).toBe('Netflix');
    expect(res.body.data.deepLinks[0].directWeb).toContain('netflix.com/title');
  });
});
