import { useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Alert from '../components/ui/Alert';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import { Icon } from '../components/common/Icons';
import { useIdentity } from '../context/IdentityContext';
import { useToast } from '../context/ToastContext';
import usePageTitle from '../hooks/usePageTitle';
import { PEER_SUPPORT_DISCLAIMER } from '../lib/constants';
import { getErrorMessage, getFieldErrors } from '../lib/errors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_MIN = 10;

function safeRedirect(candidate) {
  if (typeof candidate !== 'string') return '/community';
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return '/community';
  if (candidate.startsWith('/login')) return '/community';
  return candidate;
}

export default function LoginPage() {
  const { identity, loading, error, login, register, logout, isModerator } = useIdentity();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Headline links can deep-link straight into registration (/login?mode=register).
  const [mode, setMode] = useState(searchParams.get('mode') === 'register' ? 'register' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const tabBaseId = useId();
  const signinTabRef = useRef(null);
  const registerTabRef = useRef(null);
  const redirectTo = safeRedirect(location.state?.from);

  usePageTitle(mode === 'signin' ? 'Sign in' : 'Create an account');

  const selectMode = (nextMode) => {
    setMode(nextMode);
    setFieldErrors({});
    setFormError(null);
    const target = nextMode === 'signin' ? signinTabRef.current : registerTabRef.current;
    target?.focus();
  };

  const handleTabKeyDown = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') {
      return;
    }
    event.preventDefault();
    if (event.key === 'Home') return selectMode('signin');
    if (event.key === 'End') return selectMode('register');
    return selectMode(mode === 'signin' ? 'register' : 'signin');
  };

  const validate = () => {
    const next = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) next.email = 'Please enter your email address.';
    else if (!EMAIL_PATTERN.test(trimmedEmail)) next.email = 'Please enter a valid email address.';

    if (!password) next.password = 'Please enter your password.';
    else if (mode === 'register' && password.length < PASSWORD_MIN) {
      next.password = `Passwords need at least ${PASSWORD_MIN} characters.`;
    }

    if (mode === 'register' && displayName.trim().length > 40) {
      next.displayName = 'Display names can be at most 40 characters.';
    }

    return next;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validate();
    setFieldErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await login({ email: email.trim(), password });
        toast.success('Welcome back.');
      } else {
        await register({
          email: email.trim(),
          password,
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        });
        toast.success('Account created. You can keep using AdiYogi anonymously whenever you like.');
      }
      navigate(redirectTo, { replace: true });
    } catch (caught) {
      const mapped = getFieldErrors(caught);
      setFieldErrors(mapped);
      if (Object.keys(mapped).length === 0) {
        if (caught?.status === 401 || caught?.code === 'INVALID_CREDENTIALS') {
          setFormError('That email and password do not match an account.');
        } else if (caught?.code === 'ACCOUNT_LOCKED' || caught?.status === 423) {
          setFormError(getErrorMessage(caught, 'This account is temporarily locked. Please try again later.'));
        } else if (caught?.code === 'CONFLICT' || caught?.status === 409) {
          setFormError('An account with that email already exists. Try signing in instead.');
        } else if (caught?.status === 429) {
          // The API uses 429 both for rate limiting and for the account lockout;
          // preserve the more specific lockout explanation when present.
          setFormError(
            typeof caught?.message === 'string' && /attempts/i.test(caught.message)
              ? caught.message
              : getErrorMessage(caught)
          );
        } else if (caught?.status === 403 || caught?.status === 423) {
          setFormError(
            caught?.code === 'CSRF_INVALID'
              ? getErrorMessage(caught)
              : 'This account cannot sign in right now. It may be temporarily locked or suspended — please try again later.'
          );
        } else {
          setFormError(getErrorMessage(caught, 'We could not complete that. Please try again.'));
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      toast.success('Signed out. You are back to an anonymous session.');
      navigate('/community', { replace: true });
    } catch (caught) {
      toast.error(getErrorMessage(caught, 'Could not sign out. Please try again.'));
    } finally {
      setSigningOut(false);
    }
  };

  if (loading && !identity) {
    return (
      <div className="container-narrow py-16" aria-busy="true">
        <span className="sr-only">Loading</span>
        <div className="skeleton h-9 w-1/2" />
        <div className="card mt-8 p-6">
          <div className="skeleton h-11 w-full" />
          <div className="skeleton mt-4 h-11 w-full" />
          <div className="skeleton mt-6 h-10 w-32" />
        </div>
      </div>
    );
  }

  if (identity && identity.kind === 'user') {
    const alias = identity.preferences?.displayAlias || identity.alias;
    return (
      <div className="container-narrow py-16">
        <div className="card p-6 sm:p-8">
          <Badge tone="primary">
            <Icon name="user" className="h-3 w-3" />
            Signed in
          </Badge>
          <h1 className="mt-4 font-serif text-3xl text-ink">You are signed in</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            You are currently using the account <span className="font-medium text-ink">{alias}</span>. Posting still
            uses your alias; your email is never shown to other people.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button to="/community">Go to the community</Button>
            <Button to="/preferences" variant="secondary">
              Preferences
            </Button>
            {isModerator ? (
              <Button to="/moderation" variant="secondary">
                Moderation tools
              </Button>
            ) : null}
            <Button variant="ghost" onClick={handleSignOut} loading={signingOut}>
              <Icon name="logout" className="h-4 w-4" />
              Sign out
            </Button>
          </div>
          <Link to="/crisis" className="link mt-6 inline-block text-sm">
            Need support right now? Open crisis resources
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-12">
        <div className="w-full max-w-lg">
          <p className="eyebrow text-ink-muted">Accounts are optional</p>
          <h1 className="mt-1 font-serif text-3xl leading-tight text-ink sm:text-4xl">
            {mode === 'signin' ? 'Sign in' : 'Create an account'}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            You do not need an account to read, post, chat, or reach crisis support. Accounts add continuity across
            devices and access to moderator tools.
          </p>

          {error ? (
            <div className="mt-6">
              <Alert tone="warning" title="Sign-in is unavailable right now" icon="⚠️">
                The AdiYogi server could not be reached, so accounts cannot be checked. You can keep
                reading and use crisis resources; try again in a moment.
              </Alert>
            </div>
          ) : null}

          <div className="card mt-6 overflow-hidden">
            <div role="tablist" aria-label="Account mode" className="flex border-b border-line bg-paper">
              <button
                ref={signinTabRef}
                type="button"
                role="tab"
                id={`${tabBaseId}-signin-tab`}
                aria-selected={mode === 'signin'}
                aria-controls={`${tabBaseId}-panel`}
                tabIndex={mode === 'signin' ? 0 : -1}
                onClick={() => selectMode('signin')}
                onKeyDown={handleTabKeyDown}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  mode === 'signin' ? 'bg-surface text-primary-800' : 'text-ink-muted hover:text-ink'
                }`}
              >
                Sign in
              </button>
              <button
                ref={registerTabRef}
                type="button"
                role="tab"
                id={`${tabBaseId}-register-tab`}
                aria-selected={mode === 'register'}
                aria-controls={`${tabBaseId}-panel`}
                tabIndex={mode === 'register' ? 0 : -1}
                onClick={() => selectMode('register')}
                onKeyDown={handleTabKeyDown}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  mode === 'register' ? 'bg-surface text-primary-800' : 'text-ink-muted hover:text-ink'
                }`}
              >
                Create account
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-5 sm:p-6"
              role="tabpanel"
              id={`${tabBaseId}-panel`}
              aria-labelledby={`${tabBaseId}-${mode === 'signin' ? 'signin' : 'register'}-tab`}
              noValidate
            >
              {formError ? (
                <Alert tone="crisis" className="mb-4">
                  {formError}
                </Alert>
              ) : null}

              {mode === 'register' ? (
                <Input
                  label="Display name (optional)"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="nickname"
                  maxLength={40}
                  error={fieldErrors.displayName}
                  hint="Optional. Your public posts still use your anonymous alias."
                />
              ) : null}

              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                error={fieldErrors.email}
                required
                disabled={submitting}
              />

              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                error={fieldErrors.password}
                hint={mode === 'register' ? `At least ${PASSWORD_MIN} characters.` : undefined}
                required
                disabled={submitting}
              />

              <Button type="submit" className="mt-2 w-full" loading={submitting} disabled={submitting}>
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>

              <p className="mt-4 text-center text-xs text-ink-muted">
                By continuing you agree to the{' '}
                <Link to="/guidelines" className="link">
                  community guidelines
                </Link>
                .
              </p>
            </form>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <Link to="/community" className="link-quiet inline-flex items-center gap-1.5">
              <Icon name="arrow-left" className="h-4 w-4" />
              Continue anonymously
            </Link>
            <Link to="/crisis" className="text-crisis-700 hover:text-crisis-800">
              Need help now?
            </Link>
          </div>
        </div>

        <aside className="space-y-5" aria-label="About accounts">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-serif text-lg text-ink">
              <Icon name="shield" className="h-4 w-4 text-primary-700" />
              Why an account is optional
            </h2>
            <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-ink-muted">
              <li>Anonymous sessions already let you post, reply, chat and report.</li>
              <li>Accounts exist mostly so moderators can act on reports.</li>
              <li>Your email is never shown to other people, and posts still use your alias.</li>
              <li>You can delete your account and content at any time.</li>
            </ul>
            <Link to="/preferences" className="link mt-3 inline-block text-sm">
              Review your data controls
            </Link>
          </div>
          <p className="px-1 text-xs leading-relaxed text-ink-muted">{PEER_SUPPORT_DISCLAIMER}</p>
        </aside>
      </div>
    </div>
  );
}
