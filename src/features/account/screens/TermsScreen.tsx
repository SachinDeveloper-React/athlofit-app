import React from 'react';
import { StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import RenderHtml from 'react-native-render-html';
import { AppText, AppView, Header, Screen } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { useLegalContent } from '../hooks/useLegalContent';

const TermsScreen: React.FC = () => {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { data, isLoading, error } = useLegalContent('terms');

  const htmlContent = data?.data?.content || '';

  return (
    <Screen
      scroll
      safeArea={false}
      header={<Header title="Terms & Conditions" showBack backLabel="" />}
    >
      <AppView style={styles.container}>
        {isLoading ? (
          <AppView center style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <AppText style={styles.loadingText}>Fetching terms...</AppText>
          </AppView>
        ) : error ? (
          <AppView center style={styles.center}>
            <AppText variant="subhead" style={{ color: colors.destructive }}>
              Failed to load terms & conditions.
            </AppText>
          </AppView>
        ) : htmlContent ? (
          <AppView style={styles.htmlContainer}>
            <RenderHtml
              contentWidth={width - 32}
              source={{ html: htmlContent }}
              baseStyle={{ color: colors.foreground, fontSize: 15, lineHeight: 24 }}
              tagsStyles={{
                h1: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, color: colors.foreground },
                h2: { fontSize: 18, fontWeight: '600', marginBottom: 8, color: colors.foreground },
                h3: { fontSize: 16, fontWeight: '600', marginBottom: 6, color: colors.foreground },
                p: { marginBottom: 10, color: colors.foreground },
                li: { marginBottom: 4, color: colors.foreground },
                a: { color: colors.primary },
              }}
            />
          </AppView>
        ) : (
          <AppView center style={styles.center}>
            <AppText style={{ color: colors.foreground }}>
              No content available.
            </AppText>
          </AppView>
        )}
      </AppView>
    </Screen>
  );
};

export default TermsScreen;

const styles = StyleSheet.create({
  container: {},
  center: {
    marginTop: 100,
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.6,
  },
  htmlContainer: {
    paddingHorizontal: 16,
  },
});
