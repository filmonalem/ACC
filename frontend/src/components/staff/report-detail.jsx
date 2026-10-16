'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, Lock, MapPin, UserX } from 'lucide-react';

import { ApiError, staffApi } from '@/lib/api/client';
import { Alert, Field, StatusPill, UrgencyPill } from '@/components/ui/primitives';

/**
 * Report detail for staff.
 *
 * The reporter's identity arrives as `{ available: false, withheld: true }`
 * when the signed-in person lacks `reports.view_reporter_identity`. That is
 * rendered as an explicit explanation rather than an empty box, because a blank
 * field reads as "no name was given" — which is a different and wrong
 * conclusion about a report.
 */
export function ReportDetail({ reportId, dict }) {
  const router = useRouter();

  const [report, setReport] = useState(null);
  const [transitions, setTransitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [detail, available] = await Promise.all([
        staffApi.getReport(reportId),
        staffApi.availableTransitions(reportId).catch(() => ({ transitions: [] })),
      ]);

      setReport(detail);
      setTransitions(available?.transitions ?? []);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.push('/en/staff/login');
        return;
      }
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [reportId, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function onTransition(event) {
    event.preventDefault();
    if (!target) return;

    setPending(true);
    setError(null);

    try {
      await staffApi.updateStatus(reportId, target, reason);
      setReason('');
      setTarget('');
      await load();
    } catch (caught) {
      setError(caught);
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <div className="card p-10 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error && !report) {
    return (
      <Alert tone="danger" title={dict.staff.notAssignedToYou}>
        {error.message}
      </Alert>
    );
  }

  if (!report) return null;

  const reporter = report.reporter ?? { available: false, withheld: true };
  const location = report.location;

  return (
    <div className="space-y-5">
      {error && <Alert tone="danger">{error.message}</Alert>}

      {/* Header */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-lg font-bold tracking-wider text-ink" dir="ltr">
              {report.referenceCode}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {dict.staff.columnSubmitted}:{' '}
              {new Date(report.submittedAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusPill status={report.status} label={dict.reportStatus[report.status]} />
            <UrgencyPill
              urgency={report.urgency}
              label={dict.reportStatus[`urgency${report.urgency}`]}
            />
            <StatusPill
              status={report.verificationStatus === 'VERIFIED' ? 'RESOLVED' : 'SUBMITTED'}
              label={report.verificationStatus}
            />
          </div>
        </div>
      </div>

      {/* Urgency is never proof. Stated once, here, where the two are visible
          together, because a red HIGH badge next to an UNVERIFIED label is
          exactly the combination that gets misread as "confirmed serious". */}
      {report.urgency === 'HIGH' || report.urgency === 'CRITICAL' ? (
        <Alert tone="warning">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Urgency <em>is not verification</em>. A high-urgency report has not
              been confirmed; treat it as unverified until checked.
            </span>
          </span>
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* What was reported */}
          <section className="card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
              {dict.staff.detailDescription}
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {report.description}
            </p>
          </section>

          {/* Reporter */}
          <section className="card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
              {dict.staff.detailReporter}
            </h2>

            {reporter.available ? (
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-ink-muted">{dict.report.contactNameLabel}</dt>
                  <dd className="text-ink">{reporter.fullName ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{dict.report.contactPhoneLabel}</dt>
                  <dd className="text-ink" dir="ltr">
                    {reporter.phone ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{dict.report.contactEmailLabel}</dt>
                  <dd className="text-ink" dir="ltr">
                    {reporter.email ?? '—'}
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="mt-3 flex items-start gap-2 rounded-card bg-surface-sunken p-3">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-ink">
                    {dict.staff.detailReporterWithheld}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Reading a reporter&rsquo;s identity is a separate permission and
                    every such read is recorded in the audit trail.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Status history */}
          <section className="card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
              {dict.staff.detailHistory}
            </h2>
            <ol className="mt-3 space-y-3">
              {(report.statusHistory ?? []).map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400"
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-ink">
                      {entry.fromStatus ?? '—'} →{' '}
                      <strong>{dict.reportStatus[entry.toStatus] ?? entry.toStatus}</strong>
                    </p>
                    <p className="text-xs text-ink-muted">
                      {entry.changedByName} ·{' '}
                      {new Date(entry.createdAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                    {entry.reason && <p className="mt-0.5 text-xs text-ink-muted">{entry.reason}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {location && (
            <section className="card p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-muted">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {dict.staff.detailLocation}
              </h2>
              <p className="mt-2 text-sm text-ink">
                {[location.subCityName, location.woredaName, location.kebeleName, location.landmarkDescription]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </p>
              {location.preciseLocationWithheld && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  Precise coordinates are withheld.
                </p>
              )}
            </section>
          )}

          {/* Transition */}
          <section className="card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
              {dict.staff.transitionTitle}
            </h2>

            {transitions.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">
                No further changes are available to you from this status.
              </p>
            ) : (
              <form onSubmit={onTransition} className="mt-3 space-y-3">
                <Field label={dict.staff.transitionTitle} htmlFor="transition">
                  <select
                    id="transition"
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    className="select"
                  >
                    <option value="">—</option>
                    {transitions.map((rule) => (
                      <option key={rule.to} value={rule.to}>
                        {dict.reportStatus[rule.to] ?? rule.to}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label={dict.staff.transitionReason}
                  htmlFor="transition-reason"
                  // Required by the server on some edges; the form asks for it
                  // always, because an unexplained change is unreviewable later.
                  required
                >
                  <textarea
                    id="transition-reason"
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="textarea resize-y"
                  />
                </Field>

                <button
                  type="submit"
                  disabled={pending || !target}
                  className="btn btn-primary btn-md w-full"
                >
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {dict.staff.applyTransition}
                </button>
              </form>
            )}
          </section>

          {/* Internal notes */}
          <section className="card p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
              {dict.staff.detailNotes}
            </h2>

            {(report.notes ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">{dict.staff.noNotes}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {report.notes.map((note) => (
                  <li key={note.id} className="rounded-card bg-surface-sunken p-3">
                    <p className="whitespace-pre-wrap text-sm text-ink">{note.body}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {note.author?.fullName} ·{' '}
                      {new Date(note.createdAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}