import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Empty state for the "שמורים" (Saved) tab: a centered minimalist map-outline
/// icon and muted gray text.
class SavedEmptyState extends StatelessWidget {
  const SavedEmptyState({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.map_outlined,
            size: 64,
            color: AppTheme.textMuted.withOpacity(0.6),
          ),
          const SizedBox(height: 16),
          const Text(
            'אין מסלולים שמורים עדיין',
            style: TextStyle(
              fontSize: 15,
              color: AppTheme.textMuted,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
