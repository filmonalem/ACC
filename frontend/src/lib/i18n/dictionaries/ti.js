/**
 * ትግርኛ (Tigrinya) dictionary.
 *
 * Must contain exactly the keys in `en.js`. A test enforces this.
 *
 * Notes for anyone editing this file:
 *
 *  - **Emergency wording is safety-critical.** No critical string is machine
 *    translated. Where a reviewed translation is missing, delete the key and
 *    let the English fallback show — a wrong instruction about who to telephone
 *    is worse than an English one.
 *  - Register: written Tigrinya uses a formal register. "እስኹም" (you, polite)
 *    where Latin would be casual.
 *  - Numerals: Western Arabic digits (0-9) are used in Ethiopia, not Ethiopic
 *    numerals, so times and reference codes stay readable.
 */

const ti = {
  meta: {
    title: 'ዓዲግራት ናይ ሕብረተሰብ ርክብ',
    tagline: 'ተራኺቡ ዝነብር ሕብረተሰብ። ውሑስ ኣከባቢ።',
    description:
      'ናይ ሕብረተሰብ ጸገማት ሓብሩ፣ እሙን ናይ ኣገልግሎት ሓበሬታ ኣረጋግጹ፣ ከምኡ’ውን ዝተፈቐዱ ህዝባዊ መልእኽትታት ኣንብቡ።',
  },

  common: {
    skipToContent: 'ናብ ዋና ትሕዝቶ ሕለፍ',
    language: 'ቋንቋ',
    changeLanguage: 'ቋንቋ ቐይር',
    loading: 'ብምጽዓን ላይ ይርከብ...',
    retry: 'እንደገና ሞክር',
    close: 'ዕጸው',
    next: 'ቀጻሊ',
    back: 'ተመለስ',
    submit: 'ኣእቱ',
    cancel: 'ሰርዝ',
    optional: 'ምልCross / ኣማራጺ',
    required: 'ግደታ እዩ',
    search: 'ድለይ',
    showingResults: 'ውጽኢታት ተገሊጾም ኣለው',
    lastUpdated: 'ዘመነሉ እዋን',
    page: 'ገጽ',
    of: 'ን/ከምኡ',
    previous: 'ዝሓለፈ',
    nextPage: 'ቀጻሊ ገጽ',
    readMore: 'ተወሳኺ ኣንብብ',
    exampleEntry: 'ኣብነት መእተዊ',
    exampleEntryHelp: 'ዚ ናይ ማእከላይ መርኣያ ሓበሬታ እዩ፤ ደውሊኻ ኣይርከብን።',
    notFound: 'ገጽ ኣይተረኽበን',
    notFoundHelp: 'እቲ ዝደለኹምዎ ገጽ የለን፣ ወይ ተቐይሩ እዩ።',
    somethingWentWrong: 'ጉድለት/ስሕተት ተፈጢሩ',
    somethingWentWrongHelp: 'እቲ ጸገም ተመዝጊቡ ኣሎ። እንደገና ክትፍouter ትኽእሉ፣ ወይ ኣብ ታሕቲ ዘሎ ቁጽሪ ስልኪ ተጠቐሙ።',
  },

  nav: {
    home: 'መበገሲ ገጽ',
    report: 'ጸገም ሓብር',
    status: 'ኩነታት ሪፖርት ኣረጋግፅ',
    contacts: 'ናይ ሓደጋ እዋን መረጋገጺ ቁጽርታት',
    updates: 'ህዝባዊ መልእኽትታት',
    support: 'ናይ ሕብረተሰብ ሓገዝ',
    about: 'ብዛዕባና',
    privacy: 'ፖሊሲ ብሕት Normal',
    staff: 'መእተዊ ሰራሕተኛታት',
    menu: 'ማውጫ',
    openMenu: 'ማውጫ ክፈት',
    closeMenu: 'ማውጫ ዕጸው',
  },

  emergency: {
    title: 'ናይ ሓደጋ እዋን እዩ?',
    body: 'ACC ናይ ሓደጋ እዋን መፍትሒ ኣገልግሎት ኣይኮነን፤ ምስ ህጹጽ ናይ ሓደጋ ትካላት እውን ቀጥታ መስመር የብሉን።',
    action: 'እባክኹም ብቐጥታ ንዝምልከቶ ናይ ሓደጋ ኣገልግሎት ደውሉ::',
    footerNote: 'ስልኪ እንተዘይሰሪሑልኩም፣ ንዓበይቲ ዓዲ፣ ንጎረባብቲ ወይ ንኣከባቢ ምምሕዳር ሓገዝ ሕተቱ።',
  },

  footer: {
    aboutTitle: 'ብዛዕባዚ መድረኽ',
    aboutBody: 'ዓዲግራት ናይ ሕብረተሰብ መድረኽ ውሑስ ናይ ሕብረተሰብ መሳርሒ እዩ። ናይ መንግስቲ ኣገልግሎት ኣይኮነን።',
    contactTitle: 'ርክብ',
    accessTitle: 'ተበጻሕነት',
    accessBody: 'ዚ መድረኽ ንWCAG 2.1 AA ንምምላእ ዝተሰርሐ እዩ። ንምጥቃም ጸገም እንተጋጢምኩም ሓብሩና።',
    policiesTitle: 'ፖሊሲታት',
    rightsTitle: 'መሰልኩም',
    rightsBody: 'ብዛዕባኹም ዘሎና ሓበሬታ ናይ ምእላይ፣ ናይ ምእራም ወይ ናይ ምስራዝ መሰል ኣለኩም።',
    version: 'ቨርሽን መድረኽ',
  },

  home: {
    heroTitle: 'ጸገም ሓብሩ። እንታይ ይግበር ከምዘሎ ፍለጡ። ንመን ክትደውሉ ከምዘለኩም ኣረጋግጹ።',
    heroBody:
      'ACC ኣብ ሕብረተሰብኩም ዝረኣዩ ጸገማት ንምሕባር፣ ዝለኣኽክምዎ ሪፖርት ኣብ እንታይ ደረጃ ከምዝበጽሐ ንምክትታል፣ ከምኡ’ውን ዝተረጋገጸ ናይ ኣገልግሎት ሓበሬታ ንምርካብ የገልግል።',
    reportCta: 'ጸገም ሓብር',
    checkCta: 'ኩነታት ሪፖርት ኣረጋግፅ',
    emergencyCta: 'ናይ ኣገልግሎት ሓበሬታ ድለይ',

    featuresTitle: 'ኣብዚ እንታይ ክትገብሩ ትኽእሉ',
    featuresIntro: 'ኣርባዕተ ነገራት። ዋላ ሓደ ክፍሊት ኣይሕተትልኩምን እዩ።',

    featureReportTitle: 'ጸገም ሓብር',
    featureReportBody:
      'ዝረኣኹምዎ ጸገም ሓብሩና። ብኡንብኡ ናይ ሪፖርት ቁጽሪ ክወሃበኩም እዩ፤ ድሕሪ ሕጂ እውን ኩነታቱ ክትከታተሉ ትኽእሉ።',

    featureContactsTitle: 'ናይ ሓደጋ እዋን መረጋገጺ ቁጽርታት',
    featureContactsBody:
      'ብሰብ ዝተረጋገጹ ናይ ኣገልግሎት ቁጽርታት ዝርዝር። ነፍሲ ወከፍ ቁጽሪ መዓስ ከምዝተረጋገጸ ብንጹር ይሕብር።',

    featureUpdatesTitle: 'ህዝባዊ መልእኽትታት',
    featureUpdatesBody:
      'ብዝተፈቐደሎም ኣሰናዳእቲ (editors) ዝተጸሓፉን ዝተረጋገጹን ህዝባዊ ማስታወቂያታት።',

    featureSupportTitle: 'ናይ ሕብረተሰብ ሓገዝ',
    featureSupportBody:
      'ኣብ ዓዲግራት ዝርከቡ ናይ  ጥዕና፣ ሕብረተሰብን ናይ ሓደጋ መፍትሒ ሓገዛትን ብንጹር ዝተቐመጠሉ።',

    updatesTitle: 'ኣብ ቀረባ እዋን ዝተረጋገጹ ማስታወቂያታት',
    updatesEmpty: 'ኣብዚ እዋን ዝወጸ ማስታወቂያ የለን።',
    updatesAll: 'ኩሎም ማስታወቂያታት ርኣይ',

    contactsTitle: 'ኣብ ቀረባ እዋን ዝተረጋገጹ ናይ ኣገልግሎት ቁጽርታት',
    contactsEmpty: 'ዝተረጋገጸ ናይ ኣገልግሎት ሓበሬታ ገና ኣይወፀን።',
    contactsAll: 'ኩሎም ናይ ኣገልግሎት ሓበሬታታት ርኣይ',

    processTitle: 'ሪፖርት ምልኣኽ ብኸመይ ይ ይሰርሕ',
    processIntro: 'ኣርባዕተ ኣሰራርሓታት። ኣብ ዝደለኹምዎ እዋን ክተቋርጹ ትኽእሉ እዩ።',

    step1Title: 'እንታይ ከምዘጋጠመ ብዛዕባኡ ሓብሩ',
    step1Body: 'ብናይ ባዕልኹም ቃላት። ክንደይ ዝኣክል ሓበሬታ ክትህቡ ከምዝደለኹም ንስኹም ትውስኑ።',

    step2Title: 'ናይ ሪፖርት ቁጽሪ ክወሃበኩም እዩ',
    step2Body:
      'እዚ ቁጽሪ እዚ ሓዞዎ። ምስ ናይ ብሕቲ ኮድኩም (personal token) ብምሕዋስ ሪፖርትኩም ንምክትታል የገልግል።',

    step3Title: 'ሰብ ሞያታትና ክምረምርዎ እዮም',
    step3Body: 'ባለሙያ ብዝተወሰነ ናይ ስራሕ ሰዓት ኣቢሉ ሪፖርትኩም ይርእዮ።',

    step4Title: 'ዕብየቱ/ደረጃኡ ክትከታተሉ ትኽእሉ',
    step4Body: 'ብናይ ሪፖርት ቁጽርኹምን ብሕታዊ ኮድኩምን ገይርኩም እቲ ዝበጽሖ ደረጃ ርኣዩ።',

    privacyTitle: 'ንሓበሬታኹም ብኸመይ ንጥቀመሉ',
    privacyBody:
      'ሪፖርታት ምስጢራዊ እዮም። ዝተፈቐደሎም ሰራሕተኛታት ጥራሕ እዮም ዝርእይዎ። ንስኹም ዘይፈቐድክምዎ ናይ ብሕቲ ሓበሬታ ኣይግለጽን እዩ።',
    privacyCta: 'ናይ ብሕትነት ፖሊሲ ኣንብብ',

    disclaimerTitle: 'እዚ ቅድመ-ግንዛቤ እባክኹም ኣንብብዎ',
    disclaimerBody:
      'ACC ውሑስ ናይ ሕብረተሰብ መድረኽ እዩ። ናይ መንግስቲ ኣገልግሎት ኣይኮነን፤ ምስ ናይ ሓደጋ ኣገልግሎታት እውን ቀጥታ መስመር የብሉን። ንህጹጽ ሓደጋታት ብቐጥታ ብስልኪ ደውሉ።',
  },

  report: {
    title: 'ጸገም ሓብር',
    intro: 'እዚ ፎርም ኣብ ሕብረተሰብኩም ዘለው ጸገማት ንምሕባር እዩ። ንህጹጽ ሓደጋታት ብስልኪ ብቐጥታ ደውሉ።',

    progressLabel: 'ደረጃ {current} ከ {total}',

    stepCategoryTitle: 'እዚ ብዛዕባ እንታይ እዩ?',
    stepCategoryHelp: 'ቀሊል ዝኾነ ምረጹ። ኣድላይ እንተኾይኑ ሰብ ሞያታት ክቕይርዎ ይኽእሉ እዮም።',

    stepDescriptionTitle: 'እንታይ ተፈጢሩ?',
    stepDescriptionHelp: 'ንኻልኦት ሰባት ከምተረድእዎ ገይርኩም ጸሓፍዎ። እንታይ፣ መዓስን ኣበይን ከምዘጋጠመ ግለጹ።',
    descriptionLabel: 'ዝተፈጸመ ጸገም ግለጹ',
    descriptionPlaceholder:
      'ኣብነት፦ ኣብዚ መንገዲ ዘሎ ናይ ጎደና መብራህቲ ንሓደ ሰሙን ዝኣክል ኣይሰርሐን። ብል Severe ጸልማት እዩ፣ ሰባት እውን ይሸገሩ ኣለው።',

    stepContextTitle: 'መዓስን ኣበይን',
    stepContextHelp: 'ምልኣኹ ኣማራጺ እዩ፤ ግን ንሰራሕተኛታትና ብዙሕ ይሕግዝ።',
    incidentDateLabel: 'እቲ ጸገም መዓስ ተፈጢሩ?',
    incidentTimeLabel: 'ብግምት ኣብ ክንደይ ሰዓት?',
    timePrecisionLabel: 'እቲ ሰዓት ክንደይ ዝኣክል ዝተረጋገጸ እዩ?',
    timePrecisionExact: 'ብትክክል ዝተወሰነ',
    timePrecisionDate: 'ዕለቱ ጥራሕ፣ ሰዓቱ ኣይኮነን',
    timePrecisionApproximate: 'ብግምት',
    timePrecisionUnknown: 'ኣይፍለጥን',
    locationHeading: 'ኣበይ እዩ?',
    locationHelp:
      'ሓፈሻዊ ቦታ ምጥቃስ እኹል እዩ። ትክክለኛ መበገሲ ወይ ናይ ባዕልኹም ኣድራሻ ኣይተእትዉ— ፍሉጥ ቦታ ወይ ናይ ቀበሌ ስም ንዓና እኹል እዩ።',
    subCityLabel: 'ክፍለ ከተማ',
    woredaLabel: 'ወረዳ',
    kebeleLabel: 'ቀበሌ',
    landmarkLabel: 'ፍሉጥ ቦታ/መ ምልክታ ግለጹ',
    landmarkPlaceholder: 'ኣብነት፦ ካብ ሰማያዊ ድኳን ቅድመ-ገጽ፣ ኣብ ጥቓ ክሊኒክ',

    stepContactTitle: 'ብኸመይ ክነራኽበኩም እንተደሊና?',
    stepContactHelp:
      'ኣማራጺ እዩ። ሓበሬታ እንተዘይሃብኩም እውን ብናይ ሪፖርት ቁጽርኹምን ብሕታዊ ኮድኩምን ገይርኩም ክትከታተሉ ትኽእሉ እዩ።',
    contactNameLabel: 'ስምኩም',
    contactPhoneLabel: 'ቁጽሪ ሞባይል',
    contactPhoneHelp: 'ናይ ኢትዮጵያ ቁጽሪ ሞባይል ጥራሕ፣ ንኣብነት 0912345678።',
    contactEmailLabel: 'ኢሜይል ኣድራሻ',
    contactMethodLabel: 'ዝበለጸ ናይ ርክብ መገዲ',
    methodPhone: 'ብናይ ስልኪ ድውሊ',
    methodSms: 'ብጽሑፍ መልእኽቲ (SMS)',
    methodEmail: 'ብኢሜይል',
    methodNone: 'ርክብ ኣየድልይን',

    stepReviewTitle: 'ኣረጋግጹን ልኣኹን',
    reviewHelp: 'ቅድሚ ምልኣኽኩም እባክኹም መርምርዎ። ዝኾነ ነገር ንምእራም ንድሕሪት ክትምለሱ ትኽእሉ እዩ።',
    reviewCategory: 'ዓይነት/መደብ',
    reviewDescription: 'ዝጸሓፍክምዎ',
    reviewContext: 'መዓስን ኣበይን',
    reviewContact: 'ናይ ርክብ ሓበሬታ',
    reviewNotGiven: 'ኣይተሃበን',
    consentLabel: 'ናይ ብሕትነት ፖሊሲ ኣንቢበዮ ኣለኹ፤ ሪፖርተይ ክስራሓሉ ተሰማሚዐ ኣለኹ።',
    consentLink: 'ናይ ብሕትነት ፖሊሲ ኣንብብ',
    submitButton: 'ሪፖርተይ ልኣኽ',

    successTitle: 'ሪፖርትኩም ተልኢኹ ኣሎ',
    successBody: 'እዚኦም ሓዞኦም። ድሕሪ ሕጂ ንምክትታል ክልቲኦም የድልዩኹም እዮም።',
    referenceLabel: 'ናይ ሪፖርት ቁጽርኹም',
    tokenLabel: 'ናይ ብሕቲ ኮድኩም (Personal Token)',
    tokenHelp:
      'እዚ ኮድ እዚ ሓደ ግዜ ጥራሕ እዩ ዝርአ። ብዘይዚ ኮድ ሰራሕተኛታትና እውን እንተኾኑ ሪፖርትኩም ብሓይሊ ክኸፍትዎ ኣይኽእሉን።',
    tokenSaved: 'እዚኦም ብንጹር ዓቂበዮም ኣለኹ',
    tokenNotSaved: 'ገና ኣይጸሓፍክዎን',
    checkStatusCta: 'ኩነታት ሪፖርተይ ኣረጋግፅ',
    submitAnother: 'ካሊእ ጸገም ሓብር',
    successNextTitle: 'ቀጻሊ እንታይ ይኸውን?',
    successNextBody:
      'ሰራሕተኛ ብዝተወሰነ ናይ ስራሕ ሰዓት ሪፖርትኩም ይርእዮ። ገለ መስተኻኸሊ እንተሃልዩ ክነፍልጠኩም ኢና። እዚ ህጹጽ እንተኾይኑ ብቐጥታ ንዝምልከቶ ኣካል ደውሉ።',

    pendingTitle: 'ኣብዚ መሳርሒ ተዓቂቡ ኣሎ፣ ገና ኣይተላኸን',
    pendingBody:
      'ሪፖርትኩም ኣብዚ ተዓቂቡ ኣሎ ግን መስመር ኢንተርነት ብዘይምንባሩ ኣይተላኸን። መስመር እንተረኺቡ ብባዕሉ ክልኣኽ እዩ።',
    pendingCta: 'ሕዚ እንደገና ልኣኽ',
    pendingLeaveWarning:
      'ካብዚ ገጽ እንተወጺእኩም እቲ ዝተዓቀበ ሪፖርት ክጠፍእ እዩ። ቅድሚ ምውጻእኩም ክልኣኽ ፈትኑ።',

    errorTitle: 'ሪፖርትኩም ክንልእኮ ኣይከኣልናን',
    errorBody:
      'ዋላ ሓደ ኣይተዓቀበን። ዝጸሓፍክምዎ ቃላት ኣብቲ ፎርም ኣሎ— እንደገና ሞክሩ፣ ወይ ብስልኪ ብቐጥታ ደውሉ።',
  },

  status: {
    title: 'ኩነታት ሪፖርት ኣረጋግፅ',
    intro: 'ሪፖርትኩም ክትልእኩ ከለኹም ዝተወሃበኩም ናይ ሪፖርት ቁጽርን ናይ ብሕቲ ኮድን ኣእትዉ።',
    referenceLabel: 'ናይ ሪፖርት ቁጽሪ',
    referenceHelp: 'ኣብነት፦ ACC-7F3K9Q2M ዝመሰል እዩ።',
    tokenLabel: 'ናይ ብሕቲ ኮድ (Token)',
    tokenHelp: 'ድሕሪ ምልኣኽኩም ሓደ ግዜ ዝተራእየ ነዊሕ ኮድ።',
    submitButton: 'ሪፖርተይ ኣረጋግፅ',

    resultTitle: 'ሪፖርትኩም',
    resultStatus: 'ሕዚ ዘለዎ ኩነታት',
    resultSubmitted: 'ተልኢኹ ኣሎ',
    resultFirstReviewed: 'መጀመሪያ ተመሪምሩ',
    resultResolved: 'ተፈቲሑ ኣሎ',
    resultCategory: 'ዓይነት/መደብ',
    resultUrgency: 'ህጹጽነት ደረጃ',
    resultMessage: 'እዚ እንታይ ማለት እዩ',
    resultNotYet: 'ገና ኣይተጀመረን',

    notFoundTitle: 'እቲ ዝደለኹምዎ ሪፖርት ኣይተረኽበን',
    notFoundBody:
      'ክልቲኦም ኮዳት ትክክል ምኻኖም ኣረጋግጹ። ቁጽሪ ሪፖርት ሓጺር እዩ፤ ናይ ብሕቲ ኮድ ድማ ነዊሕ እዩ። ክልቲኦም ክሰማምዑ ኣለዎም።',
  },

  contacts: {
    title: 'ናይ ሓደጋ እዋን መረጋገጺ ቁጽርታት',
    intro:
      'ብሰብ ዝተረጋገጹ ናይ ኣገልግሎት ቁጽርታት ዝርዝር። ነፍሲ ወከፍ ቁጽሪ መዓስ ከምዝተረጋገጸ ኣረጋግጹ።',
    searchLabel: 'ናይ ኣገልግሎት ሓበሬታ ድለይ',
    searchPlaceholder: 'ስም ኣገልግሎት ወይ ዝደለኹምዎ ሓበሬታ...',
    emergencyOnlyLabel: 'ናይ ሓደጋ እዋን ኣገልግሎታት ጥራሕ ኣርኢ',
    resultsCount: '{count} ናይ ኣገልግሎት ቁጽርታት',
    resultsCountOne: '1 ናይ ኣገልግሎት ቁጽሪ',
    callCta: 'ደውል',
    coverageLabel: 'ዝሽፍኖ ኣከባቢ',
    lastVerifiedLabel: 'ዘመነሉ እዋን',
    expiresLabel: 'እንደገና ዝረጋገጸሉ',
    instructionsLabel: 'እንተዘይተነጊሩ/እንተዘይተረኺቡ',
    emptyTitle: 'ምስዚ ፍለጋ ዝሰማማዕ ናይ ኣገልግሎት ሓበሬታ ኣይተረኽበን',
    emptyBody: 'ሓጺር ፍለጋ ሞክሩ፣ ወይ ፍለጋኹም ኣጽርይዎ።',
    noPublishedTitle: 'ገና ናይ ኣገልግሎት ሓበሬታ ኣይወፀን',
    noPublishedBody: 'እዚ ክሳብ ዝረጋገፅ ብቐጥታ ብስልኪ ንዝምልከቶ ኣካል ደውሉ።',

    categoryEmergency: 'ሓደጋ እዋን',
    categoryPolice: 'ፖሊስ',
    categoryHealth: 'ጥዕና',
    categoryFire: 'ሓዊ/እሳት',
    categoryUtility: 'መሰረታዊ ኣገልግሎት (ማይ/መብራህቲ)',
    categoryTransport: 'ትራንስፖርት',
    categoryCommunity: 'ሕብረተሰብ',
    categoryGovernmentOffice: 'ቤት ጽሕፈት መንግስቲ',
    categoryOther: 'ካሊእ',
  },

  updates: {
    title: 'ህዝባዊ መልእኽትታት',
    intro: 'ቅድሚ ምውጽኦም ብዝተፈቐደሎም ኣሰናዳእቲ (editors) ዝጸደቁ ማስታወቂያታት።',
    searchLabel: 'ማስታወቂያታት ድለይ',
    emptyTitle: 'ኣብዚ እዋን ማስታወቂያ የለን',
    emptyBody: 'እባክኹም ድሕሪ ሕጂ ደጊምኩም ተመለሱ።',
    sourceLabel: 'ብወገን/ካብ',
    approvedByLabel: 'ዝጸደቀሉ ብ',
    publishedLabel: 'ዝተሓተመሉ ዕለት',
    expiresLabel: 'ዝኣልቀሉ/ዝዛዘመሉ',
    backToAll: 'ናብ ኩሎም ማስታወቂያታት ተመለስ',
    categoryPublicSafety: 'ህዝባዊ ደህንነት',
    categoryServiceNotice: 'ናይ ኣገልግሎት ማስታወቂያ',
    categoryHealthAdvisory: 'ናይ ጥዕና ምኽሪ',
    categoryInfrastructure: 'መሰረተ ልማት',
    categoryCommunity: 'ሕብረተሰብ',
    categoryOther: 'ካሊእ',
    translationPending: 'ብEnglish ጥራሕ ይርከብ',
    translationPendingHelp: 'ናብዚ ቋንቋ ዝተረጋገጸ ትርጉም ገና ኣይተወሃበን።',
  },

  support: {
    title: 'ናይ ሕብረተሰብ ሓገዝ',
    intro: 'ኣብ ዓዲግራት ዝርከብ ናይ ሓገዝ ኣገልግሎት። ነፍሲ ወከፍ ኣገልግሎት ንመን ከምዘገልግልን መዓስ ከምዝተረጋገጸን ይሕብር።',
    serviceAreaLabel: 'ናይ ኣገልግሎት ኣከባቢ',
    eligibilityLabel: 'መን ክጥቀመሉ ይኽእል',
    hoursLabel: 'ናይ ስራሕ ሰዓት',
    contactLabel: 'ርክብ',
    emptyTitle: 'ዝተመዝገበ ናይ ሓገዝ ኣገልግሎት የለን',
    emptyBody: 'እባክኹም ድሕሪ ሕጂ ደጊምኩም ተመለሱ።',
    notVerifiedTitle: 'ገና ኣይተረጋገጸን',
    verifiedTitle: 'ዝተረጋገጸ',
  },

  about: {
    title: 'ብዛዕባ ACC',
    purposeTitle: 'እዚ መድረኽ ንእንታይ ይጥቅም?',
    purposeBody:
      'ACC ንዓዲግራት ዝተዳለወ ውሑስ ናይ ሕብረተሰብ መድረኽ እዩ። ሰለስተ ነገራት የቕርብ፦ ጸገማት ምሕባር፣ ዝተላእከ ሪፖርት ምfollow ምግባር፣ ከምኡ’ውን ዝተረጋገጸ ናይ ኣገልግሎት ሓበሬታ ምእካብ።',
    limitationsTitle: 'ዘይሰርሖም ነገራት',
    limitationsBody:
      'ናይ መንግስቲ ኣገልግሎት ኣይኮነን። ምስ ናይ ሓደጋ ኣገልግሎታት ቀጥታ መስመር የብሉን። ብቐጥታ ናብ ዓደኹም ሰብ ኣይልእክን፣ ናይ ምላሽ እዋን እውን ውሕስነት ኣይህብን።',
    handlingTitle: 'ሪፖርት ብኸመይ ይእገስ/ይሰራሓሉ?',
    handlingBody:
      'ሪፖርታት ምስጢራዊ እዮም። ዝተፈቐደሎም ሰራሕተኛታት ጥራሕ እዮም ዝርእይዎ። ሰራሕተኛ ብዘይ ብቑዕ ምኽንያት ሪፖርት ክስርዝ ኣይፈቐደሉን።',
    governanceTitle: 'እዚ መድረኽ ናይ መን እዩ?',
    governanceBody:
      'ACC ብዝኾነ ናይ መንግስቲ ቤት ጽሕፈት ኣይመራሕን። ብዝተፈቐደሎም ናይ መድረኽ ኣመሓደርቲ ኣቢሉ ጥራሕ ሓበሬታታት ይወጹ።',
    partnersTitle: 'ሓጋዝትን ፍቓድን',
    partnersBody:
      'ዝተረጋገጸ ሓጋዚ/ፓርትነር የለን። ዝተረጋገጸ ሓበሬታ እንተሃልዩ ኣብዚ ገጽ ክወጽእ እዩ።',
    transparencyTitle: 'እንታይ ነውጽእ?',
    transparencyBody:
      'ማስታወቂያታት ብኣሰናዳኢ (editor) ድሕሪ ምጽዳቖም ጥራሕ ይወጹ፤ እቲ ዝጸሓፎ ሰብ እውን ባዕሉ ክሰርዞ ኣይኽእልን።',
  },

  privacy: {
    title: 'ናይ ብሕትነት ፖሊሲ',
    lastUpdatedLabel: 'ዘመነሉ እዋን',
    dataTitle: 'እንታይ ንእክብ?',
    dataBody:
      'ኣብ ሪፖርት ዝጸሓፍክምዎ፣ ዝመረጽክምዎ ምደባ፣ ቦታን ዕለትን፣ ዝተሓሓዙ ፋይላት፣ ከምኡ’ውን — እንተፈቒድኩም ጥራሕ — ስምኩም፣ ቁጽሪ ስልኪ ወይ ኢሜይልኩም።',
    useTitle: 'ስለምንታይ ንጥቀመሉ?',
    useBody: 'ሰራሕተኛታትና ንሪፖርትኩም መርሚሮም ብግቡእ ምላሽ ንኽህቡሉ እዩ።',
    accessTitle: 'መን ክርእዮ ይኽእል?',
    accessBody:
      'ሪፖርታት ንምርኣይ ፍቓድ ዘለዎም ሰራሕተኛታት ጥራሕ። ናይ ብሕቲ ሓበሬታ ንምርኣይ ፍሉይ ፍቓድ የድሊ፤ ነፍሲ ወከፍ ምርኣይ ድማ ይምዝገብ እዩ።',
    retentionTitle: 'ንክንደይ እዋን ይጸናሕ?',
    retentionBody:
      'ዝተዓጸወ ሪፖርት ንዝተወሰነ እዋን ጸኒሑ ይስረዝ። ትክክለኛ መዓልቲ ኣብ ቀጻሊ ይወሰን።',
    rightsTitle: 'መሰልኩም',
    rightsBody:
      'ብዛዕባኹም ዘሎና ሓበሬታ ናይ ምርኣይ፣ ናይ ምእራም ወይ ናይ ምስራዝ ሕቶ ክተቕርቡ ትኽእሉ እዮም። ብታሕቲ ዘሎ ኣድራሻ ጽሓፉልና።',
    cookiesTitle: 'ኩኪስ (Cookies)',
    cookiesBody:
      'እዚ መድረኽዚ ናይ ማስታወቂያ ወይ ናይ ትንተና ኩኪስ ኣይጥቀምን። ንደህንነት ሰራሕተኛታት ዘድልዩ ኩኪስ ጥራሕ ይጥቀም።',
    contactTitle: 'ሕቶታት',
    automatedNote:
      'እዚ ናይ ፈተነ ረቂቕ እዩ። ገና ብሕጋዊ ኣካል ኣይተረጋገጸን።',

    requestCta: 'ብዛዕባ ሓበሬታይ ሕቶ ኣቕርብ',
    requestFormTitle: 'ብዛዕባ ሓበሬታኹም ሕተቱ',
    requestTypeLabel: 'እንታይ ክሕተት ይደሊ?',
    requestTypeAccess: 'ብዛዕባይ ዘለኩም ሓበሬታ ኣርእዩኒ',
    requestTypeCorrection: 'ሓበሬታይ ንምእራም',
    requestTypeDeletion: 'ሓበሬታይ ስረዙለይ',
    requestDetailsLabel: 'ተወሳኺ ግለጹ',
    requestDetailsHelp:
      'ወሓደ 20 ፊደላት ጽሓፉ። ብዛዕባ ፍሉይ ሪፖርት እንተኾይኑ ቁጽሪ ሪፖርት ኣእትዉ።',
    requestReferenceLabel: 'ናይ ሪፖርት ቁጽሪ',
    requestReferenceHelp: 'ብዛዕባ ዝተወሰነ ሪፖርት እንተኾይኑ ጥራሕ።',
    requestNameLabel: 'ስምኩም',
    requestEmailLabel: 'ኢሜይል ኣድራሻ',
    requestPhoneLabel: 'ቁጽሪ ሞባይል',
    requestSubmit: 'ሕቶይ ልኣኽ',
    requestSuccess:
      'ሕቶኹም ተቐቢልናዮ ኣለና። ብዝተኻእለ መጠን ቀልጢፍና ክነራኽበኩም ኢና።',
  },

  reportStatus: {
    SUBMITTED: 'ተልኢኹ ኣሎ',
    UNDER_REVIEW: 'ኣብ ምምርማር ይርከብ',
    VERIFIED: 'ዝተረጋገጸ',
    ASSIGNED: 'ናብ ኣገልግሎት ተልኢኹ',
    IN_PROGRESS: 'ስራሕ ኣብ ምክያድ ይርከብ',
    RESOLVED: 'ተፈቲሑ ኣሎ',
    CLOSED: 'ተዓጺኡ ኣሎ',
    REJECTED: 'ኣይተቐበሎን/ተነጺጉ',
    DUPLICATE: 'ምስ ካሊእ ዝተደጋገመ',
    urgencyLOW: 'ትሕተይና',
    urgencyNORMAL: 'ተደላይ/መደበኛ',
    urgencyHIGH: 'ልዑል',
    urgencyCRITICAL: 'ኣዝዩ ህጹጽ/ሓደገኛ',
  },

  validation: {
    required: 'እዚ መእተዊ ግደታ እዩ።',
    categoryRequired: 'ካብቶም ዓይነታት ሓደ ምረጹ።',
    descriptionTooShort: 'እባክኹም ብውሕዱ 20 ፊደላት ጽሓፉ።',
    descriptionTooLong: 'ካብ 5000 ፊደላት ንታሕቲ ጽሓፉ።',
    languageRequired: 'ቋንቋ ምረጹ።',
    phoneInvalid: 'ትክክለኛ ናይ ኢትዮጵያ ቁጽሪ ሞባይል ኣእትዉ፣ ንኣብነት 0912345678።',
    emailInvalid: 'ትክክለኛ ኢሜይል ኣድራሻ ኣእትዉ።',
    nameTooLong: 'ሓጺር ስም ኣእትዉ።',
    landmarkTooLong: 'ካብ 500 ፊደላት ንታሕቲ ጽሓፉ።',
    dateInvalid: 'ትክክለኛ ዕለት ኣእትዉ።',
    consentRequired: 'ቅድሚ ምልኣኽኩም እዚ ውዕል ተቐበልዎ።',
    isAnonymousUnsupported:
      'ብዘይ ስም ምልኣኽ ኣይከኣልን።',
    referenceInvalid: 'ቁጽሪ ሪፖርት ብግቡእ ቅርጺ ኣእትውዎ።',
    tokenRequired: 'ናይ ብሕቲ ኮድኩም (Token) ኣእትዉ።',
    tokenInvalid: 'እቲ ዘእተቲክምዎ ናይ ብሕቲ ኮድ ኣይሰማማዕን።',
    requestDetailsTooShort: 'ብውሕዱ 20 ፊደላት ብምጽሓፍ ተወሳኺ ሓበሬታ ጽሓፉ።',
    requestTypeRequired: 'እንታይ ክገብሩ ከምዘለዎም ምረጹ።',
  },

  staff: {
    title: 'መእተዊ ሰራሕተኛታት',
    intro: 'ንዝተፈቐደሎም ሰራሕተኛታት ACC ጥራሕ።',
    emailLabel: 'ኢሜይል ኣድራሻ',
    passwordLabel: 'ይለፍ ቃል (Password)',
    signIn: 'እቶ',
    signingIn: 'ኣብ ምእታው ይርከብ...',
    signOut: 'ወጽእ',
    mfaRequiredTitle: 'ካልኣይ ደረጃ ማረጋገጺ (MFA) የድሊ',
    mfaRequiredBody: 'ናይ ስራሕ ደረጃኹም ካልኣይ ደረጃ ማረጋገጺ ይሕተት። ሕዚ ኣዳልውዎ።',
    mfaBegin: 'ምድላው ጀምር',
    mfaCodeLabel: 'ካብ ማረጋገጺ መተግበሪኹም (Authenticator App) ዝመጸ ኮድ',
    mfaConfirm: 'ኣረጋግጽን ዛዝምን',
    mfaEnrolled: 'ካልኣይ ደረጃ ማረጋገጺ ሕዚ ይሰርሕ ኣሎ።',
    signInFailed: 'ምእታው ኣይከኣልናን።',
    rateLimited: 'ብዙሕ ፈተነታት ተገይሩ። ሒደት ደቂቓ ጸኒሕኩም ደጊምኩም ሞክሩ።',
    locked: 'እዚ ኣካውንት ንግዝኡ ተዓጺኡ ኣሎ። ድሕሪ ሕጂ ሞክሩ።',
    mfaRequired: 'ኣካውንትኩም ቅድመ-ሁኔታ ካልኣይ ደረጃ ማረጋገጺ ከዳልው ኣለዎ።',

    queueTitle: 'ሪፖርታት',
    queueEmpty: 'ምስዞም ማጣሪያታት ዝሰማማዕ ሪፖርት የለን።',
    queueLoading: 'ሪፖርታት ብምጽዓን ላይ ይርከቡ...',
    filterReference: 'ቁጽሪ ሪፖርት',
    filterStatus: 'ኩነታት',
    filterUrgency: 'ህጹጽነት',
    filterAssigned: 'ንዓይ ዝተወሃበ',
    filterUnassigned: 'ዘይተወሃበ',
    filterAll: 'ኩሎም',
    columnReference: 'ቁጽሪ',
    columnStatus: 'ኩነታት',
    columnUrgency: 'ህጹጽነት',
    columnCategory: 'ዓይነት/መደብ',
    columnSubmitted: 'ዝተላኸሉ',
    columnAssigned: 'ዝተወሃበሉ ሰብ',

    detailTitle: 'ሪፖርት {reference}',
    detailDescription: 'ዝተሃበ መግለጺ',
    detailReporter: 'ዝሓበረ ሰብ',
    detailReporterWithheld: 'ዝተሰወረ — እዚ ንምርኣይ ፍቓድ የብልኩምን',
    detailLocation: 'ቦታ',
    detailAttachments: 'ዝተሓሓዙ ፋይላት',
    detailHistory: 'ናይ ኩነታት ታሪክ',
    detailNotes: 'ናይ ውሽጢ ማስታወሻታት',
    noNotes: 'ገና ማስታወሻ የለን።',
    triageTitle: 'መበገሲ ገምጋም',
    triageUrgency: 'ህጹጽነት',
    triageVerification: 'ማረጋገጺ',
    triageReason: 'ምኽንያት',
    transitionTitle: 'ደረጃ ምቕያር',
    transitionReason: 'ናይዚ ለውጢ ምኽንያት',
    applyTransition: 'ተግብር',
    notAssignedToYou: 'እዚ ሪፖርት ንዓኹም ኣይተወሃበን።',
  },
};

export default ti;
