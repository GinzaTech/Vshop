import { useContext, useMemo } from "react";
import { useTranslation as useReactTranslation } from "react-i18next";
import { AppLanguageContext } from "~/utils/app-language-context";

export function useTranslation(...args: Parameters<typeof useReactTranslation>) {
  const context = useContext(AppLanguageContext);
  const [namespace, options] = args;
  // Retain namespace readiness/fallback semantics without a listener per label.
  const fallback = useReactTranslation(namespace, context ? {
    ...options, i18n: context.instance, bindI18n: "",
  } : options);
  const instance = context?.instance;
  const language = options?.lng ?? context?.language;
  const keyPrefix = options?.keyPrefix;
  const nsMode = options?.nsMode ?? instance?.options.react?.nsMode;
  const t = useMemo(() => {
    if (!instance) return null;
    const resolvedNamespace = typeof namespace === "string" ? namespace
      : namespace?.filter((name): name is string => typeof name === "string")
        ?? (instance.options.defaultNS || "translation");
    const fixedNamespace = nsMode === "fallback" ? resolvedNamespace
      : typeof resolvedNamespace === "string" ? resolvedNamespace : resolvedNamespace[0];
    return instance.getFixedT(language || instance.language || "en", fixedNamespace,
      typeof keyPrefix === "string" ? keyPrefix : undefined);
  }, [instance, language, namespace, keyPrefix, nsMode]);
  if (!context || !t) return fallback;
  // Both object and tuple consumers keep the react-i18next call contract.
  return Object.assign([t, context.instance, fallback.ready], {
    t, i18n: context.instance, ready: fallback.ready,
  }) as typeof fallback;
}
