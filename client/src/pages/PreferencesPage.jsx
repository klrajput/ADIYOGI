import { useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Alert from '../components/ui/Alert';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ErrorState from '../components/ui/ErrorState';
import Modal from '../components/ui/Modal';
import { Checkbox, Input } from '../components/ui/Field';
import PageHeader from '../components/common/PageHeader';
import { Icon } from '../components/common/Icons';
import { users } from '../api/endpoints';
import { useIdentity } from '../context/IdentityContext';
import { useToast } from '../context/ToastContext';
import usePageTitle from '../hooks/usePageTitle';
import { PEER_SUPPORT_DISCLAIMER, PRIVACY_SUMMARY } from '../lib/constants';
import { getErrorMessage, getFieldErrors } from '../lib/errors';

// Mirrors the server validator (users.validator.js): 3–24 chars, letters,
// numbers, spaces, dots, underscores and hyphens only.
const ALIAS_MIN = 3;
const ALIAS_MAX = 24;
const ALIAS_PATTERN = /^[\w .-]+$/;
const CONFIRM_WORD = 'DELETE';

function preferencesFromIdentity(identity) {
  return {
    displayAlias: identity?.preferences?.displayAlias || identity?.alias || '',
    showCrisisBar: identity?.preferences?.showCrisisBar !== false,
    contentWarningDefault: identity?.preferences?.contentWarningDefault === true,
    reduceMotion: identity?.preferences?.reduceMotion === true,
  };
}

export default function PreferencesPage() {
  usePageTitle('Preferences');

  const { identity, loading, error, refresh, updatePreferences, logout, isModerator } = useIdentity();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState(() => preferencesFromIdentity(null));
  const [initialized, setInitialized] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleteContent, setDeleteContent] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  const modalTitleId = useId();
  const saved = preferencesFromIdentity(identity);

  // Populate the form once identity (and therefore preferences) is available.
  useEffect(() => {
    if (!identity || initialized) return;
    setForm(preferencesFromIdentity(identity));
    setInitialized(true);
  }, [identity, initialized]);

  // Reset the destructive dialog fields each time it closes.
  useEffect(() => {
    if (deleteOpen) return;
    setConfirmText('');
    setDeleteError(null);
  }, [deleteOpen]);

  const isDirty =
    form.displayAlias.trim() !== saved.displayAlias.trim() ||
    form.showCrisisBar !== saved.showCrisisBar ||
    form.contentWarningDefault !== saved.contentWarningDefault ||
    form.reduceMotion !== saved.reduceMotion;

  const validate = () => {
    const next = {};
    const alias = form.displayAlias.trim();
    if (alias.length < ALIAS_MIN) next.displayAlias = `Your alias needs at least ${ALIAS_MIN} characters.`;
    else if (alias.length > ALIAS_MAX) next.displayAlias = `Aliases can be at most ${ALIAS_MAX} characters.`;
    else if (!ALIAS_PATTERN.test(alias)) {
      next.displayAlias = 'Use letters, numbers, spaces, dots, underscores and hyphens only.';
    }
    return next;
  };

  const handleDiscard = () => {
    setForm(saved);
    setFieldErrors({});
    setSaveError(null);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (saving) return;
    const nextErrors = validate();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      await updatePreferences({
        ...(identity.kind === 'user' ? { displayAlias: form.displayAlias.trim() } : {}),
        showCrisisBar: form.showCrisisBar,
        contentWarningDefault: form.contentWarningDefault,
        reduceMotion: form.reduceMotion,
      });
      toast.success('Preferences saved.');
    } catch (caught) {
      const mapped = getFieldErrors(caught);
      setFieldErrors(mapped);
      if (Object.keys(mapped).length === 0) {
        setSaveError(getErrorMessage(caught, 'Your preferences could not be saved. Please try again.'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting || confirmText.trim().toUpperCase() !== CONFIRM_WORD) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await users.deleteAccount({ deleteContent });
      toast.success('Your data has been deleted.');
      setDeleteOpen(false);
      await refresh();
      navigate('/', { replace: true });
    } catch (caught) {
      setDeleteError(getErrorMessage(caught, 'Your data could not be deleted. Please try again.'));
    } finally {
      setDeleting(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      toast.success('Signed out. You are back to an anonymous session.');
      navigate('/', { replace: true });
    } catch (caught) {
      toast.error(getErrorMessage(caught, 'Could not sign out. Please try again.'));
    } finally {
      setSigningOut(false);
    }
  };

  if (loading && !identity) {
    return (
      <div className="container-narrow py-10 sm:py-14" aria-busy="true">
        <span className="sr-only">Loading your preferences</span>
        <div className="skeleton h-4 w-24" />
        <div className="skeleton mt-3 h-9 w-1/2" />
        <div className="card mt-8 p-6">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton mt-4 h-11 w-full" />
          <div className="skeleton mt-6 h-4 w-2/3" />
          <div className="skeleton mt-3 h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="container-narrow py-16">
        <ErrorState
          title="We could not restore your session"
          description="Preferences are tied to your anonymous session. Without it there is nothing to edit — retrying usually fixes this."
          onRetry={refresh}
          retryLabel="Try again"
          requestId={error?.requestId}
        />
      </div>
    );
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow="Privacy and your data"
          title="Preferences"
          description="Safety notices, accessibility options and — if you have an account — your display name. Anonymous sessions have no username and no public profile."
        />

        <form onSubmit={handleSave} className="card p-5 sm:p-6" noValidate>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <h2 className="font-serif text-xl text-ink">Safety and display settings</h2>
              <p className="mt-1 text-sm text-ink-muted">
                You are using an {identity.kind === 'anonymous' ? 'anonymous session' : 'account'}.
              </p>
            </div>
            <Badge tone={identity.kind === 'anonymous' ? 'primary' : 'neutral'}>
              <Icon name={identity.kind === 'anonymous' ? 'lock' : 'user'} className="h-3 w-3" />
              {identity.kind === 'anonymous' ? 'Anonymous' : 'Signed in'}
            </Badge>
          </div>

          {saveError ? (
            <Alert tone="crisis" className="mt-4">
              {saveError}
            </Alert>
          ) : null}

          <div className="mt-5">
            {identity.kind === 'user' ? (
              <Input
                label="Display name"
                value={form.displayAlias}
                onChange={(event) => setForm((current) => ({ ...current, displayAlias: event.target.value }))}
                maxLength={ALIAS_MAX}
                error={fieldErrors.displayAlias}
                hint="The name attached to your posts and replies. It does not need to be your real name."
                autoComplete="nickname"
              />
            ) : (
              <div className="rounded-xl border border-line bg-paper/70 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Icon name="lock" className="h-4 w-4 text-primary-700" />
                  No username — you are anonymous
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                  Your posts and replies are shown as <strong className="font-semibold text-ink">Anonymous</strong>.
                  AdiYogi does not assign you a name, and nothing is shown publicly until you choose to
                  create an account.
                </p>
                <Link to="/login?mode=register" className="link mt-3 inline-block text-sm font-medium">
                  Create an account to choose a display name
                </Link>
              </div>
            )}
          </div>

          <fieldset className="mt-2 space-y-1 border-t border-line pt-5">
            <legend className="sr-only">Display and safety settings</legend>
            <Checkbox
              label="Show the safety notice under the header"
              hint="A calm, dismissible reminder that crisis support is always available."
              checked={form.showCrisisBar}
              onChange={(event) => setForm((current) => ({ ...current, showCrisisBar: event.target.checked }))}
            />
            <Checkbox
              label="Turn on content warnings for new posts by default"
              hint="You can always change this for an individual post."
              checked={form.contentWarningDefault}
              onChange={(event) =>
                setForm((current) => ({ ...current, contentWarningDefault: event.target.checked }))
              }
            />
            <Checkbox
              label="Reduce motion"
              hint="Minimises animation. Your device's reduced-motion setting is always respected too."
              checked={form.reduceMotion}
              onChange={(event) => setForm((current) => ({ ...current, reduceMotion: event.target.checked }))}
            />
          </fieldset>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <p className="text-xs text-ink-muted" role="status">
                {!initialized ? 'Loading your preferences…' : isDirty ? 'You have unsaved changes.' : 'All changes saved.'}
              </p>
            <div className="flex flex-wrap items-center gap-2">
              {isDirty ? (
                <Button type="button" variant="ghost" onClick={handleDiscard} disabled={saving}>
                  Discard
                </Button>
              ) : null}
              <Button type="submit" loading={saving} disabled={saving || !initialized || !isDirty}>
                Save preferences
              </Button>
            </div>
          </div>
        </form>

        <section className="card mt-6 p-5 sm:p-6" aria-labelledby="your-data-heading">
          <h2 id="your-data-heading" className="font-serif text-xl text-ink">
            Your data
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            AdiYogi is built to need as little about you as possible. This is what exists while you use it.
          </p>
          <ul className="mt-4 space-y-3">
            {PRIVACY_SUMMARY.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-relaxed text-ink-muted">
                <Icon name="check" className="mt-0.5 h-4 w-4 text-primary-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-lg border border-line bg-paper p-4">
            <h3 className="text-sm font-semibold text-ink">Anonymity versus accounts</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
              An anonymous session is enough to post, reply, chat, and report. Accounts add continuity across devices
              and access to moderator tools — they are never required to receive support. No password reset flow exists
              yet, so accounts are mainly useful for the moderation team.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {identity.kind === 'user' ? (
                <Button type="button" variant="secondary" size="sm" onClick={handleSignOut} loading={signingOut}>
                  <Icon name="logout" className="h-4 w-4" />
                  Sign out
                </Button>
              ) : (
                <Button to="/login" state={{ from: '/preferences' }} variant="secondary" size="sm">
                  Sign in or create an account
                </Button>
              )}
              <Button to="/guidelines" variant="ghost" size="sm">
                Read the guidelines
              </Button>
              {isModerator ? (
                <Button to="/moderation" variant="ghost" size="sm">
                  Moderation tools
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-crisis-200 bg-crisis-50 p-5 sm:p-6" aria-labelledby="delete-heading">
          <h2 id="delete-heading" className="font-serif text-xl text-crisis-700">
            Delete my account and content
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-crisis-700/90">
            This permanently removes your session and, if you choose, every thread and reply you have written. Chat
            conversations are deleted with it. This cannot be undone.
          </p>
          <Button type="button" variant="crisis" className="mt-4" onClick={() => setDeleteOpen(true)}>
            Start deletion
          </Button>
        </section>

        <p className="mt-8 text-xs leading-relaxed text-ink-muted">{PEER_SUPPORT_DISCLAIMER}</p>
      </div>

      <Modal
        open={deleteOpen}
        onClose={deleting ? undefined : () => setDeleteOpen(false)}
        title="Delete everything?"
        description="This is permanent. Your posts will be removed from the community."
        labelledBy={`delete-title-${modalTitleId}`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Keep my data
            </Button>
            <Button
              variant="crisis"
              onClick={handleDelete}
              loading={deleting}
              disabled={deleting || confirmText.trim().toUpperCase() !== CONFIRM_WORD}
            >
              Delete everything
            </Button>
          </>
        }
      >
        {deleteError ? (
          <Alert tone="crisis" className="mb-4">
            {deleteError}
          </Alert>
        ) : null}
        <Checkbox
          label="Also delete my threads and replies"
          hint="If unchecked, your posts remain under your anonymous alias but can no longer be linked to this session."
          checked={deleteContent}
          onChange={(event) => setDeleteContent(event.target.checked)}
          disabled={deleting}
        />
        <Input
          label={`Type ${CONFIRM_WORD} to confirm`}
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          placeholder={CONFIRM_WORD}
          autoComplete="off"
          disabled={deleting}
        />
        <p className="text-xs leading-relaxed text-ink-muted">
          If you are in crisis, please reach out to a support line before deleting — deletion is not a substitute for
          care.
        </p>
      </Modal>
    </div>
  );
}
