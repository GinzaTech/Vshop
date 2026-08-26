import { createRequestDeduper } from "~/utils/request-deduper";

describe("createRequestDeduper", () => {
  it("shares one in-flight request for the same key", async () => {
    let resolveRequest: ((value: string) => void) | undefined;
    const request = new Promise<string>((resolve) => {
      resolveRequest = resolve;
    });
    const createRequest = jest.fn(() => request);
    const deduper = createRequestDeduper<string>();

    const first = deduper.run("party", createRequest);
    const second = deduper.run("party", createRequest);

    expect(second).toBe(first);
    expect(createRequest).toHaveBeenCalledTimes(1);

    resolveRequest?.("joined");
    await expect(first).resolves.toBe("joined");
  });

  it("retries after a rejected request instead of caching its failure", async () => {
    const deduper = createRequestDeduper<string>();
    const failed = deduper.run("party", () => Promise.reject(new Error("404")));

    await expect(failed).rejects.toThrow("404");
    await Promise.resolve();

    await expect(deduper.run("party", async () => "recovered")).resolves.toBe(
      "recovered",
    );
  });
});
