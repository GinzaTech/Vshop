/**
 * IdleTask - Tay cầm hủy của tác vụ idle. Gọi cancel() để hủy nếu tác vụ
 * chưa chạy (an toàn gọi nhiều lần).
 */
export type IdleTask = {
  cancel: () => void;
};

/**
 * runIdleSequence — Chạy lần lượt một loạt tác vụ nhẹ (preload, hydrate...)
 * mỗi tác vụ một nhịp rảnh rỗi, có nghỉ delayMs giữa các lần lên lịch để
 * một làn preload không chiếm trọn một nhịp JS của React (tránh khung hình
 * giật lúc điều hướng). Trả về tay cầm hủy cho screen unmount sớm.
 * @param {readonly (() => void)[]} tasks - Danh sách tác vụ chạy tuần tự
 * @param {number} [delayMs] - Khoảng nghỉ giữa các tác vụ (mặc định 240ms)
 * @returns {IdleTask} Tay cầm hủy toàn bộ chuỗi tác vụ
 */
export function runIdleSequence(tasks: readonly (() => void)[], delayMs = 240): IdleTask {
  let cancelled = false;
  let index = 0;
  let idleTask: IdleTask | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (cancelled || index >= tasks.length) return;
    timer = setTimeout(() => {
      idleTask = runWhenIdle(() => {
        if (cancelled) return;
        tasks[index++]();
        schedule();
      });
    }, delayMs);
  };
  schedule();
  return { cancel() {
    cancelled = true;
    clearTimeout(timer);
    idleTask?.cancel();
  } };
}

/**
 * Run non-urgent JS work when the runtime is idle while keeping cancellation
 * semantics for screens that unmount before the callback executes.
 *
 * runWhenIdle — Chạy callback khi runtime rảnh (requestIdleCallback nếu có,
 * fallback setTimeout 0 trên Hermes/RN), tối đa chờ timeoutMs. Trả về tay
 * cầm hủy để screen unmount trước khi callback kịp chạy.
 * @param {() => void} callback - Tác vụ nhẹ cần chạy lúc rảnh
 * @param {number} [timeoutMs] - Thời gian chờ tối đa (mặc định 1000ms)
 * @returns {IdleTask} Tay cầm hủy tác vụ
 */
export function runWhenIdle(callback: () => void, timeoutMs = 1_000): IdleTask {
  let cancelled = false;

  if (typeof globalThis.requestIdleCallback === "function") {
    const idleCallbackId = globalThis.requestIdleCallback(
      () => {
        if (!cancelled) callback();
      },
      { timeout: timeoutMs }
    );

    return {
      cancel() {
        if (cancelled) return;
        cancelled = true;
        globalThis.cancelIdleCallback(idleCallbackId);
      },
    };
  }

  const timeoutId = setTimeout(() => {
    if (!cancelled) callback();
  }, 0);

  return {
    cancel() {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(timeoutId);
    },
  };
}
