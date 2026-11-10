'use strict';

/**
 * Report controllers (`/api/v1/reports`, docs/ARCHITECTURE.md §4.3, §4.4).
 */
const { ok, created } = require('../utils/response');
const reportService = require('../services/reportService');
const { viewerIdOf } = require('../utils/domain/identity');

/**
 * POST /reports
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function create(req, res) {
  const report = await reportService.createReport({ identity: req.identity, input: req.body });
  return created(
    res,
    { report: report.toPublicJSON({ viewerId: viewerIdOf(req.identity) }) },
    { message: 'Report submitted' }
  );
}

/**
 * GET /reports (moderator+)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function list(req, res) {
  const { reports, meta } = await reportService.listReports({ query: req.query, identity: req.identity });
  return ok(res, { reports }, { message: 'Reports', meta });
}

/**
 * PATCH /reports/:id (moderator+)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function update(req, res) {
  const report = await reportService.updateReport({
    identity: req.identity,
    id: req.params.id,
    input: req.body,
  });
  return ok(
    res,
    { report: report.toPublicJSON({ viewerId: viewerIdOf(req.identity) }) },
    { message: 'Report updated' }
  );
}

module.exports = { create, list, update };
