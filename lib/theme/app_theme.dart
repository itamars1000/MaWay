import 'package:flutter/material.dart';

/// Centralized design tokens for the RunRoute shell.
///
/// Modern minimalist style: dark charcoal/navy for active surfaces, generous
/// rounded corners, and a single bright accent for interactive elements.
class AppTheme {
  AppTheme._();

  // --- Colors -------------------------------------------------------------
  /// Charcoal/navy used for active buttons, the action button and dark cards.
  static const Color charcoal = Color(0xFF111625);

  /// Bright accent for interactive elements (slider track + thumb, etc.).
  static const Color accent = Color(0xFF4ADE80);

  /// App background / sheet surface.
  static const Color surface = Color(0xFFFFFFFF);

  /// Light gray fill for inputs and the inactive segmented-control track.
  static const Color fieldFill = Color(0xFFF1F3F5);

  /// Muted gray text (hints, empty states, inactive segments).
  static const Color textMuted = Color(0xFF9CA3AF);

  /// Primary text color.
  static const Color textPrimary = Color(0xFF111625);

  /// Soft shadow color used by floating surfaces.
  static const Color shadow = Color(0x1A111625);

  // --- Shape --------------------------------------------------------------
  static const double radius = 16;
  static const BorderRadius cornerRadius =
      BorderRadius.all(Radius.circular(radius));

  // --- Bottom-sheet snap points (fraction of screen height) ---------------
  static const double sheetCollapsed = 0.14; // handle + title only
  static const double sheetAnchor = 0.45; // half-open
  static const double sheetExpanded = 0.9; // fully open

  // --- ThemeData ----------------------------------------------------------
  static ThemeData get themeData {
    final base = ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: surface,
      colorScheme: ColorScheme.fromSeed(
        seedColor: charcoal,
        primary: charcoal,
        surface: surface,
      ),
      fontFamily: 'Heebo',
    );

    return base.copyWith(
      textTheme: base.textTheme.apply(
        bodyColor: textPrimary,
        displayColor: textPrimary,
      ),
    );
  }
}
