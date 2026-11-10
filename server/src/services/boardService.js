'use strict';

/**
 * Board business rules for `/api/v1/boards` (docs/ARCHITECTURE.md §4.3, §4.4, §5).
 *
 * Counters (`threadCount`, `replyCount`, `lastActivityAt`) are denormalised for cheap
 * list rendering and are maintained exclusively by services/counterService.js.
 */
const Board = require('../models/Board');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta } = require('../utils/pagination');
const { isAdmin } = require('../utils/domain/identity');

const EDITABLE_FIELDS = Object.freeze([
  'name',
  'description',
  'icon',
  'supportLevel',
  'guidelines',
  'tags',
  'order',
  'isActive',
]);

/**
 * Active boards sorted for display.
 * @param {{query: object}} input
 * @returns {Promise<{boards: object[], meta: object}>}
 */
async function listBoards({ query }) {
  const { page, limit, skip } = getPagination(query);
  const filter = { isActive: true };
  const [documents, total] = await Promise.all([
    Board.find(filter).sort({ order: 1, createdAt: 1 }).skip(skip).limit(limit),
    Board.countDocuments(filter),
  ]);

  return {
    boards: documents.map((document) => document.toPublicJSON()),
    meta: buildMeta({ page, limit, total }),
  };
}

/**
 * One board by slug. Inactive boards remain visible to admins so they can be edited.
 * @param {{slug: string, identity: object|null}} input
 * @returns {Promise<object>} Board document
 */
async function getBoard({ slug, identity }) {
  const board = await Board.findOne({ slug });
  if (!board) throw ApiError.notFound('Board not found');
  if (!board.isActive && !isAdmin(identity)) throw ApiError.notFound('Board not found');
  return board;
}

/**
 * Create a board (admin only).
 * @param {object} input validated body
 * @returns {Promise<object>} Board document
 */
async function createBoard(input) {
  try {
    return await Board.create({
      slug: input.slug,
      name: input.name,
      description: input.description,
      icon: input.icon,
      supportLevel: input.supportLevel || 'general',
      guidelines: input.guidelines,
      tags: input.tags || [],
      order: input.order === undefined ? 0 : input.order,
      isActive: input.isActive === undefined ? true : input.isActive,
    });
  } catch (error) {
    if (error && error.code === 11000) {
      throw ApiError.conflict('A board with this slug already exists');
    }
    throw error;
  }
}

/**
 * Update a board (admin only).
 * @param {{slug: string, input: object}} input
 * @returns {Promise<object>} updated Board document
 */
async function updateBoard({ slug, input }) {
  const board = await Board.findOne({ slug });
  if (!board) throw ApiError.notFound('Board not found');

  for (const field of EDITABLE_FIELDS) {
    if (input[field] !== undefined) board[field] = input[field];
  }
  await board.save();
  return board;
}

/**
 * Soft-deactivate a board (admin only). Threads are retained for audit/export.
 * @param {{slug: string}} input
 * @returns {Promise<object>} deactivated Board document
 */
async function deactivateBoard({ slug }) {
  const board = await Board.findOne({ slug });
  if (!board) throw ApiError.notFound('Board not found');
  if (!board.isActive) return board;
  board.isActive = false;
  await board.save();
  return board;
}

module.exports = { EDITABLE_FIELDS, listBoards, getBoard, createBoard, updateBoard, deactivateBoard };
