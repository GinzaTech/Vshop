import { useSystemChromeStore } from "~/hooks/useSystemChromeStore";

describe("system chrome store", () => {
  afterEach(() => {
    useSystemChromeStore.getState().setTopInsetTone("light");
    useSystemChromeStore.getState().setPrimaryNavigationTone("dark");
  });

  it("switches the top safe-area tone with the active screen", () => {
    expect(useSystemChromeStore.getState().topInsetTone).toBe("light");

    useSystemChromeStore.getState().setTopInsetTone("dark");

    expect(useSystemChromeStore.getState().topInsetTone).toBe("dark");
  });

  it("does not notify subscribers for identical chrome state", () => {
    const listener = jest.fn();
    const unsubscribe = useSystemChromeStore.subscribe(listener);

    useSystemChromeStore.getState().setTopInsetTone("light");
    useSystemChromeStore.getState().setPrimaryNavigationTone("dark");
    useSystemChromeStore
      .getState()
      .setPrimaryNavigationAccessibilityHidden(false);

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
