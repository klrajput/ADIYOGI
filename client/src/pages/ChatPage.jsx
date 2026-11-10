import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { chat } from '../api/endpoints';
import { useToast } from '../context/ToastContext';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Modal from '../components/ui/Modal';
import { LoadingBlock } from '../components/ui/Spinner';
import ApiErrorCard from '../components/chat/ApiErrorCard';
import Composer, { MAX_MESSAGE_LENGTH } from '../components/chat/Composer';
import ConversationList from '../components/chat/ConversationList';
import MessageBubble from '../components/chat/MessageBubble';
import TypingIndicator from '../components/chat/TypingIndicator';
import CrisisQuickHelp from '../components/crisis/CrisisQuickHelp';

const PAGE_SIZE = 20;

const EXAMPLE_PROMPTS = [
  "I've been feeling anxious all week and I can't switch my thoughts off.",
  'I am struggling to sleep and it is making everything harder.',
  "I want to support a friend who seems to be struggling, but I don't know what to say.",
];

function conversationsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.conversations) ? payload.conversations : [];
}

function conversationFrom(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return payload.conversation && typeof payload.conversation === 'object'
    ? payload.conversation
    : payload;
}

function messagesFrom(payload) {
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.messages) ? payload.messages : [];
}

export default function ChatPage() {
  const { toast } = useToast();

  const [conversations, setConversations] = useState([]);
  const [convMeta, setConvMeta] = useState(null);
  const [convLoading, setConvLoading] = useState(true);
  const [convError, setConvError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState(null);
  const [threadReloadKey, setThreadReloadKey] = useState(0);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [risk, setRisk] = useState(null);
  const [inlineResources, setInlineResources] = useState(null);
  const [errorResources, setErrorResources] = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const composerRef = useRef(null);
  const scrollRef = useRef(null);
  const skipThreadLoadRef = useRef(null);

  const loadConversations = useCallback(async ({ page = 1, append = false } = {}) => {
    if (append) setLoadingMore(true);
    else setConvLoading(true);
    setConvError(null);
    try {
      const { data: payload, meta } = await chat.conversations({ page, limit: PAGE_SIZE });
      const list = conversationsFrom(payload);
      setConversations((current) => (append ? [...current, ...list] : list));
      setConvMeta(meta ?? null);
      return list;
    } catch (caught) {
      setConvError(caught);
      return [];
    } finally {
      if (append) setLoadingMore(false);
      else setConvLoading(false);
    }
  }, []);

  // Initial conversation list: select the most recent one when there is one.
  useEffect(() => {
    let cancelled = false;
    loadConversations().then((list) => {
      if (cancelled) return;
      if (list.length > 0) setActiveId(list[0].id);
    });
    return () => {
      cancelled = true;
    };
  }, [loadConversations]);

  // Load the selected thread.
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setThreadError(null);
      setThreadLoading(false);
      return undefined;
    }
    if (skipThreadLoadRef.current === activeId) {
      skipThreadLoadRef.current = null;
      return undefined;
    }
    let cancelled = false;
    setThreadLoading(true);
    setThreadError(null);
    setSendError(null);
    setRisk(null);
    setInlineResources(null);
    setErrorResources(null);
    chat
      .conversation(activeId)
      .then(({ data: payload }) => {
        if (cancelled) return;
        setMessages(messagesFrom(payload));
        const conversation = conversationFrom(payload);
        if (conversation?.id) {
          setConversations((current) =>
            current.map((entry) =>
              entry.id === conversation.id ? { ...entry, ...conversation } : entry
            )
          );
        }
      })
      .catch((caught) => {
        if (!cancelled) setThreadError(caught);
      })
      .finally(() => {
        if (!cancelled) setThreadLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, threadReloadKey]);

  // Keep the newest message in view without moving the whole page.
  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, sending, threadLoading, risk]);

  const selectConversation = (conversation) => {
    setActiveId(conversation.id);
    setDraft('');
    setSendError(null);
    setErrorResources(null);
    setDrawerOpen(false);
  };

  const startNewConversation = () => {
    setActiveId(null);
    setMessages([]);
    setThreadError(null);
    setSendError(null);
    setRisk(null);
    setInlineResources(null);
    setErrorResources(null);
    setDraft('');
    setDrawerOpen(false);
    window.requestAnimationFrame(() => composerRef.current?.focus());
  };

  const applyPrompt = (prompt) => {
    setDraft(prompt);
    setSendError(null);
    setDrawerOpen(false);
    window.requestAnimationFrame(() => composerRef.current?.focus());
  };

  const sendContent = async (rawContent) => {
    const content = String(rawContent || '').trim();
    if (!content || sending || content.length > MAX_MESSAGE_LENGTH) return;

    setSending(true);
    setSendError(null);
    setRisk(null);
    setInlineResources(null);
    setErrorResources(null);

    let conversationId = activeId;
    const optimisticId = `pending-${Date.now()}`;
    const optimistic = {
      id: optimisticId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    try {
      if (!conversationId) {
        const { data: createdPayload } = await chat.createConversation({
          title: content.slice(0, 80),
        });
        const conversation = conversationFrom(createdPayload);
        conversationId = conversation?.id;
        if (!conversationId) {
          throw new Error('We could not start the conversation. Please try again.');
        }
        setConversations((current) => [
          conversation,
          ...current.filter((entry) => entry.id !== conversation.id),
        ]);
        skipThreadLoadRef.current = conversation.id;
        setActiveId(conversation.id);
      }

      setDraft('');
      setMessages((current) => [...current, optimistic]);

      const { data: payload } = await chat.sendMessage(conversationId, { content });
      const userMessage = payload?.userMessage || { ...optimistic, id: optimisticId };
      const safetyMessage = payload?.safetyMessage || null;
      const assistantMessage = payload?.assistantMessage || null;

      setMessages((current) => {
        const withoutOptimistic = current.filter((entry) => entry.id !== optimisticId);
        const next = [...withoutOptimistic, userMessage];
        if (safetyMessage) next.push(safetyMessage);
        if (assistantMessage) next.push(assistantMessage);
        return next;
      });

      setConversations((current) =>
        current.map((entry) =>
          entry.id === conversationId
            ? {
                ...entry,
                title: entry.title || content.slice(0, 80),
                lastMessageAt: new Date().toISOString(),
                messageCount:
                  (entry.messageCount || 0) + 1 + (safetyMessage ? 1 : 0) + (assistantMessage ? 1 : 0),
              }
            : entry
        )
      );

      const level = payload?.risk?.level;
      if (level === 'elevated' || level === 'high') {
        setRisk(payload.risk);
        if (payload?.resources) setInlineResources(payload.resources);
      }
    } catch (caught) {
      // Keep the user's words: remove the optimistic bubble and restore the draft.
      setMessages((current) => current.filter((entry) => entry.id !== optimisticId));
      setDraft(content);
      setSendError(caught);
      const details = caught && typeof caught.details === 'object' && !Array.isArray(caught.details) ? caught.details : null;
      setErrorResources(details?.resources || null);
    } finally {
      setSending(false);
      window.requestAnimationFrame(() => composerRef.current?.focus());
    }
  };

  const handleRetry = () => {
    const content = draft.trim();
    if (content) sendContent(content);
  };

  const handleLoadMore = () => {
    const nextPage = (convMeta?.page || 1) + 1;
    loadConversations({ page: nextPage, append: true });
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await chat.removeConversation(pendingDelete.id);
      setConversations((current) => current.filter((entry) => entry.id !== pendingDelete.id));
      if (activeId === pendingDelete.id) {
        setActiveId(null);
        setMessages([]);
        setRisk(null);
        setInlineResources(null);
        setSendError(null);
      }
      setPendingDelete(null);
      toast.success('Conversation deleted. Its messages are permanently removed.');
    } catch (caught) {
      setDeleteError(caught);
    } finally {
      setDeleteBusy(false);
    }
  };

  const conversationList = (
    <ConversationList
      conversations={conversations}
      activeId={activeId}
      loading={convLoading}
      error={convError}
      onRetry={() => loadConversations()}
      onSelect={selectConversation}
      onDelete={(conversation) => {
        setDeleteError(null);
        setPendingDelete(conversation);
      }}
      onNew={startNewConversation}
      meta={convMeta}
      loadingMore={loadingMore}
      onLoadMore={handleLoadMore}
    />
  );

  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-sage-mist opacity-70" />
      <div className="container-page relative py-4 sm:py-6">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start">
        <aside
          className="hidden h-[calc(100vh-9rem)] overflow-hidden rounded-lg border border-line bg-surface shadow-card lg:block"
          aria-label="Your conversations"
        >
          {conversationList}
        </aside>

        <section
          aria-label="AI companion conversation"
          className="flex h-[calc(100dvh-11rem)] min-h-[30rem] flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card lg:h-[calc(100vh-9rem)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2 sm:px-4">
            <button
              type="button"
              className="btn-secondary btn-sm min-h-[40px] lg:hidden"
              onClick={() => setDrawerOpen(true)}
            >
              Conversations
            </button>
            <h1 className="min-w-0 truncate font-serif text-sm text-ink lg:text-base">AI companion</h1>
            <Link to="/crisis" className="btn-crisis btn-sm min-h-[40px] px-3">
              Get help now
            </Link>
          </div>

          <div role="note" className="border-b border-accent-200 bg-accent-50 px-3 py-2.5 sm:px-4">
            <p className="text-xs leading-relaxed text-accent-800 sm:text-sm">
              You&apos;re talking with an AI companion. It is not a therapist and cannot diagnose or
              monitor you. If you&apos;re in crisis,{' '}
              <Link
                to="/crisis"
                className="font-semibold underline decoration-accent-400 underline-offset-2 hover:decoration-accent-700"
              >
                get human help now
              </Link>
              .
            </p>
          </div>

          <div
            ref={scrollRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Conversation messages"
            className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4"
          >
            {threadLoading && messages.length === 0 ? (
              <LoadingBlock label="Loading conversation" rows={2} />
            ) : null}

            {threadError ? (
              <ErrorState
                title="We could not load this conversation"
                description="The conversation may still exist — this was a loading problem. Try again, or start a new conversation."
                onRetry={() => setThreadReloadKey((key) => key + 1)}
                requestId={threadError.requestId}
              />
            ) : null}

            {!activeId && !threadLoading ? (
              <div className="mx-auto flex max-w-xl flex-col justify-center py-4">
                <EmptyState
                  icon="🌿"
                  title="Talk it through with the companion"
                  description="You can start anywhere. The companion listens and offers support, but it is not a therapist and it cannot monitor you. Your first message starts a conversation you can delete at any time."
                  action={
                    <Link to="/crisis" className="btn-crisis btn-sm min-h-[40px]">
                      I need help right now
                    </Link>
                  }
                />
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Or start from an example
                  </p>
                  <ul className="mt-2 space-y-2">
                    {EXAMPLE_PROMPTS.map((prompt) => (
                      <li key={prompt}>
                        <button
                          type="button"
                          onClick={() => applyPrompt(prompt)}
                          className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-left text-sm text-ink-soft transition-colors hover:border-primary-300 hover:text-primary-800"
                        >
                          {prompt}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            {activeId && !threadLoading && !threadError && messages.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">
                This conversation has no messages yet. Say anything to begin.
              </p>
            ) : null}

            {messages.length > 0 ? (
              <ul className="space-y-3">
                {messages.map((message) => (
                  <li key={message.id}>
                    <MessageBubble message={message} />
                  </li>
                ))}
              </ul>
            ) : null}

            <TypingIndicator visible={sending} />

            {risk ? (
              <div className="mt-4">
                <CrisisQuickHelp initialResources={inlineResources} />
              </div>
            ) : null}
          </div>

          {sendError ? (
            <div className="px-3 pt-3 sm:px-4">
              <ApiErrorCard
                error={sendError}
                onRetry={handleRetry}
                retryLabel="Try again with this message"
              />
              {errorResources ? (
                <CrisisQuickHelp initialResources={errorResources} className="mt-2" />
              ) : null}
            </div>
          ) : null}

          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={sendContent}
            sending={sending}
            disabled={Boolean(activeId) && threadLoading}
            textareaRef={composerRef}
          />
        </section>
      </div>

      <Modal
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Your conversations"
        description="Select a conversation or start a new one."
        size="sm"
      >
        <div className="h-[60vh]">{conversationList}</div>
      </Modal>

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => {
          if (!deleteBusy) setPendingDelete(null);
        }}
        title="Delete this conversation?"
        description="This permanently deletes the conversation and all of its messages. It cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)} disabled={deleteBusy}>
              Cancel
            </Button>
            <Button variant="crisis" onClick={confirmDelete} loading={deleteBusy}>
              Delete conversation
            </Button>
          </>
        }
      >
        {deleteError ? (
          <Alert tone="crisis" title="The conversation was not deleted">
            <p>
              {deleteError.message || 'Please try again in a moment.'}
              {deleteError.requestId ? ` Reference: ${deleteError.requestId}.` : ''}
            </p>
          </Alert>
        ) : (
          <p className="text-sm text-ink-soft">
            You are about to delete{' '}
            <span className="font-semibold text-ink">
              {pendingDelete?.title || 'this conversation'}
            </span>
            .
          </p>
        )}
      </Modal>
      </div>
    </div>
  );
}
