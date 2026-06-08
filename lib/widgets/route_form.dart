import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import '../theme/app_theme.dart';

/// The form shown under the "מסלול" (Route) tab.
class RouteForm extends StatefulWidget {
  const RouteForm({super.key});

  @override
  State<RouteForm> createState() => _RouteFormState();
}

class _RouteFormState extends State<RouteForm> {
  late final TextEditingController _startController;

  @override
  void initState() {
    super.initState();
    _startController = TextEditingController(
      text: context.read<AppState>().startLocation,
    );
  }

  @override
  void dispose() {
    _startController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _SectionLabel('סוג מסלול'),
        const SizedBox(height: 8),
        _RouteTypeSelector(
          value: state.routeType,
          onChanged: context.read<AppState>().setRouteType,
        ),
        const SizedBox(height: 22),
        const _SectionLabel('נקודת התחלה'),
        const SizedBox(height: 8),
        _StartLocationField(
          controller: _startController,
          onChanged: context.read<AppState>().setStartLocation,
        ),
        const SizedBox(height: 22),
        _DistanceLabelRow(value: state.selectedDistance),
        _DistanceSlider(
          value: state.selectedDistance,
          onChanged: context.read<AppState>().setDistance,
        ),
        const SizedBox(height: 16),
        _CreateRouteButton(
          onPressed: () {
            // Hook point: trigger real route generation here.
          },
        ),
        const SizedBox(height: 8),
      ],
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: AppTheme.textMuted,
      ),
    );
  }
}

/// Two styled pill buttons: "סיבוב" (Loop) and "A → B" (One-way).
class _RouteTypeSelector extends StatelessWidget {
  const _RouteTypeSelector({required this.value, required this.onChanged});

  final RouteType value;
  final ValueChanged<RouteType> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _PillButton(
            label: 'סיבוב',
            active: value == RouteType.loop,
            onTap: () => onChanged(RouteType.loop),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _PillButton(
            label: 'A → B',
            active: value == RouteType.oneWay,
            onTap: () => onChanged(RouteType.oneWay),
          ),
        ),
      ],
    );
  }
}

class _PillButton extends StatelessWidget {
  const _PillButton({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        height: 48,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active ? AppTheme.charcoal : AppTheme.fieldFill,
          borderRadius: AppTheme.cornerRadius,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: active ? Colors.white : AppTheme.textPrimary,
          ),
        ),
      ),
    );
  }
}

class _StartLocationField extends StatelessWidget {
  const _StartLocationField({
    required this.controller,
    required this.onChanged,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      textInputAction: TextInputAction.done,
      style: const TextStyle(fontSize: 15, color: AppTheme.textPrimary),
      decoration: InputDecoration(
        prefixIcon: const Icon(
          Icons.location_on_outlined,
          color: AppTheme.charcoal,
        ),
        hintText: 'מיקום נוכחי',
        hintStyle: const TextStyle(color: AppTheme.textMuted),
        filled: true,
        fillColor: AppTheme.fieldFill,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: AppTheme.cornerRadius,
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppTheme.cornerRadius,
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppTheme.cornerRadius,
          borderSide: const BorderSide(color: AppTheme.charcoal, width: 1.5),
        ),
      ),
    );
  }
}

class _DistanceLabelRow extends StatelessWidget {
  const _DistanceLabelRow({required this.value});
  final double value;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const _SectionLabel('מרחק'),
        // e.g. ק"מ 5 — shown on the trailing (right, in RTL) side.
        Text(
          'ק"מ ${value.round()}',
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: AppTheme.textPrimary,
          ),
        ),
      ],
    );
  }
}

class _DistanceSlider extends StatelessWidget {
  const _DistanceSlider({required this.value, required this.onChanged});

  final double value;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    return SliderTheme(
      data: SliderTheme.of(context).copyWith(
        trackHeight: 5,
        activeTrackColor: AppTheme.accent,
        inactiveTrackColor: AppTheme.fieldFill,
        thumbColor: AppTheme.accent,
        overlayColor: AppTheme.accent.withOpacity(0.18),
        thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 11),
        overlayShape: const RoundSliderOverlayShape(overlayRadius: 22),
        showValueIndicator: ShowValueIndicator.never,
      ),
      child: Slider(
        value: value,
        min: AppState.minDistance,
        max: AppState.maxDistance,
        onChanged: onChanged,
      ),
    );
  }
}

class _CreateRouteButton extends StatelessWidget {
  const _CreateRouteButton({required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 54,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppTheme.charcoal,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: const RoundedRectangleBorder(
            borderRadius: AppTheme.cornerRadius,
          ),
        ),
        child: const Text(
          'צור מסלול',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}
