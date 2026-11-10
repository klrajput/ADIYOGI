const STAT_DEFINITIONS = [
  {
    key: 'openReports',
    label: 'Open reports',
    description: 'Awaiting a moderator decision',
    paths: ['openReports', 'reports.open', 'reportsOpen', 'reportCounts.open'],
  },
  {
    key: 'hiddenThreads',
    label: 'Hidden threads',
    description: 'Currently not visible to the community',
    paths: ['hiddenThreads', 'hidden.threads', 'hiddenThreadCount'],
  },
  {
    key: 'hiddenReplies',
    label: 'Hidden replies',
    description: 'Currently not visible to the community',
    paths: ['hiddenReplies', 'hidden.replies', 'hiddenReplyCount'],
  },
  {
    key: 'crisisEvents',
    label: 'Crisis events (30 days)',
    description: 'Aggregate count only — no message content',
    paths: ['crisisEvents30d', 'crisisEvents', 'crisis.last30Days', 'crisisEventsLast30Days'],
  },
];

function readValue(source, path) {
  return path.split('.').reduce((value, part) => (value == null ? undefined : value[part]), source);
}

/** Stats are shown only when the API provides a number; we never invent a zero. */
function readCount(stats, paths) {
  if (!stats || typeof stats !== 'object') return null;
  for (const path of paths) {
    const value = readValue(stats, path);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

export default function ModerationStats({ stats, loading = false, className = '' }) {
  return (
    <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${className}`}>
      {STAT_DEFINITIONS.map((definition) => {
        const value = readCount(stats, definition.paths);
        return (
          <div key={definition.key} className="card px-4 py-3">
            {loading ? (
              <>
                <div className="skeleton h-6 w-10" />
                <div className="skeleton mt-2 h-3 w-20" />
              </>
            ) : (
              <>
                <p className="font-serif text-2xl text-ink">{value === null ? '—' : value}</p>
                <p className="mt-0.5 text-xs font-semibold text-ink-soft">{definition.label}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{definition.description}</p>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
