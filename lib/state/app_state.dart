import 'package:flutter/foundation.dart';

/// Top navigation tabs.
enum AppTab {
  /// "מסלול" — build a new route.
  route,

  /// "שמורים" — saved routes.
  saved,
}

/// Shape of the generated route.
enum RouteType {
  /// "סיבוב" — a loop that returns to the start (default).
  loop,

  /// "A → B" — a one-way route.
  oneWay,
}

/// Single source of truth for the shell's interactive state.
///
/// Kept intentionally small and UI-focused. Real routing/geocoding logic can
/// be layered on later (e.g. a `generateRoute()` that fills a polyline).
class AppState extends ChangeNotifier {
  AppTab _currentTab = AppTab.route;
  RouteType _routeType = RouteType.loop;
  double _selectedDistance = 5; // km, clamped to [minDistance, maxDistance]
  String _startLocation = 'מיקום נוכחי';

  static const double minDistance = 1;
  static const double maxDistance = 42;

  AppTab get currentTab => _currentTab;
  RouteType get routeType => _routeType;
  double get selectedDistance => _selectedDistance;
  String get startLocation => _startLocation;

  /// Title shown on the collapsed bottom sheet, depending on the active tab.
  String get sheetTitle =>
      _currentTab == AppTab.route ? 'מסלול חדש' : 'המסלולים שלי';

  void setTab(AppTab tab) {
    if (_currentTab == tab) return;
    _currentTab = tab;
    notifyListeners();
  }

  void setRouteType(RouteType type) {
    if (_routeType == type) return;
    _routeType = type;
    notifyListeners();
  }

  void setDistance(double km) {
    final clamped = km.clamp(minDistance, maxDistance).toDouble();
    if (clamped == _selectedDistance) return;
    _selectedDistance = clamped;
    notifyListeners();
  }

  void setStartLocation(String value) {
    if (value == _startLocation) return;
    _startLocation = value;
    notifyListeners();
  }
}
