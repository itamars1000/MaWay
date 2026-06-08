# RunRoute — Flutter frontend shell

A minimalist, Hebrew (RTL) running-route app shell: a full-screen map with a
floating navigation header and a draggable, snapping bottom sheet.

## Layered architecture

`HomeScreen` builds a `Stack` of three layers (bottom → top):

| Layer | Widget | Role |
|-------|--------|------|
| 1. Base | `MapView` | Full-screen `GoogleMap` + sample polyline + blue location marker + white "recenter" FAB |
| 2. Top | `FloatingHeader` | Transparent bar overlapping the map: **RunRoute** logo + segmented control (מסלול / שמורים) |
| 3. Interaction | `DraggableScrollableSheet` | Snapping sheet (collapsed / anchor / expanded) whose body switches by tab |

### How the overlap works
`Stack` paints children in order, so the map is drawn first and the header/sheet
on top. The header sits in a `Positioned(top/left/right)` inside `SafeArea` with
**no background**, so the map shows through. The sheet only occupies its own
bounds, so the rest of the map stays fully interactive.

### Keeping the polyline visible
The sheet uses a `DraggableScrollableController`. A listener reads its current
`size` (a 0..1 fraction) on every drag and feeds it into:
- `GoogleMap.padding.bottom` — Google Maps re-centers the camera target within
  the *unpadded* region, lifting the route above the sheet.
- the recenter FAB's `bottom` offset — so it floats just above the sheet edge.

## State

A single `AppState` (`ChangeNotifier`, provided via `provider`) holds
`currentTab`, `routeType`, `selectedDistance`, and `startLocation`. Widgets read
with `context.watch<AppState>()` and mutate via `context.read<AppState>()`.

## File structure

```
lib/
  main.dart                       MaterialApp (RTL/he locale) + ChangeNotifierProvider
  theme/app_theme.dart            colors (#111625), radius(16), accent, snap points
  state/app_state.dart            AppState ChangeNotifier + AppTab/RouteType enums
  screens/home_screen.dart        the 3-layer Stack + sheet controller + map padding sync
  widgets/
    map_view.dart                 GoogleMap + polyline + marker + recenter FAB
    floating_header.dart          logo + SegmentedTabs
    segmented_tabs.dart           custom 2-option segmented control
    route_sheet_content.dart      RouteForm <-> SavedEmptyState by tab
    route_form.dart               route-type pills, start field, distance slider, action button
    saved_empty_state.dart        empty state (map icon + gray text)
    drag_handle.dart              SheetHeader: grab pill + title
test/widget_smoke_test.dart       AppState + Provider smoke tests
```

## Setup

This repo contains the Dart source only. Generate the platform skeleton, then
add your Google Maps API key.

```bash
flutter create .          # generates android/, ios/, etc. around existing lib/
flutter pub get
flutter analyze
flutter test
flutter run               # needs a valid Maps API key (below) for live tiles
```

### Google Maps API key

**Android** — `android/app/src/main/AndroidManifest.xml`, inside `<application>`:

```xml
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="YOUR_API_KEY"/>
```

Ensure `minSdkVersion 21` (or higher) in `android/app/build.gradle`.

**iOS** — `ios/Runner/AppDelegate.swift`:

```swift
import GoogleMaps   // add this import

// inside application(_:didFinishLaunchingWithOptions:)
GMSServices.provideAPIKey("YOUR_API_KEY")
```

Add location-usage strings to `ios/Runner/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>RunRoute uses your location to center the map and build routes.</string>
```

> Without a valid key the layout still renders; only the live map tiles will be
> blank. `flutter analyze` and `flutter test` run without a key.
```
