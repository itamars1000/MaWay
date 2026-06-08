# RunRoute — Web (mobile-first)

גרסת ווב של RunRoute: אפליקציית מסלולי ריצה מינימליסטית בעברית (RTL), בנויה
ב‑React + Vite עם מפת Leaflet / OpenStreetMap. מותאמת למובייל.

## הרצה

```bash
cd runroute-web
npm install
npm run dev        # פותח שרת פיתוח; ה‑host חשוף ב‑LAN כדי לפתוח מהטלפון
npm run build      # בנייה לפרודקשן (תיקיית dist/)
npm run preview    # תצוגה מקדימה של ה‑build
```

לפתיחה במובייל אמיתי: הרץ `npm run dev`, ואז פתח בטלפון את כתובת ה‑`Network`
שמודפסת (לדוגמה `http://192.168.x.x:5173`) — הטלפון והמחשב חייבים להיות באותה רשת.

## מפתח OpenRouteService (ליצירת מסלולים אמיתיים)

כפתור "צור מסלול" מייצר לולאה אמיתית על רחובות באמצעות OpenRouteService, שדורש מפתח חינמי:

1. הירשם וקבל מפתח (דקה): https://openrouteservice.org/dev/#/signup
2. העתק את `.env.example` ל‑`.env` והדבק את המפתח:
   ```
   VITE_ORS_API_KEY=המפתח_שלך
   ```
3. הפעל מחדש את `npm run dev` (Vite טוען `.env` בעלייה).

ללא מפתח, האפליקציה עובדת אבל לחיצה על "צור מסלול" תציג הודעת שגיאה ידידותית.
שים לב: מפתח בצד‑לקוח גלוי בבקשות הרשת — מתאים לשימוש אישי/פיתוח; לפרודקשן כדאי לתווך
את הקריאה דרך שרת קטן.

## ארכיטקטורת השכבות (Stacking)

`App` מרכיב שלוש שכבות אחת מעל השנייה בתוך `.app` (position: relative):

| z-index | רכיב | תפקיד |
|---------|------|-------|
| 1 | `MapView` | מפת Leaflet מלאת מסך + polyline של המסלול + נקודת מיקום כחולה + כפתור "מרכז מיקום" לבן |
| 10 | `FloatingHeader` | סרגל שקוף מעל המפה: לוגו **RunRoute** + מתג מגזרים (מסלול / שמורים) |
| 20 | `BottomSheet` | גיליון נגרר עם נקודות עיגון (מכווץ / חצי / מורחב) |

### איך החפיפה עובדת
המפה תופסת `position: absolute; inset: 0` ולכן ממלאת את כל המסך מתחת לכל השאר.
ה‑Header שקוף לחלוטין (אין רקע) ומוגדר `pointer-events: none` חוץ מהילדים שלו —
כך שמחוות גרירה/זום על אזורי המפה הריקים עוברות דרכו. ה‑BottomSheet תופס רק את
החלק התחתון, ולכן שאר המפה נשארת אינטראקטיבית.

### שמירה על ה‑polyline גלוי
ה‑BottomSheet מחזיק את גובהו כשבר מגובה המסך (`fraction`) ומדווח אותו ל‑`App`,
שמעביר אותו ל‑`MapView`. ב‑`MapController` כל שינוי ב‑`fraction` קורא ל‑
`map.flyToBounds(ROUTE, { paddingBottomRight: [_, sheetPx] , paddingTopLeft: [_, 90] })`
— Leaflet ממקם מחדש את המסלול בתוך האזור הפנוי, כך שהוא אף פעם לא מתחבא מתחת
לגיליון או מתחת ל‑Header. כפתור "מרכז מיקום" צף בדיוק מעל קצה הגיליון
(`bottom: calc(fraction% + 12px)`).

## ניהול State

`AppStateProvider` (React Context ב‑`src/state/AppState.jsx`) הוא מקור האמת היחיד
ומחזיק את `currentTab`, `routeType`, `selectedDistance`, ו‑`startLocation`.
רכיבים צורכים אותו דרך ה‑hook `useAppState()`. גובה הגיליון (`sheetFraction`) הוא
מצב UI ארעי שנשמר ב‑`App` ומועבר ב‑props.

## מבנה הקבצים

```
runroute-web/
  index.html                     RTL, lang="he", meta viewport למובייל, פונט Heebo
  src/
    main.jsx                     נקודת כניסה + ייבוא CSS של Leaflet
    App.jsx                      שלוש השכבות + הרמת sheetFraction
    index.css                    טוקנים לעיצוב (#111625, accent, radius 16) + RTL + סליידר
    state/AppState.jsx           Context: tabs, routeType, distance, startLocation
    components/
      MapView.jsx                Leaflet map + polyline + marker + recenter + map padding
      FloatingHeader.jsx         לוגו + SegmentedTabs
      SegmentedTabs.jsx          מתג מגזרים מותאם (מסלול / שמורים)
      BottomSheet.jsx            גיליון נגרר עם snapping (pointer events)
      RouteForm.jsx              בורר סוג מסלול, שדה מוצא, סליידר מרחק, כפתור "צור מסלול"
      SavedEmptyState.jsx        מצב ריק (אייקון מפה + טקסט אפור)
      icons.jsx                  אייקוני SVG מוטמעים
```

## הערות

- אין צורך ב‑API key — OpenStreetMap חינמי. לשימוש בעומס כבד מומלץ ספק tiles משלך.
- הסליידר מוצג LTR בכוונה (1 ק"מ משמאל, 42 מימין) כמקובל בסקאלת מרחק.
