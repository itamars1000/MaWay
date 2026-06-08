import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../theme/app_theme.dart';

/// Full-screen base layer: the Google Map plus a "recenter" FAB.
///
/// Draws a sample running-route polyline and a current-location marker (blue
/// dot). [bottomPadding] is fed in by the parent so the map's logical center
/// shifts up while the bottom sheet is open — keeping the polyline visible.
class MapView extends StatefulWidget {
  const MapView({
    super.key,
    required this.bottomPadding,
    required this.fabBottomOffset,
  });

  /// Bottom inset applied to the map so its camera target stays above the
  /// bottom sheet.
  final double bottomPadding;

  /// Distance (logical px) from the bottom of the screen at which to float the
  /// recenter FAB — tracks the top edge of the bottom sheet.
  final double fabBottomOffset;

  @override
  State<MapView> createState() => _MapViewState();
}

class _MapViewState extends State<MapView> {
  GoogleMapController? _controller;

  // Tel Aviv as a sensible default camera position.
  static const LatLng _initialTarget = LatLng(32.0853, 34.7818);
  static const CameraPosition _initialCamera = CameraPosition(
    target: _initialTarget,
    zoom: 14.5,
  );

  // A short sample loop so the polyline is visible in the shell.
  static const List<LatLng> _sampleRoute = [
    LatLng(32.0853, 34.7818),
    LatLng(32.0889, 34.7806),
    LatLng(32.0901, 34.7855),
    LatLng(32.0875, 34.7891),
    LatLng(32.0840, 34.7869),
    LatLng(32.0853, 34.7818),
  ];

  Set<Polyline> get _polylines => {
        const Polyline(
          polylineId: PolylineId('running_route'),
          points: _sampleRoute,
          color: AppTheme.charcoal,
          width: 5,
          startCap: Cap.roundCap,
          endCap: Cap.roundCap,
          jointType: JointType.round,
        ),
      };

  Set<Marker> get _markers => {
        Marker(
          markerId: const MarkerId('current_location'),
          position: _initialTarget,
          icon: BitmapDescriptor.defaultMarkerWithHue(
            BitmapDescriptor.hueAzure,
          ),
        ),
      };

  Future<void> _recenter() async {
    await _controller?.animateCamera(
      CameraUpdate.newCameraPosition(_initialCamera),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        GoogleMap(
          initialCameraPosition: _initialCamera,
          // The key piece: padding pushes the visible map region above the
          // sheet so the polyline never hides underneath it.
          padding: EdgeInsets.only(bottom: widget.bottomPadding),
          polylines: _polylines,
          markers: _markers,
          myLocationEnabled: true,
          myLocationButtonEnabled: false,
          zoomControlsEnabled: false,
          compassEnabled: false,
          onMapCreated: (c) => _controller = c,
        ),
        // White circular "recenter location" FAB, top-right of the map.
        Positioned(
          right: 16,
          bottom: widget.fabBottomOffset,
          child: _RecenterButton(onTap: _recenter),
        ),
      ],
    );
  }
}

class _RecenterButton extends StatelessWidget {
  const _RecenterButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppTheme.surface,
      shape: const CircleBorder(),
      elevation: 3,
      shadowColor: AppTheme.shadow,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: const SizedBox(
          width: 48,
          height: 48,
          child: Icon(
            Icons.my_location,
            color: AppTheme.charcoal,
            size: 22,
          ),
        ),
      ),
    );
  }
}
