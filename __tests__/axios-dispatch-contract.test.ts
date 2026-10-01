import axios, { AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";

jest.unmock("axios");

describe("installed Axios dispatch compatibility", () => {
  it("preserves safe interceptor metadata, own headers and response config through a custom adapter", async () => {
    let observed: InternalAxiosRequestConfig | undefined;
    const adapter: AxiosAdapter = async (config) => ({
      data: { ok: true }, status: 200, statusText: "OK", headers: new AxiosHeaders(), config,
    });
    const client = axios.create({ baseURL: "https://example.test", adapter });
    client.interceptors.request.use((config) => { observed = config; return config; });
    const options = { headers: { Authorization: "Bearer synthetic-test-value" }, metadata: { startTime: 123 } };
    const result = await client.post("/probe", { count: 1 }, options);
    expect(result.config).toBe(observed);
    expect(result.config.headers.get("Authorization")).toBe("Bearer synthetic-test-value");
    expect(result.config).toMatchObject({ metadata: { startTime: 123 }, data: '{"count":1}' });
    expect(result.data).toEqual({ ok: true });
  });

  it("rejects cancellation without dispatching any request", async () => {
    const adapter = jest.fn<ReturnType<AxiosAdapter>, Parameters<AxiosAdapter>>();
    const controller = new AbortController();
    controller.abort();
    await expect(axios.get("https://example.test/probe", { adapter, signal: controller.signal }))
      .rejects.toMatchObject({ code: "ERR_CANCELED" });
    expect(adapter).not.toHaveBeenCalled();
  });
});
