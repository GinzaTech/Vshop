export type PixelBackgroundTransition = "toDark" | "toLight";

const PIXEL_CANVAS_GAP = __DEV__ ? 8 : 6;
const PIXEL_CANVAS_MAX_PIXELS = __DEV__ ? 5200 : 12000;
const PIXEL_CANVAS_FRAME_RATE = __DEV__ ? 45 : 60;

const PIXEL_CANVAS_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: #ffffff;
    }
    #pixel-canvas {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <canvas id="pixel-canvas" aria-hidden="true"></canvas>
  <script>
    (function () {
      'use strict';

      var DARK = '#000000';
      var LIGHT = '#ffffff';
      var DEFAULT_DURATION = 800;
      var DEFAULT_GAP = ${PIXEL_CANVAS_GAP};
      var MAX_PIXELS = ${PIXEL_CANVAS_MAX_PIXELS};
      var FRAME_INTERVAL = ${1000 / PIXEL_CANVAS_FRAME_RATE};
      var DELAY_SHARE = 0.62;
      var canvas = document.getElementById('pixel-canvas');
      var context = canvas && canvas.getContext ? canvas.getContext('2d') : null;
      var pixels = [];
      var animationFrame = 0;
      var resizeFrame = 0;
      var cssWidth = 1;
      var cssHeight = 1;
      var activeMode = 'toDark';
      var activeDuration = DEFAULT_DURATION;
      var transitionStartedAt = 0;
      var previousFrameTime = 0;
      var transitionComplete = false;
      var reducedMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }

      function easeOutCubic(value) {
        return 1 - Math.pow(1 - value, 3);
      }

      function getColors(mode) {
        return mode === 'toLight'
          ? { base: DARK, target: LIGHT }
          : { base: LIGHT, target: DARK };
      }

      function stopAnimation() {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        }
      }

      function getEffectiveGap(width, height) {
        var gap = DEFAULT_GAP;
        while (Math.ceil(width / gap) * Math.ceil(height / gap) > MAX_PIXELS) {
          gap += 1;
        }
        return Math.max(3, gap);
      }

      function createPixels(width, height) {
        var gap = getEffectiveGap(width, height);
        var centerX = width * 0.5;
        var centerY = height * 0.5;
        var maxDistance = Math.sqrt(centerX * centerX + centerY * centerY) || 1;
        var nextPixels = [];

        for (var y = 0; y < height; y += gap) {
          for (var x = 0; x < width; x += gap) {
            var pixelCenterX = x + gap * 0.5;
            var pixelCenterY = y + gap * 0.5;
            var dx = pixelCenterX - centerX;
            var dy = pixelCenterY - centerY;
            var normalizedDistance = Math.sqrt(dx * dx + dy * dy) / maxDistance;
            var jitter = Math.random() * 0.055;

            nextPixels.push({
              x: x,
              y: y,
              size: gap + 0.75,
              delayRatio: clamp(normalizedDistance * 0.945 + jitter, 0, 1),
            });
          }
        }

        return nextPixels;
      }

      function paintSolid(color) {
        if (!context) return;
        context.fillStyle = color;
        context.fillRect(0, 0, cssWidth, cssHeight);
      }

      function drawTransition(timestamp) {
        if (!context) return;

        var frameElapsed = timestamp - previousFrameTime;
        if (frameElapsed < FRAME_INTERVAL) {
          animationFrame = requestAnimationFrame(drawTransition);
          return;
        }
        previousFrameTime = timestamp - (frameElapsed % FRAME_INTERVAL);

        var colors = getColors(activeMode);
        var elapsed = Math.max(0, timestamp - transitionStartedAt);
        var delayDuration = activeDuration * DELAY_SHARE;
        var growDuration = Math.max(1, activeDuration - delayDuration);

        paintSolid(colors.base);
        context.fillStyle = colors.target;

        for (var index = 0; index < pixels.length; index += 1) {
          var pixel = pixels[index];
          var localElapsed = elapsed - pixel.delayRatio * delayDuration;
          if (localElapsed <= 0) continue;

          var progress = easeOutCubic(clamp(localElapsed / growDuration, 0, 1));
          var size = pixel.size * progress;
          var offset = (pixel.size - size) * 0.5;
          context.fillRect(pixel.x + offset, pixel.y + offset, size, size);
        }

        if (elapsed >= activeDuration) {
          paintSolid(colors.target);
          transitionComplete = true;
          animationFrame = 0;
          return;
        }

        animationFrame = requestAnimationFrame(drawTransition);
      }

      function startTransition(mode, duration) {
        if (!context) return;

        activeMode = mode === 'toLight' ? 'toLight' : 'toDark';
        activeDuration = Math.max(240, Number(duration) || DEFAULT_DURATION);
        transitionComplete = false;
        stopAnimation();

        var colors = getColors(activeMode);
        document.documentElement.style.background = colors.base;
        document.body.style.background = colors.base;

        if (reducedMotion) {
          paintSolid(colors.target);
          transitionComplete = true;
          return;
        }

        transitionStartedAt = performance.now();
        previousFrameTime = 0;
        paintSolid(colors.base);
        animationFrame = requestAnimationFrame(drawTransition);
      }

      function initialize(restartTransition) {
        stopAnimation();
        if (!canvas || !context) return;

        cssWidth = Math.max(1, document.documentElement.clientWidth || window.innerWidth || 1);
        cssHeight = Math.max(1, document.documentElement.clientHeight || window.innerHeight || 1);
        var deviceScale = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(cssWidth * deviceScale);
        canvas.height = Math.floor(cssHeight * deviceScale);
        canvas.style.width = cssWidth + 'px';
        canvas.style.height = cssHeight + 'px';
        context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
        pixels = createPixels(cssWidth, cssHeight);

        if (restartTransition) {
          startTransition(activeMode, activeDuration);
        } else {
          paintSolid(getColors(activeMode).target);
          transitionComplete = true;
        }
      }

      function scheduleInitialize() {
        if (resizeFrame) cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(function () {
          resizeFrame = 0;
          initialize(!transitionComplete);
        });
      }

      window.__vshopPixelTransition = startTransition;
      window.addEventListener('message', function (event) {
        var data = event && event.data;
        if (!data || data.type !== 'vshop-pixel-transition') return;
        startTransition(data.mode, data.duration);
      });

      var resizeObserver = typeof ResizeObserver === 'function'
        ? new ResizeObserver(scheduleInitialize)
        : null;

      if (resizeObserver) resizeObserver.observe(document.documentElement);
      window.addEventListener('resize', scheduleInitialize, { passive: true });
      window.addEventListener('beforeunload', function () {
        stopAnimation();
        if (resizeFrame) cancelAnimationFrame(resizeFrame);
        if (resizeObserver) resizeObserver.disconnect();
        window.removeEventListener('resize', scheduleInitialize);
      });

      initialize(true);
    })();
  </script>
</body>
</html>`;

export default PIXEL_CANVAS_HTML;
