'use strict';

/**
 * User controllers (`/api/v1/users`, docs/ARCHITECTURE.md §4.3, §4.4).
 */
const { clearSessionCookies } = require('../utils/cookies');
const { ok, noContent } = require('../utils/response');
const authService = require('../services/authService');
const userService = require('../services/userService');

/**
 * GET /users/me/preferences
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function getPreferences(req, res) {
  const { context } = await authService.getIdentity(req.identity);
  return ok(res, { preferences: await userService.getPreferences(context) }, { message: 'OK' });
}

/**
 * PATCH /users/me/preferences
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function updatePreferences(req, res) {
  const { context } = await authService.getIdentity(req.identity);
  const preferences = await userService.updatePreferences(context, req.body);
  return ok(res, { preferences }, { message: 'Preferences updated' });
}

/**
 * GET /users/me/content?type=threads|replies
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function listContent(req, res) {
  const { type } = req.query;
  const { items, meta } = await userService.listOwnContent({
    identity: req.identity,
    type,
    query: req.query,
  });
  const message = type === 'replies' ? 'Your replies' : 'Your threads';
  return ok(res, { [type]: items }, { message, meta });
}

/**
 * DELETE /users/me — complete data deletion (204).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function deleteMe(req, res) {
  const deleteContent = req.body && req.body.deleteContent !== false;
  await userService.deleteAccount({ identity: req.identity, deleteContent });
  clearSessionCookies(res);
  return noContent(res);
}

module.exports = { getPreferences, updatePreferences, listContent, deleteMe };
