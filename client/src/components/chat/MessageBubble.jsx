import { formatDateTime } from '../../lib/format';

/**
 * One chat message. Assistant text is rendered as plain text with newlines
 * preserved — the client never interprets HTML from the API, so a compromised or
 * confused provider response cannot inject markup.
 */
export default function MessageBubble({ message, pending = false }) {
  const isUser = message.role === 'user';
  const timestamp = message.createdAt ? formatDateTime(message.createdAt) : '';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[88%] flex-col sm:max-w-[76%] ${isUser ? 'items-end' : 'items-start'}`}>
        <p className="mb-1 text-xs font-semibold text-ink-muted">
          {isUser ? 'You' : 'AI companion'}
          {pending ? <span className="font-normal"> · sending</span> : null}
        </p>
        <div
          className={`whitespace-pre-wrap break-words rounded-lg border px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'border-primary-200 bg-primary-50 text-primary-900'
              : 'border-line bg-surface text-ink-soft'
          }`}
        >
          {message.content}
        </div>
        {timestamp ? (
          <time dateTime={message.createdAt || undefined} className="mt-1 text-xs text-ink-muted">
            {timestamp}
          </time>
        ) : null}
      </div>
    </div>
  );
}
