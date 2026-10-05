import { createContext } from "react";
import type { i18n } from "i18next";

export const AppLanguageContext = createContext<Readonly<{
  instance: i18n;
  language: string;
}> | null>(null);
