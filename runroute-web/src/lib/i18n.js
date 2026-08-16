// Translation dictionary (he / en) + pure translate() helper.
// The React hook useT() lives in state/SettingsProvider.jsx.

export const TRANSLATIONS = {
  he: {
    // Tabs
    'tabs.route': 'מסלול',
    'tabs.saved': 'שמורים',

    // Units
    'units.km': 'ק״מ',

    // Route form
    'form.routeType': 'סוג מסלול',
    'form.loop': 'סיבוב',
    'form.startPoint': 'נקודת התחלה',
    'form.startPlaceholder': 'חפש כתובת או נקודת התחלה',
    'form.geoDenied': 'הגישה למיקום נחסמה — חפש כתובת ידנית או אפשר מיקום בדפדפן.',
    'form.geoUnavailable': 'מיקום אינו זמין (נדרש חיבור מאובטח) — חפש כתובת ידנית.',
    'form.tapMapStart': 'הקש על המפה לבחירת ההתחלה…',
    'form.pickStart': '📍 בחר התחלה על המפה',
    'form.endPoint': 'נקודת סיום',
    'form.endPlaceholder': 'חפש יעד',
    'form.removeEnd': '✕ הסר יעד',
    'form.tapMapEnd': 'הקש על המפה לבחירת היעד…',
    'form.pickEnd': '🏁 בחר יעד על המפה',
    'form.viaPoint': 'נקודת מעבר (אופציונלי)',
    'form.viaConfirmed': '📍 הסיבוב יעבור דרך הנקודה שבחרת',
    'form.removeViaAria': 'הסר נקודת מעבר',
    'form.tapMapVia': 'הקש על המפה לבחירת נקודה…',
    'form.pickVia': '➕ בחר נקודת מעבר על המפה',
    'form.distance': 'מרחק',

    // Stats
    'stat.ascent': 'מ׳ עלייה',
    'stat.descent': 'מ׳ ירידה',

    // CTA buttons
    'cta.loading': 'מחשב מסלול…',
    'cta.new': 'מסלול חדש',
    'cta.create': 'צור מסלול',

    // Route results
    'route.warnBelow': '⚠️ לא נמצא מסלול באורך המבוקש כאן — זהו הארוך ביותר ({dist} ק״מ)',
    'route.warnDirect': 'ℹ️ זהו המסלול הישיר ל-B ({dist} ק״מ) — ארוך מהמבוקש',
    'route.next': 'מסלול הבא ›',
    'route.turnsPerKm': '{turns} פניות לק"מ',
    'route.turnTarget': '(יעד ≤3)',
    'route.clear': 'מחק מסלול מהמפה',
    'route.typeLoop': 'סיבוב',
    'route.typeAB': 'A → B',

    // Sheet title
    'sheet.route': 'מסלול חדש',
    'sheet.saved': 'המסלולים שלי',

    // Save / feedback
    'save.save': 'שמור',
    'save.saved': 'נשמר',
    'feedback.thanks': 'תודה! זה ישפר את המסלולים הבאים 🙏',
    'feedback.q': 'איך המסלול?',
    'feedback.goodAria': 'מסלול טוב',
    'feedback.badAria': 'מסלול לא טוב',

    // Address autocomplete
    'addr.useCurrent': 'השתמש במיקום הנוכחי',
    'addr.searching': 'מחפש…',
    'addr.noResults': 'לא נמצאו תוצאות',
    'addr.placeholder': 'חפש כתובת',

    // Building panel
    'build.title': 'מכינים את האזור הזה',
    'build.step1': 'מורידים מפת רחובות…',
    'build.step2': 'בונים רשת דרכים…',
    'build.step3': 'מחשבים מסלולים מתאימים…',
    'build.note': 'פעם ראשונה באזור הזה — בדרך כלל כדקה. בפעם הבאה זה יהיה מיידי.',

    // Login screen
    'login.ariaLabel': 'התחברות',
    'login.title': 'מצא את הדרך שלך',
    'login.sub': 'מסלולי ריצה ישרים ורציפים — שמירה וסנכרון בין כל המכשירים שלך.',
    'login.google': 'התחבר עם Google',
    'login.signIn': 'כניסה',
    'login.signUp': 'הרשמה',
    'login.or': 'או',
    'login.emailLabel': 'אימייל',
    'login.passwordLabel': 'סיסמה',
    'login.confirmLabel': 'אימות סיסמה',
    'login.working': 'רגע…',
    'login.checkMailTitle': 'שלחנו לכם מייל',
    'login.checkMailSub': 'לחצו על הקישור ששלחנו ל-{email} כדי להפעיל את החשבון. אם הוא לא הגיע, בדקו בתיקיית הספאם.',
    'login.err.mismatch': 'הסיסמאות אינן תואמות.',
    'login.err.taken': 'האימייל הזה כבר רשום. נסו להתחבר במקום.',
    'login.err.badCreds': 'אימייל או סיסמה שגויים.',
    'login.err.unconfirmed': 'החשבון עדיין לא אומת — לחצו על הקישור במייל ששלחנו.',
    'login.err.weakPassword': 'הסיסמה קצרה מדי (6 תווים לפחות).',
    'login.err.badEmail': 'כתובת האימייל לא תקינה.',
    'login.err.rateLimited': 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.',
    'login.err.cap': 'ההרשמה סגורה כרגע — אנחנו בגרסת בדיקה עם מספר משתמשים מוגבל.',
    'login.err.generic': 'משהו השתבש. נסו שוב.',

    // Map overlay / FABs
    'map.locating': 'מאתר מיקום…',
    'map.loading': 'טוען מפה…',
    'map.showRoute': 'הצג את המסלול',
    'map.myLocation': 'מרכז על המיקום שלי',
    'map.myLocationTitle': 'המיקום שלי',

    // Saved routes view
    'saved.editName': 'ערוך שם',
    'saved.exportGpx': 'ייצוא GPX',
    'saved.delete': 'מחק',
    'saved.emptyTitle': 'עדיין אין מסלולים שמורים',
    'saved.emptyText': 'צרו מסלול בלשונית "מסלול" כדי שיופיע כאן.',

    // Settings
    'settings.title': 'הגדרות',
    'settings.close': 'סגור',
    'settings.clearConfirm': 'למחוק את כל {count} המסלולים השמורים? פעולה זו אינה הפיכה.',
    'settings.account': 'חשבון',
    'settings.signOut': 'התנתק',
    'settings.signInNote': 'התחבר כדי לשמור ולסנכרן את המסלולים שלך.',
    'settings.signInGoogle': 'התחבר עם Google',
    'settings.map': 'מפה',
    'settings.mapType': 'סוג מפה',
    'settings.mapTypeHint': 'הסגנון שמוצג ברקע',
    'settings.language': 'שפה',
    'settings.data': 'נתונים',
    'settings.savedRoutes': 'מסלולים שמורים',
    'settings.savedCount': '{count} מסלולים נשמרו במכשיר הזה',
    'settings.deleteAll': 'מחק הכל',
    'settings.about': 'אודות',
    'settings.aboutNote': 'מסלולי ריצה ישרים ורציפים.',
    'settings.version': 'גרסה {ver}',

    // Safety / liability
    'safety.title': 'לפני שיוצאים לרוץ',
    'safety.intro': 'המסלולים נוצרים אוטומטית כהצעה בלבד — אנא קראו לפני השימוש:',
    'safety.b1': 'הנתונים עלולים להיות שגויים או לא מעודכנים; מסלול עלול לעבור במקום לא בטוח.',
    'safety.b2': 'אתם אחראים לבטיחותכם — שימו לב לתנועה, לחוקי הדרך, לתאורה ולסביבה.',
    'safety.b3': 'התייעצו עם רופא לפני פעילות גופנית והכירו את גבולותיכם.',
    'safety.ack': 'הבנתי — אני אחראי/ת לבטיחותי',
    'safety.routeNote': 'מסלול מוצע — שימו לב לתנועה ולסביבה.',
    'safety.settingsTitle': 'בטיחות ואחריות',
    'safety.agreePrefix': 'בהמשך השימוש אתם מאשרים את ',
    'safety.and': ' ואת ',

    // Privacy policy
    'privacy.title': 'מדיניות פרטיות',
    'privacy.link': 'מדיניות פרטיות',
    'privacy.updated': 'עודכן לאחרונה: יוני 2026',
    'privacy.intro': 'אנו מכבדים את פרטיותכם. להלן אילו נתונים נאספים, לאיזו מטרה, ולמי הם מועברים.',
    'privacy.h.collect': 'אילו נתונים נאספים',
    'privacy.collect': 'מיקום (נקודת התחלה ו-GPS) לצורך יצירת מסלולים; אם התחברתם — אימייל, שם ותמונת פרופיל מחשבון Google; ומסלולים ששמרתם.',
    'privacy.h.use': 'למה הנתונים משמשים',
    'privacy.use': 'ליצירת מסלולי ריצה סביב המיקום שלכם, לשמירת מסלולים ולשיפור איכות המסלולים.',
    'privacy.h.third': 'שירותי צד שלישי',
    'privacy.third': 'קואורדינטות נשלחות למנוע המסלולים, ל-Open-Meteo (נתוני גובה), ל-Photon/OpenStreetMap (חיפוש כתובות) ולספק אריחי המפה. חשבונות ומסלולים נשמרים ב-Supabase. פרטי שגיאות טכניות (ללא מידע מזהה במכוון) עשויים להישלח ל-Sentry לצורך איתור וטיפול בתקלות.',
    'privacy.h.retention': 'שמירה ומחיקה',
    'privacy.retention': 'מסלולים שמורים נשארים עד שתמחקו אותם. ניתן למחוק את כל המסלולים מתוך מסך ההגדרות > נתונים. מחיקת החשבון מסירה את הנתונים המשויכים אליו.',
    'privacy.h.rights': 'הזכויות שלכם',
    'privacy.rights': 'יש לכם זכות לעיין בנתונים שלכם, לתקן אותם ולמחוק אותם. משתמשים באיחוד האירופי זכאים גם לזכויות לפי ה-GDPR.',
    'privacy.h.contact': 'יצירת קשר',
    'privacy.contact': 'בשאלות פרטיות ניתן לפנות אלינו בדוא"ל: itamars1000@gmail.com',

    // Terms of use
    'terms.title': 'תנאי שימוש',
    'terms.link': 'תנאי השימוש',
    'terms.updated': 'עודכן לאחרונה: יולי 2026',
    'terms.intro': 'ברוכים הבאים ל-MaWay. השימוש באפליקציה מהווה הסכמה לתנאים אלה — אנא קראו אותם.',
    'terms.h.service': 'מהות השירות',
    'terms.service': 'MaWay מייצרת הצעות למסלולי ריצה באופן אוטומטי, על בסיס נתוני מפה ציבוריים (OpenStreetMap). השירות ניתן כמות שהוא (As-Is), ללא התחייבות לזמינות, לדיוק או להתאמה למטרה מסוימת.',
    'terms.h.use': 'שימוש מותר',
    'terms.use': 'השירות מיועד לשימוש אישי ולא מסחרי. אין לעשות בו שימוש לרעה — לרבות יצירת עומס מכוון, איסוף נתונים אוטומטי או שיבוש פעולתו.',
    'terms.h.content': 'התוכן שלכם',
    'terms.content': 'מסלולים ששמרתם נשארים שלכם. שמירה בחשבון מאפשרת לנו לאחסן ולהציג אותם עבורכם, בהתאם למדיניות הפרטיות.',
    'terms.h.disclaimer': 'הסרת אחריות',
    'terms.disclaimer': 'המסלולים הם הצעות בלבד ועלולים להיות שגויים, לא מעודכנים או לא בטוחים. האחריות לבדוק את המסלול ולשמור על בטיחותכם — כולל תנועה, תאורה, מזג אוויר ומצב גופני — מוטלת עליכם בלבד.',
    'terms.h.liability': 'הגבלת אחריות',
    'terms.liability': 'במידה המרבית המותרת בדין, MaWay ומפעיליה לא יישאו באחריות לכל נזק, ישיר או עקיף, הנובע מהשימוש בשירות או מהסתמכות על מסלול שהוצע בו.',
    'terms.h.changes': 'שינויים בשירות ובתנאים',
    'terms.changes': 'אנו רשאים לעדכן את השירות ואת התנאים מעת לעת. המשך שימוש לאחר עדכון מהווה הסכמה לתנאים המעודכנים.',
    'terms.h.law': 'דין וסמכות שיפוט',
    'terms.law': 'על תנאים אלה חל דין מדינת ישראל, וסמכות השיפוט הבלעדית נתונה לבתי המשפט המוסמכים בישראל.',
    'terms.h.contact': 'יצירת קשר',
    'terms.contact': 'לשאלות על תנאי השימוש ניתן לפנות אלינו בדוא"ל: itamars1000@gmail.com',

    // Accessibility statement (IS 5568 / WCAG 2.1 AA)
    'a11y.title': 'הצהרת נגישות',
    'a11y.link': 'הצהרת נגישות',
    'a11y.updated': 'עודכן לאחרונה: יולי 2026',
    'a11y.intro': 'ב-MaWay אנו מחויבים להנגיש את השירות לכלל המשתמשים, לרבות אנשים עם מוגבלות, בהתאם לתקן הישראלי ת"י 5568 ולהנחיות WCAG 2.1 ברמה AA.',
    'a11y.h.commitment': 'המחויבות שלנו',
    'a11y.commitment': 'הנגשה היא תהליך מתמשך. אנו פועלים באופן שוטף לתקן, לבדוק ולשפר את נגישות האפליקציה, ומטמיעים נגישות כחלק מהפיתוח.',
    'a11y.h.features': 'אמצעי נגישות באפליקציה',
    'a11y.features': 'ניווט מלא במקלדת; תאימות לקוראי מסך (NVDA, JAWS, VoiceOver, TalkBack); תוויות טקסט לכל הכפתורים והשדות; ניגודיות צבעים תואמת; תמיכה מלאה בעברית ובכיווניות מימין-לשמאל; ואפשרות להגדיל את התצוגה. בנוסף, כפתור הנגישות (או Alt+A) מאפשר להתאים ניגודיות, גודל טקסט, ריווח שורות, הדגשת קישורים ועצירת אנימציות.',
    'a11y.h.alternatives': 'המפה וחלופות טקסטואליות',
    'a11y.alternatives': 'המפה היא רכיב חזותי מטבעו ועשויה להיות מאתגרת בקורא מסך. לכל מסלול מוצגים נתונים בטקסט (מרחק, טיפוס, פניות לק"מ), ניתן לקבוע נקודות לפי חיפוש כתובת, לעבור בין מסלולים חלופיים, ולייצא את המסלול כקובץ GPX לשימוש באפליקציות ניווט. אנו ממשיכים לשפר את החלופות הלא-חזותיות.',
    'a11y.h.contact': 'פנייה בנושא נגישות',
    'a11y.contact': 'נתקלתם בבעיית נגישות או שיש לכם הצעה לשיפור? רכז הנגישות: צוות MaWay. דוא"ל: itamars1000@gmail.com. נשתדל לטפל בפנייה בהקדם.',

    // Accessibility widget (Regulation 35 comfort controls)
    'a11yw.title': 'הגדרות נגישות',
    'a11yw.open': 'פתיחת הגדרות נגישות',
    'a11yw.close': 'סגירה',
    'a11yw.contrast': 'ניגודיות',
    'a11yw.contrast.off': 'רגילה',
    'a11yw.contrast.high': 'גבוהה',
    'a11yw.contrast.invert': 'היפוך צבעים',
    'a11yw.textSize': 'גודל טקסט',
    'a11yw.lineSpacing': 'ריווח שורות',
    'a11yw.lineSpacing.normal': 'רגיל',
    'a11yw.links': 'הדגשת קישורים',
    'a11yw.motion': 'עצירת אנימציות',
    'a11yw.reset': 'איפוס הגדרות',
    'a11yw.on': 'פועל',
    'a11yw.off': 'כבוי',
    'a11yw.announce': 'הגדרות הנגישות עודכנו',

    // Map styles
    'mapStyle.voyager': 'צבעוני',
    'mapStyle.light': 'בהיר',
    'mapStyle.dark': 'כהה',
    'mapStyle.satellite': 'לוויין',

    // Location sentinel display labels
    'location.current': 'מיקום נוכחי',
    'location.mapPoint': 'נקודה על המפה',

    // Engine errors
    'err.no-start': 'קבע נקודת התחלה (אפשר מיקום או חפש כתובת).',
    'err.offline': 'שרת המסלולים לא זמין כרגע — נסה שוב בעוד רגע.',
    'err.http': 'יצירת המסלול נכשלה. נסה מרחק אחר או שוב בעוד רגע.',
    'err.empty': 'לא נמצא מסלול מתאים מהנקודה הזו. נסה מרחק אחר.',
    'err.no-quality': 'לא נמצא מסלול עם פחות מ-3 פניות לק"מ באזור הזה. נסה מרחק אחר או נקודת התחלה אחרת.',
    'err.timeout': 'יצירת המסלול ארכה יותר מדי — נסה מרחק קצר יותר, או שוב בעוד רגע.',
    'err.via-too-far': 'נקודת המעבר רחוקה מדי לסיבוב באורך הזה — קרב אותה או הגדל את המרחק.',
    'err.no-via': 'לא נמצא סיבוב שעובר דרך נקודת המעבר. נסה נקודה אחרת או מרחק אחר.',
    'err.no-end': 'בחר נקודת סיום (הקש על המפה או חפש כתובת).',
    'err.end-uncovered': 'היעד מחוץ לאזור הזמין כרגע — נסה יעד קרוב יותר.',
    'err.no-path': 'לא נמצא מסלול מ-A ל-B. נסה יעד אחר או מרחק אחר.',
    'err.building': 'מכינים את האזור הזה בפעם הראשונה. בעיר גדולה זה יכול לקחת עד רבע שעה — אפשר לסגור ולנסות שוב מאוחר יותר.',
    'err.build-failed': 'לא הצלחנו להכין את האזור הזה כרגע — נסה שוב בעוד רגע.',
    'err.rate-limited': 'יותר מדי בקשות — נסה שוב בעוד רגע.',
    'err.build-busy': 'יש כרגע עומס בהכנת אזורים חדשים — נסה שוב מאוחר יותר.',
    'err.default': 'משהו השתבש ביצירת המסלול. נסה שוב.',
  },

  en: {
    // Tabs
    'tabs.route': 'Route',
    'tabs.saved': 'Saved',

    // Units
    'units.km': 'km',

    // Route form
    'form.routeType': 'Route type',
    'form.loop': 'Loop',
    'form.startPoint': 'Start point',
    'form.startPlaceholder': 'Search address or start point',
    'form.geoDenied': 'Location access denied — search for an address or enable location in your browser.',
    'form.geoUnavailable': 'Location unavailable (secure connection required) — search for an address.',
    'form.tapMapStart': 'Tap the map to pick a start…',
    'form.pickStart': '📍 Pick start on map',
    'form.endPoint': 'End point',
    'form.endPlaceholder': 'Search destination',
    'form.removeEnd': '✕ Remove destination',
    'form.tapMapEnd': 'Tap the map to pick a destination…',
    'form.pickEnd': '🏁 Pick destination on map',
    'form.viaPoint': 'Via point (optional)',
    'form.viaConfirmed': '📍 The loop will pass through your chosen point',
    'form.removeViaAria': 'Remove via point',
    'form.tapMapVia': 'Tap the map to pick a point…',
    'form.pickVia': '➕ Pick via point on map',
    'form.distance': 'Distance',

    // Stats
    'stat.ascent': 'm ascent',
    'stat.descent': 'm descent',

    // CTA buttons
    'cta.loading': 'Calculating route…',
    'cta.new': 'New route',
    'cta.create': 'Create route',

    // Route results
    'route.warnBelow': '⚠️ No route of the requested length found here — this is the longest available ({dist} km)',
    'route.warnDirect': 'ℹ️ This is the direct route to B ({dist} km) — longer than requested',
    'route.next': 'Next route ›',
    'route.turnsPerKm': '{turns} turns/km',
    'route.turnTarget': '(target ≤3)',
    'route.clear': 'Remove route from map',
    'route.typeLoop': 'Loop',
    'route.typeAB': 'A → B',

    // Sheet title
    'sheet.route': 'New route',
    'sheet.saved': 'My routes',

    // Save / feedback
    'save.save': 'Save',
    'save.saved': 'Saved',
    'feedback.thanks': 'Thanks! This will improve future routes 🙏',
    'feedback.q': "How's the route?",
    'feedback.goodAria': 'Good route',
    'feedback.badAria': 'Bad route',

    // Address autocomplete
    'addr.useCurrent': 'Use current location',
    'addr.searching': 'Searching…',
    'addr.noResults': 'No results found',
    'addr.placeholder': 'Search address',

    // Building panel
    'build.title': 'Preparing this area',
    'build.step1': 'Downloading street map…',
    'build.step2': 'Building road network…',
    'build.step3': 'Computing suitable routes…',
    'build.note': "First time in this area — usually about a minute. Next time it'll be instant.",

    // Login screen
    'login.ariaLabel': 'Sign in',
    'login.title': 'Find your way',
    'login.sub': 'Straight, continuous running routes — save and sync across all your devices.',
    'login.google': 'Sign in with Google',
    'login.signIn': 'Sign in',
    'login.signUp': 'Sign up',
    'login.or': 'or',
    'login.emailLabel': 'Email',
    'login.passwordLabel': 'Password',
    'login.confirmLabel': 'Confirm password',
    'login.working': 'One moment…',
    'login.checkMailTitle': 'Check your email',
    'login.checkMailSub': 'Click the link we sent to {email} to activate your account. If it has not arrived, check your spam folder.',
    'login.err.mismatch': 'The passwords do not match.',
    'login.err.taken': 'That email is already registered. Try signing in instead.',
    'login.err.badCreds': 'Wrong email or password.',
    'login.err.unconfirmed': 'This account is not confirmed yet — click the link in the email we sent.',
    'login.err.weakPassword': 'That password is too short (at least 6 characters).',
    'login.err.badEmail': 'That email address is not valid.',
    'login.err.rateLimited': 'Too many attempts. Try again in a few minutes.',
    'login.err.cap': 'Sign-ups are closed right now — we are in a limited testing phase.',
    'login.err.generic': 'Something went wrong. Please try again.',

    // Map overlay / FABs
    'map.locating': 'Finding location…',
    'map.loading': 'Loading map…',
    'map.showRoute': 'Show route',
    'map.myLocation': 'Center on my location',
    'map.myLocationTitle': 'My location',

    // Saved routes view
    'saved.editName': 'Edit name',
    'saved.exportGpx': 'Export GPX',
    'saved.delete': 'Delete',
    'saved.emptyTitle': 'No saved routes yet',
    'saved.emptyText': 'Create a route in the "Route" tab to see it here.',

    // Settings
    'settings.title': 'Settings',
    'settings.close': 'Close',
    'settings.clearConfirm': 'Delete all {count} saved routes? This cannot be undone.',
    'settings.account': 'Account',
    'settings.signOut': 'Sign out',
    'settings.signInNote': 'Sign in to save and sync your routes.',
    'settings.signInGoogle': 'Sign in with Google',
    'settings.map': 'Map',
    'settings.mapType': 'Map type',
    'settings.mapTypeHint': 'The style shown in the background',
    'settings.language': 'Language',
    'settings.data': 'Data',
    'settings.savedRoutes': 'Saved routes',
    'settings.savedCount': '{count} routes saved on this device',
    'settings.deleteAll': 'Delete all',
    'settings.about': 'About',
    'settings.aboutNote': 'Straight, continuous running routes.',
    'settings.version': 'Version {ver}',

    // Safety / liability
    'safety.title': 'Before you head out',
    'safety.intro': 'Routes are generated automatically as suggestions only — please read before using:',
    'safety.b1': 'Map data may be inaccurate or outdated; a route may pass through an unsafe place.',
    'safety.b2': "You are responsible for your own safety — watch traffic, obey road rules, and mind lighting and surroundings.",
    'safety.b3': 'Consult a doctor before exercising and know your own limits.',
    'safety.ack': "I understand — I'm responsible for my safety",
    'safety.routeNote': 'Suggested route — stay aware of traffic and surroundings.',
    'safety.settingsTitle': 'Safety & liability',
    'safety.agreePrefix': 'By continuing you accept the ',
    'safety.and': ' and the ',

    // Privacy policy
    'privacy.title': 'Privacy Policy',
    'privacy.link': 'Privacy policy',
    'privacy.updated': 'Last updated: June 2026',
    'privacy.intro': 'We respect your privacy. Here is what data is collected, why, and who it is shared with.',
    'privacy.h.collect': 'What we collect',
    'privacy.collect': 'Location (start point and GPS) to generate routes; if you sign in — email, name and profile picture from your Google account; and routes you save.',
    'privacy.h.use': 'How we use it',
    'privacy.use': 'To generate running routes around your location, to save routes, and to improve route quality.',
    'privacy.h.third': 'Third-party services',
    'privacy.third': 'Coordinates are sent to the route engine, to Open-Meteo (elevation), to Photon/OpenStreetMap (address search), and to the map tile provider. Accounts and saved routes are stored in Supabase. Technical error details (with no identifying information by design) may be sent to Sentry to help us find and fix bugs.',
    'privacy.h.retention': 'Retention & deletion',
    'privacy.retention': 'Saved routes remain until you delete them. You can delete all routes from Settings > Data. Deleting your account removes its associated data.',
    'privacy.h.rights': 'Your rights',
    'privacy.rights': 'You have the right to access, correct and delete your data. Users in the EU also have rights under the GDPR.',
    'privacy.h.contact': 'Contact',
    'privacy.contact': 'For privacy questions, email us at itamars1000@gmail.com',

    // Terms of use
    'terms.title': 'Terms of Use',
    'terms.link': 'Terms of use',
    'terms.updated': 'Last updated: July 2026',
    'terms.intro': 'Welcome to MaWay. Using the app means you accept these terms — please read them.',
    'terms.h.service': 'The service',
    'terms.service': 'MaWay automatically generates running-route suggestions based on public map data (OpenStreetMap). The service is provided as-is, with no guarantee of availability, accuracy or fitness for a particular purpose.',
    'terms.h.use': 'Permitted use',
    'terms.use': 'The service is for personal, non-commercial use. Do not abuse it — including deliberate overload, automated data harvesting, or interfering with its operation.',
    'terms.h.content': 'Your content',
    'terms.content': 'Routes you save remain yours. Saving to an account lets us store and display them for you, subject to the privacy policy.',
    'terms.h.disclaimer': 'Disclaimer',
    'terms.disclaimer': 'Routes are suggestions only and may be wrong, outdated or unsafe. Checking the route and staying safe — including traffic, lighting, weather and your own fitness — is solely your responsibility.',
    'terms.h.liability': 'Limitation of liability',
    'terms.liability': 'To the maximum extent permitted by law, MaWay and its operators are not liable for any damage, direct or indirect, arising from use of the service or reliance on a suggested route.',
    'terms.h.changes': 'Changes to the service and terms',
    'terms.changes': 'We may update the service and these terms from time to time. Continued use after an update constitutes acceptance of the updated terms.',
    'terms.h.law': 'Governing law',
    'terms.law': 'These terms are governed by the laws of the State of Israel, and the competent courts of Israel have exclusive jurisdiction.',
    'terms.h.contact': 'Contact',
    'terms.contact': 'For questions about these terms, email us at itamars1000@gmail.com',

    // Accessibility statement (IS 5568 / WCAG 2.1 AA)
    'a11y.title': 'Accessibility Statement',
    'a11y.link': 'Accessibility statement',
    'a11y.updated': 'Last updated: July 2026',
    'a11y.intro': 'At MaWay we are committed to making our service accessible to everyone, including people with disabilities, in line with the Israeli standard IS 5568 and WCAG 2.1 level AA.',
    'a11y.h.commitment': 'Our commitment',
    'a11y.commitment': 'Accessibility is an ongoing effort. We continually fix, test and improve the app’s accessibility and build it into our development process.',
    'a11y.h.features': 'Accessibility features',
    'a11y.features': 'Full keyboard navigation; screen-reader support (NVDA, JAWS, VoiceOver, TalkBack); text labels on all buttons and fields; compliant colour contrast; full Hebrew and right-to-left support; and pinch-to-zoom. In addition, the accessibility button (or Alt+A) lets you adjust contrast, text size, line spacing, link highlighting and stop animations.',
    'a11y.h.alternatives': 'The map and text alternatives',
    'a11y.alternatives': 'The map is inherently visual and can be challenging with a screen reader. Every route shows its data as text (distance, ascent, turns per km), points can be set by address search, alternative routes can be cycled, and a route can be exported as a GPX file for navigation apps. We keep improving the non-visual alternatives.',
    'a11y.h.contact': 'Accessibility contact',
    'a11y.contact': 'Found an accessibility problem or have a suggestion? Accessibility coordinator: the MaWay team. Email: itamars1000@gmail.com. We will do our best to address your request promptly.',

    // Accessibility widget (Regulation 35 comfort controls)
    'a11yw.title': 'Accessibility settings',
    'a11yw.open': 'Open accessibility settings',
    'a11yw.close': 'Close',
    'a11yw.contrast': 'Contrast',
    'a11yw.contrast.off': 'Normal',
    'a11yw.contrast.high': 'High',
    'a11yw.contrast.invert': 'Invert colours',
    'a11yw.textSize': 'Text size',
    'a11yw.lineSpacing': 'Line spacing',
    'a11yw.lineSpacing.normal': 'Normal',
    'a11yw.links': 'Highlight links',
    'a11yw.motion': 'Stop animations',
    'a11yw.reset': 'Reset settings',
    'a11yw.on': 'On',
    'a11yw.off': 'Off',
    'a11yw.announce': 'Accessibility settings updated',

    // Map styles
    'mapStyle.voyager': 'Colorful',
    'mapStyle.light': 'Light',
    'mapStyle.dark': 'Dark',
    'mapStyle.satellite': 'Satellite',

    // Location sentinel display labels
    'location.current': 'Current location',
    'location.mapPoint': 'Map point',

    // Engine errors
    'err.no-start': 'Set a start point (use location or search for an address).',
    'err.offline': 'Route server unavailable — please try again in a moment.',
    'err.http': 'Route generation failed. Try a different distance or try again.',
    'err.empty': 'No suitable route found from this point. Try a different distance.',
    'err.no-quality': 'No route with fewer than 3 turns/km found in this area. Try a different distance or start point.',
    'err.timeout': 'Route generation took too long — try a shorter distance, or try again.',
    'err.via-too-far': 'The via point is too far for a loop of this length — move it closer or increase the distance.',
    'err.no-via': 'No loop found that passes through the via point. Try a different point or distance.',
    'err.no-end': 'Choose an end point (tap the map or search for an address).',
    'err.end-uncovered': 'The destination is outside the currently available area — try a closer destination.',
    'err.no-path': 'No route from A to B found. Try a different destination or distance.',
    'err.building': 'Preparing this area for the first time. A large city can take up to 15 minutes — you can close this and try again later.',
    'err.build-failed': "We couldn't prepare this area right now — please try again in a moment.",
    'err.rate-limited': 'Too many requests — please try again in a moment.',
    'err.build-busy': "New areas are busy being prepared right now — please try again later.",
    'err.default': 'Something went wrong creating the route. Please try again.',
  },
};

// Simple {var} interpolation for template strings.
function interpolate(template, vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}

// Framework-free translate — usable in non-React code (AppState, settings.js).
export function translate(lang, key, vars) {
  const dict = TRANSLATIONS[lang] ?? TRANSLATIONS.he;
  const val = dict[key] ?? TRANSLATIONS.he[key] ?? key;
  return interpolate(val, vars);
}
