const ti = {
  SUBMITTED: 'ሪፖርትዎን ደርሻንሃል። ባለሙያ የሚያነሱበት ይጠብቃል።',
  UNDER_REVIEW: 'ባለሙያ የሪፖርትዎን በመመልከት ላይ ነው።',
  VERIFIED: 'ሪፖርትዎ ከያገኘባት መረጃ ጋር ተጨምሯል፤ አሁን ይሠራል።',
  ASSIGNED: 'ሪፖርትዎ ለዚህ ዓይነት ችግር ኃላፊ ቡድኑ ተልኳል።',
  IN_PROGRESS: 'ተመደባው ቡድን ላይ ሪፖርትዎ ላይ እየሥራ ናቸው።',
  RESOLVED: 'እርምጃ ተወስዷል፤ ሪፖርትዎ ተፈትሯል። በቀጣይም ይዘጋል።',
  CLOSED: 'ይህ ሪፖርት አሁን ተዘግቷል። ነገሩ ተቀይሯል ወይም ከበስተካከሉ በላይ ሆነ ቢሆን፣ እባክዎ አዲስ ሪፖርት ይልኩ፣ የዚህን ቁጥር በመጠቀም።',
  REJECTED: 'ይህ ሪፖርት የተዘጋ ሳይሆን ተዘግቷል።',
  DUPLICATE: 'ይህ ሪፖርት ከቀድሞው ሪፖርት ጋር ተደጋጋሚ ሆነተር ተመዝግቧል፤ በቀድሞው የተለያየ ሠራት ላይ ነው።',
  DEFAULT: 'ሪፖርትዎ ተመዝግቧል።',
} as const;

const am = {
  SUBMITTED: 'ሪፖርትዎ ደርሻንሃል። ባለሙያ የሚያነሱበት ይጠብቃል።',
  UNDER_REVIEW: 'ባለሙያ ሪፖርትዎን በመመልከት ላይ ነው።',
  VERIFIED: 'ሪፖርትዎ ከያገኘት መረጃ ጋር ተጨምሯል፤ አሁን ይሠራል።',
  ASSIGNED: 'ሪፖርትዎ ለዚህ ዓይነት ችግር ኃላፊ የሆነው ቡድን ተልኳል።',
  IN_PROGRESS: 'ተመደባው ቡድን ሪፖርትዎ ላይ እየሥራ ነው።',
  RESOLVED: 'እርምጃ ተወስዷል፤ ሪፖርትዎን ተፈትሯል። በቀጣይም ይዘጋል።',
  CLOSED: 'ይህ ሪፖርት አሁን ተዘግቷል። ነገሩ ተቀይሯል ወይስም ከበስተካከሉ በላይ ሆነ ቢሆን፣ እባክዎ አዲስ ሪፖርት ይልኩ፤ የዚህን ቁጥር በመጠቀም።',
  REJECTED: 'ይህ ሪፖርት የተዘጋ ሳይሆን ተዘግቷል።',
  DUPLICATE: 'ይህ ሪፖርት ከቀድሞው ሪፖርት ጋር ተደጋጋሚ ሆነተር ተመዝግቧል፤ በቀድሞው በተለያየ ሠራት ላይ ነው።',
  DEFAULT: 'ሪፖርትዎ ተመዝግቧል።',
} as const;

const en = {
  SUBMITTED: 'We have received your report. It is waiting to be picked up by a member of staff.',
  UNDER_REVIEW: 'A member of staff is reviewing your report.',
  VERIFIED:
    'Your report has been checked against the information available to us and is being processed.',
  ASSIGNED: 'Your report has been passed to the team responsible for this type of concern.',
  IN_PROGRESS: 'The assigned team is working on your report.',
  RESOLVED:
    'Action has been taken and your report has been marked as resolved. It will close shortly.',
  CLOSED:
    'This report is now closed. If the situation has changed or got worse, please submit a new report and mention this reference code.',
  REJECTED: 'This report was closed without further action.',
  DUPLICATE:
    'This report was recorded as a duplicate of an earlier report, which is being handled separately.',
  DEFAULT: 'Your report is recorded.',
} as const;

/**
 * The public explanation shown to a resident on the status page.
 *
 * ## Why these live in code rather than in the database
 *
 * They describe the *lifecycle*, not any individual report, so there are exactly
 * as many as there are statuses. Putting them in a table would mean an edit
 * requires a migration and a deploy, and — more seriously — would make the text
 * of a safety-relevant message editable by whoever holds database access, with
 * no code review and no test coverage. Keeping them here means they change the
 * same way and with the same scrutiny as the logic that produces them.
 *
 * ## Why every language is present
 *
 * This is the text that tells someone whether their report was received and what
 * happens next. Showing it in a language the reader cannot read is not a
 * cosmetic problem: someone who cannot tell whether their report was accepted
 * will reasonably submit it again, and possibly conclude that nobody received
 * the first one.
 *
 * Translations here are drafts and must be reviewed by a native speaker before
 * any pilot — recorded as an open gate in `docs/03-milestones.md`.
 */
const MESSAGES: Record<'en' | 'ti' | 'am', Record<string, string>> = { en, ti, am };

/**
 * The message shown to a resident for a given status, in the requested language.
 *
 * Falls back to English rather than to the raw enum name: an untranslated
 * fallback must still be a sentence a reader can act on, never `SUBMITTED`.
 */
export function publicStatusMessage(
  status: string,
  locale: string = 'en',
): { message: string; locale: string; translationPending: boolean } {
  const key = MESSAGES.en[status as keyof typeof MESSAGES.en] ? status : 'DEFAULT';

  const requested = locale in MESSAGES ? (locale as keyof typeof MESSAGES) : 'en';

  return {
    message: MESSAGES[requested][key] ?? MESSAGES.en[key],
    locale: requested,
    // Tells the interface it should say "shown in English" rather than let the
    // reader assume they are reading their own language.
    translationPending: requested !== locale,
  };
}