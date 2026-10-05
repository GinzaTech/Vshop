# Responsive transparent black navigation — physical follow-up

User resumed physical tests and reports a pause before switching primary tabs.
The installed Worklets scheduler queues scheduleOnUI through queueMicrotask;
the old callback queues the lens then routes synchronously in the same JS event.
An isolated deferred-UI integration regression proves route dispatch precedes
execution of the queued lens worklet, despite source order calling move first.

Configure the lens on the UI thread and acknowledge startup to RN before routing.
Start lens scheduling before setIntent. Guard the ack by accepted-intent revision,
mounted lifetime, current pending destination and authoritative navigation. Rapid
newer presses supersede queued older requests; prevented presses enqueue nothing.
Keep immediate opaque page ownership, mounted content, partial spring retarget,
Reduce Motion, dimensions, native blur/refraction and stable semantic controls.

Black nav must transmit the page: ultra-thin dark native blur,36% dark veil,
56% lens tint, original crisp glyphs/reflection. Opaque black remains fallback.

Baseline QA/45218ba: seven primary route presses, passive15s video, gfx204 frames
/113 janky55.39%, p50/95/99=25/97/150ms. Development build/instrumentation scope;
some first-route image uploads are included, so no release-FPS conclusion follows.
Repeat the same sequence after the change and separately inspect warm repeats.

- [ ] RED/GREEN deferred UI/RN ordering, newest intent, prevented press, lifecycle.
- [ ] Current native top/lower More, background transmission and rapid navigation.
- [ ] Nine inner routes: press feedback and media identity; no account mutations.
- [ ] Matching frame capture, source checks/export and updated result report.
