import React from "react";
import { AppLanguageContext } from "~/utils/app-language-context";

/** Hidden retained tabs adopt the current locale when they receive focus. */
export function AppSceneLanguageBoundary({ active, children }: React.PropsWithChildren<{ active: boolean }>) {
  const language = React.useContext(AppLanguageContext);
  const lastActive = React.useRef(language);
  React.useLayoutEffect(() => {
    if (active) lastActive.current = language;
  }, [active, language]);
  return <AppLanguageContext.Provider value={active ? language : lastActive.current}>
    {children}
  </AppLanguageContext.Provider>;
}
