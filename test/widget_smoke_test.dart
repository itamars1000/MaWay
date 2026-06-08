import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:runroute/state/app_state.dart';

void main() {
  test('AppState exposes the right defaults and tab-driven title', () {
    final state = AppState();

    expect(state.currentTab, AppTab.route);
    expect(state.routeType, RouteType.loop);
    expect(state.selectedDistance, 5);
    expect(state.startLocation, 'מיקום נוכחי');
    expect(state.sheetTitle, 'מסלול חדש');

    state.setTab(AppTab.saved);
    expect(state.sheetTitle, 'המסלולים שלי');
  });

  test('AppState clamps distance to [1, 42]', () {
    final state = AppState();

    state.setDistance(100);
    expect(state.selectedDistance, 42);

    state.setDistance(0);
    expect(state.selectedDistance, 1);
  });

  testWidgets('AppState notifies listeners on tab change', (tester) async {
    final state = AppState();
    var notified = 0;
    state.addListener(() => notified++);

    state.setTab(AppTab.saved);
    expect(notified, 1);

    // No-op change should not notify.
    state.setTab(AppTab.saved);
    expect(notified, 1);
  });

  // Sanity check that a Provider-wrapped tree builds without throwing.
  testWidgets('AppState is consumable via Provider', (tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => AppState(),
        child: MaterialApp(
          home: Builder(
            builder: (context) =>
                Text(context.watch<AppState>().sheetTitle),
          ),
        ),
      ),
    );
    expect(find.text('מסלול חדש'), findsOneWidget);
  });
}
