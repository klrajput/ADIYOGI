import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { moderation, reports as reportsApi } from '../api/endpoints';
import { useIdentity } from '../context/IdentityContext';
import { useToast } from '../context/ToastContext';
import useApiResource from '../hooks/useApiResource';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import { LoadingBlock } from '../components/ui/Spinner';
import AuditLog from '../components/moderation/AuditLog';
import HiddenContentCard from '../components/moderation/HiddenContentCard';
import ModerationActionDialog from '../components/moderation/ModerationActionDialog';
import ModerationStats from '../components/moderation/ModerationStats';
import QueueReportCard from '../components/moderation/QueueReportCard';
import ReportResolutionDialog from '../components/moderation/ReportResolutionDialog';

const PAGE_SIZE = 20;

function normaliseQueue(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const hidden = source.hidden && typeof source.hidden === 'object' ? source.hidden : {};
  return {
    reports: Array.isArray(source.reports) ? source.reports : [],
    hiddenThreads: Array.isArray(source.hiddenThreads)
      ? source.hiddenThreads
      : Array.isArray(hidden.threads)
        ? hidden.threads
        : [],
    hiddenReplies: Array.isArray(source.hiddenReplies)
      ? source.hiddenReplies
      : Array.isArray(hidden.replies)
        ? hidden.replies
        : [],
  };
}

function actionSuccessMessage(action) {
  const messages = {
    hide: 'Content hidden. The action was recorded in the audit log.',
    unhide: 'Content restored. The action was recorded in the audit log.',
    delete: 'Content deleted. The action was recorded in the audit log.',
    pin: 'Thread pinned. The action was recorded in the audit log.',
    unpin: 'Thread unpinned. The action was recorded in the audit log.',
    lock: 'Thread locked. The action was recorded in the audit log.',
    unlock: 'Thread unlocked. The action was recorded in the audit log.',
  };
  return messages[action] || 'Action completed and recorded in the audit log.';
}

function ModeratorGate() {
  return (
    <div className="container-narrow py-10 sm:py-14">
      <div className="card px-6 py-10 text-center sm:px-10">
        <span aria-hidden="true" className="text-3xl">
          🛡️
        </span>
        <h1 className="mt-4 font-serif text-2xl text-ink">This area is for moderators</h1>
        <p className="mx-auto mt-3 max-w-prose text-sm leading-relaxed text-ink-muted">
          Moderation is how the community keeps to its guidelines. Moderators review reports, hide
          or remove content that breaks the rules, and record every action with a reason. The queue
          is only visible to moderator and admin accounts.
        </p>
        <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
          Moderation is carried out by people. It is not automated and it is not monitored
          continuously — nobody is watching in real time.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button to="/login">Sign in as a moderator</Button>
          <Button to="/community" variant="secondary">
            Back to the community
          </Button>
        </div>
        <p className="mt-5 text-xs text-ink-muted">
          If you or someone else is in crisis,{' '}
          <Link to="/crisis" className="link">
            get human help now
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

export default function ModerationPage() {
  const { identity, loading: identityLoading, isModerator } = useIdentity();
  const { toast } = useToast();

  const [queuePage, setQueuePage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);

  const fetchQueue = useCallback(
    () => moderation.queue({ page: queuePage, limit: PAGE_SIZE }),
    [queuePage]
  );
  const {
    data: queueData,
    meta: queueMeta,
    loading: queueLoading,
    error: queueError,
    refetch: refetchQueue,
  } = useApiResource(fetchQueue, [queuePage], { enabled: isModerator });

  const fetchStats = useCallback(() => moderation.stats(), []);
  const {
    data: statsData,
    loading: statsLoading,
    refetch: refetchStats,
  } = useApiResource(fetchStats, [], { enabled: isModerator });

  const fetchAudit = useCallback(
    () => moderation.actions({ page: auditPage, limit: PAGE_SIZE }),
    [auditPage]
  );
  const {
    data: auditData,
    meta: auditMeta,
    loading: auditLoading,
    error: auditError,
    refetch: refetchAudit,
  } = useApiResource(fetchAudit, [auditPage], { enabled: isModerator });

  const [actionDialog, setActionDialog] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const [resolutionDialog, setResolutionDialog] = useState(null);
  const [resolutionStatus, setResolutionStatus] = useState('resolved');
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolutionBusy, setResolutionBusy] = useState(false);
  const [resolutionError, setResolutionError] = useState(null);

  // ---- all hooks above this line; conditional rendering starts here ----------
  if (identityLoading) {
    return (
      <div className="container-narrow py-10">
        <p className="eyebrow">Moderation</p>
        <h1 className="mt-2 font-serif text-2xl text-ink">Checking your permissions</h1>
        <div className="mt-6">
          <LoadingBlock label="Checking your permissions" rows={3} />
        </div>
      </div>
    );
  }

  if (!isModerator) {
    return <ModeratorGate />;
  }

  const queue = normaliseQueue(queueData);
  const stats = statsData?.stats || statsData || null;
  const auditEntries = Array.isArray(auditData?.actions) ? auditData.actions : [];
  const reports = queue.reports;
  const hasQueueItems =
    reports.length > 0 || queue.hiddenThreads.length > 0 || queue.hiddenReplies.length > 0;

  const openActionDialog = (payload) => {
    setActionError(null);
    setActionReason('');
    setActionDialog(payload);
  };

  const confirmAction = async () => {
    if (!actionDialog || actionBusy) return;
    const reason = actionReason.trim();
    setActionBusy(true);
    setActionError(null);
    try {
      await moderation.act({
        action: actionDialog.action,
        targetType: actionDialog.targetType,
        targetId: actionDialog.targetId,
        ...(actionDialog.reportId ? { reportId: actionDialog.reportId } : {}),
        ...(reason ? { reason } : {}),
      });
      toast.success(actionSuccessMessage(actionDialog.action));
      setActionDialog(null);
      setActionReason('');
      refetchQueue();
      refetchStats();
      refetchAudit();
    } catch (caught) {
      setActionError(caught);
    } finally {
      setActionBusy(false);
    }
  };

  const openResolutionDialog = (report, status) => {
    setResolutionError(null);
    setResolutionNote('');
    setResolutionStatus(status);
    setResolutionDialog(report);
  };

  const confirmResolution = async () => {
    if (!resolutionDialog || resolutionBusy) return;
    const note = resolutionNote.trim();
    setResolutionBusy(true);
    setResolutionError(null);
    try {
      await reportsApi.update(resolutionDialog.id, {
        status: resolutionStatus,
        ...(note ? { resolutionNote: note } : {}),
      });
      toast.success(
        resolutionStatus === 'resolved'
          ? 'Report marked as resolved.'
          : 'Report dismissed. The decision is in the audit log.'
      );
      setResolutionDialog(null);
      refetchQueue();
      refetchStats();
      refetchAudit();
    } catch (caught) {
      setResolutionError(caught);
    } finally {
      setResolutionBusy(false);
    }
  };

  return (
    <div className="container-page py-6 sm:py-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Moderation</p>
          <h1 className="mt-1 font-serif text-2xl text-ink sm:text-3xl">Moderation queue</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
            Review reports and hidden content. Every action is recorded with your account name and
            reason. Decisions are made by people, not automatically, and this queue is not monitored
            continuously.
          </p>
        </div>
        <p className="text-xs text-ink-muted">
          Signed in as{' '}
          <span className="font-semibold text-ink-soft">
            {identity?.preferences?.displayAlias || identity?.alias || 'Moderator'}
          </span>
          {identity?.role ? ` · role: ${identity.role}` : ''}
        </p>
      </div>

      <ModerationStats stats={stats} loading={statsLoading} className="mt-6" />

      <section aria-labelledby="moderation-queue-title" className="mt-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="moderation-queue-title" className="font-serif text-xl text-ink">
              Open reports and hidden content
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Reports are shown with the reporter&apos;s account of what happened — not as proof
              that a guideline was broken.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary btn-sm min-h-[40px]"
            onClick={() => {
              refetchQueue();
              refetchStats();
              refetchAudit();
            }}
          >
            Refresh queue
          </button>
        </div>

        {queueLoading ? (
          <div className="mt-4">
            <LoadingBlock label="Loading the moderation queue" rows={3} />
          </div>
        ) : null}

        {!queueLoading && queueError ? (
          <div className="mt-4">
            <ErrorState
              title="We could not load the moderation queue"
              description="The queue did not respond. No moderation data is shown rather than stale data."
              onRetry={refetchQueue}
              requestId={queueError.requestId}
            />
          </div>
        ) : null}

        {!queueLoading && !queueError ? (
          <div className="mt-4 space-y-6">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Reports
              </h3>
              {reports.length === 0 ? (
                <div className="mt-2">
                  <EmptyState
                    icon="📭"
                    title="No open reports"
                    description="When someone reports a thread or reply, it will appear here for review."
                  />
                </div>
              ) : (
                <ul className="mt-2 space-y-3">
                  {reports.map((report) => (
                    <QueueReportCard
                      key={report.id}
                      report={report}
                      onOpenAction={openActionDialog}
                      onResolve={openResolutionDialog}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Hidden content
              </h3>
              {queue.hiddenThreads.length === 0 && queue.hiddenReplies.length === 0 ? (
                <p className="mt-2 rounded-lg border border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-ink-muted">
                  No hidden content right now.
                </p>
              ) : (
                <div className="mt-2 space-y-3">
                  {queue.hiddenThreads.length > 0 ? (
                    <ul className="space-y-3">
                      {queue.hiddenThreads.map((thread) => (
                        <HiddenContentCard
                          key={thread.id}
                          item={thread}
                          targetType="thread"
                          onOpenAction={openActionDialog}
                        />
                      ))}
                    </ul>
                  ) : null}
                  {queue.hiddenReplies.length > 0 ? (
                    <ul className="space-y-3">
                      {queue.hiddenReplies.map((reply) => (
                        <HiddenContentCard
                          key={reply.id}
                          item={reply}
                          targetType="reply"
                          onOpenAction={openActionDialog}
                        />
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </div>

            {queueMeta && queueMeta.totalPages > 1 ? (
              <Pagination meta={queueMeta} onPageChange={setQueuePage} label="queue pages" />
            ) : null}

            {queueMeta && !hasQueueItems && queueMeta.totalPages > 1 ? (
              <p className="text-xs text-ink-muted">This page of the queue is empty.</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="moderation-audit-title" className="mt-8">
        <h2 id="moderation-audit-title" className="sr-only">
          Audit log
        </h2>
        <AuditLog
          entries={auditEntries}
          loading={auditLoading}
          error={auditError}
          meta={auditMeta}
          onRetry={refetchAudit}
          onPageChange={setAuditPage}
        />
      </section>

      <p className="mt-6 text-xs leading-relaxed text-ink-muted">
        Moderation is not a crisis service. If a post suggests someone may be in immediate danger,
        share crisis resources with them and, where you can, contact emergency services. AdiYogi
        cannot alert anyone on your behalf.
      </p>

      <Modal
        open={Boolean(actionDialog)}
        onClose={() => {
          if (!actionBusy) setActionDialog(null);
        }}
        title="Moderate content"
        description="Choose an action and record why. Destructive actions require a reason."
        size="md"
      >
        {actionDialog ? (
          <ModerationActionDialog
            targetType={actionDialog.targetType}
            targetLabel={actionDialog.targetLabel}
            action={actionDialog.action}
            onActionChange={(value) =>
              setActionDialog((current) => (current ? { ...current, action: value } : current))
            }
            reason={actionReason}
            onReasonChange={setActionReason}
            onClose={() => setActionDialog(null)}
            onConfirm={confirmAction}
            busy={actionBusy}
            error={actionError}
          />
        ) : null}
      </Modal>

      <Modal
        open={Boolean(resolutionDialog)}
        onClose={() => {
          if (!resolutionBusy) setResolutionDialog(null);
        }}
        title="Record a decision"
        description="This updates the report status and adds the decision to the audit log."
        size="md"
      >
        <ReportResolutionDialog
          report={resolutionDialog}
          status={resolutionStatus}
          onStatusChange={setResolutionStatus}
          note={resolutionNote}
          onNoteChange={setResolutionNote}
          onClose={() => setResolutionDialog(null)}
          onConfirm={confirmResolution}
          busy={resolutionBusy}
          error={resolutionError}
        />
      </Modal>
    </div>
  );
}
