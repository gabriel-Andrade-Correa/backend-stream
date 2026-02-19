const axios = require('axios');
const { env } = require('../config/env');

const http = axios.create({
  baseURL: env.tmdbBaseUrl,
  timeout: 10000,
  params: {
    api_key: env.tmdbApiKey,
    language: 'pt-BR'
  }
});

module.exports = { http };
