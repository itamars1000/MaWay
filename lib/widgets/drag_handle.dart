import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// The grab pill + sheet title shown at the top of the bottom sheet
/// (always visible, even when collapsed).
class SheetHeader extends StatelessWidget {
  const SheetHeader({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 10),
        // Grab handle.
        Container(
          width: 44,
          height: 5,
          decoration: BoxDecoration(
            color: AppTheme.fieldFill,
            borderRadius: BorderRadius.circular(999),
          ),
        ),
        const SizedBox(height: 14),
        Text(
          title,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppTheme.textPrimary,
          ),
        ),
        const SizedBox(height: 8),
      ],
    );
  }
}
