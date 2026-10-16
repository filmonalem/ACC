'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, LogIn, ShieldCheck } from 'lucide-react';

import { ApiError, staffApi } from '@/lib/api/client';
import { Alert, Field } from '@/components/ui/primitives';

/**
 * Staff sign-in, including the MFA enrolment flow.
 *
 * MFA is **mandatory** for privileged roles, and that creates a two-part
 * journey: the first sign-in for a supervisor returns a session that grants
 * nothing except the right to set up a second factor. This component therefore
 * handles three states rather than treating enrolment as an edge case — which
 * is what made the original enrolment deadlock easy to miss.
 *
 * The enrolment secret is shown once, as text as well as an implied QR code,
 * because the person setting this up may be on a desktop without a phone
 * scanner to hand and needs to type it in by hand.
 */
export function StaffLogin({ dict }) {
  const router = useRouter();

  const [step, setStep] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [secret, setSecret] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  async function onCredentials(event) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await staffApi.login(email, password);

      if (response.user?.scope === 'enrolment') {
        // Not an error: this is the expected first sign-in for a privileged
        // account. Move to enrolment rather than showing a failure.
        setStep('mfa-setup');
        return;
      }

      router.push('/en/staff/reports');
    } catch (caught) {
      setError(describe(caught, dict));
    } finally {
      setPending(false);
    }
  }

  async function onBeginMfa() {
    setPending(true);
    setError(null);

    try {
      const response = await staffApi.beginMfa();
      setSecret(response.secret);
      setStep('mfa-confirm');
    } catch (caught) {
      setError(describe(caught, dict));
    } finally {
      setPending(false);
    }
  }

  async function onConfirmMfa(event) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      await staffApi.confirmMfa(mfaCode.trim(), secret);
      setStep('mfa-done');
    } catch (caught) {
      setError(describe(caught, dict));
    } finally {
      setPending(false);
    }
  }

  if (step === 'mfa-done') {
    return (
      <div className="card border-success-100 bg-success-50 p-6 text-center">
        <span
          aria-hidden="true"
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-600 text-white"
        >
          <ShieldCheck className="h-6 w-6" />
        </span>
        <p className="mt-4 text-sm font-semibold text-success-700">{dict.staff.mfaEnrolled}</p>
        <p className="mt-1 text-sm text-success-700">{dict.staff.mfaRequiredBody}</p>
        <button
          type="button"
          onClick={() => onCredentials(new Event('submit'))}
          className="btn btn-primary btn-md mt-5"
        >
          <LogIn className="h-4 w-4" />
          {dict.staff.signIn}
        </button>
      </div>
    );
  }

  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-xl font-bold text-ink">{dict.staff.title}</h1>
      <p className="mt-1 text-sm text-ink-muted">{dict.staff.intro}</p>

      {error && (
        <Alert tone="danger" className="mt-5">
          {error.message}
          {error.requestId && (
            <span className="mt-1 block font-mono text-xs opacity-75" dir="ltr">
              {error.requestId.slice(0, 8)}
            </span>
          )}
        </Alert>
      )}

      {step === 'credentials' && (
        <form onSubmit={onCredentials} noValidate className="mt-6 space-y-4">
          <Field label={dict.staff.emailLabel} htmlFor="staff-email" required>
            <input
              id="staff-email"
              type="email"
              dir="ltr"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input"
            />
          </Field>

          <Field label={dict.staff.passwordLabel} htmlFor="staff-password" required>
            <input
              id="staff-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input"
            />
          </Field>

          <button type="submit" disabled={pending} className="btn btn-primary btn-md w-full">
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {dict.staff.signingIn}
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                {dict.staff.signIn}
              </>
            )}
          </button>
        </form>
      )}

      {step === 'mfa-setup' && (
        <div className="mt-6">
          <Alert tone="warning" title={dict.staff.mfaRequiredTitle}>
            {dict.staff.mfaRequiredBody}
          </Alert>
          <button type="button" onClick={onBeginMfa} disabled={pending} className="btn btn-primary btn-md mt-5 w-full">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {dict.staff.mfaBegin}
          </button>
        </div>
      )}

      {step === 'mfa-confirm' && secret && (
        <form onSubmit={onConfirmMfa} noValidate className="mt-6 space-y-4">
          <div className="rounded-card border border-border bg-surface-sunken p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              {dict.staff.mfaCodeLabel}
            </p>
            {/* Shown once. The person setting this up may be entering it on a
                second device by hand. */}
            <p className="mt-2 select-all break-all font-mono text-sm font-bold text-ink" dir="ltr">
              {secret}
            </p>
          </div>

          <Field label={dict.staff.mfaCodeLabel} htmlFor="mfa-code" required>
            <input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              dir="ltr"
              required
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ''))}
              className="input text-center font-mono text-lg tracking-[0.3em]"
            />
          </Field>

          <button
            type="submit"
            disabled={pending || mfaCode.length !== 6}
            className="btn btn-primary btn-md w-full"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {dict.staff.mfaConfirm}
          </button>
        </form>
      )}
    </div>
  );
}

/** Turns a failed sign-in into wording a person can act on. */
function describe(error, dict) {
  if (!(error instanceof ApiError)) {
    return new ApiError(dict.staff.signInFailed);
  }

  switch (error.code) {
    case 'rate_limited':
      return new ApiError(dict.staff.rateLimited, { requestId: error.requestId });
    case 'account_locked':
      return new ApiError(dict.staff.locked, { requestId: error.requestId });
    case 'mfa_code_required':
    case 'mfa_enrollment_required':
      return new ApiError(dict.staff.mfaRequired, { requestId: error.requestId });
    default:
      // Deliberately does not surface "no such user" separately from "wrong
      // password": that distinction tells an attacker which addresses exist.
      return new ApiError(dict.staff.signInFailed, { requestId: error.requestId });
  }
}