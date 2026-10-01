package expo.modules.vshopglass

import kotlin.math.ceil

/** Pure bounds policy: never allocate a page-sized shader layer. Units are pixels. */
internal data class LensGeometry(val width: Int, val height: Int, val padding: Int) {
  val bufferWidth get() = width + padding * 2
  val bufferHeight get() = height + padding * 2

  companion object {
    fun validAffine(matrix: FloatArray): Boolean {
      if (matrix.size != 9 || matrix.any { !it.isFinite() }) return false
      if (matrix[6] != 0f || matrix[7] != 0f || matrix[8] != 1f) return false
      val determinant = matrix[0] * matrix[4] - matrix[1] * matrix[3]
      return determinant.isFinite() && kotlin.math.abs(determinant) > 0.000001f
    }
    fun create(width: Int, height: Int, density: Float): LensGeometry? {
      if (!density.isFinite() || density <= 0 || density > 8) return null
      if (width <= 0 || height <= 0 || width > 120 * density || height > 80 * density) return null
      return LensGeometry(width, height, ceil(12 * density).toInt())
    }
    fun magnification(value: Float) = if (value.isFinite()) value.coerceIn(1f, 1.1f) else 1f
    fun edge(value: Float) = if (value.isFinite()) value.coerceIn(0f, 2f) else 0f
  }
}
