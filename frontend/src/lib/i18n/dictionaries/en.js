/**
 * English dictionary — the source of truth for the key set.
 *
 * `ti.js` and `am.js` must contain exactly these keys. A test fails the build
 * otherwise, because a missing key renders as a raw identifier in front of a
 * resident, which is worse than an untranslated sentence.
 *
 * Keep the file organised by page so a translator working on one area can find
 * it, and keep strings self-contained: they are read out of context.
 */

const en = {
  meta: {
    title: 'Adigrat Community Connect',
    tagline: 'Connected Communities. Safer Neighbourhoods.',
    description:
      'Report a community concern, check verified service contacts, and read approved public announcements for Adigrat.',
  },

  common: {
    skipToContent: 'Skip to main content',
    language: 'Language',
    changeLanguage: 'Change language',
    loading: 'Loading',
    retry: 'Try again',
    close: 'Close',
    next: 'Next',
    back: 'Back',
    submit: 'Submit',
    cancel: 'Cancel',
    optional: 'optional',
    required: 'required',
    search: 'Search',
    showingResults: 'Showing results',
    lastUpdated: 'Last updated',
    page: 'Page',
    of: 'of',
    previous: 'Previous',
    nextPage: 'Next page',
    readMore: 'Read more',
    exampleEntry: 'Example entry',
    exampleEntryHelp: 'This is demonstration data and cannot be called.',
    notFound: 'Page not found',
    notFoundHelp: 'The page you asked for does not exist, or has moved.',
    somethingWentWrong: 'Something went wrong',
    somethingWentWrongHelp:
      'The problem has been recorded. You can try again, or use the telephone number below.',
  },

  nav: {
    home: 'Home',
    report: 'Report a Concern',
    status: 'Check a Report',
    contacts: 'Emergency Contacts',
    updates: 'Public Updates',
    support: 'Community Support',
    about: 'About',
    privacy: 'Privacy',
    staff: 'Staff sign-in',
    menu: 'Menu',
    openMenu: 'Open navigation menu',
    closeMenu: 'Close navigation menu',
  },

  /**
   * Present on every page. Wording is deliberately plain: the reader may be
   * frightened, may not read the language fluently, or may have come from the
   * emergency panel specifically looking for a phone number.
   */
  emergency: {
    title: 'Is this an emergency?',
    body: 'ACC is not an emergency service and does not contact anyone on your behalf.',
    action: 'Call the appropriate service directly.',
    footerNote:
      'If you cannot reach anyone, ask a neighbour, a shopkeeper, or a local official to help you call.',
  },

  footer: {
    aboutTitle: 'About this site',
    aboutBody:
      'Adigrat Community Connect is a proposed community platform. It is not a government service.',
    contactTitle: 'Contact',
    accessTitle: 'Accessibility',
    accessBody:
      'This site aims to meet WCAG 2.1 AA. If something here is difficult to use, please tell us.',
    policiesTitle: 'Policies',
    rightsTitle: 'Your rights',
    rightsBody: 'You can ask what we hold about you, ask us to correct it, or ask us to delete it.',
    version: 'Platform version',
  },

  home: {
    heroTitle: 'Report a concern. Check what is happening. Know who to call.',
    heroBody:
      'Use ACC to tell us about a problem in your community, to follow what happens to your report, and to find service contacts that have actually been checked.',
    reportCta: 'Report a concern',
    checkCta: 'Check a report',
    emergencyCta: 'Find a service contact',

    featuresTitle: 'What you can do here',
    featuresIntro: 'Four things, and nothing you have to pay for.',

    featureReportTitle: 'Report a Concern',
    featureReportBody:
      'Tell us what you have seen. You will get a reference code straight away, and you can come back to check what is happening with it.',

    featureContactsTitle: 'Emergency Contacts',
    featureContactsBody:
      'A directory of services whose details have been checked by a person. Every entry shows when it was last verified, so you can judge it for yourself.',

    featureUpdatesTitle: 'Public Updates',
    featureUpdatesBody:
      'Announcements that have been written and approved by an authorised editor before anyone else sees them.',

    featureSupportTitle: 'Community Support',
    featureSupportBody:
      'Health, social and disability support available in Adigrat, with the service area and eligibility spelled out.',

    updatesTitle: 'Latest verified announcements',
    updatesEmpty: 'There are no announcements at the moment.',
    updatesAll: 'See all announcements',

    contactsTitle: 'Recently verified service contacts',
    contactsEmpty: 'No verified service contacts have been published yet.',
    contactsAll: 'See all contacts',

    processTitle: 'How reporting works',
    processIntro: 'Four steps. You can stop at any point.',

    step1Title: 'You tell us what happened',
    step1Body: 'In your own words. You choose how much detail to give.',

    step2Title: 'You get a reference code',
    step2Body:
      'Write it down. Together with a private code, it is how you check on your report later.',

    step3Title: 'Staff review it',
    step3Body: 'A member of staff looks at it during published working hours.',

    step4Title: 'You can check progress',
    step4Body: 'Use your reference code and private code to see where it has got to.',

    privacyTitle: 'What we do with what you tell us',
    privacyBody:
      'Reports are private. Staff who review them are logged, including who looked at the details about the person who wrote it. We keep your details for a limited time and then delete them.',
    privacyCta: 'Read the privacy notice',

    disclaimerTitle: 'Please read this first',
    disclaimerBody:
      'ACC is a proposed platform. It is not a government service, it is not connected to an emergency dispatch system, and it does not promise a response time. For an emergency, contact the appropriate service directly by telephone.',
  },

  report: {
    title: 'Report a Concern',
    intro: 'This form is for problems in your community. For an emergency, please telephone a service directly.',

    progressLabel: 'Step {current} of {total}',

    stepCategoryTitle: 'What is this about?',
    stepCategoryHelp: 'Choose the closest match. Staff can change it later if needed.',

    stepDescriptionTitle: 'What happened?',
    stepDescriptionHelp:
      'Write it as you would tell a neighbour. What you saw, when, and where. You do not need to be certain.',
    descriptionLabel: 'Describe what happened',
    descriptionPlaceholder:
      'For example: for the past week a street light has not been working near the main junction. It is very dark at night and people are walking past.',

    stepContextTitle: 'When and where',
    stepContextHelp: 'Optional, but it helps staff act on this.',
    incidentDateLabel: 'When did this happen?',
    incidentTimeLabel: 'Roughly what time?',
    timePrecisionLabel: 'How close is that time?',
    timePrecisionExact: 'About right',
    timePrecisionDate: 'That day, not the time',
    timePrecisionApproximate: 'Roughly',
    timePrecisionUnknown: 'I am not sure',
    locationHeading: 'Where was it?',
    locationHelp:
      'A description of the place is enough. Please do not give precise coordinates — a landmark or the name of the kebele is easier for us and safer for you.',
    subCityLabel: 'Sub-city',
    woredaLabel: 'Woreda',
    kebeleLabel: 'Kebele',
    landmarkLabel: 'Describe the place',
    landmarkPlaceholder: 'For example: near the blue shop, opposite the clinic gate',

    stepContactTitle: 'How can we reach you?',
    stepContactHelp:
      'Optional. If you leave nothing, you can still check your report using your reference code and private code.',
    contactNameLabel: 'Your name',
    contactPhoneLabel: 'Mobile number',
    contactPhoneHelp: 'Ethiopian mobile numbers only, for example 0912345678.',
    contactEmailLabel: 'Email address',
    contactMethodLabel: 'Best way to reach you',
    methodPhone: 'Phone call',
    methodSms: 'Text message',
    methodEmail: 'Email',
    methodNone: 'Do not contact me',

    stepReviewTitle: 'Check and send',
    reviewHelp: 'Please read this before sending. You can go back and change anything.',
    reviewCategory: 'Category',
    reviewDescription: 'What you wrote',
    reviewContext: 'When and where',
    reviewContact: 'Contact details',
    reviewNotGiven: 'Not given',
    consentLabel: 'I have read the privacy notice and agree to my report being processed.',
    consentLink: 'Read the privacy notice',
    submitButton: 'Send my report',

    successTitle: 'Your report has been sent',
    successBody: 'Please keep these. You need both to check on your report later.',
    referenceLabel: 'Your reference code',
    tokenLabel: 'Your private code',
    tokenHelp:
      'We show this once and cannot show it again. Without it, nobody — including staff — can look up your report.',
    tokenSaved: 'I have written these down safely',
    tokenNotSaved: 'I have not written them down yet',
    checkStatusCta: 'Check my report',
    submitAnother: 'Report something else',
    successNextTitle: 'What happens next',
    successNextBody:
      'A member of staff will look at your report during published working hours. We cannot promise when, or that we will act on it. If this is urgent and no one comes, please contact a service directly.',

    pendingTitle: 'Saved on this device, not yet sent',
    pendingBody:
      'Your report is saved here but has not reached us yet. It will send itself as soon as there is a connection. Until then nobody at ACC has seen it.',
    pendingCta: 'Try sending now',
    pendingLeaveWarning:
      'If you close this page, the saved report is lost. Please send it before you leave if you can.',

    errorTitle: 'We could not send your report',
    errorBody:
      'Nothing has been saved. Your words are still in the form above — try again, or telephone a service directly.',
  },

  status: {
    title: 'Check a Report',
    intro: 'Enter the reference code and private code you were given when you sent your report.',
    referenceLabel: 'Reference code',
    referenceHelp: 'It looks like ACC-7F3K9Q2M.',
    tokenLabel: 'Private code',
    tokenHelp: 'The longer code we showed you once, after sending.',
    submitButton: 'Check my report',

    resultTitle: 'Your report',
    resultStatus: 'Current status',
    resultSubmitted: 'Sent',
    resultFirstReviewed: 'First looked at',
    resultResolved: 'Resolved',
    resultCategory: 'Category',
    resultUrgency: 'Urgency',
    resultMessage: 'What this means',
    resultNotYet: 'Not yet',

    notFoundTitle: 'We could not find that report',
    notFoundBody:
      'Check both codes. The reference code is the short one; the private code is the longer one. They must both match.',
  },

  contacts: {
    title: 'Emergency Contacts',
    intro:
      'Service details checked by a person. Every entry shows when it was last verified — check that date before you rely on it.',
    searchLabel: 'Search contacts',
    searchPlaceholder: 'Name of a service, or what you need',
    emergencyOnlyLabel: 'Show emergency services only',
    resultsCount: '{count} contacts',
    resultsCountOne: '1 contact',
    callCta: 'Call',
    coverageLabel: 'Covers',
    lastVerifiedLabel: 'Last checked',
    expiresLabel: 'Check again by',
    instructionsLabel: 'If you cannot get through',
    emptyTitle: 'No contacts match that search',
    emptyBody: 'Try a shorter search, or clear the filter.',
    noPublishedTitle: 'No service contacts have been published yet',
    noPublishedBody:
      'Until one has been verified, please contact a service directly by telephone.',

    categoryEmergency: 'Emergency',
    categoryPolice: 'Police',
    categoryHealth: 'Health',
    categoryFire: 'Fire',
    categoryUtility: 'Utility',
    categoryTransport: 'Transport',
    categoryCommunity: 'Community',
    categoryGovernmentOffice: 'Government office',
    categoryOther: 'Other',
  },

  updates: {
    title: 'Public Updates',
    intro: 'Announcements approved by an authorised editor before publication.',
    searchLabel: 'Search announcements',
    emptyTitle: 'No announcements at the moment',
    emptyBody: 'Please check again later.',
    sourceLabel: 'From',
    approvedByLabel: 'Approved by',
    publishedLabel: 'Published',
    expiresLabel: 'Ends',
    backToAll: 'All announcements',
    categoryPublicSafety: 'Public safety',
    categoryServiceNotice: 'Service notice',
    categoryHealthAdvisory: 'Health advisory',
    categoryInfrastructure: 'Infrastructure',
    categoryCommunity: 'Community',
    categoryOther: 'Other',
    translationPending: 'Available in English only',
    translationPendingHelp:
      'A reviewed translation into your language has not been provided yet.',
  },

  support: {
    title: 'Community Support',
    intro: 'Support available in Adigrat. Each entry says who it is for and when it was last checked.',
    serviceAreaLabel: 'Service area',
    eligibilityLabel: 'Who can use this',
    hoursLabel: 'Opening times',
    contactLabel: 'Contact',
    emptyTitle: 'No support services are listed yet',
    emptyBody: 'Please check again later.',
    notVerifiedTitle: 'Not yet checked',
    verifiedTitle: 'Checked',
  },

  about: {
    title: 'About ACC',
    purposeTitle: 'What this is for',
    purposeBody:
      'ACC is a proposed community platform for Adigrat. It exists to make three things easier: reporting a concern, following what happened to it, and finding a service contact whose details have been checked by a person.',
    limitationsTitle: 'What it does not do',
    limitationsBody:
      'It is not a government service. It is not connected to any emergency dispatch system. It does not send anyone to you, and it does not promise a response time.',
    handlingTitle: 'How a report is handled',
    handlingBody:
      'Reports are private. Only staff who are authorised for it can open one, and every read of the details about the person who wrote it is recorded. Staff cannot delete a report without a recorded reason.',
    governanceTitle: 'Who runs this',
    governanceBody:
      'ACC is not operated by any government office. Organisations taking part must be approved by a governance administrator before anything is published in their name.',
    partnersTitle: 'Partnerships and approvals',
    partnersBody:
      'No partnership has been verified. Where an arrangement is confirmed and permitted to be shown, it will be listed here with the date it was agreed.',
    transparencyTitle: 'What we publish',
    transparencyBody:
      'Announcements are only visible after an editor has approved them, and an editor cannot approve an announcement they wrote themselves.',
  },

  privacy: {
    title: 'Privacy Notice',
    lastUpdatedLabel: 'Last updated',
    dataTitle: 'What we collect',
    dataBody:
      'What you write in a report, the category you choose, any time and place you give, any file you attach, and — only if you choose to give them — your name, phone number or email address.',
    useTitle: 'Why we use it',
    useBody: 'To let staff review your report and, if you asked for it, to contact you about it.',
    accessTitle: 'Who can see it',
    accessBody:
      'Staff authorised to review reports. Reading the personal details attached to a report is a separate permission, and each time it happens it is recorded.',
    retentionTitle: 'How long we keep it',
    retentionBody:
      'A closed report is kept for a limited period and then deleted. The exact period has not yet been agreed and must be published here before any pilot starts.',
    rightsTitle: 'Your rights',
    rightsBody:
      'You can ask what we hold about you, ask us to correct it, or ask us to delete it. Write to the address below and we will respond within the period the law requires.',
    cookiesTitle: 'Cookies',
    cookiesBody:
      'This site sets no advertising or analytics cookies. Staff sign-in uses a cookie that is required for security and cannot be read by scripts.',
    contactTitle: 'Questions',
    automatedNote:
      'This is a draft notice prepared for a proposed pilot. It has not yet been reviewed by a lawyer, and it is not a legally sufficient privacy notice until it has been.',

    requestCta: 'Make a request about my data',
    requestFormTitle: 'Ask about your data',
    requestTypeLabel: 'What do you want?',
    requestTypeAccess: 'See what you hold about me',
    requestTypeCorrection: 'Correct something',
    requestTypeDeletion: 'Delete my data',
    requestDetailsLabel: 'Tell us more',
    requestDetailsHelp:
      'At least 20 characters, so we know what you are asking about. If your request is about a specific report, include its reference code.',
    requestReferenceLabel: 'Report reference code',
    requestReferenceHelp: 'If your request is about a particular report.',
    requestNameLabel: 'Your name',
    requestEmailLabel: 'Email address',
    requestPhoneLabel: 'Mobile number',
    requestSubmit: 'Send my request',
    requestSuccess:
      'Your request has been received. Someone will look at it and contact you using the details you gave.',
  },

  reportStatus: {
    SUBMITTED: 'Sent',
    UNDER_REVIEW: 'Being looked at',
    VERIFIED: 'Checked',
    ASSIGNED: 'Sent to a service',
    IN_PROGRESS: 'Being worked on',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed',
    REJECTED: 'Not accepted',
    DUPLICATE: 'Duplicate of another report',
    urgencyLOW: 'Low',
    urgencyNORMAL: 'Normal',
    urgencyHIGH: 'High',
    urgencyCRITICAL: 'Critical',
  },

  validation: {
    required: 'This is required.',
    categoryRequired: 'Choose one of the options.',
    descriptionTooShort: 'Please write at least 20 characters so staff can act on it.',
    descriptionTooLong: 'Please shorten this to 5000 characters or fewer.',
    languageRequired: 'Choose a language.',
    phoneInvalid: 'Enter a valid Ethiopian mobile number, for example 0912345678.',
    emailInvalid: 'Enter a valid email address.',
    nameTooLong: 'Please shorten this.',
    landmarkTooLong: 'Please shorten this to 500 characters or fewer.',
    dateInvalid: 'Enter a valid date.',
    consentRequired: 'Please agree before sending.',
    isAnonymousUnsupported:
      'Reporting without contact details is not available. We could not keep it truly anonymous, so we do not offer it.',
    referenceInvalid: 'Enter the reference code exactly as it was given.',
    tokenRequired: 'Enter your private code.',
    tokenInvalid: 'That private code does not match.',
    requestDetailsTooShort: 'Please tell us a little more — at least 20 characters.',
    requestTypeRequired: 'Choose what you would like to do.',
  },

  staff: {
    title: 'Staff sign-in',
    intro: 'For authorized ACC staff only.',
    emailLabel: 'Email address',
    passwordLabel: 'Password',
    signIn: 'Sign in',
    signingIn: 'Signing in',
    signOut: 'Sign out',
    mfaRequiredTitle: 'Two-factor authentication needed',
    mfaRequiredBody:
      'Your role requires a second factor. Set one up now; it is needed every time you sign in.',
    mfaBegin: 'Start setup',
    mfaCodeLabel: 'Code from your authenticator app',
    mfaConfirm: 'Confirm and finish',
    mfaEnrolled: 'Two-factor authentication is now on.',
    signInFailed: 'We could not sign you in.',
    rateLimited: 'Too many attempts. Wait a few minutes and try again.',
    locked: 'This account is temporarily locked. Try again later.',
    mfaRequired: 'Your account must have two-factor authentication set up first.',

    queueTitle: 'Reports',
    queueEmpty: 'No reports match these filters.',
    queueLoading: 'Loading reports',
    filterReference: 'Reference code',
    filterStatus: 'Status',
    filterUrgency: 'Urgency',
    filterAssigned: 'Assigned to me',
    filterUnassigned: 'Not assigned',
    filterAll: 'All',
    columnReference: 'Reference',
    columnStatus: 'Status',
    columnUrgency: 'Urgency',
    columnCategory: 'Category',
    columnSubmitted: 'Sent',
    columnAssigned: 'Assigned to',

    detailTitle: 'Report {reference}',
    detailDescription: 'What was reported',
    detailReporter: 'Person who reported',
    detailReporterWithheld: 'Withheld — you do not have permission to view this',
    detailLocation: 'Where',
    detailAttachments: 'Attachments',
    detailHistory: 'Status history',
    detailNotes: 'Internal notes',
    noNotes: 'No notes yet.',
    triageTitle: 'Triage',
    triageUrgency: 'Urgency',
    triageVerification: 'Verification',
    triageReason: 'Reason',
    transitionTitle: 'Move to',
    transitionReason: 'Reason for this change',
    applyTransition: 'Apply',
    notAssignedToYou: 'This report is not assigned to you.',
  },
};

export default en;