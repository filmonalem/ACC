/**
 * አማርኛ (Amharic) dictionary.
 *
 * Must contain exactly the keys in `en.js`. A test enforces this.
 *
 * Notes for anyone editing this file:
 *
 *  - **Emergency wording is safety-critical.** No critical string is machine
 *    translated. Where a reviewed translation is missing, delete the key and
 *    let the English fallback show — a wrong instruction about who to telephone
 *    is worse than an English one.
 *  - Register: written Amharic here uses a formal register, "እርስዎ", where a
 *    conversational interface might use the more familiar form.
 *  - Numerals: Western Arabic digits (0-9) are used in Ethiopia, so times and
 *    reference codes stay readable.
 */

const am = {
  meta: {
    title: 'አዲግራት የማኅበረሰብ ግንኙነት',
    tagline: 'የተገናኙ ማኅበሰቦች። ደህንነታማ አካባቢዎች።',
    description:
      'የማኅበረሰብ ችግር ያሳወቅ፣ የተረጋገጠ የአገልግሎት መረጃ ያረጋግጥ፣ እና የተፈቀደ የህዝብ መልእክቶችን ያነበብ።',
  },

  common: {
    skipToContent: 'ወደ ዋናው ይዘቱ ዝለል',
    language: 'ቋንቋ',
    changeLanguage: 'ቋንቋ ቀይር',
    loading: 'በመጫን ላይ',
    retry: 'እንደገና ሞክር',
    close: 'ዝጋ',
    next: 'ቀጣይ',
    back: 'ተመለስ',
    submit: 'አስገባ',
    cancel: 'ሰርዝ',
    optional: 'አማራጭ',
    required: 'ያስፈልጋል',
    search: 'ፈልግ',
    showingResults: 'ውጤቶች ታይተዋል',
    lastUpdated: 'መጨረሻ ጊዜ',
    page: 'ገጽ',
    of: 'ከ',
    previous: 'ያለፈው',
    nextPage: 'ቀጣይ ገጽ',
    readMore: 'ተጨማሪ አንብብ',
    exampleEntry: 'ምሳሌ ግብ',
    exampleEntryHelp: 'ይህ ማሳያ መረጃ ሲሆን መደወል አይችልም።',
    notFound: 'ገጹ አልተገኘም',
    notFoundHelp: 'ያጠየቁት ገጽ የለም፣ ወይም ተዛውቷል።',
    somethingWentWrong: 'ለምስል ችግር ተከስቷል',
    somethingWentWrongHelp:
      'ችግሩ ተመዝግቧል። እንደገና ማሞክር ይችላሉ፣ ወይም ከዚህ በታች ያለውን ስልክ ቁጥር ይጠቀሙ።',
  },

  nav: {
    home: 'መጀመሪያ',
    report: 'ችግር ያሳወቅ',
    status: 'ሪፖርት አረጋግጥ',
    contacts: 'የአደጋ ጊዜ መረጃ አገልግሎት',
    updates: 'የህዝብ መልእክቶች',
    support: 'የማኅበረሰብ ድጋፍ',
    about: 'ስለ እኛ',
    privacy: 'ግለዳዊነት',
    staff: 'የሠራችን ግባ',
    menu: 'ማውጫ',
    openMenu: 'የአሰሳ ማውጫ ክፈት',
    closeMenu: 'የአሰሳ ማውጫ ዝጋ',
  },

  emergency: {
    title: 'አደጋ ጊዜ ነው?',
    body: 'ACC የአደጋ ጊዜ አገልግሎት አይደለም፣ እና በእርስዎ ብቃት ሰውን አይደውልም።',
    action: 'ተገቢውን አገልግሎት በቀጥታ ይደውሉ።',
    footerNote:
      'ማንኛውንም ካልደረሱ፣ ባለጎች፣ የዕቃድ ሰዎች ወይም የአካባቢ አስተዳዳሪዎች ማደውሎ እንዲያደውሉ ጠይቀው።',
  },

  footer: {
    aboutTitle: 'ስህተት ይህ ስልጥ',
    aboutBody:
      'አዲግራት የማኅበረሰብ መድረክ የተጠበቀ የማኅበረሰብ መሣሪያ ነው። የመንግሥት አገልግሎት አይደለም።',
    contactTitle: 'ግንኙነት',
    accessTitle: 'ተደራሽነት',
    accessBody:
      'ይህ ስልጥ WCAG 2.1 AA ለመፈጸም ይጠናገራል። ለመጠቀም ከተከሳተ አንድ ከሆነ ወደ እኛ ያሳውቁን።',
    policiesTitle: 'ፖሊሲዎች',
    rightsTitle: 'የእርስዎ መብት',
    rightsBody: 'ስለእርስዎ ያለንን መረጃ ማየት፣ ማስተካከል ወይም ማጥፋት ይጠይቃሉ።',
    version: 'የመድረክ ስሪት',
  },

  home: {
    heroTitle: 'ችግር ያሳወቅ። ምን እየተደረገ ነው ይወቁ። ማንን መደወል እንደምታወቁ ይወቁ።',
    heroBody:
      'ACC በማኅበረሰብዎ ውስጥ ያለውን ችግር ለመታወቅ፣ ሪፖርትዎ ምን ሆነበት ለመከታተል፣ እና በአንድ ሰው የተረጋገጠ የአገልግሎት መረጃ ለማግኘት ይረዳል።',
    reportCta: 'ችግር ያሳወቅ',
    checkCta: 'ሪፖርት አረጋግጥ',
    emergencyCta: 'የአገልግሎት መረጃ አገልግሎት ፈልግ',

    featuresTitle: 'እዚህ ላይ ምን ማድረግ ይችላሉ',
    featuresIntro: 'አራት ነገሮች። እና አንድም ክፍያ የማይጠይቅም።',

    featureReportTitle: 'ችግር ያሳወቅ',
    featureReportBody:
      'ያዩን ነገር ያሳውቁን። ወዲያውኑ የሪፖርት ቁጥር ያገኛሉ፣ እና ማንኛውንም ጊዜ ላይ የሆነውን መረጃ ለመከታተል መለስ ይችላሉ።',

    featureContactsTitle: 'የአደጋ ጊዜ መረጃ አገልግሎት',
    featureContactsBody:
      'በአንድ ሰው የተረጋገጡ የአገልግሎት መረጃ ዝርዝር። እያንዳንዱ ምስል መጨረሻ መቼ ተረጋግጧል በሆነ በራሱ ማስቀመጥ ይችላሉ።',

    featureUpdatesTitle: 'የህዝብ መልእክቶች',
    featureUpdatesBody:
      'ከፈቃድ ያለው አርትዒስት ከሌሎች ከመታየታቸው በፊት የተጻፉ እና የተጸድቁ ማስታወቂያዎች።',

    featureSupportTitle: 'የማኅበረሰብ ድጋፍ',
    featureSupportBody:
      'በአዲግራት የሚገኝ የጤና፣ የማኅበረሰብ እና የችግር አፋጣጥ ድጋፍ፣ አገልግሎት አካባቢና መብት በግልጽ ተገርጧል።',

    updatesTitle: 'የቅርብ ጊዜ የተረጋገጡ ማስታወቂያዎች',
    updatesEmpty: 'በአሁኑ ማስታወቂያ የለም።',
    updatesAll: 'ሁሉንም ማስታወቂያዎች እይ',

    contactsTitle: 'በቅርብ ጊዜ የተረጋገጡ የአገልግሎት መረጃ',
    contactsEmpty: 'የተረጋገጠ የአገልግሎት መረጃ ገና አልተወጣም።',
    contactsAll: 'ሁሉንም መረጃ አገልግሎት እይ',

    processTitle: 'ሪፖርት ማስገባት እንዴት ነው',
    processIntro: 'አራት ደረጃዎች። በማንኛውም ጊዜ መቆም ይችላሉ።',

    step1Title: 'ምን እንደሆነ ስለእርስዎ ይናገራሉ',
    step1Body: 'በራስዎ ቃል። የሚሰጡትን መጠን እርስዎ ይመልከታሉ።',

    step2Title: 'የሪፖርት ቁጥር ያገኛሉ',
    step2Body:
      'ይህን ይመዝግቡ። ከግል ኮድ ጋር በጥምረት ሪፖርትዎን ለመከታተል የሚያገለግሉት ዘዴ ነው።',

    step3Title: 'የሠራችን ባለሙያዎች ያነሳፉታሉ',
    step3Body: 'ባለሙያ የሚገበርበት በተሳወቀው የሥራ ሰዓት ውስጥ ይመለከታል።',

    step4Title: 'እድገት መለካት ይችላሉ',
    step4Body: 'የሪፖርት ቁጥርዎና ግል ኮድዎ በመጠቀም የደረሰውን ነገር ይመልከቱ።',

    privacyTitle: 'የምንርህን መረጃ እንዴት እንጠቀማለን',
    privacyBody:
      'ሪፖርቶች የግል ናቸው። የሚያነሱትት የሠራችን ባለሙያዎች ይመዝገባሉ፣ የጻፈውን ሰው ስለ ድርጅቱ ያነሱትን መረጃ በስያቱ እንዲሁም። ድርጅትዎን በጊዜ ሰሌዳ አጥበቀን የሚጥፉ አካባቢ ለየው።',
    privacyCta: 'የግለዳዊነት ማስጠንቀቂያ አንብብ',

    disclaimerTitle: 'እባክዎ ይህን ቀድሞ ያነበቡ',
    disclaimerBody:
      'ACC የተጠበቀ መድረክ ነው። የመንግሥት አገልግሎት አይደለም፣ ከማንኛውም የአደጋ ጊዜ አገልግሎት ጋር አይያያዘም፣ እና የመልስ ጊዜ አይተስገጥም። ለአደጋ ጊዜ ተገቢውን አገልግሎት በስልክ በቀጥታ ያግኑ።',
  },

  report: {
    title: 'ችግር ያሳወቅ',
    intro:
      'ይህ ቅጽ ለማኅበረሰብዎ ውስጥ ያሉ ችግሮች ነው። ለአደጋ ጊዜ አገልግሎትን በስልክ በቀጥታ ያደውሉ።',

    progressLabel: 'ደረጃ {current} ከ {total}',

    stepCategoryTitle: 'ይህ ስለ ምን ነው?',
    stepCategoryHelp: 'ቀላልነት ያለውን ያስቀምጡ። አስፈላጊነት ቢሆንም ባለሙያዎች መቀየር ይችላሉ።',

    stepDescriptionTitle: 'ምን ተደረገ?',
    stepDescriptionHelp:
      'ለጎሎ ብቻዎች እንደሚናገሩት ይጻፉ። ያዩኑን፣ መቼ እና የት፣ ግንኙነት ግን አያስፈልግም።',
    descriptionLabel: 'የተደረገውን ይግለጹ',
    descriptionPlaceholder:
      'ምሳሌ፦ ለሳምንት ከዚህ በፊት በመንገዱ ላይ የጎዳና ብርሃን አልሰራም። በሌሊት ብጹም ነው፣ ሰዎችም እየሄዱ ናቸው።',

    stepContextTitle: 'መቼ እና የት',
    stepContextHelp: 'አማራጭ ነው፣ ግን ባለሙያዎች እንዲያድሩ ይረዳል።',
    incidentDateLabel: 'የተደረገው መቼ ነው?',
    incidentTimeLabel: 'በግምት ስዕድ ሰዓት?',
    timePrecisionLabel: 'ያ ሰዓት ልክ በፍጥነት?',
    timePrecisionExact: 'በጭላጭሉ',
    timePrecisionDate: 'ያቀኑ ብቻ፣ ሰዓቱን አይደለም',
    timePrecisionApproximate: 'በግምት',
    timePrecisionUnknown: 'አወቅነድለሁ',
    locationHeading: 'የት ነው?',
    locationHelp:
      'የቦታው ማስረጃ በቂ ነው። ትክክለኛ አቆጣጠር አትስጡ — ቦታ ምልክት ወይም የቀበሌ ስም ለእኛ ቀላልና ለእርስዎ ደህንነት ይሆናል።',
    subCityLabel: 'ክፍለ ከተማ',
    woredaLabel: 'ወረዳ',
    kebeleLabel: 'ቀበሌ',
    landmarkLabel: 'ቦታውን ይግለጹ',
    landmarkPlaceholder: 'ምሳሌ፦ በሰማያዊው ሱቃል ፊት፣ ክሊኒኩ በርክኩ ተገናኝቶ',

    stepContactTitle: 'እንዴት እንደምነራዎት?',
    stepContactHelp:
      'አማራጭ ነው። ምንም ካልሰጡ ከዚያ የሪፖርት ቁጥርዎና ግል ኮድዎ በመጠቀም መከታተል ይችላሉ።',
    contactNameLabel: 'ስምዎ',
    contactPhoneLabel: 'የሞባይል ቁጥር',
    contactPhoneHelp: 'የኢትዮጵያ የሞባይል ቁጥሮች ብቻ፣ ለምሳሌ 0912345678።',
    contactEmailLabel: 'የኢሜይል አድራሻ',
    contactMethodLabel: 'ምርጥ የመደወል መንገድ',
    methodPhone: 'የስልክ ጥሪያ',
    methodSms: 'የጽሑት መልእክት',
    methodEmail: 'ኢሜይል',
    methodNone: 'አይነካትም',

    stepReviewTitle: 'ያረጋግጡና ይላኩ',
    reviewHelp: 'ከመላክዎ በፊት እባክዎ ያነበቡ። ማንኛውንም ለመቀየር መመለስ ይችላሉ።',
    reviewCategory: 'ምድብ',
    reviewDescription: 'ያጻፉት',
    reviewContext: 'መቼ እና የት',
    reviewContact: 'የአያያዝ መረጃ',
    reviewNotGiven: 'አልተሰጠም',
    consentLabel: 'የግለዳዊነት ማስጠንቀቂያውን አንብቢሃል፤ ሪፖርትዬ መረጃ እንዲዘጋጅም እስምርታለሁ።',
    consentLink: 'የግለዳዊነት ማስጠንቀቂያ አንብብ',
    submitButton: 'ሪፖርትዬን ላክ',

    successTitle: 'ሪፖርትዎ ተልኳል',
    successBody: 'እነዚህን ያስቀምጡ። ለኋላ ለመመለስ ሁለቱም ያስፈልጋሉ።',
    referenceLabel: 'የሪፖርት ቁጥርዎ',
    tokenLabel: 'የግል ኮድዎ',
    tokenHelp:
      'ይህን አንድ ጊዜ ብቻ እንዳሳያልን ማስገርራቸው አይችልም። ያለዚህ ከሠራችን ባለሙያዎች በእጅ ማንም ሪፖርትዎን ማየት አይችልም።',
    tokenSaved: 'እነዚህን በደህንነት አስቀምጤለሁ',
    tokenNotSaved: 'ገና አልጻፍኩም',
    checkStatusCta: 'ሪፖርትዬን አረጋግጥ',
    submitAnother: 'ሌላ ችግር አሳወቅ',
    successNextTitle: 'ቀጣዩ ምን ይፈጠራል',
    successNextBody:
      'ባለሙያ በተሳወቀው የሥራ ሰዓት ሪፖርትዎን ይመለከታል። መቼ ወይም እንደምደርም በሆነ ማስጠንቀቂያ ልሰገንበታለን። ይህ አስቸኳይ ከሆነ ሰው ካልመጣ አገልግሎትን በቀጥታ ያግኑ።',

    pendingTitle: 'በዚህ መሣሪያ ተቀምጧል፣ ገና አልተላከም',
    pendingBody:
      'ሪፖርትዎ እዚህ ተቀምጧል ግን እስካሁን አልደረሰምን። ግንኙነት ሲኖር በራሱ ይላካል። እስከዚያ በACC የሚናገበ ሰው አልታየም።',
    pendingCta: 'አሁን ላክ ሞክር',
    pendingLeaveWarning:
      'ይህን ገጹ ካልቀወቁ የተቀመጠው ሪፖርት ይጠፋል። ከመውጣታችሁ በፊት ከቻሉ ይላኩ።',

    errorTitle: 'ሪፖርትዎን መላክ አልቻልንም',
    errorBody:
      'ምንም አልተቀመጠም። የእርስዎ ቃላት ከላይ በቅጹ ውስጥ ይቀጥላሉ — እንደገና ሞክሩ፣ ወይም አገልግሎትን በስልክ በቀጥታ ያደውሉ።',
  },

  status: {
    title: 'ሪፖርት አረጋግጥ',
    intro: 'ሪፖርትዎን ሲልኩ የተሰጡትን የሪፖርት ቁጥርና የግል ኮድ ያስገቡ።',
    referenceLabel: 'የሪፖርት ቁጥር',
    referenceHelp: 'ACC-7F3K9Q2M የሚመስል ነው።',
    tokenLabel: 'የግል ኮድ',
    tokenHelp: 'ከመላክዎ በኋላ አንድ ጊዜ የታዩት ቀዳሚ ኮድ።',
    submitButton: 'ሪፖርትዬን አረጋግጥ',

    resultTitle: 'ሪፖርትዎ',
    resultStatus: 'አሁን ያለው ክፍተት',
    resultSubmitted: 'ተልኳል',
    resultFirstReviewed: 'መጀመሪያ ተመርምሯል',
    resultResolved: 'ተፈትሯል',
    resultCategory: 'ምድብ',
    resultUrgency: 'አስቸኳይነት',
    resultMessage: 'ይህ ምን ይልጋል',
    resultNotYet: 'ገና አይደለም',

    notFoundTitle: 'ያለውን ሪፖርት አልገኘንም',
    notFoundBody:
      'ሁለቱንም ኮዶች ያረጋግጡ። የሪፖርት ቁጥሩ ያጭሩ ነው፤ የግል ኮዱ ረዘማውና ያለው ነው። ሁለቱም መስማማ ያስፈልጋሉ።',
  },

  contacts: {
    title: 'የአደጋ ጊዜ መረጃ አገልግሎት',
    intro:
      'በአንድ ሰው የተረጋገጡ የአገልግሎት መረጃዎች። እያንዳንዱ ምስል መጨረሻ መቼ ተረጋግጧል በሆነ ያረጋግጡ።',
    searchLabel: 'መረጃ አገልግሎት ፈልግ',
    searchPlaceholder: 'የአገልግሎት ስም፣ ወይም የሚያስፈልጋታት ነገር',
    emergencyOnlyLabel: 'የአደጋ ጊዜ አገልግሎቶችን ብቻ አሳያ',
    resultsCount: '{count} መረጃ አገልግሎቶች',
    resultsCountOne: '1 መረጃ አገልግሎት',
    callCta: 'ደውል',
    coverageLabel: 'ያጠናኝራል',
    lastVerifiedLabel: 'መጨረሻ ማረጋገጫ',
    expiresLabel: 'እንደገና የሚመለስበት',
    instructionsLabel: 'ካልደረሱ',
    emptyTitle: 'ከዚያ ጋር የሚዛመድ መረጃ አገልግሎት የለም',
    emptyBody: 'አጭሩን ፍለጋ ይሞክሩ፣ ወይም ማጣሪያውን ያጽዱ።',
    noPublishedTitle: 'ገና የአገልግሎት መረጃ አገልግሎት አልተወጣም',
    noPublishedBody: 'እስኪረጋግጥ አገልግሎትን በስልክ በቀጥታ ያግኑ።',

    categoryEmergency: 'አደጋ ጊዜ',
    categoryPolice: 'ፖሊስ',
    categoryHealth: 'ጤና',
    categoryFire: 'እሳት',
    categoryUtility: 'መገልግሎት',
    categoryTransport: 'ትራፊክ',
    categoryCommunity: 'ማኅበረሰብ',
    categoryGovernmentOffice: 'የመንግሥት ጽ/ቤት',
    categoryOther: 'ሌላ',
  },

  updates: {
    title: 'የህዝብ መልእክቶች',
    intro: 'ከተወጡ በፊት በፈቃድ ያለው አርትዒስት የጸድታቸው ማስታወቂያዎች።',
    searchLabel: 'ማስታወቂያዎችን ፈልግ',
    emptyTitle: 'በአሁኑ ማስታወቂያ የለም',
    emptyBody: 'እባክዎ ወደገና ይመለስኩ።',
    sourceLabel: 'ከ',
    approvedByLabel: 'የጸድተው',
    publishedLabel: 'የተታተመው',
    expiresLabel: 'ያልቃል',
    backToAll: 'ሁሉም ማስታወቂያዎች',
    categoryPublicSafety: 'የህዝብ ደህንነት',
    categoryServiceNotice: 'የአገልግሎት ማስታወቂያ',
    categoryHealthAdvisory: 'የጤና ምክር',
    categoryInfrastructure: 'መሠረተ ልማት',
    categoryCommunity: 'ማኅበረሰብ',
    categoryOther: 'ሌላ',
    translationPending: 'በEnglish ብቻ ይገኛል',
    translationPendingHelp: 'ወደ አማርኛ የተረጋገጠ ትርጉም ገና አልተሰጠም።',
  },

  support: {
    title: 'የማኅበረሰብ ድጋፍ',
    intro:
      'በአዲግራት የሚገኝ ድጋፍ። እያንዳንዱ ምስል ማንነት የሚጠቀምበትንና መጨረሻ መቼ ተረጋግጧል በሆነ ይናገራል።',
    serviceAreaLabel: 'የአገልግሎት አካባቢ',
    eligibilityLabel: 'ማን ሊጠቀም ይችላል',
    hoursLabel: 'የስራ ሰዓት',
    contactLabel: 'ግንኙነት',
    emptyTitle: 'ምንም የድጋፍ አገልግሎት አልተመዘገበም',
    emptyBody: 'እባክዎ ወደገና ይመለስኩ።',
    notVerifiedTitle: 'ገና አልተረጋገጠም',
    verifiedTitle: 'ተረጋግጧል',
  },

  about: {
    title: 'ስለ ACC',
    purposeTitle: 'ይህ ለምን ነው',
    purposeBody:
      'ACC ለአዲግራት የተጠበቀ የማኅበረሰብ መድረክ ነው። ሦስት ነገሮችን ለማቅርብ የተለያየ ነው፦ ችግር ማስታወቅ፣ ሪፖርቱ ላይ የሆነውን መከታተል፣ እና በአንድ ሰው የተረጋገጠ የአገልግሎት መረጃ ማግኘት።',
    limitationsTitle: 'የማይሰራቸው',
    limitationsBody:
      'የመንግሥት አገልግሎት አይደለም። ከማንኛውም የአደጋ ጊዜ አገልግሎት ጋር አይያያዘም። ወደእርስዎ ሰው አያልክም፣ እና የመልስ ጊዜ አይተስገጥም።',
    handlingTitle: 'ሪፖርት እንዴት ይከናወናል',
    handlingBody:
      'ሪፖርቶች የግል ናቸው። በተፈቀድ የሚያነሱት የሠራችን ባለሙያዎችን ብቻ ይከፍታሉ፤ ያጨውኑን ስለ ድርጅቱ ያነሳትን መረጃ ማነበብ ሞል ብቻ ነው። ባለሙያ ያልመዝግበ ምክንያት ሪፖርት እንዲጠፋ አይችልም።',
    governanceTitle: 'ይህን ዛሬ የማን ነው',
    governanceBody:
      'ACC በማንኛውም የመንግሥት ቢሮ አይመራም። በተሳተፉ የመድረክ አስተዳዳሪ ተፈቀድ ከሆኑ ብቻ በስሙ የሚወጡ ነገሮችን ማወጣት ይችላሉ።',
    partnersTitle: 'አጋሮችና አፈቃድ',
    partnersBody:
      'ምንም አጋር አልተረጋግጧም። ስምም ተረጋግጦበት ወይም ማሳየት በተፈቀደ የሆነ ማስታወቂያ እዚህ በቀኑ ይሰጣል።',
    transparencyTitle: 'ምን እንወጣለን',
    transparencyBody:
      'ማስታወቂያዎች በአርትዒስት ከጸድተው በኋላ ብቻ ይታያሉ፤ ደግሞ የጻፈው አርትዒስት ያነሱትን አይችልም።',
  },

  privacy: {
    title: 'የግለዳዊነት ማስጠንቀቂያ',
    lastUpdatedLabel: 'መጨረሻ ጊዜ',
    dataTitle: 'ምን ይሰበሰባለን',
    dataBody:
      'በሪፖርት ውስጥ የጻፉት፣ የመረጡት ምድብ፣ የሰጡት ጊዜና ቦታ፣ የያዎት ፋይል፣ እና — ከመረጡት ብቻ — ስምዎ፣ የስልክ ቁጥርዎ ወይም ኢሜይል።',
    useTitle: 'ለምን እንጠቀማለን',
    useBody: 'ባለሙያዎች ሪፖርትዎን እንዲመለከቱ፣ እና ከጠየቁት ጋር ለያገናኝ እንዲያግኑ።',
    accessTitle: 'ማን ማየት ይችላል',
    accessBody:
      'ሪፖርቶችን ለመመልከት የተፈቀዱ የሠራችን ባለሙያዎች። ከሪፖርት ጋር የተያያዘውን የግል መረጃ ማነበብ የተለየ ፈቃድ ነው፤ ማንኛውም ሲፈጸም ይመዝግባል።',
    retentionTitle: 'ለረዘመን ቅጣት',
    retentionBody:
      'የተዘጋ ሪፖርት በጊዜ ገደብ ውስጥ ተይዟል በኋላ ይጠፋል። ትክክለኛው ጊዜ ገና አልተስማማም፤ ማንኛውም ፓይሎት ከመጀመሪያው በፊት እዚህ መታተም አለበት።',
    rightsTitle: 'የእርስዎ መብት',
    rightsBody:
      'ስለእርስዎ ያለንን መረጃ ማየት፣ ማስተካከል ወይም ማጥፋት ይጠይቃሉ። ከዚህ በታች ያለውን አድራሻ ይጻፉና ሕጋ የሚያስፈልገውን ጊዜ ውስጥ እንመልሳለን።',
    cookiesTitle: 'ኩክኒዎች',
    cookiesBody:
      'ይህ ስልጥ የማስታወቂያ ወይም የትንተና ኩክኒ አያስገባም። የሠራችን ግባ በደህንነት የሚያስፈልገውን ኩክኒ ይጠቀማል፤ ስክሪፕቶች ሊያነቡት አይችሉም።',
    contactTitle: 'ጥያቄዎች',
    automatedNote:
      'ይህ ለተጠበቀ ፓይሎት የተዘጋጀ ረቂቅ ነው። ገና በሐንዝ አማካር አልታየም፤ ስለሆነም ሕጋዊ በቂ የሆነ ማስጠንቀቂያ አይደለም።',

    requestCta: 'ስለመረጃዬ ጥያቄ አቀርብ',
    requestFormTitle: 'ስለመረጃዎ ይጠይቁ',
    requestTypeLabel: 'ምን ልጠይቅ?',
    requestTypeAccess: 'ስለእኔ ያላታቸውን ይምሩኝ',
    requestTypeCorrection: 'ለወሲት ማስተካከል',
    requestTypeDeletion: 'መረጃዬን አጥፋ',
    requestDetailsLabel: 'ተጨማሪ ይግለጹ',
    requestDetailsHelp:
      'ቢያንስ 20 ፊደል፣ ምን ማለትንት እንዳለዎት እንዳለግብ። ስለ ለተወሰነ ሪፖርት ከሆነ ቁጥሩን ያካትቱ።',
    requestReferenceLabel: 'የሪፖርት ቁጥር',
    requestReferenceHelp: 'ስለ ተወሰነ ሪፖርት ከሆነ።',
    requestNameLabel: 'ስምዎ',
    requestEmailLabel: 'ኢሜይል አድራሻ',
    requestPhoneLabel: 'የሞባይል ቁጥር',
    requestSubmit: 'ጥያቄዬን ላክ',
    requestSuccess:
      'ጥያቄዎ ተቀብለናል። አንድ ሰው ያያዘውን በመስተያተኑ የመረጃዎን አድራሻ ያግኝዎታል።',
  },

  reportStatus: {
    SUBMITTED: 'ተልኳል',
    UNDER_REVIEW: 'በመመልከት ላይ',
    VERIFIED: 'ተረጋግጧል',
    ASSIGNED: 'ለአገልግሎት ተልኳል',
    IN_PROGRESS: 'ላይ በሥራ ላይ',
    RESOLVED: 'ተፈትሯል',
    CLOSED: 'ተዘግቷል',
    REJECTED: 'አልተቀበለም',
    DUPLICATE: 'ከሌላ ሪፖርት ጋር ተደጋጋሚ',
    urgencyLOW: 'ዝቅተኛ',
    urgencyNORMAL: 'መደበኛ',
    urgencyHIGH: 'ከፍተኛ',
    urgencyCRITICAL: 'አደገኛ',
  },

  validation: {
    required: 'ያስፈልጋል።',
    categoryRequired: 'ከዘርፎቹ አንድ ይምረጡ።',
    descriptionTooShort: 'እባክዎ ቢያንስ 20 ፊደል ይጻፉ እንዲረዳን።',
    descriptionTooLong: 'ወደ 5000 ፊደላት ያነሱ።',
    languageRequired: 'ቋንቋ ይምረጡ።',
    phoneInvalid: 'ትክክለኛ የኢትዮጵያ የሞባይል ቁጥር ያስገቡ፣ ለምሳሌ 0912345678።',
    emailInvalid: 'ትክክለኛ ኢሜይል አድራሻ ያስገቡ።',
    nameTooLong: 'አጭሩ።',
    landmarkTooLong: 'ወደ 500 ፊደላት ያነሱ።',
    dateInvalid: 'ትክክለኛ ቀን ያስገቡ።',
    consentRequired: 'ከመላክዎ በፊት ያስገምጡ።',
    isAnonymousUnsupported:
      'ያለካረፍ መረጃ መላክ አይገኝም። በእውነት ስለ ሳንተር አንድም ማሳደጊያ ልካም አልችሉም፣ ስለዚህም አያቀርቡም።',
    referenceInvalid: 'የሪፖርት ቁጥሩን በተሰጠው መልክ ያስገቡ።',
    tokenRequired: 'የግል ኮድዎን ያስገቡ።',
    tokenInvalid: 'ያ የግል ኮድ አይዛመድም።',
    requestDetailsTooShort: 'ትንሽ ተጨማሪ ይግለጹ — ቢያንስ 20 ፊደል።',
    requestTypeRequired: 'ምን ማድረግ እንደሚፈልጉ ይምረጡ።',
  },

  staff: {
    title: 'የሠራችን ግባ',
    intro: 'ለተፈቀዱ የACC የሠራችን ባለሙያዎች ብቻ።',
    emailLabel: 'ኢሜይል አድራሻ',
    passwordLabel: 'የይለፍ ቃል',
    signIn: 'ግባ',
    signingIn: 'በመግባት ላይ',
    signOut: 'ውጣ',
    mfaRequiredTitle: 'ሁለተኛ የማረጋገጫ ስርዓት ያስፈልጋል',
    mfaRequiredBody:
      'የእርስዎ የሥራ ደረጃ ሁለተኛ ሁኔታ ይጠይቃል። አሁን ያዘጋጁት፤ ማንኛውም ጊዜ ሲግቡ ያስፈልጋል።',
    mfaBegin: 'ማዘጋጀት ጀምር',
    mfaCodeLabel: 'ከአውቲንቴክኤተር መተግበሪያዎ የመጣ ኮድ',
    mfaConfirm: 'አረጋግጥና ጨርህ',
    mfaEnrolled: 'ሁለተኛ የማረጋገጫ ስርዓት አሁን በሥራ ላይ ነው።',
    signInFailed: 'መግባት አልቻልንም።',
    rateLimited: 'በጣም ሙከራዎች። የትንሽ ደቂቃ ይጠብቁ፤ እንደገና ይሞክሩ።',
    locked: 'ይህ ልክ በጊዜ ተዘግቷል። ወደገና ይሞክሩ።',
    mfaRequired: 'የእርስዎ ልክ በመጀመሪያ ሁለተኛ የማረጋገጫ ስርዓት ማዘጋጀት አለበት።',

    queueTitle: 'ሪፖርቶች',
    queueEmpty: 'ከእነዚህ ማጣሪያዎች ጋር የሚዛመድ ሪፖርት የለም።',
    queueLoading: 'ሪፖርቶች በመጫን ላይ',
    filterReference: 'የሪፖርት ቁጥር',
    filterStatus: 'ክፍተት',
    filterUrgency: 'አስቸኳይነት',
    filterAssigned: 'እኔ የተመደበኝ',
    filterUnassigned: 'ያልተመደበ',
    filterAll: 'ሁሉም',
    columnReference: 'ቁጥር',
    columnStatus: 'ክፍተት',
    columnUrgency: 'አስቸኳይነት',
    columnCategory: 'ምድብ',
    columnSubmitted: 'ተልኳል',
    columnAssigned: 'ተመደበ',

    detailTitle: 'ሪፖርት {reference}',
    detailDescription: 'የተሰጠው',
    detailReporter: 'ያሳወቀው',
    detailReporterWithheld: 'ተደብቧል — ይህን ለመታየት ፈቃድዎ የለዎም',
    detailLocation: 'የት',
    detailAttachments: 'ተያያይ ፋይሎች',
    detailHistory: 'የክፍተት ታሪክ',
    detailNotes: 'የውስጥ ማስታወሻዎች',
    noNotes: 'ገና ማስታወሻ የለም።',
    triageTitle: 'ምደበኛ አስተያየት',
    triageUrgency: 'አስቸኳይነት',
    triageVerification: 'ማረጋገጫ',
    triageReason: 'ምክንያት',
    transitionTitle: 'ወደ ማንቀሳቀስ',
    transitionReason: 'የዚህ ለውጥ ምክንያት',
    applyTransition: 'ተግብር',
    notAssignedToYou: 'ይህ ሪፖርት እርስዎ አይመደብም።',
  },
};

export default am;