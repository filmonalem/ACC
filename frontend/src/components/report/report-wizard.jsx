'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, Check, Loader2, Send } from 'lucide-react';

import { ApiError, newIdempotencyKey, submitReport } from '@/lib/api/client';
import { Alert, Field } from '@/components/ui/primitives';

/**
 * The multi-step report form.
 *
 * Design decisions that are not obvious from the code:
 *
 *  - **One form, several steps.** React Hook Form holds a single set of values
 *    for the whole wizard, so going back never loses what someone typed, and
 *    there is one submission path rather than five partial ones.
 *  - **The idempotency key is generated once, on mount, and reused for the life
 *    of the draft.** That is what makes a retry safe: the server returns the
 *    original report instead of creating a second. Generating a key per submit
 *    would defeat the entire mechanism.
 *  - **Validation runs per step, not only at the end.** Someone who has
 *    written four paragraphs should not discover on the last screen that the
 *    category was missing.
 *  - **"Pending sync" is a distinct state from "submitted".** When the request
 *    fails to reach the server the wizard says exactly that, and never implies
 *    the report was received.
 *  - **No file attachment.** A resident on a phone uploading a photo on a
 *    metered connection is the most likely way this form breaks. The pilot
 *    therefore omits it rather than shipping a field that silently fails — see
 *    docs/03-milestones.md.
 */

const STEPS = ['category', 'description', 'context', 'contact', 'review'];

/** Builds a schema whose messages come from the active dictionary. */
function buildSchema(dict, { categoryKeys }) {
  return z.object({
    categoryKey: categoryKeys.length
      ? z.string().min(1, dict.validation.categoryRequired)
      : z.string().min(1, dict.validation.categoryRequired),

    description: z
      .string()
      .min(20, dict.validation.descriptionTooShort)
      .max(5000, dict.validation.descriptionTooLong),

    incidentDate: z.string().optional(),
    incidentTime: z.string().optional(),
    timePrecision: z.enum(['EXACT', 'DATE_ONLY', 'APPROXIMATE', 'UNKNOWN']).optional(),

    subCityName: z.string().max(120).optional().or(z.literal('')),
    woredaName: z.string().max(120).optional().or(z.literal('')),
    kebeleName: z.string().max(120).optional().or(z.literal('')),
    landmarkDescription: z
      .string()
      .max(500, dict.validation.landmarkTooLong)
      .optional()
      .or(z.literal('')),

    reporterName: z.string().max(120, dict.validation.nameTooLong).optional().or(z.literal('')),
    reporterPhone: z
      .string()
      .regex(/^(\+?251)?0?9\d{8}$/, dict.validation.phoneInvalid)
      .optional()
      .or(z.literal('')),
    reporterEmail: z.string().email(dict.validation.emailInvalid).optional().or(z.literal('')),
    preferredContactMethod: z.enum(['PHONE', 'SMS', 'EMAIL', 'NONE']).optional(),

    reporterConsentGiven: z.literal(true, {
      errorMap: () => ({ message: dict.validation.consentRequired }),
    }),
  });
}

export function ReportWizard({ locale, dict, categories, privacyHref }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [serverError, setServerError] = useState(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);

  /*
   * Generated once per wizard instance, in `useState`'s initialiser rather than
   * on every render — a fresh key per render would make retries produce
   * duplicates, which is the exact failure idempotency exists to prevent.
   */
  const [idempotencyKey] = useState(() => newIdempotencyKey());

  const categoryKeys = useMemo(
    () => (Array.isArray(categories) ? categories.map((category) => category.key) : []),
    [categories],
  );

  const schema = useMemo(() => buildSchema(dict, { categoryKeys }), [dict, categoryKeys]);

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    // Everything is touched only when a field is left, not on every keystroke:
    // validating a half-written description on each character is hostile.
    defaultValues: {
      categoryKey: '',
      description: '',
      timePrecision: 'UNKNOWN',
      subCityName: 'Adigrat',
      reporterConsentGiven: false,
      preferredContactMethod: 'PHONE',
    },
  });

  const values = watch();

  /** Which fields belong to which step, so each step validates only its own. */
  const STEP_FIELDS = {
    category: ['categoryKey'],
    description: ['description'],
    context: [
      'incidentDate',
      'incidentTime',
      'timePrecision',
      'subCityName',
      'woredaName',
      'kebeleName',
      'landmarkDescription',
    ],
    contact: ['reporterName', 'reporterPhone', 'reporterEmail', 'preferredContactMethod'],
    review: ['reporterConsentGiven'],
  };

  const step = STEPS[stepIndex];

  /**
   * A step may only advance once its own fields pass.
   *
   * `trigger` returns whether validation succeeded rather than throwing, so a
   * failed step simply does not move — and the error is already rendered beside
   * the field that caused it.
   */
  const goNext = useCallback(async () => {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) setStepIndex((index) => Math.min(index + 1, STEPS.length - 1));
  }, [step, trigger]);

  const goBack = useCallback(() => {
    setServerError(null);
    setStepIndex((index) => Math.max(index - 1, 0));
  }, []);

  async function onSubmit(data) {
    setPending(true);
    setServerError(null);

    try {
      const payload = {
        categoryKey: data.categoryKey,
        description: data.description.trim(),
        language: locale,
        reporterConsentGiven: true,
        ...(data.incidentDate ? { incidentOccurredAt: new Date(data.incidentDate).toISOString() } : {}),
        ...(data.incidentTime && data.timePrecision
          ? { incidentTimePrecision: data.timePrecision }
          : {}),
        ...(data.subCityName ? { subCityName: data.subCityName } : {}),
        ...(data.woredaName ? { woredaName: data.woredaName } : {}),
        ...(data.kebeleName ? { kebeleName: data.kebeleName } : {}),
        ...(data.landmarkDescription
          ? { landmarkDescription: data.landmarkDescription }
          : {}),
        ...(data.reporterName ? { reporterName: data.reporterName } : {}),
        ...(data.reporterPhone ? { reporterPhone: data.reporterPhone } : {}),
        ...(data.reporterEmail ? { reporterEmail: data.reporterEmail } : {}),
        ...(data.preferredContactMethod
          ? { preferredContactMethod: data.preferredContactMethod }
          : {}),
      };

      const response = await submitReport(payload, idempotencyKey);
      setResult(response);
    } catch (error) {
      if (error instanceof ApiError) {
        /*
         * Two distinct failure shapes, and they are reported differently on
         * purpose:
         *
         *  - A refusal from the server (validation, a disabled feature) is shown
         *    as an error against the form, because the reader can act on it.
         *  - A network failure or timeout means **nothing was received**. It says
         *    so, and does not claim the report was sent or that it is queued —
         *    this pilot keeps no local outbox, so the honest statement is that it
         *    is still here in the form and they should try again.
         */
        setServerError(
          error.isNetworkError || error.isRateLimited || error.code === 'request_timeout'
            ? { kind: 'unsent', message: error.message, code: error.code }
            : { kind: 'refused', message: error.message, code: error.code },
        );
      } else {
        setServerError({ kind: 'unsent', message: dict.report.errorBody, code: 'unknown' });
      }
    } finally {
      setPending(false);
    }
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (result) {
    return <ReportSuccess locale={locale} dict={dict} result={result} />;
  }

  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  return (
    <div className="card overflow-hidden">
      {/* Progress. The bar is decorative; the text carries the real position,
          because a progress bar alone tells a screen reader nothing. */}
      <div className="border-b border-border bg-surface-sunken px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-ink">
            {dict.report.progressLabel
              .replace('{current}', String(stepIndex + 1))
              .replace('{total}', String(STEPS.length))}
          </p>
          <p className="text-xs font-medium text-ink-muted">{dict.nav[step] ?? dict.report.title}</p>
        </div>

        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuenow={stepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-label={dict.report.title}
        >
          <div
            className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-4 py-6 sm:px-6">
        {/* ── Step 1: category ─────────────────────────────────────────── */}
        {step === 'category' && (
          <fieldset>
            <legend className="text-lg font-bold text-ink">
              {dict.report.stepCategoryTitle}
            </legend>
            <p className="mt-1 text-sm text-ink-muted">{dict.report.stepCategoryHelp}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(categories ?? []).map((category) => {
                const selected = values.categoryKey === category.key;

                return (
                  <label
                    key={category.key}
                    className={[
                      'relative flex cursor-pointer items-start gap-3 rounded-card border-2 p-4 transition-colors',
                      selected
                        ? 'border-brand-600 bg-brand-50'
                        : 'border-border bg-surface hover:border-brand-300 hover:bg-brand-50/40',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      value={category.key}
                      {...register('categoryKey')}
                      className="sr-only"
                    />

                    <span
                      aria-hidden="true"
                      className={[
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                        selected ? 'border-brand-600 bg-brand-600' : 'border-border-strong',
                      ].join(' ')}
                    >
                      {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </span>

                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-ink">{category.label}</span>
                      {category.description && (
                        <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                          {category.description}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>

            {errors.categoryKey && (
              <p className="field-error mt-3" role="alert">
                {errors.categoryKey.message}
              </p>
            )}
          </fieldset>
        )}

        {/* ── Step 2: description ──────────────────────────────────────── */}
        {step === 'description' && (
          <fieldset>
            <legend className="text-lg font-bold text-ink">
              {dict.report.stepDescriptionTitle}
            </legend>
            <p className="mt-1 text-sm text-ink-muted">{dict.report.stepDescriptionHelp}</p>

            <Field
              label={dict.report.descriptionLabel}
              htmlFor="description"
              required
              error={errors.description?.message}
              hint={`${(values.description ?? '').length} / 5000`}
              className="mt-5"
            >
              <textarea
                id="description"
                rows={9}
                placeholder={dict.report.descriptionPlaceholder}
                aria-invalid={errors.description ? 'true' : undefined}
                aria-describedby={errors.description ? 'description-error' : 'description-hint'}
                {...register('description')}
                className="textarea resize-y font-normal"
              />
            </Field>
          </fieldset>
        )}

        {/* ── Step 3: context ──────────────────────────────────────────── */}
        {step === 'context' && (
          <fieldset>
            <legend className="text-lg font-bold text-ink">
              {dict.report.stepContextTitle}
            </legend>
            <p className="mt-1 text-sm text-ink-muted">{dict.report.stepContextHelp}</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field
                label={dict.report.incidentDateLabel}
                htmlFor="incidentDate"
                optionalLabel={dict.common.optional}
                error={errors.incidentDate?.message}
              >
                <input
                  id="incidentDate"
                  type="date"
                  {...register('incidentDate')}
                  className="input"
                />
              </Field>

              <Field
                label={dict.report.incidentTimeLabel}
                htmlFor="incidentTime"
                optionalLabel={dict.common.optional}
              >
                <input
                  id="incidentTime"
                  type="time"
                  {...register('incidentTime')}
                  className="input"
                />
              </Field>
            </div>

            {values.incidentDate && (
              <Field
                label={dict.report.timePrecisionLabel}
                htmlFor="timePrecision"
                className="mt-4"
                optionalLabel={dict.common.optional}
              >
                <select id="timePrecision" {...register('timePrecision')} className="select">
                  <option value="EXACT">{dict.report.timePrecisionExact}</option>
                  <option value="DATE_ONLY">{dict.report.timePrecisionDate}</option>
                  <option value="APPROXIMATE">{dict.report.timePrecisionApproximate}</option>
                  <option value="UNKNOWN">{dict.report.timePrecisionUnknown}</option>
                </select>
              </Field>
            )}

            <h3 className="mt-8 text-base font-bold text-ink">{dict.report.locationHeading}</h3>
            <p className="mt-1 text-sm text-ink-muted">{dict.report.locationHelp}</p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label={dict.report.subCityLabel}
                htmlFor="subCityName"
                optionalLabel={dict.common.optional}
              >
                <input id="subCityName" {...register('subCityName')} className="input" />
              </Field>

              <Field
                label={dict.report.woredaLabel}
                htmlFor="woredaName"
                optionalLabel={dict.common.optional}
              >
                <input id="woredaName" {...register('woredaName')} className="input" />
              </Field>

              <Field
                label={dict.report.kebeleLabel}
                htmlFor="kebeleName"
                optionalLabel={dict.common.optional}
                className="sm:col-span-2"
              >
                <input id="kebeleName" {...register('kebeleName')} className="input" />
              </Field>

              <Field
                label={dict.report.landmarkLabel}
                htmlFor="landmarkDescription"
                optionalLabel={dict.common.optional}
                hint={dict.report.locationHelp}
                error={errors.landmarkDescription?.message}
                className="sm:col-span-2"
              >
                <textarea
                  id="landmarkDescription"
                  rows={3}
                  placeholder={dict.report.landmarkPlaceholder}
                  {...register('landmarkDescription')}
                  className="textarea resize-y"
                />
              </Field>
            </div>
          </fieldset>
        )}

        {/* ── Step 4: contact ──────────────────────────────────────────── */}
        {step === 'contact' && (
          <fieldset>
            <legend className="text-lg font-bold text-ink">
              {dict.report.stepContactTitle}
            </legend>
            <p className="mt-1 text-sm text-ink-muted">{dict.report.stepContactHelp}</p>

            <div className="mt-5 space-y-4">
              <Field
                label={dict.report.contactNameLabel}
                htmlFor="reporterName"
                optionalLabel={dict.common.optional}
                error={errors.reporterName?.message}
              >
                <input
                  id="reporterName"
                  autoComplete="name"
                  {...register('reporterName')}
                  className="input"
                />
              </Field>

              <Field
                label={dict.report.contactPhoneLabel}
                htmlFor="reporterPhone"
                optionalLabel={dict.common.optional}
                hint={dict.report.contactPhoneHelp}
                error={errors.reporterPhone?.message}
              >
                <input
                  id="reporterPhone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  placeholder="0912345678"
                  aria-invalid={errors.reporterPhone ? 'true' : undefined}
                  {...register('reporterPhone')}
                  className="input"
                />
              </Field>

              <Field
                label={dict.report.contactEmailLabel}
                htmlFor="reporterEmail"
                optionalLabel={dict.common.optional}
                error={errors.reporterEmail?.message}
              >
                <input
                  id="reporterEmail"
                  type="email"
                  autoComplete="email"
                  dir="ltr"
                  aria-invalid={errors.reporterEmail ? 'true' : undefined}
                  {...register('reporterEmail')}
                  className="input"
                />
              </Field>

              <Field
                label={dict.report.contactMethodLabel}
                htmlFor="preferredContactMethod"
                optionalLabel={dict.common.optional}
              >
                <select
                  id="preferredContactMethod"
                  {...register('preferredContactMethod')}
                  className="select"
                >
                  <option value="PHONE">{dict.report.methodPhone}</option>
                  <option value="SMS">{dict.report.methodSms}</option>
                  <option value="EMAIL">{dict.report.methodEmail}</option>
                  <option value="NONE">{dict.report.methodNone}</option>
                </select>
              </Field>
            </div>
          </fieldset>
        )}

        {/* ── Step 5: review ──────────────────────────────────────────── */}
        {step === 'review' && (
          <fieldset>
            <legend className="text-lg font-bold text-ink">
              {dict.report.stepReviewTitle}
            </legend>
            <p className="mt-1 text-sm text-ink-muted">{dict.report.reviewHelp}</p>

            <dl className="mt-5 divide-y divide-border rounded-card border border-border">
              <ReviewRow label={dict.report.reviewCategory}>
                {categories?.find((c) => c.key === values.categoryKey)?.label ??
                  dict.report.reviewNotGiven}
              </ReviewRow>

              <ReviewRow label={dict.report.reviewDescription}>
                <p className="whitespace-pre-wrap">{values.description}</p>
              </ReviewRow>

              <ReviewRow label={dict.report.reviewContext}>
                {[
                  values.subCityName,
                  values.woredaName,
                  values.kebeleName,
                  values.landmarkDescription,
                  values.incidentDate,
                ]
                  .filter(Boolean)
                  .join(' · ') || dict.report.reviewNotGiven}
              </ReviewRow>

              <ReviewRow label={dict.report.reviewContact}>
                {[values.reporterName, values.reporterPhone, values.reporterEmail]
                  .filter(Boolean)
                  .join(' · ') || dict.report.reviewNotGiven}
              </ReviewRow>
            </dl>

            <div className="mt-5 rounded-card border border-border bg-surface-sunken p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  {...register('reporterConsentGiven')}
                  aria-invalid={errors.reporterConsentGiven ? 'true' : undefined}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-border-strong text-brand-700 focus:ring-brand-500"
                />
                <span className="text-sm text-ink">
                  {dict.report.consentLabel}{' '}
                  <a href={privacyHref} className="font-semibold text-brand-700 underline">
                    {dict.report.consentLink}
                  </a>
                </span>
              </label>
              {errors.reporterConsentGiven && (
                <p className="field-error mt-2" role="alert">
                  {errors.reporterConsentGiven.message}
                </p>
              )}
            </div>
          </fieldset>
        )}

        {/* ── Server-side failure ─────────────────────────────────────── */}
        {serverError && (
          <div className="mt-5">
            {serverError.kind === 'unsent' ? (
              <Alert tone="warning" title={dict.report.pendingTitle}>
                <p>{serverError.message}</p>
                <p className="mt-1">{dict.report.pendingBody}</p>
                {dict.report.pendingLeaveWarning && (
                  <p className="mt-1 text-xs">{dict.report.pendingLeaveWarning}</p>
                )}
              </Alert>
            ) : (
              <Alert tone="danger" title={dict.report.errorTitle}>
                {serverError.message}
              </Alert>
            )}
          </div>
        )}

        {/* ── Navigation ───────────────────────────────────────────────── */}
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={goBack}
              disabled={pending}
              className="btn btn-secondary btn-md"
            >
              <ArrowLeft className="h-4 w-4" />
              {dict.common.back}
            </button>
          ) : (
            <span />
          )}

          {step !== 'review' ? (
            <button type="button" onClick={goNext} className="btn btn-primary btn-md">
              {dict.common.next}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting || pending}
              className="btn btn-accent btn-lg"
            >
              {pending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {dict.common.loading}
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  {dict.report.submitButton}
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function ReviewRow({ label, children }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  );
}

/**
 * Confirmation.
 *
 * The two codes are shown large, with the private code hidden behind a
 * deliberate "I have written this down" gate. It is deliberately slightly
 * annoying: the token is stored only as a hash, so it genuinely cannot be shown
 * again, and a reader who scrolls past it without copying it has lost the ability
 * to check their own report. Being clear about that is better than a convenient
 * screen that quietly loses their access.
 */
function ReportSuccess({ locale, dict, result }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [tokenVisible, setTokenVisible] = useState(false);

  return (
    <div className="space-y-5">
      <div className="card border-success-100 bg-success-50 p-6 text-center sm:p-8">
        <span
          aria-hidden="true"
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-600 text-white"
        >
          <Check className="h-7 w-7" strokeWidth={3} />
        </span>

        <h2 className="mt-4 text-xl font-bold text-success-700">{dict.report.successTitle}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-success-700">{dict.report.successBody}</p>
      </div>

      <div className="card p-5 sm:p-6">
        <div className="rounded-card border-2 border-brand-200 bg-brand-50 p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-700">
            {dict.report.referenceLabel}
          </p>
          <p className="mt-1 select-all font-mono text-2xl font-bold tracking-wider text-brand-900 sm:text-3xl">
            {result.referenceCode}
          </p>
        </div>

        <div className="mt-4 rounded-card border-2 border-accent-200 bg-accent-50 p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-accent-700">
            {dict.report.tokenLabel}
          </p>

          {tokenVisible ? (
            <p className="mt-1 select-all break-all font-mono text-lg font-bold tracking-wide text-accent-900">
              {result.statusToken}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setTokenVisible(true)}
              className="mt-2 btn btn-accent btn-md"
            >
              {dict.report.tokenNotSaved}
            </button>
          )}

          <p className="mt-2 text-xs leading-relaxed text-accent-800">{dict.report.tokenHelp}</p>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-card bg-surface-sunken p-4">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-border-strong text-brand-700 focus:ring-brand-500"
          />
          <span className="text-sm font-medium text-ink">{dict.report.tokenSaved}</span>
        </label>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <a
            href={`/${locale}/status?reference=${result.referenceCode}`}
            className="btn btn-primary btn-md flex-1"
          >
            {dict.report.checkStatusCta}
          </a>
          <a href={`/${locale}/report`} className="btn btn-secondary btn-md">
            {dict.report.submitAnother}
          </a>
        </div>
      </div>

      <div className="card p-5 sm:p-6">
        <h3 className="text-base font-bold text-ink">{dict.report.successNextTitle}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{dict.report.successNextBody}</p>
      </div>
    </div>
  );
}