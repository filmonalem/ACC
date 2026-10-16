'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, Search } from 'lucide-react';

import { ApiError, staffApi } from '@/lib/api/client';
import {
  Alert,
  EmptyState,
  StatusPill,
  UrgencyPill,
} from '@/components/ui/primitives';

/**
 * The staff report queue.
 *
 * Two behaviours worth calling out:
 *
 *  - **It never fabricates rows.** Every figure on screen is whatever the
 *    authorized endpoint returned for this person. An officer without the
 *    broad permission sees a genuinely empty queue, not a filtered one — the
 *    difference matters, because a filtered list implies there is something
 *    hidden from them.
 *  - **A 401 sends you back to sign-in rather than showing an empty table.**
 *    An expired session that renders as "no reports" looks exactly like a
 *    quiet day, and someone would stop checking.
 */
export function ReportQueue({ dict, initialFilters = {} }) {
  const router = useRouter();

  const [filters, setFilters] = useState({
    search: '',
    status: '',
    urgency: '',
    assignedToMe: false,
    unassigned: false,
    ...initialFilters,
  });

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const query = useMemo(() => {
    const params = {};
    if (filters.search) params.search = filters.search;
    if (filters.status) params.status = filters.status;
    if (filters.urgency) params.urgency = filters.urgency;
    if (filters.assignedToMe) params.assignedToMe = 'true';
    if (filters.unassigned) params.unassigned = 'true';
    return params;
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await staffApi.listReports(query);
      setPayload(data);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.push('/en/staff/login');
        return;
      }
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [query, router]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = payload?.data ?? [];
  const meta = payload?.meta;

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="q-search" className="field-label">
              {dict.staff.filterReference}
            </label>
            <input
              id="q-search"
              type="search"
              value={filters.search}
              onChange={(event) => setFilters((f) => ({ ...f, search: event.target.value }))}
              placeholder="ACC-…"
              dir="ltr"
              spellCheck={false}
              className="input font-mono"
            />
          </div>

          <div>
            <label htmlFor="q-status" className="field-label">
              {dict.staff.filterStatus}
            </label>
            <select
              id="q-status"
              value={filters.status}
              onChange={(event) => setFilters((f) => ({ ...f, status: event.target.value }))}
              className="select"
            >
              <option value="">{dict.staff.filterAll}</option>
              {[
                'SUBMITTED',
                'UNDER_REVIEW',
                'VERIFIED',
                'ASSIGNED',
                'IN_PROGRESS',
                'RESOLVED',
                'CLOSED',
                'REJECTED',
                'DUPLICATE',
              ].map((status) => (
                <option key={status} value={status}>
                  {dict.reportStatus[status] ?? status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="q-urgency" className="field-label">
              {dict.staff.filterUrgency}
            </label>
            <select
              id="q-urgency"
              value={filters.urgency}
              onChange={(event) => setFilters((f) => ({ ...f, urgency: event.target.value }))}
              className="select"
            >
              <option value="">{dict.staff.filterAll}</option>
              {['LOW', 'NORMAL', 'HIGH', 'CRITICAL'].map((urgency) => (
                <option key={urgency} value={urgency}>
                  {dict.reportStatus[`urgency${urgency}`] ?? urgency}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button type="button" onClick={load} className="btn btn-secondary btn-md w-full">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {dict.common.retry}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={filters.assignedToMe}
              onChange={(event) =>
                setFilters((f) => ({ ...f, assignedToMe: event.target.checked }))
              }
              className="h-4 w-4 rounded border-border-strong text-brand-700 focus:ring-brand-500"
            />
            <span className="text-sm text-ink">{dict.staff.filterAssigned}</span>
          </label>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={filters.unassigned}
              onChange={(event) => setFilters((f) => ({ ...f, unassigned: event.target.checked }))}
              className="h-4 w-4 rounded border-border-strong text-brand-700 focus:ring-brand-500"
            />
            <span className="text-sm text-ink">{dict.staff.filterUnassigned}</span>
          </label>
        </div>
      </div>

      {error && <Alert tone="danger">{error.message}</Alert>}

      {loading ? (
        <div className="card p-10 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-600" />
          <p className="mt-3 text-sm text-ink-muted">{dict.staff.queueLoading}</p>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Search} title={dict.staff.queueEmpty} />
      ) : (
        <>
          <p className="text-sm text-ink-muted" aria-live="polite">
            {dict.common.showingResults}: {meta?.total ?? rows.length}
          </p>

          {/* Cards rather than a table. On a phone a table forces horizontal
              scrolling to read a reference code; on a desktop the card grid is
              still easier to scan than five cramped columns. */}
          <ul className="grid gap-3 md:grid-cols-2">
            {rows.map((report) => (
              <li key={report.id}>
                <a href={`/en/staff/reports/${report.id}`} className="card card-interactive block p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-sm font-bold tracking-wide text-ink" dir="ltr">
                      {report.referenceCode}
                    </span>
                    <StatusPill
                      status={report.status}
                      label={dict.reportStatus[report.status] ?? report.status}
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <UrgencyPill
                      urgency={report.urgency}
                      label={dict.reportStatus[`urgency${report.urgency}`] ?? report.urgency}
                    />
                    {report.categoryKey && (
                      <span className="pill pill-neutral">{report.categoryKey}</span>
                    )}
                  </div>

                  <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{report.description}</p>

                  <p className="mt-2 text-xs text-ink-subtle">
                    {dict.staff.columnSubmitted}:{' '}
                    {new Date(report.submittedAt).toLocaleString('en', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}