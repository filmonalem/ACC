'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Search } from 'lucide-react';

import { ApiError, lookupReportStatus } from '@/lib/api/client';
import { Alert, Field, StatusPill } from '@/components/ui/primitives';

/**
 * Report status lookup.
 *
 * Requires **both** the reference code and the private token; either alone
 * reveals nothing. The form is deliberately boring and says so — a resident
 * chasing an old report should not have to think about which of two codes goes
 * where.
 *
 * On arrival from the submission confirmation the reference code is pre-filled
 * from the query string. The private code never is: it is shown once and never
 * placed in a URL, because URLs end up in browser history, proxy logs and
 * screenshots, and this value is the only thing granting access to the report.
 */
export function StatusLookupForm({ locale, dict }) {
  const searchParams = useSearchParams();
  const [reference, setReference] = useState(searchParams.get('reference') ?? '');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await lookupReportStatus(reference.trim(), token.trim(), locale);
      setResult(data);
    } catch (caught) {
      if (caught instanceof ApiError) setError(caught);
      else setError(new ApiError(dict.common.somethingWentWrong, { code: 'unknown' }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="card p-5 sm:p-6" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={dict.status.referenceLabel} htmlFor="reference" required hint={dict.status.referenceHelp}>
            <input
              id="reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              required
              autoComplete="off"
              spellCheck={false}
              dir="ltr"
              placeholder="ACC-7F3K9Q2M"
              className="input font-mono uppercase tracking-wider"
            />
          </Field>

          <Field label={dict.status.tokenLabel} htmlFor="statusToken" required hint={dict.status.tokenHelp}>
            <input
              id="statusToken"
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              required
              autoComplete="off"
              spellCheck={false}
              dir="ltr"
              className="input font-mono"
            />
          </Field>
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary btn-md mt-5 w-full sm:w-auto">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {dict.common.loading}
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              {dict.status.submitButton}
            </>
          )}
        </button>
      </form>

      {/* Both failure shapes are distinguished. "Wrong code" and "we could not
          reach the server" need different actions from the reader. */}
      {error && (
        <Alert tone="warning" title={error.code === 'report_not_found' ? dict.status.notFoundTitle : dict.common.somethingWentWrong}>
          <p>
            {error.code === 'report_not_found' ? dict.status.notFoundBody : error.message}
          </p>
          {error.requestId && (
            <p className="mt-2 font-mono text-xs opacity-80">
              {dict.common.page}: <span dir="ltr">{error.requestId.slice(0, 8)}</span>
            </p>
          )}
        </Alert>
      )}

      {result && <StatusResult locale={locale} dict={dict} result={result} />}
    </div>
  );
}

function StatusResult({ locale, dict, result }) {
  const formatDate = (value) =>
    value
      ? new Date(value).toLocaleString(locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : dict.status.resultNotYet;

  return (
    <section className="card p-5 sm:p-6" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            {dict.status.resultTitle}
          </p>
          <p className="mt-0.5 font-mono text-lg font-bold tracking-wider text-ink" dir="ltr">
            {result.referenceCode}
          </p>
        </div>
        <StatusPill
          status={result.status}
          label={dict.reportStatus[result.status] ?? result.status}
        />
      </div>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            {dict.status.resultCategory}
          </dt>
          <dd className="mt-0.5 text-sm text-ink">{result.categoryLabel ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            {dict.status.resultUrgency}
          </dt>
          <dd className="mt-0.5 text-sm text-ink">
            {dict.reportStatus[`urgency${result.urgency}`] ?? result.urgency}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            {dict.status.resultSubmitted}
          </dt>
          <dd className="mt-0.5 text-sm text-ink">{formatDate(result.submittedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            {dict.status.resultFirstReviewed}
          </dt>
          <dd className="mt-0.5 text-sm text-ink">{formatDate(result.firstReviewedAt)}</dd>
        </div>
        {result.resolvedAt && (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              {dict.status.resultResolved}
            </dt>
            <dd className="mt-0.5 text-sm text-ink">{formatDate(result.resolvedAt)}</dd>
          </div>
        )}
      </dl>

      {/*
        The explanation of what is happening to their report.

        When the server reports `translationPending`, the text below is English
        even though the reader chose Tigrinya or Amharic. That is stated plainly
        rather than left for them to notice: someone who cannot tell whether
        their report was accepted will reasonably submit it again.
      */}
      <div className="mt-5 rounded-card bg-brand-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-700">
          {dict.status.resultMessage}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-brand-900">{result.publicMessage}</p>

        {result.translationPending && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-warning-100 px-2.5 py-1 text-xs font-semibold text-warning-700">
            {dict.updates.translationPending}
          </p>
        )}
      </div>

      <p className="mt-4 text-xs text-ink-muted">
        {dict.common.lastUpdated}: {formatDate(result.updatedAt)}
      </p>
    </section>
  );
}