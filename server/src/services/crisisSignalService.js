'use strict';

/**
 * Safety net around `services/crisisService` for the forum write paths
 * (thread/reply creation). Posting help-seeking content must always succeed, so
 * every crisis interaction here is best-effort: if the crisis service is missing,
 * slow or failing we log a warning and continue without an assessment rather than
 * blocking the post or fabricating a risk level.
 *
 * The assessment is advisory only: `support` is returned to the UI when the level is
 * `elevated`/`high` and is never persisted as a label on the user or the content
 * (docs/ARCHITECTURE.md §4.4, §8).
 */
const logger = require('../config/logger');

const SUPPORT_LEVELS = new Set(['elevated', 'high']);
const VALID_LEVELS = new Set(['none', 'low', 'elevated', 'high']);

/** @type {object|null|undefined} undefined = not loaded yet, null = unavailable */
let cachedCrisisService;

/**
 * Resolve the crisis service once, tolerating a not-yet-deployed module.
 * @returns {object|null}
 */
function crisisService() {
  if (cachedCrisisService !== undefined) return cachedCrisisService;
  try {
    // Lazy require keeps the API bootable even if the AI module is being deployed
    // independently; the post path degrades gracefully instead of crashing.
    // eslint-disable-next-line global-require
    cachedCrisisService = require('./crisisService');
  } catch (error) {
    logger.warn('crisis.service_unavailable', { code: error && error.code });
    cachedCrisisService = null;
  }
  return cachedCrisisService;
}

/**
 * @typedef {{level:'none'|'low'|'elevated'|'high', score:number, reasons:string[], showResources:boolean}} Assessment
 */

/**
 * Normalise whatever the crisis service returned into the frozen shape.
 * @param {*} result
 * @returns {Assessment|null}
 */
function normalise(result) {
  if (!result || typeof result !== 'object') return null;
  const level = VALID_LEVELS.has(result.level) ? result.level : null;
  if (!level) return null;
  return {
    level,
    score: Number.isFinite(result.score) ? result.score : 0,
    reasons: Array.isArray(result.reasons) ? result.reasons.filter((reason) => typeof reason === 'string') : [],
    showResources: Boolean(result.showResources) || SUPPORT_LEVELS.has(level),
  };
}

/**
 * Assess post/reply text server-side. Never throws.
 * @param {string} text
 * @returns {Promise<Assessment|null>} null when the assessment could not be produced
 */
async function assessContent(text) {
  if (typeof text !== 'string' || text.trim().length === 0) return null;
  const service = crisisService();
  if (!service || typeof service.assess !== 'function') return null;

  try {
    return normalise(await service.assess(text, { source: 'content' }));
  } catch (error) {
    logger.warn('crisis.assess_failed', { code: error && error.code });
    return null;
  }
}

/**
 * Record a crisis event (metadata only) for elevated/high assessments. Never throws.
 * @param {{sessionId: string, assessment: Assessment|null, country?: string|null}} input
 * @returns {Promise<void>}
 */
async function recordIfElevated({ sessionId, assessment, country }) {
  if (!assessment || !SUPPORT_LEVELS.has(assessment.level)) return;
  const service = crisisService();
  if (!service || typeof service.recordEvent !== 'function') return;

  try {
    await service.recordEvent({
      sessionId,
      level: assessment.level,
      source: 'content',
      triggerCodes: assessment.reasons,
      country: country || null,
      resourcesShown: Boolean(assessment.showResources),
    });
  } catch (error) {
    logger.warn('crisis.record_event_failed', { code: error && error.code });
  }
}

/**
 * The `support` payload returned by thread/reply creation, or null when the
 * assessment is low/none/unavailable.
 * @param {Assessment|null} assessment
 * @returns {{level:string, showResources:boolean}|null}
 */
function supportFor(assessment) {
  if (!assessment || !SUPPORT_LEVELS.has(assessment.level)) return null;
  return { level: assessment.level, showResources: Boolean(assessment.showResources) };
}

module.exports = { assessContent, recordIfElevated, supportFor, SUPPORT_LEVELS };
