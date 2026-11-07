const express = require('express');
const { protect } = require('../middleware/auth');
const { personalInsights } = require('../utils/insights');
const { asyncHandler } = require('../utils/helpers');

const router = express.Router();
router.use(protect);

// GET /api/insights/me — personalised levels, tips and suggested goals
router.get('/me', asyncHandler(async (req, res) => res.json(await personalInsights(req.user))));

module.exports = router;
