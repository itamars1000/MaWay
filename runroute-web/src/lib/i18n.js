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
    'login.guest': 'המשך כאורח',

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
    'err.building': 'מכינים את האזור הזה בפעם הראשונה — זה לוקח רגע. נסה שוב בעוד דקה.',
    'err.build-failed': 'לא הצלחנו להכין את האזור הזה כרגע — נסה שוב בעוד רגע.',
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
    'login.guest': 'Continue as guest',

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
    'err.building': 'Preparing this area for the first time — this takes a moment. Try again in a minute.',
    'err.build-failed': "We couldn't prepare this area right now — please try again in a moment.",
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
