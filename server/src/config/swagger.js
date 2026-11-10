'use strict';

/**
 * OpenAPI 3.0.3 document for the AdiYogi API.
 *
 * Served as JSON at `GET /api/docs/openapi.json` and rendered by Swagger UI at
 * `GET /api/docs` (see routes/v1/docs.routes.js). The document is the machine-readable
 * mirror of docs/API_DOCUMENTATION.md and covers every implemented endpoint, the
 * success/error envelopes, cookie authentication and the CSRF header contract.
 *
 * Hand-maintained (no runtime reflection) so the spec can never drift into exposing
 * internals: only public `data` shapes from ARCHITECTURE §4.4/§12.7 appear here.
 */
const env = require('./env');

/** @param {string} name @returns {object} schema reference */
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

/** Pagination meta block (§4.1). */
const PAGINATION_META = {
  type: 'object',
  required: ['page', 'limit', 'total', 'totalPages', 'hasNext', 'hasPrev'],
  properties: {
    page: { type: 'integer', example: 1 },
    limit: { type: 'integer', example: 20 },
    total: { type: 'integer', example: 137 },
    totalPages: { type: 'integer', example: 7 },
    hasNext: { type: 'boolean', example: true },
    hasPrev: { type: 'boolean', example: false },
  },
};

/**
 * Build a success-envelope schema with a concrete `data` shape.
 * @param {object} dataSchema
 * @param {object} [metaSchema]
 * @returns {object}
 */
function envelope(dataSchema, metaSchema = { type: 'object', additionalProperties: true }) {
  return {
    type: 'object',
    required: ['success', 'message', 'data', 'meta'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      message: { type: 'string', example: 'OK' },
      data: dataSchema,
      meta: metaSchema,
    },
  };
}

/**
 * @param {string} description
 * @param {object} dataSchema
 * @param {object} [metaSchema]
 * @returns {object} OpenAPI response object
 */
function okResponse(description, dataSchema, metaSchema) {
  return {
    description,
    content: { 'application/json': { schema: envelope(dataSchema, metaSchema) } },
  };
}

/**
 * @param {string} description
 * @param {string} code error code from §4.2
 * @param {object} detailsSchema
 * @returns {object} OpenAPI response object
 */
function errorResponse(description, code, detailsSchema = { type: 'object', additionalProperties: true }) {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['success', 'message', 'error', 'requestId'],
          properties: {
            success: { type: 'boolean', enum: [false] },
            message: { type: 'string' },
            error: {
              type: 'object',
              required: ['code'],
              properties: {
                code: { type: 'string', enum: [code] },
                details: detailsSchema,
              },
            },
            requestId: { type: 'string', example: '01HZX8T7Q2K3M4N5P6R7S8T9V0' },
          },
        },
      },
    },
  };
}

const ERRORS = Object.freeze({
  validation: errorResponse('Validation failed', 'VALIDATION_ERROR', {
    type: 'array',
    items: {
      type: 'object',
      properties: { path: { type: 'string' }, message: { type: 'string' } },
    },
  }),
  unauthenticated: errorResponse('Authentication required', 'UNAUTHENTICATED'),
  csrf: errorResponse('Invalid or missing CSRF token', 'CSRF_INVALID'),
  forbidden: errorResponse('Authenticated but not allowed', 'FORBIDDEN'),
  notFound: errorResponse('Resource not found or not visible', 'NOT_FOUND'),
  conflict: errorResponse('Conflict (duplicate)', 'CONFLICT'),
  rateLimited: errorResponse('Too many requests', 'RATE_LIMITED', {
    type: 'object',
    properties: { retryAfterSeconds: { type: 'integer' } },
  }),
  contentBlocked: errorResponse('Content policy violation', 'CONTENT_BLOCKED'),
  aiUnavailable: errorResponse('AI provider unavailable', 'AI_UNAVAILABLE', {
    type: 'object',
    properties: { retryAfterSeconds: { type: 'integer' }, canUseGuidedMode: { type: 'boolean' } },
  }),
  serviceUnavailable: errorResponse('Dependency unavailable', 'SERVICE_UNAVAILABLE', {
    type: 'object',
    properties: { db: { type: 'string' } },
  }),
  internal: errorResponse('Unexpected server error', 'INTERNAL_ERROR'),
});

/** Page/limit parameters shared by every collection endpoint. */
const PAGINATION_PARAMS = [
  {
    name: 'page',
    in: 'query',
    required: false,
    schema: { type: 'integer', minimum: 1, default: 1 },
    description: '1-based page number.',
  },
  {
    name: 'limit',
    in: 'query',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    description: 'Page size (maximum 50; values above are clamped).',
  },
];

/** Required on every non-GET request to /api/v1 (§6.3). */
const CSRF_PARAM = {
  name: 'x-csrf-token',
  in: 'header',
  required: true,
  schema: { type: 'string' },
  description:
    'Signed CSRF token from the readable `ay_csrf` cookie (`<random>.<hmac>`). Required for every POST/PATCH/DELETE on /api/v1.',
};

/**
 * @param {string} name path parameter name
 * @param {string} description
 * @returns {object}
 */
function idParam(name, description = '24-hex MongoDB ObjectId') {
  return {
    name,
    in: 'path',
    required: true,
    schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
    description,
  };
}

/** @type {object} OpenAPI document */
const spec = {
  openapi: '3.0.3',
  info: {
    title: 'AdiYogi API',
    version: env.version,
    description: [
      'Anonymous-first mental-health peer-support API: forum, AI companion and crisis resources.',
      '',
      '**Base path:** `/api/v1`. All responses use the envelopes documented under `schemas`.',
      '',
      '**Authentication:** server-issued httpOnly cookies. `POST /auth/session` bootstraps an',
      'anonymous identity; `POST /auth/register` / `POST /auth/login` upgrade to an account.',
      'The short-lived access JWT lives in `ay_at`, the opaque refresh token in `ay_rt`',
      '(path-scoped to `/api/v1/auth`), and the signed CSRF token in the readable `ay_csrf` cookie.',
      '',
      '**CSRF:** every non-GET request to `/api/v1` must send header `x-csrf-token` equal to the',
      '`ay_csrf` cookie value. Only `POST /auth/session`, `/auth/login` and `/auth/register` are',
      'exempt while no refresh cookie exists.',
      '',
      '**Rate limits:** global 300/15min; auth 10/15min; writes 20/10min; reports 10/hour;',
      'chat 20/5min; crisis assessment 30/10min. Trips return `429 RATE_LIMITED`.',
    ].join('\n'),
    license: { name: 'MIT' },
  },
  servers: [{ url: '/', description: 'Same origin (API at /api/v1, docs at /api/docs)' }],
  tags: [
    { name: 'Auth', description: 'Sessions, cookies, CSRF and accounts' },
    { name: 'Users', description: 'The caller’s preferences, content and data deletion' },
    { name: 'Boards', description: 'Forum boards (public read, admin write)' },
    { name: 'Threads', description: 'Threads and their replies' },
    { name: 'Replies', description: 'Reply moderation actions' },
    { name: 'Reports', description: 'Community reports (moderator workflow)' },
    { name: 'Moderation', description: 'Moderator queue, actions and audit log' },
    { name: 'Notifications', description: 'Thread-reply notifications' },
    { name: 'Chat', description: 'AI companion conversations' },
    { name: 'Crisis', description: 'Verified crisis resources and assessment' },
    { name: 'Health', description: 'Liveness and readiness probes' },
  ],
  components: {
    securitySchemes: {
      accessCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'ay_at',
        description: 'Short-lived HS256 access JWT (httpOnly).',
      },
      refreshCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'ay_rt',
        description: 'Opaque refresh token, path-scoped to `/api/v1/auth` (httpOnly).',
      },
      csrfCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'ay_csrf',
        description: 'Readable signed CSRF token; echo it in the `x-csrf-token` header.',
      },
    },
    schemas: {
      PaginationMeta: PAGINATION_META,
      Identity: {
        type: 'object',
        required: ['id', 'kind', 'role', 'alias', 'createdAt', 'isAnonymous', 'preferences'],
        properties: {
          id: { type: 'string', example: '665f1c2ab1d4c3e5f6a7b8c9' },
          kind: { type: 'string', enum: ['anonymous', 'user'] },
          role: { type: 'string', enum: ['member', 'moderator', 'admin'] },
          alias: { type: 'string', example: 'Seeker 4F2A' },
          createdAt: { type: 'string', format: 'date-time' },
          isAnonymous: { type: 'boolean' },
          preferences: ref('Preferences'),
        },
      },
      Preferences: {
        type: 'object',
        properties: {
          displayAlias: { type: 'string', minLength: 3, maxLength: 24, example: 'Seeker 4F2A' },
          showCrisisBar: { type: 'boolean', default: true },
          contentWarningDefault: { type: 'boolean', default: false },
          reduceMotion: { type: 'boolean', default: false },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Board: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          slug: { type: 'string', example: 'anxiety' },
          name: { type: 'string', example: 'Anxiety & Overthinking' },
          description: { type: 'string' },
          icon: { type: 'string' },
          supportLevel: { type: 'string', enum: ['general', 'peer', 'crisis'] },
          guidelines: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          order: { type: 'integer' },
          threadCount: { type: 'integer' },
          replyCount: { type: 'integer' },
          lastActivityAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ThreadAuthor: {
        type: 'object',
        properties: {
          alias: { type: 'string', example: 'Seeker 4F2A' },
          type: { type: 'string', enum: ['anonymous', 'user'] },
        },
      },
      Thread: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          boardSlug: { type: 'string' },
          boardName: { type: 'string' },
          title: { type: 'string', maxLength: 160 },
          body: { type: 'string', maxLength: 5000 },
          excerpt: { type: 'string' },
          contentWarning: { type: 'boolean' },
          tags: { type: 'array', items: { type: 'string' } },
          author: ref('ThreadAuthor'),
          status: { type: 'string', enum: ['published', 'hidden', 'removed', 'deleted'] },
          isPinned: { type: 'boolean' },
          isLocked: { type: 'boolean' },
          replyCount: { type: 'integer' },
          viewCount: { type: 'integer' },
          lastActivityAt: { type: 'string', format: 'date-time', nullable: true },
          editedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          isOwner: { type: 'boolean' },
          canEdit: { type: 'boolean' },
          canDelete: { type: 'boolean' },
        },
      },
      Reply: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          thread: { type: 'string' },
          body: { type: 'string', maxLength: 3000 },
          contentWarning: { type: 'boolean' },
          author: ref('ThreadAuthor'),
          status: { type: 'string', enum: ['published', 'hidden', 'removed', 'deleted'] },
          createdAt: { type: 'string', format: 'date-time' },
          editedAt: { type: 'string', format: 'date-time', nullable: true },
          isOwner: { type: 'boolean' },
          canDelete: { type: 'boolean' },
        },
      },
      Support: {
        type: 'object',
        description:
          'Present only when the server-side assessment is `elevated` or `high`. Advice for the UI; never persisted on the content or the user.',
        required: ['level', 'showResources'],
        properties: {
          level: { type: 'string', enum: ['elevated', 'high'] },
          showResources: { type: 'boolean' },
        },
      },
      Report: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          targetType: { type: 'string', enum: ['thread', 'reply'] },
          targetId: { type: 'string' },
          targetThread: { type: 'string', nullable: true },
          reason: {
            type: 'string',
            enum: ['spam', 'harassment', 'self_harm_risk', 'graphic', 'medical_misinformation', 'other'],
          },
          details: { type: 'string', maxLength: 500 },
          status: { type: 'string', enum: ['open', 'reviewing', 'resolved', 'dismissed'] },
          createdAt: { type: 'string', format: 'date-time' },
          isOwner: { type: 'boolean' },
        },
      },
      EnrichedReport: {
        allOf: [
          ref('Report'),
          {
            type: 'object',
            properties: {
              targetExcerpt: { type: 'string', nullable: true, description: 'Truncated (200 chars) target body.' },
              targetStatus: { type: 'string', nullable: true },
              targetAuthorAlias: { type: 'string', nullable: true },
              targetThread: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  boardSlug: { type: 'string' },
                  status: { type: 'string' },
                },
              },
            },
          },
        ],
      },
      ModerationAction: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          action: {
            type: 'string',
            enum: [
              'hide',
              'unhide',
              'delete',
              'pin',
              'unpin',
              'lock',
              'unlock',
              'report_review',
              'report_resolve',
              'report_dismiss',
            ],
          },
          targetType: { type: 'string', enum: ['thread', 'reply', 'report'] },
          targetId: { type: 'string' },
          reportId: { type: 'string', nullable: true },
          reason: { type: 'string' },
          moderator: {
            type: 'object',
            properties: { id: { type: 'string' }, displayName: { type: 'string', nullable: true } },
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['thread_reply', 'moderation', 'system'] },
          message: { type: 'string', example: 'Someone replied to your thread' },
          thread: { type: 'string', nullable: true },
          reply: { type: 'string', nullable: true },
          read: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ModerationStats: {
        type: 'object',
        properties: {
          openReports: { type: 'integer' },
          reportsToday: { type: 'integer' },
          hiddenThreads: { type: 'integer' },
          hiddenReplies: { type: 'integer' },
          crisisEvents30d: { type: 'integer' },
          threadsToday: { type: 'integer' },
          repliesToday: { type: 'integer' },
        },
      },
      Health: {
        type: 'object',
        required: ['status', 'uptime', 'version', 'env'],
        properties: {
          status: { type: 'string', enum: ['ok'] },
          uptime: { type: 'integer', description: 'Process uptime in seconds.' },
          version: { type: 'string', example: '2.0.0' },
          env: { type: 'string', example: 'production' },
          db: { type: 'string', example: 'connected', description: 'Readiness probes only.' },
        },
      },
      Conversation: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          messageCount: { type: 'integer' },
          lastMessageAt: { type: 'string', format: 'date-time', nullable: true },
          riskLevel: { type: 'string', enum: ['none', 'low', 'elevated', 'high'] },
          status: { type: 'string', enum: ['active', 'archived'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ChatMessage: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          conversation: { type: 'string' },
          role: { type: 'string', enum: ['user', 'assistant'] },
          content: { type: 'string' },
          riskLevel: { type: 'string', enum: ['none', 'low', 'elevated', 'high'] },
          aiProvider: { type: 'string', enum: ['gemini', 'none'] },
          aiModel: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CrisisAssessment: {
        type: 'object',
        required: ['level', 'showResources', 'reasons'],
        properties: {
          level: { type: 'string', enum: ['none', 'low', 'elevated', 'high'] },
          showResources: { type: 'boolean' },
          reasons: { type: 'array', items: { type: 'string' } },
          score: { type: 'number' },
        },
      },
      CrisisResources: {
        type: 'object',
        properties: {
          region: { type: 'string', example: 'IN' },
          primary: { type: 'object', additionalProperties: true },
          text: { type: 'object', additionalProperties: true },
          emergency: { type: 'object', additionalProperties: true },
          local: { type: 'array', items: { type: 'object', additionalProperties: true } },
          international: { type: 'object', additionalProperties: true },
          lastVerified: { type: 'string', example: '2026-04' },
        },
      },
    },
  },
  security: [{ accessCookie: [] }],
  paths: {
    /* ------------------------------------------------------------------ Auth */
    '/api/v1/auth/session': {
      post: {
        tags: ['Auth'],
        operationId: 'createSession',
        summary: 'Start or reuse a session (anonymous-first)',
        description:
          'Reuses a valid `ay_rt` refresh cookie when present, otherwise creates an anonymous Session and UserPreference. Always sets fresh `ay_at`/`ay_rt`/`ay_csrf` cookies. No token is ever returned in the JSON body.',
        security: [{ refreshCookie: [] }],
        parameters: [CSRF_PARAM],
        responses: {
          200: okResponse('Session ready', { type: 'object', properties: { identity: ref('Identity'), csrfToken: { type: 'string', description: 'Signed CSRF token; echo it in the x-csrf-token header.' } } }),
          403: ERRORS.csrf,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        operationId: 'getCurrentIdentity',
        summary: 'Resolve the caller’s identity and preferences',
        responses: {
          200: okResponse('OK', { type: 'object', properties: { identity: ref('Identity') } }),
          401: ERRORS.unauthenticated,
          500: ERRORS.internal,
        },
      },
    },
    '/api/v1/auth/csrf': {
      get: {
        tags: ['Auth'],
        operationId: 'getCsrfToken',
        summary: 'Return (and set if missing) the signed CSRF token',
        description: 'The token must be echoed in the `x-csrf-token` header on every non-GET request.',
        responses: {
          200: okResponse('OK', { type: 'object', properties: { csrfToken: { type: 'string' } } }),
          500: ERRORS.internal,
        },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        operationId: 'register',
        summary: 'Create a member account and sign it in',
        parameters: [CSRF_PARAM],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', maxLength: 254 },
                  password: { type: 'string', minLength: 10, maxLength: 128 },
                  displayName: { type: 'string', minLength: 2, maxLength: 40 },
                },
              },
            },
          },
        },
        responses: {
          201: okResponse('Account created', { type: 'object', properties: { identity: ref('Identity'), csrfToken: { type: 'string', description: 'Signed CSRF token; echo it in the x-csrf-token header.' } } }),
          400: ERRORS.validation,
          403: ERRORS.csrf,
          409: ERRORS.conflict,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        operationId: 'login',
        summary: 'Sign in with email and password',
        description:
          'Always returns `Email or password is incorrect` on bad credentials (no user enumeration). Five consecutive failures lock the account for 15 minutes; further attempts return 429 with `retryAfterSeconds`.',
        parameters: [CSRF_PARAM],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', maxLength: 128 },
                },
              },
            },
          },
        },
        responses: {
          200: okResponse('Signed in', { type: 'object', properties: { identity: ref('Identity'), csrfToken: { type: 'string', description: 'Signed CSRF token; echo it in the x-csrf-token header.' } } }),
          400: ERRORS.validation,
          401: ERRORS.unauthenticated,
          403: ERRORS.forbidden,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        operationId: 'logout',
        summary: 'Revoke the current session and clear cookies',
        parameters: [CSRF_PARAM],
        responses: {
          204: { description: 'Session revoked; cookies cleared' },
          403: ERRORS.csrf,
          500: ERRORS.internal,
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth'],
        operationId: 'refreshSession',
        summary: 'Rotate the refresh token and issue a new access token',
        parameters: [CSRF_PARAM],
        responses: {
          200: okResponse('Session refreshed', { type: 'object', properties: { identity: ref('Identity'), csrfToken: { type: 'string', description: 'Signed CSRF token; echo it in the x-csrf-token header.' } } }),
          401: ERRORS.unauthenticated,
          403: ERRORS.csrf,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
    },

    /* ----------------------------------------------------------------- Users */
    '/api/v1/users/me/preferences': {
      get: {
        tags: ['Users'],
        operationId: 'getPreferences',
        summary: 'Read the caller’s preferences',
        responses: {
          200: okResponse('OK', { type: 'object', properties: { preferences: ref('Preferences') } }),
          401: ERRORS.unauthenticated,
          500: ERRORS.internal,
        },
      },
      patch: {
        tags: ['Users'],
        operationId: 'updatePreferences',
        summary: 'Update the caller’s preferences',
        parameters: [CSRF_PARAM],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                minProperties: 1,
                properties: {
                  displayAlias: {
                    type: 'string',
                    minLength: 3,
                    maxLength: 24,
                    pattern: '^[\\w .-]+$',
                    example: 'Quiet Maple',
                  },
                  showCrisisBar: { type: 'boolean' },
                  contentWarningDefault: { type: 'boolean' },
                  reduceMotion: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: okResponse('Preferences updated', { type: 'object', properties: { preferences: ref('Preferences') } }),
          400: ERRORS.validation,
          401: ERRORS.unauthenticated,
          403: ERRORS.csrf,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
    },
    '/api/v1/users/me/content': {
      get: {
        tags: ['Users'],
        operationId: 'listOwnContent',
        summary: 'Paginated list of the caller’s own threads or replies',
        parameters: [
          {
            name: 'type',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['threads', 'replies'], default: 'threads' },
          },
          ...PAGINATION_PARAMS,
        ],
        responses: {
          200: okResponse(
            'Own content',
            {
              type: 'object',
              properties: {
                threads: { type: 'array', items: ref('Thread') },
                replies: { type: 'array', items: ref('Reply') },
              },
            },
            PAGINATION_META
          ),
          400: ERRORS.validation,
          401: ERRORS.unauthenticated,
          500: ERRORS.internal,
        },
      },
    },
    '/api/v1/users/me': {
      delete: {
        tags: ['Users'],
        operationId: 'deleteMe',
        summary: 'Delete the caller’s account/session and content (complete data deletion)',
        description:
          'Hard-deletes the caller’s threads (and all replies to them), their own replies, conversations and messages, notifications, preferences, reports and crisis metadata, then revokes sessions (and the User row for accounts). Only a session-id hash is logged. `deleteContent: false` retains authored forum content.',
        parameters: [CSRF_PARAM],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { deleteContent: { type: 'boolean', default: true } },
              },
            },
          },
        },
        responses: {
          204: { description: 'Data deleted; cookies cleared' },
          400: ERRORS.validation,
          401: ERRORS.unauthenticated,
          403: ERRORS.csrf,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
    },

    /* ---------------------------------------------------------------- Boards */
    '/api/v1/boards': {
      get: {
        tags: ['Boards'],
        operationId: 'listBoards',
        summary: 'List active boards with live counters',
        security: [],
        parameters: PAGINATION_PARAMS,
        responses: {
          200: okResponse(
            'Boards',
            { type: 'object', properties: { boards: { type: 'array', items: ref('Board') } } },
            PAGINATION_META
          ),
          500: ERRORS.internal,
        },
      },
      post: {
        tags: ['Boards'],
        operationId: 'createBoard',
        summary: 'Create a board (admin only)',
        parameters: [CSRF_PARAM],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['slug', 'name'],
                properties: {
                  slug: { type: 'string', pattern: '^[a-z0-9-]{2,40}$' },
                  name: { type: 'string', minLength: 2, maxLength: 80 },
                  description: { type: 'string', maxLength: 500 },
                  icon: { type: 'string', maxLength: 16 },
                  supportLevel: { type: 'string', enum: ['general', 'peer', 'crisis'] },
                  guidelines: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 300 } },
                  tags: { type: 'array', maxItems: 10, items: { type: 'string' } },
                  order: { type: 'integer', minimum: 0, maximum: 999 },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          201: okResponse('Board created', { type: 'object', properties: { board: ref('Board') } }),
          400: ERRORS.validation,
          401: ERRORS.unauthenticated,
          403: ERRORS.forbidden,
          409: ERRORS.conflict,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
    },
    '/api/v1/boards/{slug}': {
      parameters: [
        {
          name: 'slug',
          in: 'path',
          required: true,
          schema: { type: 'string', pattern: '^[a-z0-9-]{2,40}$' },
        },
      ],
      get: {
        tags: ['Boards'],
        operationId: 'getBoard',
        summary: 'Get one board by slug (inactive boards are admin-visible only)',
        security: [],
        responses: {
          200: okResponse('Board', { type: 'object', properties: { board: ref('Board') } }),
          404: ERRORS.notFound,
          500: ERRORS.internal,
        },
      },
      patch: {
        tags: ['Boards'],
        operationId: 'updateBoard',
        summary: 'Update a board (admin only)',
        parameters: [CSRF_PARAM],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                minProperties: 1,
                properties: {
                  name: { type: 'string', minLength: 2, maxLength: 80 },
                  description: { type: 'string', maxLength: 500 },
                  icon: { type: 'string', maxLength: 16 },
                  supportLevel: { type: 'string', enum: ['general', 'peer', 'crisis'] },
                  guidelines: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 300 } },
                  tags: { type: 'array', maxItems: 10, items: { type: 'string' } },
                  order: { type: 'integer', minimum: 0, maximum: 999 },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: okResponse('Board updated', { type: 'object', properties: { board: ref('Board') } }),
          400: ERRORS.validation,
          401: ERRORS.unauthenticated,
          403: ERRORS.forbidden,
          404: ERRORS.notFound,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
      delete: {
        tags: ['Boards'],
        operationId: 'deactivateBoard',
        summary: 'Deactivate a board (admin only, soft delete)',
        parameters: [CSRF_PARAM],
        responses: {
          204: { description: 'Board deactivated' },
          401: ERRORS.unauthenticated,
          403: ERRORS.forbidden,
          404: ERRORS.notFound,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
    },

    /* --------------------------------------------------------------- Threads */
    '/api/v1/threads': {
      get: {
        tags: ['Threads'],
        operationId: 'listThreads',
        summary: 'List threads with board/tag filters, search and sorting',
        description:
          'Public listings expose `published` threads only (moderators also see `hidden`). Search uses the MongoDB text index with an escaped-regex fallback when the index is unavailable.',
        security: [],
        parameters: [
          { name: 'board', in: 'query', schema: { type: 'string' }, description: 'Board slug filter.' },
          { name: 'q', in: 'query', schema: { type: 'string', maxLength: 200 }, description: 'Full-text search over title and body.' },
          {
            name: 'tag',
            in: 'query',
            schema: { type: 'string', pattern: '^[a-z0-9-]{2,24}$' },
            description: 'Exact tag filter.',
          },
          {
            name: 'sort',
            in: 'query',
            schema: { type: 'string', enum: ['recent', 'new', 'replies'], default: 'recent' },
          },
          ...PAGINATION_PARAMS,
        ],
        responses: {
          200: okResponse(
            'Threads',
            { type: 'object', properties: { threads: { type: 'array', items: ref('Thread') } } },
            PAGINATION_META
          ),
          400: ERRORS.validation,
          500: ERRORS.internal,
        },
      },
      post: {
        tags: ['Threads'],
        operationId: 'createThread',
        summary: 'Create a thread (any session)',
        description:
          'Content is sanitised to plain text and checked by the server-side crisis assessment. The response includes `support` only when the assessment is `elevated` or `high`; it is advice for the UI and is never persisted.',
        parameters: [CSRF_PARAM],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['boardSlug', 'title', 'body'],
                properties: {
                  boardSlug: { type: 'string', example: 'anxiety' },
                  title: { type: 'string', minLength: 3, maxLength: 160 },
                  body: { type: 'string', minLength: 20, maxLength: 5000 },
                  tags: {
                    type: 'array',
                    maxItems: 6,
                    items: { type: 'string', pattern: '^[a-z0-9-]{2,24}$' },
                  },
                  contentWarning: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: {
          201: okResponse('Thread created', {
            type: 'object',
            required: ['thread'],
            properties: { thread: ref('Thread'), support: ref('Support') },
          }),
          400: ERRORS.validation,
          401: ERRORS.unauthenticated,
          403: ERRORS.csrf,
          404: ERRORS.notFound,
          422: ERRORS.contentBlocked,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
    },
    '/api/v1/threads/{id}': {
      parameters: [idParam('id', 'Thread id')],
      get: {
        tags: ['Threads'],
        operationId: 'getThread',
        summary: 'Get one thread (counts a throttled view)',
        description:
          'Hidden threads are visible only to their author or a moderator; anything else is 404. Views count at most once per viewer+thread per 10 minutes.',
        security: [],
        responses: {
          200: okResponse('Thread', { type: 'object', properties: { thread: ref('Thread') } }),
          400: ERRORS.validation,
          404: ERRORS.notFound,
          500: ERRORS.internal,
        },
      },
      patch: {
        tags: ['Threads'],
        operationId: 'updateThread',
        summary: 'Edit a thread (author within 15 minutes) or pin/lock it (moderator)',
        description:
          'Authors may edit title/body/tags/contentWarning within 15 minutes of creation. Moderators/admins may change `isPinned`/`isLocked`; those changes are written to the moderation audit log.',
        parameters: [CSRF_PARAM],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                minProperties: 1,
                properties: {
                  title: { type: 'string', minLength: 3, maxLength: 160 },
                  body: { type: 'string', minLength: 20, maxLength: 5000 },
                  tags: { type: 'array', maxItems: 6, items: { type: 'string' } },
                  contentWarning: { type: 'boolean' },
                  isPinned: { type: 'boolean' },
                  isLocked: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: okResponse('Thread updated', { type: 'object', properties: { thread: ref('Thread') } }),
          400: ERRORS.validation,
          401: ERRORS.unauthenticated,
          403: ERRORS.forbidden,
          404: ERRORS.notFound,
          422: ERRORS.contentBlocked,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
      delete: {
        tags: ['Threads'],
        operationId: 'deleteThread',
        summary: 'Soft-delete a thread (author or moderator)',
        parameters: [CSRF_PARAM],
        responses: {
          204: { description: 'Thread deleted (status `deleted`)' },
          401: ERRORS.unauthenticated,
          403: ERRORS.forbidden,
          404: ERRORS.notFound,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
    },
    '/api/v1/threads/{id}/replies': {
      parameters: [idParam('id', 'Thread id')],
      get: {
        tags: ['Threads'],
        operationId: 'listReplies',
        summary: 'Paginated published replies for a thread',
        security: [],
        parameters: [
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['old', 'new'], default: 'old' } },
          ...PAGINATION_PARAMS,
        ],
        responses: {
          200: okResponse(
            'Replies',
            { type: 'object', properties: { replies: { type: 'array', items: ref('Reply') } } },
            PAGINATION_META
          ),
          400: ERRORS.validation,
          404: ERRORS.notFound,
          500: ERRORS.internal,
        },
      },
      post: {
        tags: ['Threads'],
        operationId: 'createReply',
        summary: 'Reply to a published, unlocked thread (any session)',
        description:
          'Notifies the thread author (generic message only, never content). The response includes `support` only for elevated/high assessments.',
        parameters: [CSRF_PARAM],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['body'],
                properties: {
                  body: { type: 'string', minLength: 2, maxLength: 3000 },
                  contentWarning: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: {
          201: okResponse('Reply created', {
            type: 'object',
            required: ['reply'],
            properties: { reply: ref('Reply'), support: ref('Support') },
          }),
          400: ERRORS.validation,
          401: ERRORS.unauthenticated,
          403: ERRORS.forbidden,
          404: ERRORS.notFound,
          422: ERRORS.contentBlocked,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
    },

    /* --------------------------------------------------------------- Replies */
    '/api/v1/replies/{id}': {
      parameters: [idParam('id', 'Reply id')],
      delete: {
        tags: ['Replies'],
        operationId: 'deleteReply',
        summary: 'Soft-delete a reply (author or moderator)',
        parameters: [CSRF_PARAM],
        responses: {
          204: { description: 'Reply deleted (status `deleted`)' },
          401: ERRORS.unauthenticated,
          403: ERRORS.forbidden,
          404: ERRORS.notFound,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
    },

    /* --------------------------------------------------------------- Reports */
    '/api/v1/reports': {
      post: {
        tags: ['Reports'],
        operationId: 'createReport',
        summary: 'Report a published thread or reply (one report per target per reporter)',
        parameters: [CSRF_PARAM],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['targetType', 'targetId', 'reason'],
                properties: {
                  targetType: { type: 'string', enum: ['thread', 'reply'] },
                  targetId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
                  reason: {
                    type: 'string',
                    enum: ['spam', 'harassment', 'self_harm_risk', 'graphic', 'medical_misinformation', 'other'],
                  },
                  details: { type: 'string', maxLength: 500 },
                },
              },
            },
          },
        },
        responses: {
          201: okResponse('Report submitted', { type: 'object', properties: { report: ref('Report') } }),
          400: ERRORS.validation,
          401: ERRORS.unauthenticated,
          403: ERRORS.csrf,
          404: ERRORS.notFound,
          409: ERRORS.conflict,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
      get: {
        tags: ['Reports'],
        operationId: 'listReports',
        summary: 'List reports (moderator+)',
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['open', 'reviewing', 'resolved', 'dismissed'] },
          },
          { name: 'targetType', in: 'query', schema: { type: 'string', enum: ['thread', 'reply'] } },
          ...PAGINATION_PARAMS,
        ],
        responses: {
          200: okResponse(
            'Reports',
            { type: 'object', properties: { reports: { type: 'array', items: ref('EnrichedReport') } } },
            PAGINATION_META
          ),
          400: ERRORS.validation,
          401: ERRORS.unauthenticated,
          403: ERRORS.forbidden,
          500: ERRORS.internal,
        },
      },
    },
    '/api/v1/reports/{id}': {
      parameters: [idParam('id', 'Report id')],
      patch: {
        tags: ['Reports'],
        operationId: 'updateReport',
        summary: 'Change a report’s status (moderator+)',
        description:
          'Status transitions are audited as ModerationAction `report_review` / `report_resolve` / `report_dismiss`.',
        parameters: [CSRF_PARAM],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['reviewing', 'resolved', 'dismissed'] },
                  resolutionNote: { type: 'string', maxLength: 500 },
                },
              },
            },
          },
        },
        responses: {
          200: okResponse('Report updated', { type: 'object', properties: { report: ref('Report') } }),
          400: ERRORS.validation,
          401: ERRORS.unauthenticated,
          403: ERRORS.forbidden,
          404: ERRORS.notFound,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
    },

    /* ------------------------------------------------------------ Moderation */
    '/api/v1/moderation/queue': {
      get: {
        tags: ['Moderation'],
        operationId: 'getModerationQueue',
        summary: 'Open/reviewing reports plus hidden threads and replies (moderator+)',
        description: 'Reporter identity is never included. Each collection is paginated independently in `meta`.',
        parameters: PAGINATION_PARAMS,
        responses: {
          200: okResponse(
            'Moderation queue',
            {
              type: 'object',
              properties: {
                reports: { type: 'array', items: ref('EnrichedReport') },
                hiddenThreads: { type: 'array', items: ref('Thread') },
                hiddenReplies: { type: 'array', items: ref('Reply') },
              },
            },
            {
              type: 'object',
              properties: {
                reports: PAGINATION_META,
                hiddenThreads: PAGINATION_META,
                hiddenReplies: PAGINATION_META,
              },
            }
          ),
          400: ERRORS.validation,
          401: ERRORS.unauthenticated,
          403: ERRORS.forbidden,
          500: ERRORS.internal,
        },
      },
    },
    '/api/v1/moderation/actions': {
      post: {
        tags: ['Moderation'],
        operationId: 'createModerationAction',
        summary: 'Apply a moderation action and audit it (moderator+)',
        description:
          'Action/target compatibility is enforced: threads allow hide/unhide/delete/pin/unpin/lock/unlock; replies allow hide/unhide/delete. `reason` is required for hide and delete. Supplying `reportId` also resolves that report.',
        parameters: [CSRF_PARAM],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['action', 'targetType', 'targetId'],
                properties: {
                  action: {
                    type: 'string',
                    enum: ['hide', 'unhide', 'delete', 'pin', 'unpin', 'lock', 'unlock'],
                  },
                  targetType: { type: 'string', enum: ['thread', 'reply'] },
                  targetId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
                  reportId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
                  reason: { type: 'string', maxLength: 500, description: 'Required for hide/delete.' },
                },
              },
            },
          },
        },
        responses: {
          201: okResponse('Action applied', {
            type: 'object',
            required: ['moderationAction'],
            properties: {
              moderationAction: ref('ModerationAction'),
              target: { oneOf: [ref('Thread'), ref('Reply')] },
            },
          }),
          400: ERRORS.validation,
          401: ERRORS.unauthenticated,
          403: ERRORS.forbidden,
          404: ERRORS.notFound,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
      get: {
        tags: ['Moderation'],
        operationId: 'listModerationActions',
        summary: 'Paginated moderation audit log (moderator+)',
        parameters: [
          {
            name: 'action',
            in: 'query',
            schema: {
              type: 'string',
              enum: [
                'hide',
                'unhide',
                'delete',
                'pin',
                'unpin',
                'lock',
                'unlock',
                'report_review',
                'report_resolve',
                'report_dismiss',
              ],
            },
          },
          { name: 'targetType', in: 'query', schema: { type: 'string', enum: ['thread', 'reply', 'report'] } },
          ...PAGINATION_PARAMS,
        ],
        responses: {
          200: okResponse(
            'Moderation audit log',
            { type: 'object', properties: { actions: { type: 'array', items: ref('ModerationAction') } } },
            PAGINATION_META
          ),
          400: ERRORS.validation,
          401: ERRORS.unauthenticated,
          403: ERRORS.forbidden,
          500: ERRORS.internal,
        },
      },
    },
    '/api/v1/moderation/stats': {
      get: {
        tags: ['Moderation'],
        operationId: 'getModerationStats',
        summary: 'Aggregate moderation counters (moderator+)',
        description: 'Counts only — no content and no reporter identity. `crisisEvents30d` is an aggregate of TTL metadata events.',
        responses: {
          200: okResponse('Moderation statistics', { type: 'object', properties: { stats: ref('ModerationStats') } }),
          401: ERRORS.unauthenticated,
          403: ERRORS.forbidden,
          500: ERRORS.internal,
        },
      },
    },

    /* --------------------------------------------------------- Notifications */
    '/api/v1/notifications': {
      get: {
        tags: ['Notifications'],
        operationId: 'listNotifications',
        summary: 'List the caller’s notifications',
        parameters: [
          {
            name: 'unreadOnly',
            in: 'query',
            schema: { type: 'boolean', default: false },
            description: 'When true, return unread notifications only.',
          },
          ...PAGINATION_PARAMS,
        ],
        responses: {
          200: okResponse(
            'Notifications',
            { type: 'object', properties: { notifications: { type: 'array', items: ref('Notification') } } },
            {
              type: 'object',
              properties: { ...PAGINATION_META.properties, unreadCount: { type: 'integer' } },
            }
          ),
          400: ERRORS.validation,
          401: ERRORS.unauthenticated,
          500: ERRORS.internal,
        },
      },
    },
    '/api/v1/notifications/{id}/read': {
      parameters: [idParam('id', 'Notification id')],
      patch: {
        tags: ['Notifications'],
        operationId: 'markNotificationRead',
        summary: 'Mark one of the caller’s notifications as read',
        parameters: [CSRF_PARAM],
        responses: {
          200: okResponse('Notification read', {
            type: 'object',
            properties: { notification: ref('Notification') },
          }),
          400: ERRORS.validation,
          401: ERRORS.unauthenticated,
          403: ERRORS.csrf,
          404: ERRORS.notFound,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
    },
    '/api/v1/notifications/read-all': {
      post: {
        tags: ['Notifications'],
        operationId: 'markAllNotificationsRead',
        summary: 'Mark every unread notification of the caller as read',
        parameters: [CSRF_PARAM],
        responses: {
          200: okResponse('All notifications marked read', {
            type: 'object',
            properties: { updated: { type: 'integer' } },
          }),
          401: ERRORS.unauthenticated,
          403: ERRORS.csrf,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
    },

    /* ------------------------------------------------------------------ Chat */
    '/api/v1/chat/conversations': {
      get: {
        tags: ['Chat'],
        operationId: 'listConversations',
        summary: 'List the caller’s conversations',
        parameters: PAGINATION_PARAMS,
        responses: {
          200: okResponse(
            'Conversations',
            { type: 'object', properties: { conversations: { type: 'array', items: ref('Conversation') } } },
            PAGINATION_META
          ),
          401: ERRORS.unauthenticated,
          500: ERRORS.internal,
        },
      },
      post: {
        tags: ['Chat'],
        operationId: 'createConversation',
        summary: 'Create a conversation',
        parameters: [CSRF_PARAM],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { title: { type: 'string', maxLength: 120 } } },
            },
          },
        },
        responses: {
          201: okResponse('Conversation created', {
            type: 'object',
            properties: { conversation: ref('Conversation') },
          }),
          400: ERRORS.validation,
          401: ERRORS.unauthenticated,
          403: ERRORS.csrf,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
    },
    '/api/v1/chat/conversations/{id}': {
      parameters: [idParam('id', 'Conversation id')],
      get: {
        tags: ['Chat'],
        operationId: 'getConversation',
        summary: 'Get one of the caller’s conversations with its messages',
        responses: {
          200: okResponse(
            'Conversation and messages',
            {
              type: 'object',
              properties: {
                conversation: ref('Conversation'),
                messages: { type: 'array', items: ref('ChatMessage') },
              },
            },
            PAGINATION_META
          ),
          400: ERRORS.validation,
          401: ERRORS.unauthenticated,
          404: ERRORS.notFound,
          500: ERRORS.internal,
        },
      },
      delete: {
        tags: ['Chat'],
        operationId: 'deleteConversation',
        summary: 'Hard-delete one of the caller’s conversations and its messages',
        parameters: [CSRF_PARAM],
        responses: {
          204: { description: 'Conversation deleted' },
          401: ERRORS.unauthenticated,
          403: ERRORS.forbidden,
          404: ERRORS.notFound,
          500: ERRORS.internal,
        },
      },
    },
    '/api/v1/chat/conversations/{id}/messages': {
      parameters: [idParam('id', 'Conversation id')],
      post: {
        tags: ['Chat'],
        operationId: 'sendChatMessage',
        summary: 'Send a message and receive the AI companion reply',
        description:
          'When the AI provider is unavailable this endpoint returns `503 AI_UNAVAILABLE` — it never fabricates an assistant reply. Rate limited to 20 requests / 5 minutes.',
        parameters: [CSRF_PARAM],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['content'],
                properties: { content: { type: 'string', minLength: 1, maxLength: 2000 } },
              },
            },
          },
        },
        responses: {
          200: okResponse('Message exchanged', {
            type: 'object',
            properties: {
              userMessage: ref('ChatMessage'),
              assistantMessage: ref('ChatMessage'),
              risk: ref('CrisisAssessment'),
              ai: {
                type: 'object',
                properties: {
                  provider: { type: 'string', enum: ['gemini', 'none'] },
                  model: { type: 'string', nullable: true },
                  degraded: { type: 'boolean' },
                },
              },
              resources: ref('CrisisResources'),
            },
          }),
          400: ERRORS.validation,
          401: ERRORS.unauthenticated,
          403: ERRORS.forbidden,
          404: ERRORS.notFound,
          429: ERRORS.rateLimited,
          503: ERRORS.aiUnavailable,
          500: ERRORS.internal,
        },
      },
    },

    /* ---------------------------------------------------------------- Crisis */
    '/api/v1/crisis/resources': {
      get: {
        tags: ['Crisis'],
        operationId: 'getCrisisResources',
        summary: 'Verified regional crisis resources with international fallback',
        security: [],
        parameters: [
          {
            name: 'country',
            in: 'query',
            schema: { type: 'string', maxLength: 40 },
            description:
              'Optional region selector (e.g. IN, US, GB, CA, AU); unknown regions fall back to international resources.',
          },
        ],
        responses: {
          200: okResponse('Crisis resources', { type: 'object', properties: { resources: ref('CrisisResources') } }),
          500: ERRORS.internal,
        },
      },
    },
    '/api/v1/crisis/assess': {
      post: {
        tags: ['Crisis'],
        operationId: 'assessCrisisText',
        summary: 'Assess a draft for distress signals (text is never stored)',
        description: 'Rate limited to 30 requests / 10 minutes. The assessed text is not persisted.',
        security: [],
        parameters: [CSRF_PARAM],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: { type: 'string', maxLength: 5000 },
                  source: { type: 'string', enum: ['chat', 'content', 'assessment'] },
                },
              },
            },
          },
        },
        responses: {
          200: okResponse('Assessment', {
            type: 'object',
            properties: { assessment: ref('CrisisAssessment') },
          }),
          400: ERRORS.validation,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
    },
    '/api/v1/crisis/events': {
      post: {
        tags: ['Crisis'],
        operationId: 'recordCrisisEvent',
        summary: 'Record a manual crisis-support event (metadata only)',
        security: [],
        parameters: [CSRF_PARAM],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['level', 'source'],
                properties: {
                  level: { type: 'string', enum: ['low', 'elevated', 'high'] },
                  source: { type: 'string', enum: ['manual', 'chat', 'content', 'assessment'] },
                  country: { type: 'string', maxLength: 40 },
                },
              },
            },
          },
        },
        responses: {
          200: okResponse('Event recorded', {
            type: 'object',
            properties: { acknowledged: { type: 'boolean' }, resources: ref('CrisisResources') },
          }),
          400: ERRORS.validation,
          429: ERRORS.rateLimited,
          500: ERRORS.internal,
        },
      },
    },

    /* ---------------------------------------------------------------- Health */
    '/health': {
      get: {
        tags: ['Health'],
        operationId: 'liveness',
        summary: 'Liveness probe (no database dependency)',
        security: [],
        responses: {
          200: okResponse('Process is alive', ref('Health')),
          500: ERRORS.internal,
        },
      },
    },
    '/healthz': {
      get: {
        tags: ['Health'],
        operationId: 'livenessAlias',
        summary: 'Liveness alias',
        security: [],
        responses: { 200: okResponse('Process is alive', ref('Health')) },
      },
    },
    '/health/ready': {
      get: {
        tags: ['Health'],
        operationId: 'readiness',
        summary: 'Readiness probe (pings MongoDB)',
        security: [],
        responses: {
          200: okResponse('Dependency is ready', ref('Health')),
          503: ERRORS.serviceUnavailable,
        },
      },
    },
    '/api/v1/health': {
      get: {
        tags: ['Health'],
        operationId: 'livenessVersioned',
        summary: 'Versioned liveness alias',
        security: [],
        responses: { 200: okResponse('Process is alive', ref('Health')) },
      },
    },

    /* ------------------------------------------------------------------ Docs */
    '/api/docs': {
      get: {
        tags: ['Health'],
        operationId: 'swaggerUi',
        summary: 'Swagger UI for this API',
        security: [],
        responses: { 200: { description: 'Swagger UI HTML' } },
      },
    },
    '/api/docs/openapi.json': {
      get: {
        tags: ['Health'],
        operationId: 'openapiDocument',
        summary: 'OpenAPI 3.0.3 document (JSON)',
        security: [],
        responses: {
          200: {
            description: 'OpenAPI document',
            content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
          },
        },
      },
    },
  },
};

// Export the document itself (no self-reference: swagger-ui-express serialises it).
module.exports = spec;
