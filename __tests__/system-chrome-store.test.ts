import { useSystemChromeStore } from "~/hooks/useSystemChromeStore";

describe("system chrome store", () => {
  afterEach(() => {
    useSystemChromeStore.getState().setTopInsetTone("light");
  });

  it("switches the top safe-area tone with the active screen", () => {
    expect(useSystemChromeStore.getState().topInsetTone).toBe("light");

    useSystemChromeStore.getState().setTopInsetTone("dark");

    expect(useSystemChromeStore.getState().topInsetTone).toBe("dark");
  });
});
