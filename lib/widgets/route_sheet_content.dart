import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import 'route_form.dart';
import 'saved_empty_state.dart';

/// Switches the bottom-sheet body based on the active top-nav tab.
class RouteSheetContent extends StatelessWidget {
  const RouteSheetContent({super.key});

  @override
  Widget build(BuildContext context) {
    final tab = context.watch<AppState>().currentTab;

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 200),
      child: tab == AppTab.route
          ? const RouteForm(key: ValueKey('route'))
          : const SavedEmptyState(key: ValueKey('saved')),
    );
  }
}
