package expo.modules.vshopglass

import android.content.Context
import android.graphics.Canvas
import android.graphics.RenderNode
import android.os.Build
import android.util.Log
import android.view.View
import androidx.annotation.RequiresApi
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

/** Page-only sibling of the lens. Retains drawing commands, never a screenshot. */
class RefractionTargetView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  val onReady by EventDispatcher()
  private var captureEnabled = false
  private var page: PageDisplayList? = null
  private var consumers: Set<RefractionLensView> = emptySet()
  private var publishedTag = NO_ID
  private var captureFailed = false
  private var aggregateVisible = true

  fun setCaptureEnabled(enabled: Boolean) {
    if (captureEnabled == enabled) return
    captureEnabled = enabled
    if (!enabled) releasePage()
    invalidate()
  }

  fun addConsumer(view: RefractionLensView) { consumers = consumers + view }
  fun removeConsumer(view: RefractionLensView) { consumers = consumers - view }
  private fun captureAllowed() = LensLifecycle.retainPage(captureEnabled, windowVisibility == VISIBLE, aggregateVisible)
  fun pageNode(): RenderNode? = if (Build.VERSION.SDK_INT >= 33 && captureAllowed()) page?.node else null

  override fun dispatchDraw(canvas: Canvas) {
    if (!captureAllowed() || captureFailed || Build.VERSION.SDK_INT < 33 || !canvas.isHardwareAccelerated) {
      super.dispatchDraw(canvas)
      return
    }
    try {
      val hadNode = page != null
      val display = page ?: PageDisplayList().also { page = it }
      display.node.setPosition(0, 0, width, height)
      val recording = display.node.beginRecording()
      try { super.dispatchDraw(recording) } finally { display.node.endRecording() }
      canvas.drawRenderNode(display.node)
      // A newly published node must wake an already-bound static lens once.
      // Ordinary re-recordings reuse its identity and do not notify here.
      if (LensLifecycle.publishSource(hadNode, true)) consumers.forEach { it.onSourceInvalidated() }
    } catch (_: RuntimeException) {
      captureFailed = true
      releasePage()
      Log.w("VShopGlass", "Page recording unavailable; preserving ordinary page drawing")
      super.dispatchDraw(canvas)
    }
  }

  override fun onDescendantInvalidated(child: View, target: View) {
    super.onDescendantInvalidated(child, target)
    // Coalesced by View invalidation. Refresh structure/clips as well as child nodes.
    // Ordinary dispatchDraw calls must not notify and form a feedback loop.
    if (captureEnabled && !captureFailed) invalidate()
    consumers.forEach { it.onSourceInvalidated() }
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    // Yoga owns child coordinates; LinearLayout.onLayout would overwrite them.
    if (id > 0 && publishedTag != id) {
      publishedTag = id
      onReady(mapOf("targetTag" to id))
    }
    if (changed) consumers.forEach { it.onSourceInvalidated() }
  }

  override fun onWindowVisibilityChanged(visibility: Int) {
    super.onWindowVisibilityChanged(visibility)
    if (visibility != VISIBLE) releasePage() else invalidate()
  }

  override fun onVisibilityAggregated(visible: Boolean) {
    super.onVisibilityAggregated(visible)
    aggregateVisible = visible
    if (!captureAllowed()) releasePage() else invalidate()
  }

  override fun onDetachedFromWindow() {
    releasePage()
    publishedTag = NO_ID
    super.onDetachedFromWindow()
  }

  private fun releasePage() {
    if (Build.VERSION.SDK_INT >= 33) page?.node?.discardDisplayList()
    page = null
    // The ordinary page may itself reference the discarded node. Re-record it.
    invalidate()
    consumers.forEach { it.onSourceInvalidated() }
  }
}

@RequiresApi(33)
private class PageDisplayList { val node = RenderNode("VShop page drawing commands") }
