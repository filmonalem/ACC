'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Loader2, Send } from 'lucide-react';

import { ApiError, submitPrivacyRequest } from '@/lib/api/client';
import { Alert, Field } from '@/components/ui/primitives';

/**
 * Personal data request form (access, correction, deletion).
 *
 * A data-subject request is one of the few things a resident must be able to do
 * without an account, so this posts to the public endpoint. The backend refuses
 * to fulfil a deletion without recorded identity verification, which is the
 * right design: a guessed reference code must not be able to erase a stranger's
 * report. This form asks for identifying details so that verification can
 * happen later, and says nothing about how long it will take beyond what the
 * server has committed to.
 */

function buildSchema(dict) {
  return z.object({
    requestType: z.enum(['ACCESS', 'CORRECTION', 'DELETION'], dict.validation.requestTypeRequired),
    details: z
      .string()
      .min(20, dict.validation.requestDetailsTooShort)
      .max(4000, dict.validation.requestDetailsTooShort),
    reportReferenceCode: z
      .string()
      .regex(/^ACC-[0-9A-HJKMNP-TV-Z]{8}$/, dict.validation.referenceInvalid)
      .optional()
      .or(z.literal('')),
    requesterName: z.string().max(120).optional().or(z.literal('')),
    requesterEmail: z.string().email(dict.validation.emailInvalid).optional().or(z.literal('')),
    requesterPhone: z
      .string()
      .regex(/^(\+?251)?0?9\d{8}$/, dict.validation.phoneInvalid)
      .optional()
      .or(z.literal('')),
  });
}

export function PrivacyRequestForm({ dict }) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(buildSchema(dict)),
    mode: 'onBlur',
    defaultValues: { requestType: 'ACCESS', details: '' },
  });

  async function onSubmit(data) {
    setPending(true);
    setError(null);

    try {
      await submitPrivacyRequest({
        ...data,
        reportReferenceCode: data.reportReferenceCode || undefined,
        requesterName: data.requesterName || undefined,
        requesterEmail: data.requesterEmail || undefined,
        requesterPhone: data.requesterPhone || undefined,
      });

      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(dict.common.somethingWentWrong));
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <div className="card border-success-100 bg-success-50 p-6 text-center" role="status">
        <span
          aria-hidden="true"
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-600 text-white"
        >
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <p className="mt-4 text-sm leading-relaxed text-success-700">{dict.privacy.requestSuccess}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="card p-5 sm:p-6">
      <Field label={dict.privacy.requestTypeLabel} htmlFor="requestType" required>
        <select id="requestType" {...register('requestType')} className="select">
          <option value="ACCESS">{dict.privacy.requestTypeAccess}</option>
          <option value="CORRECTION">{dict.privacy.requestTypeCorrection}</option>
          <option value="DELETION">{dict.privacy.requestTypeDeletion}</option>
        </select>
      </Field>

      <Field
        label={dict.privacy.requestDetailsLabel}
        htmlFor="details"
        required
        hint={dict.privacy.requestDetailsHelp}
        error={errors.details?.message}
        className="mt-5"
      >
        <textarea
          id="details"
          rows={5}
          aria-invalid={errors.details ? 'true' : undefined}
          {...register('details')}
          className="textarea resize-y"
        />
      </Field>

      <Field
        label={dict.privacy.requestReferenceLabel}
        htmlFor="reportReferenceCode"
        optionalLabel={dict.common.optional}
        hint={dict.privacy.requestReferenceHelp}
        error={errors.reportReferenceCode?.message}
        className="mt-5"
      >
        <input
          id="reportReferenceCode"
          dir="ltr"
          spellCheck={false}
          placeholder="ACC-7F3K9Q2M"
          {...register('reportReferenceCode')}
          className="input font-mono uppercase tracking-wider"
        />
      </Field>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Field
          label={dict.privacy.requestNameLabel}
          htmlFor="requesterName"
          optionalLabel={dict.common.optional}
        >
          <input id="requesterName" autoComplete="name" {...register('requesterName')} className="input" />
        </Field>

        <Field
          label={dict.privacy.requestEmailLabel}
          htmlFor="requesterEmail"
          optionalLabel={dict.common.optional}
          error={errors.requesterEmail?.message}
        >
          <input
            id="requesterEmail"
            type="email"
            dir="ltr"
            autoComplete="email"
            {...register('requesterEmail')}
            className="input"
          />
        </Field>

        <Field
          label={dict.privacy.requestPhoneLabel}
          htmlFor="requesterPhone"
          optionalLabel={dict.common.optional}
          error={errors.requesterPhone?.message}
        >
          <input
            id="requesterPhone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="tel"
            placeholder="0912345678"
            {...register('requesterPhone')}
            className="input"
          />
        </Field>
      </div>

      {error && (
        <Alert tone="danger" className="mt-5">
          {error.message}
        </Alert>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary btn-md mt-6">
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {dict.common.loading}
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            {dict.privacy.requestSubmit}
          </>
        )}
      </button>
    </form>
  );
}