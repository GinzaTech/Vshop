import 'react-native-paper';
export {};

declare global {
    namespace ReactNativePaper {
        interface ThemeColors {
            outlineVariant: string;
            onPrimary: string;
        }
    }
}
