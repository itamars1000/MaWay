import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import '../theme/app_theme.dart';

/// Two-option segmented control bound to [AppState.currentTab].
///
/// "מסלול" (Route) / "שמורים" (Saved). The active segment gets a charcoal fill
/// that slides between options via an [AnimatedAlign].
class SegmentedTabs extends StatelessWidget {
  const SegmentedTabs({super.key});

  @override
  Widget build(BuildContext context) {
    final tab = context.watch<AppState>().currentTab;
    final isRoute = tab == AppTab.route;

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(999),
        boxShadow: const [
          BoxShadow(color: AppTheme.shadow, blurRadius: 12, offset: Offset(0, 4)),
        ],
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          // Two equal segments inside the available width.
          final segmentWidth = (constraints.maxWidth - 8) / 2;
          return Stack(
            children: [
              // Sliding active pill.
              AnimatedAlign(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                // In RTL, "route" is the leading (right) segment.
                alignment:
                    isRoute ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  width: segmentWidth,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppTheme.charcoal,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              Row(
                children: [
                  _Segment(
                    label: 'מסלול',
                    active: isRoute,
                    width: segmentWidth,
                    onTap: () =>
                        context.read<AppState>().setTab(AppTab.route),
                  ),
                  _Segment(
                    label: 'שמורים',
                    active: !isRoute,
                    width: segmentWidth,
                    onTap: () =>
                        context.read<AppState>().setTab(AppTab.saved),
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.label,
    required this.active,
    required this.width,
    required this.onTap,
  });

  final String label;
  final bool active;
  final double width;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: SizedBox(
        width: width,
        height: 36,
        child: Center(
          child: AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 220),
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: active ? Colors.white : AppTheme.textMuted,
            ),
            child: Text(label),
          ),
        ),
      ),
    );
  }
}
