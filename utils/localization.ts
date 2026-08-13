// Import i18n và các module liên quan đến đa ngôn ngữ
import i18n, { ModuleType } from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import { getStoredItem, setStoredItem } from "./storage";

// Import các file JSON dịch thuật cho từng ngôn ngữ
import en from "~/assets/i18n/en.json";   // Tiếng Anh
import ar from "~/assets/i18n/ar.json";   // Tiếng Ả Rập
import de from "~/assets/i18n/de.json";   // Tiếng Đức
import es from "~/assets/i18n/es.json";   // Tiếng Tây Ban Nha
import fr from "~/assets/i18n/fr.json";   // Tiếng Pháp
import it from "~/assets/i18n/it.json";   // Tiếng Ý
import jp from "~/assets/i18n/jp.json";   // Tiếng Nhật
import ko from "~/assets/i18n/ko.json";   // Tiếng Hàn
import no from "~/assets/i18n/no.json";   // Tiếng Na Uy
import pl from "~/assets/i18n/pl.json";   // Tiếng Ba Lan
import pt from "~/assets/i18n/pt.json";   // Tiếng Bồ Đào Nha
import ru from "~/assets/i18n/ru.json";   // Tiếng Nga
import th from "~/assets/i18n/th.json";   // Tiếng Thái
import tr from "~/assets/i18n/tr.json";   // Tiếng Thổ Nhĩ Kỳ
import uk from "~/assets/i18n/uk.json";   // Tiếng Ukraina
import vi from "~/assets/i18n/vi.json";   // Tiếng Việt
import zhHans from "~/assets/i18n/zh-Hans.json"; // Tiếng Trung Giản Thể
import zhHant from "~/assets/i18n/zh-Hant.json"; // Tiếng Trung Phồn Thể

// https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes
/**
 * resources - Đối tượng chứa tất cả tài nguyên dịch thuật và mã ngôn ngữ VAPI tương ứng
 * Mỗi key là mã ngôn ngữ ISO 639, value gồm:
 * - translation: dữ liệu JSON dịch thuật
 * - VAPILangCode: mã ngôn ngữ dùng cho API VNG (Valorant API)
 * @type {Object}
 */
export const resources = {
  ar: { translation: ar, VAPILangCode: "ar-AE" },
  de: { translation: de, VAPILangCode: "de-DE" },
  en: { translation: en, VAPILangCode: "en-US" },
  es: { translation: es, VAPILangCode: "es-ES" },
  fr: { translation: fr, VAPILangCode: "fr-FR" },
  it: { translation: it, VAPILangCode: "it-IT" },
  jp: { translation: jp, VAPILangCode: "ja-JP" },
  ko: { translation: ko, VAPILangCode: "ko-KR" },
  no: { translation: no, VAPILangCode: "en-US" },
  pl: { translation: pl, VAPILangCode: "pl-PL" },
  pt: { translation: pt, VAPILangCode: "pt-BR" },
  ru: { translation: ru, VAPILangCode: "ru-RU" },
  th: { translation: th, VAPILangCode: "th-TH" },
  tr: { translation: tr, VAPILangCode: "tr-TR" },
  uk: { translation: uk, VAPILangCode: "uk-UA" },
  vi: { translation: vi, VAPILangCode: "vi-VN" },
  "zh-Hans": { translation: zhHans, VAPILangCode: "zh-CN" },
  "zh-Hant": { translation: zhHant, VAPILangCode: "zh-TW" },
};

/**
 * getVAPILang - Lấy mã ngôn ngữ VAPI dựa trên ngôn ngữ hiện tại của i18n
 * @returns {string} Mã ngôn ngữ VAPI (VD: "en-US", "vi-VN"), mặc định "en-US"
 */
export const getVAPILang = () => {
  const translation = resources[i18n.language as keyof typeof resources];
  return translation ? translation.VAPILangCode : "en-US";
};

/**
 * normalizeLanguage - Chuẩn hóa mã ngôn ngữ từ thiết bị về mã ngôn ngữ được hỗ trợ trong app
 * @param {string | null | undefined} languageCode - Mã ngôn ngữ (VD: "en", "vi")
 * @param {string | null | undefined} languageTag - Thẻ ngôn ngữ đầy đủ (VD: "en-US", "vi-VN")
 * @returns {string} Mã ngôn ngữ đã chuẩn hóa (VD: "en", "vi", "zh-Hant")
 */
const normalizeLanguage = (
  languageCode?: string | null,
  languageTag?: string | null
) => {
  const normalizedTag = languageTag?.toLowerCase() || "";

  // Xử lý tiếng Trung Phồn Thể (zh-Hant, zh-TW, zh-HK)
  if (
    normalizedTag.startsWith("zh-hant") ||
    normalizedTag.startsWith("zh-tw") ||
    normalizedTag.startsWith("zh-hk")
  ) {
    return "zh-Hant";
  }

  // Xử lý tiếng Trung Giản Thể (zh-Hans, zh-CN, zh-SG)
  if (
    normalizedTag.startsWith("zh-hans") ||
    normalizedTag.startsWith("zh-cn") ||
    normalizedTag.startsWith("zh-sg")
  ) {
    return "zh-Hans";
  }

  // Lấy 2 ký tự đầu của mã ngôn ngữ và chuyển thành chữ thường
  const normalizedCode = (languageCode || languageTag || "en")
    .split("-")[0]
    .toLowerCase();

  // Xử lý các trường hợp đặc biệt
  switch (normalizedCode) {
    case "ja": // Tiếng Nhật -> "jp"
      return "jp";
    case "nb": // Tiếng Na Uy Bokmål -> "no"
    case "nn": // Tiếng Na Uy Nynorsk -> "no"
      return "no";
    default:
      // Kiểm tra nếu mã ngôn ngữ có trong resources, nếu không thì mặc định "en"
      return normalizedCode in resources ? normalizedCode : "en";
  }
};

/**
 * langDetector - Bộ phát hiện ngôn ngữ tùy chỉnh cho i18next
 * Dùng để tự động phát hiện ngôn ngữ từ bộ nhớ hoặc từ thiết bị
 * @type {Object}
 */
const langDetector = {
  type: "languageDetector" as ModuleType,
  async: true,
  /**
   * detect - Phát hiện ngôn ngữ ưu tiên từ bộ nhớ, nếu không có thì từ cài đặt thiết bị
   * @param {Function} callback - Hàm callback nhận mã ngôn ngữ đã phát hiện
   */
  detect: async (callback: any) => {
    // Kiểm tra ngôn ngữ đã lưu trong bộ nhớ
    const result = await getStoredItem("language");
    if (result) {
      callback(normalizeLanguage(result, result));
      return;
    }

    // Nếu không có trong bộ nhớ, lấy ngôn ngữ từ thiết bị
    const locales = getLocales();
    const deviceLocale = locales?.[0];
    const lang = normalizeLanguage(
      deviceLocale?.languageCode,
      deviceLocale?.languageTag
    );
    callback(lang);
  },
  init: () => {},
  /**
   * cacheUserLanguage - Lưu ngôn ngữ người dùng đã chọn vào bộ nhớ
   * @param {string} language - Mã ngôn ngữ cần lưu
   */
  cacheUserLanguage: (language: string) => {
    setStoredItem("language", language);
  },
};

// Khởi tạo i18n với language detector, react-i18next bridge và các resources
i18n
  .use(langDetector)      // Sử dụng bộ phát hiện ngôn ngữ tùy chỉnh
  .use(initReactI18next)  // Tích hợp với React
  .init({
    resources,                // Tài nguyên dịch thuật các ngôn ngữ
    compatibilityJSON: "v3",  // Tương thích JSON phiên bản 3
    fallbackLng: "en",        // Ngôn ngữ dự phòng là tiếng Anh
    // i18next debug dumps every translation key and noticeably delays dev startup.
    debug: false,
    react: {
      useSuspense: false,     // Tắt Suspense mode
    },
    interpolation: {
      escapeValue: false,     // Không escape giá trị (React Native đã tự động escape)
    },
  });

// Export đối tượng i18n mặc định để sử dụng trong toàn app
export default i18n;
