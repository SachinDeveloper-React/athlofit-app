// src/components/common/ForceUpdateModal.tsx
// ─── Full-screen modal shown when the backend flags an app version update ─────
// Two modes:
//   - 'force': Mandatory update — user CANNOT dismiss, must go to store.
//   - 'soft':  Optional update — user can dismiss with "Later" button.

import React from 'react';
import { View, Modal, StatusBar, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { makeStyles } from '../../hooks/makeStyles';
import AppText from '../AppText';
import Button from '../Button';
import { Icon } from '../Icon';

// ─── Styles ───────────────────────────────────────────────────────────────────

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  container: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: spacing[8],
    backgroundColor: colors.background,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: spacing[6],
  },
  title: {
    marginBottom: spacing[3],
    textAlign: 'center' as const,
  },
  message: {
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: spacing[8],
    maxWidth: 300,
  },
  versionBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
    marginBottom: spacing[6],
    gap: spacing[2],
  },
  buttonColumn: {
    width: '100%' as const,
    alignItems: 'center' as const,
    gap: spacing[3],
  },
}));

// ─── Props ────────────────────────────────────────────────────────────────────

interface ForceUpdateModalProps {
  visible: boolean;
  updateType: 'force' | 'soft';
  title: string;
  message: string;
  latestVersion?: string;
  updateUrl?: string;
  onDismiss?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ForceUpdateModal: React.FC<ForceUpdateModalProps> = ({
  visible,
  updateType,
  title,
  message,
  latestVersion,
  updateUrl,
  onDismiss,
}) => {
  const { colors, spacing } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const isForce = updateType === 'force';

  const handleUpdate = () => {
    if (updateUrl) {
      Linking.openURL(updateUrl).catch(() => {});
    } else {
      // Fallback: open the app's store page based on platform
      const storeUrl =
        Platform.OS === 'ios'
          ? 'https://apps.apple.com/app/athlofit'
          : 'https://play.google.com/store/apps/details?id=com.athlofit';
      Linking.openURL(storeUrl).catch(() => {});
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + spacing[4],
            paddingBottom: insets.bottom + spacing[6],
          },
        ]}
      >
        <StatusBar
          barStyle={colors.background === '#FFFFFF' ? 'dark-content' : 'light-content'}
          backgroundColor={colors.background}
        />

        {/* Icon */}
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: isForce ? `${colors.destructive}18` : `${colors.primary}18` },
          ]}
        >
          <Icon
            name={isForce ? 'Shield' : 'Zap'}
            size={44}
            color={isForce ? colors.destructive : colors.primary}
          />
        </View>

        {/* Title */}
        <AppText variant="title2" weight="bold" style={styles.title}>
          {title}
        </AppText>

        {/* Message */}
        <AppText variant="body" secondary style={styles.message}>
          {message}
        </AppText>

        {/* Version badge */}
        {latestVersion && (
          <View
            style={[
              styles.versionBadge,
              { backgroundColor: `${colors.primary}12` },
            ]}
          >
            <AppText variant="caption1" weight="semiBold" color={colors.primary}>
              v{latestVersion} available
            </AppText>
          </View>
        )}

        {/* Buttons */}
        <View style={styles.buttonColumn}>
          <Button
            label="Update Now"
            onPress={handleUpdate}
            size="lg"
            fullWidth
          />

          {/* Only show dismiss button for soft updates */}
          {!isForce && onDismiss && (
            <Button
              label="Later"
              variant="ghost"
              onPress={onDismiss}
              size="md"
              style={{ maxWidth: 280 }}
            />
          )}
        </View>

        {/* Force update notice */}
        {isForce && (
          <AppText
            variant="caption1"
            secondary
            style={{ textAlign: 'center', marginTop: spacing[4], maxWidth: 260 }}
          >
            This update is mandatory. Please update to continue using Athlofit.
          </AppText>
        )}
      </View>
    </Modal>
  );
};

export default ForceUpdateModal;
