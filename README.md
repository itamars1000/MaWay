# Maway / RunRoute — סיכום פרויקט

אפליקציית ייצור מסלולי ריצה עולמית. המשתמש בוחר נקודת התחלה ומרחק, והמערכת
מייצרת **לולאות ריצה סגורות** שמעדיפות רחובות ישרים ורציפים (מעט פניות חדות),
ומציגה אותן על מפה. ה-UI דו-לשוני (אנגלית כברירת מחדל, עברית RTL).

---

## ארכיטקטורה — שלושה תת-פרויקטים

| תיקייה | סטאק | תפקיד | סטטוס |
|--------|------|--------|--------|
| `runroute-web/` | React 18 + Vite + Leaflet/OSM | קליינט web (mobile-first, דו-לשוני) | **פעיל** |
| `route_engine/` | Python + FastAPI + osmnx/networkx/rustworkx | מנוע ייצור מסלולים (HTTP API) | **פעיל** |
| `lib/` (Flutter/Dart) | Flutter + google_maps_flutter | מעטפת UI מקורית (ללא מנוע חי) | legacy |

המוצר החי: **`runroute-web` (UI) מדבר עם `route_engine` (HTTP)**.

### חיבור web ↔ engine
- הקליינט קורא ל-`GET /loop?lat=..&lng=..&distance=<m>[&seed][&via][&end]` →
  מחזיר GeoJSON `FeatureCollection` של מועמדי לולאה, ממוין מהטוב לפחות.
- `end_lat/lng` מעביר למצב מסלול A→B.
- `POST /feedback` רושם 👍/👎 שמכוונן את משקלי ה-scorer (`learning.py`).
- `POST /admin/reload` / `POST /admin/reindex` — תחזוקת אינדקס האזורים (מוגן ב-`ADMIN_TOKEN`).

---

## הרעיון המרכזי של המנוע (pipeline)

לולאת ריצה שמעדיפה רחובות ישרים, נבנית מעקרונות ראשונים:

1. **רשת** (`network.py`) — הורדת גרף הליכה דרך `osmnx`.
2. **גרף דואלי + קנס פנייה** (`dual_graph.py`) — המרת הגרף ה-primal ל-line graph
   שבו הצמתים = סגמנטים מכוונים, הקשתות = פניות. משקל פנייה =
   `length(v) + alpha·(1 − cos θ)^k` (alpha=500, k=3); 0 בישר, מקסימום ב-U-turn.
3. **שדה וקטורי + A\*** (`heuristic.py`, `search.py`) — מעגל אידאלי מגדיר "משיכה"
   טנגנציאלית; A\* מחפש החוצה לצד הרחוק ואז חזרה, עם קנס על סגמנטים חוזרים → לולאה
   סגורה אמיתית.
4. **פלט GeoJSON** (`geometry.py`) — LineString עם `distance_m` / `sharp_turns`.

נתיב השירות: `api.py` → `graph_store.py` (חיפוש אזור) → `router.py`
(`find_loop_candidates`, ה-router בזמן-אמת מעל rustworkx) → `ondemand.py` /
`world_store.py` (בניית tile כשאין אזור שמכסה את הנקודה).

### הפרדת אחריות: ניתוב מול ניקוד
- **ניתוב** ממוטב **רק** למציאת לולאות עם מעט פניות (כבישים רציפים זולים, סמטאות/מדרגות יקרים).
- **"נעימות"** לא מעורבבת בעלות הניתוב (היא הייתה מושכת מסלולים לשבילי פארק מפותלים
  ושוברת את הערובה של ≤3 פניות/ק"מ). במקום זה, ה-scorer מעדיף מסלולים נעימים **רק
  מבין** אלו שכבר עומדים בתקרת הפניות (`router._score`).

### אותות איכות ב-scorer (`router._score` — נמוך = טוב יותר)
משקלים **נלמדים** (מ-feedback) + קנסות **קבועים**:

| אות | סוג | תיאור |
|-----|-----|--------|
| `turns` | נלמד | צפיפות פניות; תקרה קשיחה ≤3/ק"מ |
| `dist` | נלמד | סטייה ממרחק היעד |
| `pleasant` / `scenic` | נלמד | רחובות שקטים/ירוקים, נוף מים/פארק |
| `offroad_frac` | קבוע 0.6 | שבילי עפר (תקרה 10%) |
| `overlap_frac` | קבוע 0.5 | חפיפה עצמית (מעדיף לולאה עגולה) |
| `busy_frac` | קבוע 0.35 | רחובות סואנים (primary/secondary/trunk) |
| `rough_frac` | קבוע 0.25 | משטח מרוצף-מחוספס (אבני-ריצוף/sett/מתכת) |
| `sidewalked_frac` | קבוע 0.15 (מוחסר) | **העדפת** רחובות עם מדרכה/foot=designated |
| גובה (`ascent_m`) | קבוע 0.25 | **העדפת לולאות שטוחות** (climb/ק"מ) |

### "רחובות אמינים" — שיפורים אחרונים
- **גיזום `foot=no/private`** בזמן בנייה (`builder.prune`) — שבילים פרטיים/חסומים
  לעולם לא מוצעים.
- **משטח מרוצף-מחוספס** ו-**אות מדרכה** — אותות ניקוד חדשים (מערכי `rough`/`sidewalked`).
- **ניתוב מודע-גובה** — המנוע מביא גובה (Open-Meteo, ללא מפתח) בעת ה-finalize וממיין
  מחדש כך שהלולאה השטוחה ביותר מובילה. serve-time בלבד.

> המרחק **מקורב** (ה-A\* heuristic מנחה, לא admissible) — צפו לאורך קרוב ליעד (~±20%).

---

## שכבות ה-web (`runroute-web/src/`)

`App.jsx` עורם שלוש שכבות בתוך `.app`: `MapView` (Leaflet, z1) →
`FloatingHeader` (שקוף, z10) → `BottomSheet` (גיליון נגרר עם snapping, z20).
ה-sheet מדווח את גובהו ל-`App`, שמזין את `MapView` כך שקו המסלול נשאר גלוי.

- **State** ב-React Context יחיד: `state/AppState.jsx` (`currentTab`, `routeType`,
  `selectedDistance`, `startLocation`), נצרך דרך `useAppState()`.
- **i18n** מותאם-אישית: `lib/i18n.js` (מילון he/en) + `useT()` מקופל ל-SettingsProvider;
  החלפת שפה מעדכנת `document.documentElement.dir/lang` (LTR↔RTL).
- **ייצוא GPX** (`lib/gpx.js`) — הורדת המסלול כקובץ GPX 1.1 (טרי ושמורים).
- עזרי engine/geocode/gpx/routing ב-`src/lib/`.

---

## תשתית ופריסה (Cloud Run)

- **Service** `runroute-engine1` (us-west1, project `maway-498818`) — מגיש את ה-API.
- **Job** `runroute-build` — בונה tiles של אזורים חדשים מ-Geofabrik extracts, מעלה ל-GCS.
- אזורים מוקדמים נטענים lazily ל-LRU מוגבל (RAM שטוח); נקודות מחוץ לכיסוי → tile on-demand.
- **חשוב:** האוטומציה מעדכנת את ה-**service** אך **לא** את ה-**Job** — אחרי שינוי
  בקוד build-time צריך לעדכן את ה-Job ידנית:
  ```bash
  IMAGE=$(gcloud run services describe runroute-engine1 --region us-west1 \
    --format='value(spec.template.spec.containers[0].image)')
  gcloud run jobs update runroute-build --image "$IMAGE" --region us-west1
  ```
  (אימות image של Job מקנן רמה עמוקה יותר: `spec.template.spec.template.spec.containers[0].image`)

### עמידות
- pkl חסר/פגום באינדקס מדולג בחן ונופל ל-on-demand (`region_for`).
- `/admin/reindex` מנקה ערכים מתים מ-`index.json`.
- הורדות Geofabrik חולפות (502/503) — retry עם backoff (`extracts.py`).
- כשל בניית tile ראשונה → קוד `build_failed` ידידותי + cooldown קצר.

---

## בדיקות

`pytest route_engine/tests` (43 בדיקות, ללא רשת/osmnx):
מתמטיקת קנס-פנייה, מונה פניות-חדות גאומטרי, retry של extracts, self-healing index,
זיהוי משטח/מדרכה/foot, וניקוד מודע-גובה.

---

## מוסכמות
- **עברית RTL / אנגלית LTR** — שתי השפות נתמכות; ה-slider של המרחק מתהפך לפי שפה.
- קודי שגיאה של המנוע הם מחרוזות יציבות (`no-quality`, `via-too-far`,
  `end-uncovered`, `building`, `build-failed`…) הממופות להודעות ידידותיות ב-UI —
  לשמור מסונכרן בין `engine.js` ל-`api.py`.

ראו גם: [CLAUDE.md](CLAUDE.md), [route_engine/README.md](route_engine/README.md),
[runroute-web/README.md](runroute-web/README.md),
[README.flutter.md](README.flutter.md) (מעטפת Flutter legacy).
