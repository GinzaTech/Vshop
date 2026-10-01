package expo.modules.vshopglass

import android.graphics.Color
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class VShopLiquidGlassModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VShopLiquidGlass")
    Constants("apiVersion" to 1)
    View(RefractionTargetView::class) {
      Name("RefractionTarget")
      Events("onReady")
      Prop("enabled") { view: RefractionTargetView, enabled: Boolean -> view.setCaptureEnabled(enabled) }
    }
    View(RefractionLensView::class) {
      Name("RefractionLens")
      Prop("targetTag") { view: RefractionLensView, tag: Int? -> view.setTargetTag(tag) }
      Prop("enabled") { view: RefractionLensView, enabled: Boolean -> view.setRenderingEnabled(enabled) }
      Prop("tint") { view: RefractionLensView, tint: Color -> view.setTint(tint.toArgb()) }
      Prop("magnification") { view: RefractionLensView, value: Float -> view.setMagnification(value) }
      Prop("edgeDp") { view: RefractionLensView, value: Float -> view.setEdge(value) }
    }
  }
}
