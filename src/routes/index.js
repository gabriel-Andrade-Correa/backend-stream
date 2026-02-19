const express = require('express');
const streamRoutes = require('./stream.routes');

const router = express.Router();

router.use(streamRoutes);

module.exports = router;
