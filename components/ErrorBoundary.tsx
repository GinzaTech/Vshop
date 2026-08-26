/**
 * ErrorBoundary — Bắt lỗi render trong React component tree.
 * Hiển thị fallback UI thay vì crash toàn app.
 * Cho phép user "Thử lại" (reset state) hoặc "Về Trang chủ".
 */
import React from "react";
import * as Sentry from "@sentry/react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { COLORS, RADIUS } from "~/constants/DesignSystem";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

class ErrorBoundaryImpl extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack ?? "unavailable",
        },
      },
    });
    if (__DEV__) {
      console.error("[ErrorBoundary]", error, errorInfo.componentStack);
    }
  }

  handleReset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}

/** ErrorFallback — UI hiển thị khi có lỗi render */
function ErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.title}>
          {t("error_boundary.title", { defaultValue: "Đã xảy ra lỗi" })}
        </Text>
        <Text style={styles.message}>
          {t("error_boundary.message", {
            defaultValue: "Ứng dụng gặp sự cố không mong muốn. Vui lòng thử lại.",
          })}
        </Text>
        {__DEV__ ? (
          <Text style={styles.devError} selectable>
            {error.message}
            {"\n\n"}
            {error.stack}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onReset}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.primaryText}>
              {t("error_boundary.retry", { defaultValue: "Thử lại" })}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onReset();
              router.replace("/profile");
            }}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.secondaryText}>
              {t("error_boundary.home", { defaultValue: "Về Trang chủ" })}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  icon: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
  },
  message: {
    marginTop: 8,
    fontSize: 15,
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 22,
  },
  devError: {
    marginTop: 20,
    fontSize: 11,
    fontFamily: "monospace",
    color: COLORS.TEXT_SECONDARY,
    backgroundColor: COLORS.SURFACE,
    padding: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 32,
  },
  primaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: RADIUS.button,
    backgroundColor: COLORS.VALORANT_RED,
  },
  secondaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: RADIUS.button,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  primaryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "600",
  },
});

export const ErrorBoundary = ErrorBoundaryImpl;
