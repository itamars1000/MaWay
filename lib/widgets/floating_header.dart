import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'segmented_tabs.dart';

/// Transparent top app bar overlapping the map.
///
/// Left: bold "RunRoute" logo. Right: the [SegmentedTabs] switch.
class FloatingHeader extends StatelessWidget {
  const FloatingHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            const _Logo(),
            const Spacer(),
            // Constrain the segmented control so it doesn't stretch full-width.
            const SizedBox(
              width: 180,
              child: SegmentedTabs(),
            ),
          ],
        ),
      ),
    );
  }
}

class _Logo extends StatelessWidget {
  const _Logo();

  @override
  Widget build(BuildContext context) {
    // Rendered LTR so the brand reads "RunRoute" regardless of app direction.
    return const Directionality(
      textDirection: TextDirection.ltr,
      child: Text(
        'RunRoute',
        style: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.w800,
          color: AppTheme.charcoal,
          letterSpacing: -0.5,
        ),
      ),
    );
  }
}
