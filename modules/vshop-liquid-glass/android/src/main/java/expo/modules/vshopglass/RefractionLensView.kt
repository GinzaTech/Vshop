package expo.modules.vshopglass

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.os.Build
import android.util.Log
import android.view.View
import android.view.ViewTreeObserver
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

/** Decorative consumer; the sibling target can never contain this view. */
class RefractionLensView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private var targetTag: Int? = null
  private var target: RefractionTargetView? = null
  private var enabled = false
  private var renderer: LensRenderer? = null
  private var failed = false
  private var reportedReady = false
  private var observer: ViewTreeObserver? = null
  private var tint = Color.TRANSPARENT
  private var magnification = 1f
  private var edgeDp = 0f
  private var dirty = true
  private var rebound = false
  private var mappingWasValid = false
  private val sourceMatrix = Matrix()
  private val lensMatrix = Matrix()
  private val inverseLens = Matrix()
  private val transform = Matrix()
  private val nextTransform = Matrix()
  private val matrixValues = FloatArray(9)
  private val preDraw = ViewTreeObserver.OnPreDrawListener {
    if (resolveTarget()) {
      val mapping = updateTransform()
      val valid = mapping != Mapping.INVALID
      val redraw = LensLifecycle.needsRedraw(rebound, mappingWasValid, valid, mapping == Mapping.CHANGED)
      rebound = false
      mappingWasValid = valid
      if (!valid && renderer != null) { releaseDrawing(); invalidate() }
      else if (redraw) invalidate()
    }
    true
  }

  init {
    setWillNotDraw(false)
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
    isFocusable = false
    isClickable = false
  }

  fun setTargetTag(tag: Int?) {
    if (targetTag == tag) return
    releaseTarget()
    targetTag = tag?.takeIf { it > 0 }
    dirty = true
    invalidate()
  }
  fun setRenderingEnabled(value: Boolean) {
    enabled = value
    updateSubscription()
    invalidate()
  }
  fun setTint(value: Int) { tint = value; onSourceInvalidated() }
  fun setMagnification(value: Float) { magnification = LensGeometry.magnification(value); onSourceInvalidated() }
  fun setEdge(value: Float) { edgeDp = LensGeometry.edge(value); onSourceInvalidated() }
  fun onSourceInvalidated() { dirty = true; if (canRender()) invalidate() }

  private fun canRender() = enabled && !failed && Build.VERSION.SDK_INT >= 33 &&
    isAttachedToWindow && windowVisibility == VISIBLE && isShown

  private fun updateSubscription() {
    val next = if (canRender()) viewTreeObserver else null
    if (observer === next) return
    observer?.takeIf { it.isAlive }?.removeOnPreDrawListener(preDraw)
    observer = next
    next?.addOnPreDrawListener(preDraw)
    if (next == null) releaseTarget()
  }

  private fun resolveTarget(): Boolean {
    if (!canRender()) return false
    val current = target
    if (current != null && current.isAttachedToWindow && current.id == targetTag && current.isShown) return true
    releaseTarget()
    val tag = targetTag ?: return false
    val candidate = try { appContext.findView<RefractionTargetView>(tag) } catch (_: RuntimeException) { null }
    if (candidate == null || !candidate.isAttachedToWindow || candidate.windowToken != windowToken || !candidate.isShown) return false
    // Reject ancestors, self and descendants: no feedback or self-referential display list.
    if (isAncestor(candidate, this) || isAncestor(this, candidate)) return false
    target = candidate
    candidate.addConsumer(this)
    rebound = true
    dirty = true
    return true
  }

  private enum class Mapping { INVALID, UNCHANGED, CHANGED }

  private fun updateTransform(): Mapping {
    val source = target ?: return Mapping.INVALID
    sourceMatrix.reset()
    lensMatrix.reset()
    source.transformMatrixToGlobal(sourceMatrix)
    transformMatrixToGlobal(lensMatrix)
    if (!lensMatrix.invert(inverseLens)) return Mapping.INVALID
    nextTransform.setConcat(inverseLens, sourceMatrix)
    nextTransform.getValues(matrixValues)
    if (!LensGeometry.validAffine(matrixValues)) return Mapping.INVALID
    if (transform == nextTransform) return Mapping.UNCHANGED
    transform.set(nextTransform)
    dirty = true
    return Mapping.CHANGED
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    if (!canvas.isHardwareAccelerated || !resolveTarget() || Build.VERSION.SDK_INT < 33) return
    val bounds = LensGeometry.create(width, height, resources.displayMetrics.density) ?: return
    val page = target?.pageNode()?.takeIf { it.hasDisplayList() } ?: return
    if (updateTransform() == Mapping.INVALID) return
    try {
      val drawing = renderer ?: LensRenderer().also { renderer = it; dirty = true }
      if (dirty) {
        drawing.updateMaterial(tint, magnification, edgeDp * resources.displayMetrics.density)
        drawing.record(page, transform, bounds)
        dirty = false
      }
      drawing.draw(canvas)
      if (!reportedReady) {
        reportedReady = true
        Log.i("VShopGlass", "Backdrop commands recorded (API 1); GPU pixels not verified")
      }
    } catch (_: RuntimeException) {
      // No screen data or exception payload enters diagnostics.
      failed = true
      Log.w("VShopGlass", "Backdrop renderer unavailable; using material fallback")
      updateSubscription()
    }
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    onSourceInvalidated()
  }
  override fun onAttachedToWindow() { super.onAttachedToWindow(); updateSubscription() }
  override fun onWindowVisibilityChanged(visibility: Int) {
    super.onWindowVisibilityChanged(visibility)
    updateSubscription()
  }
  override fun onVisibilityAggregated(visible: Boolean) {
    super.onVisibilityAggregated(visible)
    updateSubscription()
  }
  override fun onDetachedFromWindow() {
    observer?.takeIf { it.isAlive }?.removeOnPreDrawListener(preDraw)
    observer = null
    releaseTarget()
    super.onDetachedFromWindow()
  }

  private fun releaseTarget() {
    target?.removeConsumer(this)
    target = null
    rebound = false
    releaseDrawing()
  }

  private fun releaseDrawing() {
    if (Build.VERSION.SDK_INT >= 33) renderer?.release()
    renderer = null
    mappingWasValid = false
    dirty = true
  }

  private fun isAncestor(ancestor: View, child: View): Boolean {
    var cursor: View? = child
    while (cursor != null) {
      if (cursor === ancestor) return true
      cursor = cursor.parent as? View
    }
    return false
  }
}
