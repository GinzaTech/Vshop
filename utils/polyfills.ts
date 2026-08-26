/**
 * Polyfills cho Hermes JS engine (React Native Android).
 *
 * Hermes (đặc biệt các phiên bản cũ đi kèm với một số bản React Native)
 * không hỗ trợ `Promise.allSettled`. File này phải được import ở đầu
 * file entry point của app (_layout.tsx) để polyfill có sẵn trước khi
 * bất kỳ module nào khác sử dụng nó.
 */

// Kiểm tra nếu Promise.allSettled chưa được định nghĩa thì tự định nghĩa
if (typeof Promise.allSettled !== "function") {
  /**
   * allSettled - Polyfill cho Promise.allSettled
   * @param {T} promises - Mảng các Promise cần xử lý
   * @returns {Promise} Promise trả về mảng kết quả với trạng thái fulfilled/rejected của từng promise
   */
  Promise.allSettled = function allSettled<T extends readonly unknown[] | []>(
    promises: T
  ): Promise<{
    -readonly [K in keyof T]: PromiseSettledResult<Awaited<T[K]>>;
  }> {
    // Dùng Promise.all và map từng promise để bọc kết quả thành fulfilled hoặc rejected
    return Promise.all(
      Array.from(promises).map((promise) =>
        Promise.resolve(promise).then(
          (value) =>
            ({ status: "fulfilled" as const, value }) as PromiseFulfilledResult<typeof value>,
          (reason) =>
            ({ status: "rejected" as const, reason }) as PromiseRejectedResult
        )
      )
    ) as unknown as Promise<{
      -readonly [K in keyof T]: PromiseSettledResult<Awaited<T[K]>>;
    }>;
  };
}
