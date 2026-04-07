import React from 'react';
import { StyleSheet, ActivityIndicator } from 'react-native';
import { AppText, AppView, Header, Screen } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { useLegalContent } from '../hooks/useLegalContent';

const PrivacyScreen: React.FC = () => {
  const { colors } = useTheme();
  const { data, isLoading, error } = useLegalContent('privacy');

  return (
    <Screen
      scroll
      safeArea={false}
      header={<Header title="Privacy Policy" showBack backLabel="" />}
    >
      <AppView style={styles.container}>
        {isLoading ? (
          <AppView center style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <AppText style={styles.loadingText}>Fetching policy...</AppText>
          </AppView>
        ) : error ? (
          <AppView center style={styles.center}>
            <AppText variant="subhead" style={{ color: colors.destructive }}>
              Failed to load privacy policy.
            </AppText>
          </AppView>
        ) : (
          <AppView
            style={[
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <AppText style={[styles.content, { color: colors.foreground }]}>
              {data?.data?.content || 'No content available.'}
            </AppText>
          </AppView>
        )}
      </AppView>
    </Screen>
  );
};

export default PrivacyScreen;

const styles = StyleSheet.create({
  container: {
    // paddingTop: 20,
  },
  center: {
    // marginTop: 100,
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.6,
  },
  card: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  content: {
    fontSize: 15,
    lineHeight: 24,
  },
});
