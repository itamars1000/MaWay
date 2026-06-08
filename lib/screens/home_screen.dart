import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../widgets/drag_handle.dart';
import '../widgets/floating_header.dart';
import '../widgets/map_view.dart';
import '../widgets/route_sheet_content.dart';

/// The single screen of the app — composes the three layers in a [Stack]:
///   1. [MapView]            (base, fills the screen)
///   2. [FloatingHeader]     (top, transparent, overlaps the map)
///   3. DraggableScrollableSheet (interaction, snapping bottom sheet)
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final DraggableScrollableController _sheetController =
      DraggableScrollableController();

  /// Current sheet height as a fraction of the screen (0..1). Drives both the
  /// map's bottom padding and the recenter FAB's offset.
  double _sheetFraction = AppTheme.sheetAnchor;

  @override
  void initState() {
    super.initState();
    _sheetController.addListener(_onSheetMoved);
  }

  void _onSheetMoved() {
    if (!_sheetController.isAttached) return;
    setState(() => _sheetFraction = _sheetController.size);
  }

  @override
  void dispose() {
    _sheetController.removeListener(_onSheetMoved);
    _sheetController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.sizeOf(context).height;
    // How much of the screen the sheet currently covers, in logical px.
    final sheetPixels = _sheetFraction * screenHeight;

    return Scaffold(
      // Let the map slide under the (transparent) status bar area.
      extendBodyBehindAppBar: true,
      body: Stack(
        children: [
          // --- Layer 1: full-screen map -----------------------------------
          MapView(
            // Push the map's logical center above the sheet.
            bottomPadding: sheetPixels,
            // Float the FAB just above the sheet's top edge.
            fabBottomOffset: sheetPixels + 12,
          ),

          // --- Layer 2: floating transparent header -----------------------
          const Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: FloatingHeader(),
          ),

          // --- Layer 3: draggable snapping bottom sheet --------------------
          DraggableScrollableSheet(
            controller: _sheetController,
            initialChildSize: AppTheme.sheetAnchor,
            minChildSize: AppTheme.sheetCollapsed,
            maxChildSize: AppTheme.sheetExpanded,
            snap: true,
            snapSizes: const [
              AppTheme.sheetCollapsed,
              AppTheme.sheetAnchor,
              AppTheme.sheetExpanded,
            ],
            builder: (context, scrollController) {
              return _SheetSurface(scrollController: scrollController);
            },
          ),
        ],
      ),
    );
  }
}

/// The rounded white sheet container: a pinned header (handle + title) above a
/// scrollable body so content can grow when expanded.
class _SheetSurface extends StatelessWidget {
  const _SheetSurface({required this.scrollController});

  final ScrollController scrollController;

  @override
  Widget build(BuildContext context) {
    final title = context.watch<AppState>().sheetTitle;

    return Container(
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(color: AppTheme.shadow, blurRadius: 20, offset: Offset(0, -4)),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: CustomScrollView(
        controller: scrollController,
        slivers: [
          // Pinned header keeps the handle + title visible while collapsed.
          SliverPersistentHeader(
            pinned: true,
            delegate: _SheetHeaderDelegate(title: title),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
              child: const RouteSheetContent(),
            ),
          ),
        ],
      ),
    );
  }
}

class _SheetHeaderDelegate extends SliverPersistentHeaderDelegate {
  _SheetHeaderDelegate({required this.title});

  final String title;
  static const double _height = 76;

  @override
  double get minExtent => _height;

  @override
  double get maxExtent => _height;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return Container(
      color: AppTheme.surface,
      alignment: Alignment.topCenter,
      child: SheetHeader(title: title),
    );
  }

  @override
  bool shouldRebuild(covariant _SheetHeaderDelegate oldDelegate) =>
      oldDelegate.title != title;
}
