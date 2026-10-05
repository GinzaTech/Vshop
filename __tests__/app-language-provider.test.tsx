import React from "react";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import TestRenderer, { act } from "react-test-renderer";

import { AppLanguageProvider } from "~/components/AppLanguageProvider";
import { AppSceneLanguageBoundary } from "~/components/AppSceneLanguageBoundary";
import { useTranslation } from "~/hooks/useAppTranslation";

jest.mock("~/utils/localization", () => ({ __esModule: true, default: null }));

it("uses one language listener while every memoized consumer updates text and derived labels", async () => {
  const instance = createInstance();
  await instance.use(initReactI18next).init({
    lng: "vi", fallbackLng: "en", initImmediate: false,
    resources: { vi: { translation: { label: "Ngôn ngữ" } }, en: { translation: { label: "Language" } } },
    react: { useSuspense: false },
  });
  const on = jest.spyOn(instance, "on");
  const off = jest.spyOn(instance, "off");
  const Consumer = React.memo(function Consumer() {
    const { t } = useTranslation();
    const derived = React.useMemo(() => t("label"), [t]);
    return React.createElement("LocaleLabel", { value: t("label"), derived });
  });
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<AppLanguageProvider instance={instance}>
    {Array.from({ length: 25 }, (_, index) => <Consumer key={index} />)}
  </AppLanguageProvider>); });
  expect(on.mock.calls.filter(([event]) => event === "languageChanged")).toHaveLength(1);
  await act(async () => { await instance.changeLanguage("en"); });
  for (const label of renderer.root.findAllByType("LocaleLabel" as never)) {
    expect(label.props).toMatchObject({ value: "Language", derived: "Language" });
  }
  await act(async () => { await instance.changeLanguage("vi"); });
  expect(renderer.root.findAllByType("LocaleLabel" as never)).toHaveLength(25);
  for (const label of renderer.root.findAllByType("LocaleLabel" as never)) {
    expect(label.props).toMatchObject({ value: "Ngôn ngữ", derived: "Ngôn ngữ" });
  }
  act(() => renderer.unmount());
  expect(off.mock.calls.filter(([event]) => event === "languageChanged")).toHaveLength(1);
});

it("updates the visible tab first and keeps hidden locale work until focus without remounting", async () => {
  const instance = createInstance();
  await instance.use(initReactI18next).init({ lng: "vi", initImmediate: false,
    resources: { vi: { translation: { label: "Ngôn ngữ" } }, en: { translation: { label: "Language" } } },
    react: { useSuspense: false } });
  const renders = { visible: 0, hidden: 0 };
  const Label = React.memo(function Label({ name }: { name: keyof typeof renders }) {
    const { t } = useTranslation();
    renders[name] += 1;
    const [retained] = React.useState(() => ({ id: name }));
    return React.createElement("LocaleLabel", { name, value: t("label"), retained });
  });
  const tree = (hiddenActive: boolean) => <AppLanguageProvider instance={instance}>
    <AppSceneLanguageBoundary active={!hiddenActive}><Label name="visible" /></AppSceneLanguageBoundary>
    <AppSceneLanguageBoundary active={hiddenActive}><Label name="hidden" /></AppSceneLanguageBoundary>
  </AppLanguageProvider>;
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(tree(false)); });
  const hidden = renderer.root.findByProps({ name: "hidden", value: "Ngôn ngữ" });
  const identity = hidden.props.retained;
  const count = renders.hidden;
  await act(async () => { await instance.changeLanguage("en"); });
  expect(renderer.root.findByProps({ name: "visible", value: "Language" })).toBeDefined();
  expect(renders.hidden).toBe(count);
  expect(hidden.props.value).toBe("Ngôn ngữ");
  act(() => { renderer.update(tree(true)); });
  expect(renderer.root.findByProps({ name: "hidden", value: "Language" }).props.retained).toBe(identity);
  act(() => { renderer.unmount(); });
});

it("does not retain a speculative locale from a suspended active render after an urgent blur", async () => {
  const instance = createInstance();
  await instance.use(initReactI18next).init({ lng: "vi", initImmediate: false,
    resources: { vi: { translation: { label: "Ngôn ngữ" } }, en: { translation: { label: "Language" } } },
    react: { useSuspense: false } });
  const pending = new Promise<void>(() => undefined);
  let speculativeRenders = 0;
  function Label({ suspend }: { suspend: boolean }) {
    const { t } = useTranslation();
    const value = t("label");
    if (suspend && value === "Language") {
      speculativeRenders += 1;
      throw pending;
    }
    return React.createElement("LocaleLabel", { value });
  }
  const tree = (active: boolean, suspend: boolean) => <AppLanguageProvider instance={instance}>
    <React.Suspense fallback={null}>
      <AppSceneLanguageBoundary active={active}><Label suspend={suspend} /></AppSceneLanguageBoundary>
    </React.Suspense>
  </AppLanguageProvider>;
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(tree(true, true)); });
  await act(async () => { await instance.changeLanguage("en"); });
  expect(speculativeRenders).toBeGreaterThan(0);
  expect(renderer.root.findByType("LocaleLabel" as never).props.value).toBe("Ngôn ngữ");
  act(() => { renderer.update(tree(false, false)); });
  expect(renderer.root.findByType("LocaleLabel" as never).props.value).toBe("Ngôn ngữ");
  act(() => { renderer.unmount(); });
});

it.each(["default", "fallback", "prefix"] as const)("preserves namespace, tuple and explicit locale semantics for %s", async (mode) => {
  const instance = createInstance();
  await instance.use(initReactI18next).init({ lng: "vi", fallbackLng: "en", initImmediate: false,
    resources: {
      vi: { translation: { onlyDefault: "Tiếng Việt" } },
      en: { translation: { onlyDefault: "Default only" }, feature: { group: { label: "Scoped Hello" } } },
    }, react: { useSuspense: false } });
  function Label() {
    const result = useTranslation(mode === "prefix" ? "feature" : ["feature", "translation"], {
      lng: "en", nsMode: mode === "fallback" ? "fallback" : "default",
      keyPrefix: mode === "prefix" ? "group" : undefined,
    });
    const [t, i18n, ready] = result;
    expect(t).toBe(result.t); expect(i18n).toBe(instance); expect(ready).toBe(true);
    return React.createElement("LocaleLabel", { value: t(mode === "prefix" ? "label" : "onlyDefault") });
  }
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<AppLanguageProvider instance={instance}><Label /></AppLanguageProvider>); });
  expect(renderer.root.findByType("LocaleLabel" as never).props.value).toBe(
    mode === "prefix" ? "Scoped Hello" : mode === "fallback" ? "Default only" : "onlyDefault",
  );
  act(() => { renderer.unmount(); });
});
