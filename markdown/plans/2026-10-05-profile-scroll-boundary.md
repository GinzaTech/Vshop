# Profile tab scroll boundary

User reports Profile equipment can be pulled beyond its final content. Apply one
Android-safe vertical boundary to the shared FlatList owner used by equipment,
skins and collection. Set overScrollMode="never" and alwaysBounceVertical=false,
while retaining the existing RefreshControl and navigation clearance padding so
the last item remains visible above the floating bar. Horizontal pager and nested
skin/filter rows remain unchanged.

- [x] Integration RED before source edit for all three shared tab pages.
- [x] Clamp overscroll without changing refresh or bottom clearance.
- [ ] Scoped source tests PASS; Android default-font drag to end pending while
  another foreground application owns the phone.
- [x] Full source/export outcomes recorded with existing audit boundary.

red.log1 behavior failure before source edit. green.log34/34 tests in4 suites.
The shared vertical FlatList now uses alwaysBounceVertical=false and
overScrollMode=never for equipment/skins/collection; RefreshControl and existing
navigation-clearance padding remain. Final source/export outcomes are shared with
the skin-preview snapshot above:217suites/3021tests PASS; export budget PASS;
overallcheck only existing braces1240992; physical end-drag pending.

Evidence: C:/Users/kona/.codex/artifacts/vshop-profile-scroll-boundary-20261005/.
