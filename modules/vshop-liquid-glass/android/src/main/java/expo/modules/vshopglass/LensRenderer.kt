package expo.modules.vshopglass

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.RenderEffect
import android.graphics.RenderNode
import android.graphics.RuntimeShader
import androidx.annotation.RequiresApi

/** All effect layers are bounded to the padded lens, not the full page. */
@RequiresApi(33)
internal class LensRenderer {
  private val node = RenderNode("VShop bounded backdrop lens")
  private val shader = RuntimeShader(SHADER)
  private var geometry: LensGeometry? = null
  private var tint = Color.TRANSPARENT
  private var magnification = 1f
  private var edge = 0f

  fun updateMaterial(color: Int, zoom: Float, edgePixels: Float) {
    tint = color
    magnification = zoom
    edge = edgePixels
  }

  fun record(page: RenderNode, transform: Matrix, bounds: LensGeometry) {
    geometry = bounds
    node.setPosition(0, 0, bounds.bufferWidth, bounds.bufferHeight)
    val canvas = node.beginRecording()
    try {
      canvas.translate(bounds.padding.toFloat(), bounds.padding.toFloat())
      canvas.concat(transform)
      canvas.drawRenderNode(page)
    } finally { node.endRecording() }
    shader.setFloatUniform("size", bounds.width.toFloat(), bounds.height.toFloat())
    shader.setFloatUniform("padding", bounds.padding.toFloat())
    shader.setFloatUniform("zoom", magnification)
    shader.setFloatUniform("edge", edge)
    shader.setColorUniform("tint", tint)
    node.setRenderEffect(RenderEffect.createRuntimeShaderEffect(shader, "page"))
  }

  fun draw(canvas: Canvas) {
    val bounds = geometry ?: return
    canvas.save()
    canvas.clipRect(0, 0, bounds.width, bounds.height)
    canvas.translate(-bounds.padding.toFloat(), -bounds.padding.toFloat())
    canvas.drawRenderNode(node)
    canvas.restore()
  }

  fun release() {
    geometry = null
    node.discardDisplayList()
    node.setRenderEffect(null)
  }

  companion object {
    // Pixel coordinates already compensate the source/lens global transforms.
    // Magnification and a capsule-edge displacement sample real page pixels.
    private const val SHADER = """
      uniform shader page;
      uniform float2 size;
      uniform float padding;
      uniform float zoom;
      uniform float edge;
      layout(color) uniform half4 tint;
      half4 main(float2 point) {
        float2 center = size * 0.5 + float2(padding);
        float2 local = point - center;
        float radius = size.y * 0.5;
        float2 axis = float2(clamp(local.x, -size.x * 0.5 + radius, size.x * 0.5 - radius), 0.0);
        float2 normalVector = local - axis;
        float distance = length(normalVector);
        float2 normal = normalVector / max(distance, 0.001);
        float rim = smoothstep(radius * 0.65, radius, distance);
        float2 sampleAt = center + local / zoom - normal * rim * edge;
        sampleAt = clamp(sampleAt, float2(0.5), size + float2(padding * 2.0 - 0.5));
        half4 source = page.eval(sampleAt);
        // Fill a transparent source with white; never compound the fallback tint.
        half3 background = source.rgb + half3(1.0) * (1.0 - source.a);
        return half4(mix(background, tint.rgb, tint.a), 1.0);
      }
    """
  }
}
