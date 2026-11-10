/**
 * Endpoint wrappers — the only place that knows API paths.
 * Components import `endpoints`, never `fetch`.
 * Contract: docs/ARCHITECTURE.md §4.3.
 */
import { api } from './client';

export const auth = {
  bootstrap: () => api.post('/auth/session', {}),
  me: () => api.get('/auth/me'),
  csrf: () => api.get('/auth/csrf'),
  register: (payload) => api.post('/auth/register', payload),
  login: (payload) => api.post('/auth/login', payload),
  logout: () => api.post('/auth/logout', {}),
  refresh: () => api.post('/auth/refresh', {}),
};

export const users = {
  preferences: () => api.get('/users/me/preferences'),
  updatePreferences: (payload) => api.patch('/users/me/preferences', payload),
  content: (query) => api.get('/users/me/content', { query }),
  deleteAccount: (payload) => api.delete('/users/me', payload),
};

export const boards = {
  list: () => api.get('/boards'),
  get: (slug) => api.get(`/boards/${encodeURIComponent(slug)}`),
};

export const threads = {
  list: (query) => api.get('/threads', { query }),
  get: (id) => api.get(`/threads/${encodeURIComponent(id)}`),
  create: (payload) => api.post('/threads', payload),
  update: (id, payload) => api.patch(`/threads/${encodeURIComponent(id)}`, payload),
  remove: (id) => api.delete(`/threads/${encodeURIComponent(id)}`),
  replies: (id, query) => api.get(`/threads/${encodeURIComponent(id)}/replies`, { query }),
  createReply: (id, payload) => api.post(`/threads/${encodeURIComponent(id)}/replies`, payload),
};

export const replies = {
  remove: (id) => api.delete(`/replies/${encodeURIComponent(id)}`),
};

export const reports = {
  create: (payload) => api.post('/reports', payload),
  list: (query) => api.get('/reports', { query }),
  update: (id, payload) => api.patch(`/reports/${encodeURIComponent(id)}`, payload),
};

export const moderation = {
  queue: (query) => api.get('/moderation/queue', { query }),
  act: (payload) => api.post('/moderation/actions', payload),
  actions: (query) => api.get('/moderation/actions', { query }),
  stats: () => api.get('/moderation/stats'),
};

export const chat = {
  conversations: (query) => api.get('/chat/conversations', { query }),
  createConversation: (payload) => api.post('/chat/conversations', payload),
  conversation: (id) => api.get(`/chat/conversations/${encodeURIComponent(id)}`),
  // A provider call can take up to AI_TIMEOUT_MS plus one retry, so the chat turn gets
  // a longer client timeout than the default request budget.
  sendMessage: (id, payload) =>
    api.post(`/chat/conversations/${encodeURIComponent(id)}/messages`, payload, { timeoutMs: 45_000 }),
  removeConversation: (id) => api.delete(`/chat/conversations/${encodeURIComponent(id)}`),
};

export const crisis = {
  resources: (query) => api.get('/crisis/resources', { query }),
  assess: (payload) => api.post('/crisis/assess', payload),
  recordEvent: (payload) => api.post('/crisis/events', payload),
};

export const notifications = {
  list: (query) => api.get('/notifications', { query }),
  markRead: (id) => api.patch(`/notifications/${encodeURIComponent(id)}/read`),
  markAllRead: () => api.post('/notifications/read-all', {}),
};

export default { auth, users, boards, threads, replies, reports, moderation, chat, crisis, notifications };
