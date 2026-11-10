'use strict';

/**
 * Crisis controller (docs/ARCHITECTURE.md §4.3, §4.4, §8).
 *
 * Privacy rules enforced here:
 *  - `POST /crisis/assess` stores NOTHING and never echoes the text back;
 *  - `POST /crisis/events` persists metadata only (no text, no IP, no UA);
 *  - nothing user-authored is logged.
 */
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const crisisService = require('../services/crisisService');

const getResources = asyncHandler(async (req, res) => {
  const resources = crisisService.getResources({ country: req.query.country });
  return ok(res, { resources }, { message: 'Crisis resources retrieved' });
});

const assess = asyncHandler(async (req, res) => {
  const assessment = await crisisService.assess(req.body.text, {
    source: req.body.source || 'assessment',
  });
  return ok(res, { assessment }, { message: 'Crisis assessment complete' });
});

const recordEvent = asyncHandler(async (req, res) => {
  const { level, source, country } = req.body;
  const resources = crisisService.getResources({ country });

  await crisisService.recordEvent({
    sessionId: req.identity.sessionId,
    level,
    source,
    triggerCodes: [],
    country,
    resourcesShown: true,
  });

  return ok(res, { acknowledged: true, resources }, { message: 'Crisis event recorded' });
});

module.exports = {
  getResources,
  assess,
  recordEvent,
};
