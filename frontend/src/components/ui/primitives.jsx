import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';

/**
 * Shared presentational primitives.
 *
 * Small enough not to warrant a component library. The point of having them
 * here rather than inline in each page is that a status pill looks and behaves
 * the same everywhere — including, critically, that status is never conveyed by
 * colour alone. Every pill renders an icon *and* a text label, because roughly
 * one in twelve men has a colour vision deficiency and a coloured dot tells
 * them nothing at all.
 */

/** Report status → visual treatment. */
const STATUS_TONES = {
  SUBMITTED: { pill: 'pill-neutral', icon: ClockIcon },
  UNDER_REVIEW: { pill: 'pill-info', icon: EyeIcon },
  VERIFIED: { pill: 'pill-info', icon: CheckCircle2 },
  ASSIGNED: { pill: 'pill-brand', icon: UserCheckIcon },
  IN_PROGRESS: { pill: 'pill-warning', icon: LoaderIcon },
  RESOLVED: { pill: 'pill-success', icon: CheckCircle2 },
  CLOSED: { pill: 'pill-neutral', icon: LockIcon },
  REJECTED: { pill: 'pill-danger', icon: XCircleIcon },
  DUPLICATE: { pill: 'pill-neutral', icon: CopyIcon },
};

/** Urgency → visual treatment. Escalating urgency is what makes this red. */
const URGENCY_TONES = {
  LOW: { pill: 'pill-neutral' },
  NORMAL: { pill: 'pill-neutral' },
  HIGH: { pill: 'pill-warning' },
  CRITICAL: { pill: 'pill-danger', icon: TriangleAlert },
};

export function StatusPill({ status, label, className = '' }) {
  const tone = STATUS_TONES[status] ?? STATUS_TONES.SUBMITTED;
  const Icon = tone.icon ?? ClockIcon;

  return (
    <span className={`pill ${tone.pill} ${className}`}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {label ?? status}
    </span>
  );
}

export function UrgencyPill({ urgency, label, className = '' }) {
  const tone = URGENCY_TONES[urgency] ?? URGENCY_TONES.NORMAL;
  const Icon = tone.icon;

  return (
    <span className={`pill ${tone.pill} ${className}`}>
      {Icon && <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
      {label ?? urgency}
    </span>
  );
}

/**
 * An inline alert.
 *
 * `role="alert"` on the error variant so a screen reader announces a validation
 * failure the moment it appears. The other variants are `role="status"` or
 * plain, because interrupting a reader to announce information they did not ask
 * for is its own accessibility problem.
 */
export function Alert({ tone = 'info', title, children, className = '', role }) {
  const icons = {
    info: Info,
    success: CheckCircle2,
    warning: TriangleAlert,
    danger: AlertCircle,
  };

  const Icon = icons[tone] ?? Info;
  const resolvedRole = role ?? (tone === 'danger' ? 'alert' : undefined);

  return (
    <div className={`alert alert-${tone} ${className}`} role={resolvedRole}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={title ? 'mt-1' : undefined}>{children}</div>}
      </div>
    </div>
  );
}

/**
 * Empty state.
 *
 * Always gives the reader something to do next. An empty state that only says
 * "nothing here" is a dead end — on a public site, that is where people leave.
 */
export function EmptyState({ icon: Icon = Info, title, body, action = null }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken text-ink-subtle">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-bold text-ink">{title}</h3>
      {body && <p className="mt-1.5 max-w-md text-sm text-ink-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** A page heading with an optional lede and back link. */
export function PageHeader({ title, lede, backHref, backLabel, children }) {
  return (
    <div className="border-b border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {backHref && (
          <a
            href={backHref}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </a>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
            {lede && <p className="mt-2 text-base leading-relaxed text-ink-muted">{lede}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Section container with consistent rhythm. */
export function Container({ children, className = '', size = 'default' }) {
  const widths = {
    narrow: 'max-w-2xl',
    default: 'max-w-4xl',
    wide: 'max-w-6xl',
  };

  return (
    <div className={`mx-auto ${widths[size]} px-4 sm:px-6 ${className}`}>{children}</div>
  );
}

/**
 * A labelled form field.
 *
 * Optional fields say so **in words** rather than relying on the absence of an
 * asterisk. An asterisk is a convention learned once and read differently by
 * different people; the word is unambiguous in every language.
 *
 * `error` is rendered with `role="alert"` so a validation failure is announced,
 * not merely coloured — colour alone is invisible to a screen reader and to
 * roughly one in twelve men.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  optionalLabel = '',
  children,
  className = '',
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="field-label">
        {label}
        {required ? (
          <span className="ml-1 text-danger-700" aria-hidden="true">
            *
          </span>
        ) : (
          optionalLabel && (
            <span className="ml-1.5 text-xs font-normal text-ink-subtle">
              ({optionalLabel})
            </span>
          )
        )}
      </label>

      {children}

      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="field-hint">
          {hint}
        </p>
      )}

      {error && (
        <p id={`${htmlFor}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ── Internal icons ─────────────────────────────────────────────────────────
// Kept local so this module has no dependency on the icon set used elsewhere.

function ClockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function EyeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function UserCheckIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="m16 11 2 2 4-4" />
    </svg>
  );
}

function LoaderIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 2v4M12 18v4M4.9 4.9l2.9 2.9M16.2 16.2l2.9 2.9M2 12h4M18 12h4M4.9 19.1l2.9-2.9M16.2 7.8l2.9-2.9" />
    </svg>
  );
}

function LockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function XCircleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  );
}

function CopyIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect width="14" height="14" x="8" y="8" rx="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function ArrowLeftIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="m12 19-7-7 7-7M19 12H5" />
    </svg>
  );
}