package expo.modules.vshopglass

import org.junit.Assert.*
import org.junit.Test

class LensGeometryTest {
  @Test fun acceptsOnlyFiniteInvertibleAffineMappings() {
    val identity = floatArrayOf(1f, 0f, 0f, 0f, 1f, 0f, 0f, 0f, 1f)
    assertTrue(LensGeometry.validAffine(identity))
    assertTrue(LensGeometry.validAffine(floatArrayOf(1.17f, 0f, -80f, 0f, .965f, -1000f, 0f, 0f, 1f)))
    assertFalse(LensGeometry.validAffine(floatArrayOf()))
    for (index in identity.indices) {
      assertFalse(LensGeometry.validAffine(identity.copyOf().also { it[index] = Float.NaN }))
    }
    assertFalse(LensGeometry.validAffine(identity.copyOf().also { it[6] = .1f }))
    assertFalse(LensGeometry.validAffine(identity.copyOf().also { it[7] = .1f }))
    assertFalse(LensGeometry.validAffine(identity.copyOf().also { it[8] = 2f }))
    assertFalse(LensGeometry.validAffine(identity.copyOf().also { it[0] = 0f }))
  }
  @Test fun boundsAreLensSizedAtEveryDensity() {
    for (density in listOf(1f, 2.625f, 4f)) {
      val geometry = LensGeometry.create((90 * density).toInt(), (50 * density).toInt(), density)!!
      assertTrue(geometry.bufferWidth <= 116 * density)
      assertTrue(geometry.bufferHeight <= 76 * density)
      assertTrue(geometry.padding >= 12 * density)
    }
  }

  @Test fun invalidOrPageSizedBuffersAreRejected() {
    for (width in listOf(-1, 0, 100000)) assertNull(LensGeometry.create(width, 50, 1f))
    assertNull(LensGeometry.create(90, 0, 1f))
    assertNull(LensGeometry.create(90, 100000, 1f))
    for (density in listOf(0f, -1f, Float.NaN, Float.POSITIVE_INFINITY)) {
      assertNull(LensGeometry.create(90, 50, density))
    }
  }

  @Test fun opticalInputsAreFiniteAndBounded() {
    assertEquals(1.065f, LensGeometry.magnification(1.065f), 0.0001f)
    assertEquals(1f, LensGeometry.magnification(Float.NaN), 0f)
    assertEquals(1f, LensGeometry.magnification(-5f), 0f)
    assertEquals(1.1f, LensGeometry.magnification(50f), 0f)
    assertEquals(1.5f, LensGeometry.edge(1.5f), 0f)
    assertEquals(0f, LensGeometry.edge(Float.NaN), 0f)
    assertEquals(0f, LensGeometry.edge(-1f), 0f)
    assertEquals(2f, LensGeometry.edge(100f), 0f)
  }
}
