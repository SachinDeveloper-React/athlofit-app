import { useCallback, useMemo, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { useAuthStore } from '../../auth/store/authStore';
import { navigate } from '../../../navigation/navigationRef';
import { AccountRoutes, RootRoutes } from '../../../navigation/routes';
import { settingScreenService } from '../service/settingScreenService';
import { useAccountDeletion } from './useAccountDeletion';
import {
  getHealthPreference,
} from '../../health/service/healthPreference.service';
import {
  getAllPermissionStatuses,
  requestPermissionByKey,
  type PermissionStatuses,
} from '../service/permissionStatus.service';

export const useSettingScreen = () => {
  const profile = useAuthStore(s => s.user);
  const logout = useAuthStore(state => state.logout);

  const {
    deletionStatus,
    requestDeletion,
    cancelDeletion,
    isRequestingDeletion,
    isCancellingDeletion,
  } = useAccountDeletion();

  const onEditProfile = useCallback(() => {
    navigate(RootRoutes.ACCOUNT_NAVIGATOR, {
      screen: AccountRoutes.EDIT_PROFILE,
    });
  }, []);

  const onEmail = useCallback(() => {
    navigate(RootRoutes.ACCOUNT_NAVIGATOR, {
      screen: AccountRoutes.EDIT_PROFILE,
    });
  }, []);

  const onHelp = useCallback(() => {
    navigate(RootRoutes.ACCOUNT_NAVIGATOR, {
      screen: AccountRoutes.HELP_SUPPORT,
    });
  }, []);

  const onTerms = useCallback(() => {
    navigate(RootRoutes.ACCOUNT_NAVIGATOR, {
      screen: AccountRoutes.TERMS,
    });
  }, []);

  const onPrivacy = useCallback(() => {
    navigate(RootRoutes.ACCOUNT_NAVIGATOR, {
      screen: AccountRoutes.PRIVACY,
    });
  }, []);

  const onSignOut = useCallback(() => {
    logout();
  }, [logout]);

  const onConnectHealth = useCallback(async () => {
    const pref = getHealthPreference();
    if (pref === 'connected') {
      // Already connected — open platform-specific health settings
      const { Linking } = require('react-native');
      if (Platform.OS === 'ios') {
        Linking.openURL('app-settings:');
      } else {
        Linking.openURL('package:com.google.android.apps.healthdata').catch(() =>
          Linking.openSettings(),
        );
      }
      return;
    }

    // Try connecting Health Connect / HealthKit directly from here
    if (Platform.OS === 'ios') {
      const { initializeHealthKit } = await import('../../health/service/healthkit.service');
      const granted = await initializeHealthKit();
      if (granted) {
        const { setHealthPreference } = await import('../../health/service/healthPreference.service');
        setHealthPreference('connected');
        // Reset stores so next Tracker load uses HealthKit
        const { useHealthInitStore } = await import('../../health/store/healthInitStore');
        useHealthInitStore.getState().reset();
      } else {
        const { Linking, Alert } = require('react-native');
        Alert.alert(
          'Permission Required',
          'Please open Settings and grant Health access to Athlofit.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
          ],
        );
      }
    } else {
      // Android: try Health Connect
      try {
        const { isHealthConnectAvailable, initializeHealthConnect } = require('../../health/service/healthConnect.service');
        const available = await isHealthConnectAvailable();
        if (!available) {
          const { Linking, Alert } = require('react-native');
          Alert.alert(
            'Health Connect Not Available',
            'Please install Health Connect from the Play Store.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Install',
                onPress: () => Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata'),
              },
            ],
          );
          return;
        }
        const granted = await initializeHealthConnect();
        if (granted) {
          const { setHealthPreference } = await import('../../health/service/healthPreference.service');
          setHealthPreference('connected');
          const { useHealthInitStore } = await import('../../health/store/healthInitStore');
          useHealthInitStore.getState().reset();
        } else {
          const { Linking, Alert } = require('react-native');
          Alert.alert(
            'Permission Required',
            'Please open Health Connect settings and grant all permissions to Athlofit.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => Linking.openURL('package:com.google.android.apps.healthdata').catch(() =>
                  Linking.openSettings(),
                ),
              },
            ],
          );
        }
      } catch (e) {
        const { Alert } = require('react-native');
        Alert.alert('Error', 'Could not connect to Health Connect. Please try again.');
      }
    }
  }, []);

  // ── Permission statuses ──────────────────────────────────────────────────
  const [permissionStatuses, setPermissionStatuses] = useState<PermissionStatuses | null>(null);
  const [healthConnectionStatus, setHealthConnectionStatus] = useState<'connected' | 'skipped' | 'not_set'>('not_set');

  useEffect(() => {
    getAllPermissionStatuses().then(setPermissionStatuses);

    // Determine actual health connection status by checking both preference AND real permissions
    (async () => {
      const pref = getHealthPreference();
      if (pref === 'skipped') {
        setHealthConnectionStatus('skipped');
        return;
      }
      if (pref === 'connected') {
        // Verify actual permission is still granted
        if (Platform.OS === 'android') {
          try {
            const { hasHealthConnectPermissions } = require('../../health/service/healthConnect.service');
            const granted = await hasHealthConnectPermissions();
            setHealthConnectionStatus(granted ? 'connected' : 'not_set');
          } catch {
            setHealthConnectionStatus('not_set');
          }
        } else {
          setHealthConnectionStatus('connected');
        }
        return;
      }
      setHealthConnectionStatus('not_set');
    })();
  }, []);

  const onRequestPermission = useCallback(async (key: string) => {
    const granted = await requestPermissionByKey(key as keyof PermissionStatuses);
    // Refresh statuses after request
    const updated = await getAllPermissionStatuses();
    setPermissionStatuses(updated);
  }, []);

  const onDeleteAccount = useCallback(() => {
    requestDeletion();
  }, [requestDeletion]);

  const onCancelDeletion = useCallback(() => {
    cancelDeletion();
  }, [cancelDeletion]);

  const sections = useMemo(
    () =>
      settingScreenService.getSettingsSections(profile?.name, profile?.email, {
        onEditProfile,
        onEmail,
        onHelp,
        onTerms,
        onPrivacy,
        onSignOut,
        onDeleteAccount,
        onCancelDeletion,
        onConnectHealth,
        onRequestPermission,
        deletionStatus: deletionStatus?.status,
        scheduledDeletionDate: deletionStatus?.scheduledDeletionDate,
        healthConnectionStatus,
        permissionStatuses,
      }),
    [
      profile?.name,
      profile?.email,
      onEditProfile,
      onEmail,
      onHelp,
      onTerms,
      onPrivacy,
      onSignOut,
      onDeleteAccount,
      onCancelDeletion,
      onConnectHealth,
      onRequestPermission,
      deletionStatus?.status,
      deletionStatus?.scheduledDeletionDate,
      healthConnectionStatus,
      permissionStatuses,
    ],
  );

  return {
    sections,
    isRequestingDeletion,
    isCancellingDeletion,
  };
};
