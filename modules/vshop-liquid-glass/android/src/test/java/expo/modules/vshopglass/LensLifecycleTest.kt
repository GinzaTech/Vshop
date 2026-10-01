package expo.modules.vshopglass

import org.junit.Assert.*
import org.junit.Test

class LensLifecycleTest {
  @Test fun firstSuccessfulSourcePublicationWakesConsumerWithoutADrawLoop() {
    assertFalse(LensLifecycle.publishSource(false, false))
    assertTrue(LensLifecycle.publishSource(false, true))
    repeat(100) { assertFalse(LensLifecycle.publishSource(true, true)) }
  }
  @Test fun recoversSameMappingExactlyOnceAfterInvalidation() {
    assertTrue(LensLifecycle.needsRedraw(false, false, true, false))
    assertFalse(LensLifecycle.needsRedraw(false, true, true, false))
    assertFalse(LensLifecycle.needsRedraw(false, true, false, false))
    assertTrue(LensLifecycle.needsRedraw(false, false, true, false))
  }
  @Test fun aNewBindingRedrawsEvenWhenCoordinatesMatch() {
    assertTrue(LensLifecycle.needsRedraw(true, true, true, false))
    assertFalse(LensLifecycle.needsRedraw(false, true, true, false))
    assertFalse(LensLifecycle.needsRedraw(true, true, false, true))
  }
  @Test fun movingMappingRedrawsButInvalidAndIdleMappingsDoNotLoop() {
    assertTrue(LensLifecycle.needsRedraw(false, true, true, true))
    repeat(100) { assertFalse(LensLifecycle.needsRedraw(false, true, true, false)) }
    assertFalse(LensLifecycle.needsRedraw(false, false, false, true))
  }
  @Test fun captureRequiresAggregateVisibilityAsWellAsWindowVisibility() {
    assertTrue(LensLifecycle.retainPage(true, true, true))
    assertFalse(LensLifecycle.retainPage(true, true, false))
    assertFalse(LensLifecycle.retainPage(true, false, true))
    assertFalse(LensLifecycle.retainPage(false, true, true))
  }
}
