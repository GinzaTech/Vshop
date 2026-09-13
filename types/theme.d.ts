// Bổ sung trường màu tùy chỉnh của app vào ThemeColors của react-native-paper
// để TypeScript không báo lỗi khi đọc colors.outlineVariant / colors.onPrimary.
import 'react-native-paper';
export {};

declare global {
    namespace ReactNativePaper {
        // Mở rộng interface màu gốc: outlineVariant (viền phụ),
        // onPrimary (chữ trên nền primary) — các token do app thêm vào theme.
        interface ThemeColors {
            outlineVariant: string;
            onPrimary: string;
        }
    }
}
