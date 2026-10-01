package expo.modules.vshopglass

/** Pure lifecycle decisions; the native views own the Android callbacks/resources. */
internal object LensLifecycle {
  fun publishSource(hadNode: Boolean, recordingSucceeded: Boolean) = !hadNode && recordingSucceeded
  fun needsRedraw(rebound: Boolean, wasValid: Boolean, valid: Boolean, changed: Boolean) =
    valid && (rebound || !wasValid || changed)
  fun retainPage(enabled: Boolean, windowVisible: Boolean, aggregateVisible: Boolean) =
    enabled && windowVisible && aggregateVisible
}
