import React from "react";
import type { i18n } from "i18next";
import { I18nextProvider } from "react-i18next";

import { AppLanguageContext } from "~/utils/app-language-context";
import defaultInstance from "~/utils/localization";

/** One language subscription for the retained application tree. */
export function AppLanguageProvider({ children, instance = defaultInstance }: React.PropsWithChildren<{ instance?: i18n }>) {
  const [language, setLanguage] = React.useState(instance.language);
  React.useEffect(() => {
    const notify = () => React.startTransition(() => setLanguage(instance.language));
    instance.on("languageChanged", notify);
    instance.on("initialized", notify);
    notify();
    return () => {
      instance.off("languageChanged", notify);
      instance.off("initialized", notify);
    };
  }, [instance]);
  const context = React.useMemo(() => ({ instance, language }), [instance, language]);
  return <AppLanguageContext.Provider value={context}>
    <I18nextProvider i18n={instance}>{children}</I18nextProvider>
  </AppLanguageContext.Provider>;
}
