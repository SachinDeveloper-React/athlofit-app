import { FileText, LifeBuoy, LogOut, Mail, User, Shield, Trash2, HeartPulse, Bell, Footprints, Camera, BatteryWarning, Download } from 'lucide-react-native';
import { Section } from '../types/setting.types';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  NotificationCategory,
  NotificationPreferences,
} from './notificationPrefs.service';
import { DeletionStatus } from './accountDeletion.service';
import type { PermissionStatuses } from './permissionStatus.service';

export const settingScreenService = {
  getSettingsSections: (
    profileName: string | undefined,
    profileEmail: string | undefined,
    callbacks: {
      onEditProfile: () => void;
      onEmail: () => void;
      onHelp: () => void;
      onTerms: () => void;
      onPrivacy: () => void;
      onSignOut: () => void;
      onDeleteAccount?: () => void;
      onCancelDeletion?: () => void;
      onConnectHealth?: () => void;
      onRequestPermission?: (key: string) => void;
      onBatteryOptimization?: () => void;
      onExportData?: () => void;
      isExportingData?: boolean;
      notificationPrefs?: NotificationPreferences | null;
      onToggleNotificationCategory?: (c: NotificationCategory, v: boolean) => void;
      onToggleNotificationMaster?: (v: boolean) => void;
      deletionStatus?: DeletionStatus;
      scheduledDeletionDate?: string | null;
      healthConnectionStatus?: 'connected' | 'skipped' | 'not_set';
      permissionStatuses?: PermissionStatuses | null;
      batteryOptExempt?: boolean | null;
    },
  ): Section[] => {
    const sections: Section[] = [
      {
        title: 'PERSONAL INFO',
        rows: [
          {
            key: 'edit',
            type: 'nav',
            title: 'EDIT PROFILE',
            icon: User,
            valueText: profileName,
            onPress: callbacks.onEditProfile,
          },
          {
            key: 'email',
            type: 'nav',
            title: 'EMAIL ADDRESS',
            icon: Mail,
            valueText: profileEmail,
            onPress: callbacks.onEmail,
          },
        ],
      },
      {
        title: 'HEALTH DATA',
        rows: [
          {
            key: 'connect_health',
            type: 'nav',
            title: callbacks.healthConnectionStatus === 'connected'
              ? 'HEALTH CONNECTED'
              : 'CONNECT HEALTH',
            icon: HeartPulse,
            iconColorKey: callbacks.healthConnectionStatus === 'connected' ? 'primary' : 'foreground',
            valueText: callbacks.healthConnectionStatus === 'connected'
              ? 'Connected'
              : 'Steps only',
            onPress: callbacks.onConnectHealth,
            ...(callbacks.healthConnectionStatus === 'connected' && {
              badge: { text: 'Active', variant: 'success' as const },
            }),
          },
          // Battery optimization row (Android only, show when status is known)
          ...(callbacks.batteryOptExempt !== null && callbacks.batteryOptExempt !== undefined ? [{
            key: 'battery_opt',
            type: 'nav' as const,
            title: 'BACKGROUND ACTIVITY',
            icon: BatteryWarning,
            iconColorKey: (callbacks.batteryOptExempt ? 'primary' : 'destructive') as 'primary' | 'destructive',
            valueText: callbacks.batteryOptExempt ? 'Unrestricted' : 'Restricted',
            badge: callbacks.batteryOptExempt
              ? { text: 'OK', variant: 'success' as const }
              : { text: 'Fix', variant: 'destructive' as const },
            onPress: callbacks.onBatteryOptimization,
          }] : []),
        ],
      },
      ...(callbacks.permissionStatuses ? [{
        title: 'PERMISSIONS',
        rows: [
          {
            key: 'perm_notification',
            type: 'nav' as const,
            title: 'NOTIFICATIONS',
            icon: Bell,
            valueText: callbacks.permissionStatuses.notification === 'granted' ? 'Allowed' : 'Not Allowed',
            badge: callbacks.permissionStatuses.notification === 'granted'
              ? { text: 'Granted', variant: 'success' as const }
              : { text: 'Denied', variant: 'destructive' as const },
            onPress: () => callbacks.onRequestPermission?.('notification'),
          },
          {
            key: 'perm_activity',
            type: 'nav' as const,
            title: 'STEP TRACKING',
            icon: Footprints,
            valueText: callbacks.permissionStatuses.activityRecognition === 'granted' ? 'Allowed' : 'Not Allowed',
            badge: callbacks.permissionStatuses.activityRecognition === 'granted'
              ? { text: 'Granted', variant: 'success' as const }
              : { text: 'Denied', variant: 'destructive' as const },
            onPress: () => callbacks.onRequestPermission?.('activityRecognition'),
          },
          {
            key: 'perm_camera',
            type: 'nav' as const,
            title: 'CAMERA',
            icon: Camera,
            valueText: callbacks.permissionStatuses.camera === 'granted' ? 'Allowed'
              : callbacks.permissionStatuses.camera === 'denied' ? 'Not Allowed' : 'Not Requested',
            badge: callbacks.permissionStatuses.camera === 'granted'
              ? { text: 'Granted', variant: 'success' as const }
              : callbacks.permissionStatuses.camera === 'denied'
                ? { text: 'Denied', variant: 'destructive' as const }
                : undefined,
            onPress: () => callbacks.onRequestPermission?.('camera'),
          },
        ],
      }] : []),
      // ── Notifications ────────────────────────────────────────────────────
      // Rendered only once preferences have loaded: showing every switch as
      // "on" before the real values arrive would flash the wrong state and,
      // worse, a tap during that window would write a default the user never
      // chose over their actual setting.
      ...(callbacks.notificationPrefs
        ? [{
            title: 'NOTIFICATIONS',
            rows: [
              {
                key: 'notif_master',
                type: 'toggle' as const,
                title: 'ALL NOTIFICATIONS',
                icon: Bell,
                value: callbacks.notificationPrefs.masterEnabled,
                onValueChange: (v: boolean) =>
                  callbacks.onToggleNotificationMaster?.(v),
              },
              // Per-category switches are hidden while the master is off. They
              // would have no effect there, and a row that looks live but does
              // nothing is worse than one that is absent.
              ...(callbacks.notificationPrefs.masterEnabled
                ? CATEGORY_ORDER.map((c) => ({
                    key: `notif_${c}`,
                    type: 'toggle' as const,
                    title: CATEGORY_LABELS[c],
                    icon: Bell,
                    value: callbacks.notificationPrefs!.categories[c] !== false,
                    onValueChange: (v: boolean) =>
                      callbacks.onToggleNotificationCategory?.(c, v),
                  }))
                : []),
            ],
          }]
        : []),
      {
        title: 'ADDITIONAL OPTION',
        rows: [
          {
            key: 'help',
            type: 'nav',
            title: 'HELP & SUPPORT',
            icon: LifeBuoy,
            onPress: callbacks.onHelp,
          },
          {
            key: 'terms',
            type: 'nav',
            title: 'TERMS & CONDITIONS',
            icon: FileText,
            onPress: callbacks.onTerms,
          },
          {
            key: 'privacy',
            type: 'nav',
            title: 'PRIVACY POLICY',
            icon: Shield,
            onPress: callbacks.onPrivacy,
          },
          // Sits with the legal rows rather than in DANGER ZONE: exporting your
          // own data is a privacy right, not a destructive action, and putting
          // it next to DELETE ACCOUNT would make it look like one.
          ...(callbacks.onExportData
            ? [{
                key: 'export_data',
                type: 'nav' as const,
                title: 'DOWNLOAD MY DATA',
                icon: Download,
                onPress: callbacks.onExportData,
                badge: callbacks.isExportingData
                  ? { text: 'Sending', variant: 'warning' as const }
                  : undefined,
              }]
            : []),
          {
            key: 'signout',
            type: 'nav',
            title: 'SIGN OUT',
            icon: LogOut,
            iconColorKey: 'destructive',
            onPress: callbacks.onSignOut,
          },
        ],
      },
    ];

    // Add account deletion section if callbacks are provided
    if (callbacks.onDeleteAccount || callbacks.onCancelDeletion) {
      const deletionRows: Section['rows'] = [];

      // Show appropriate action based on deletion status
      if (callbacks.deletionStatus === 'pending' || callbacks.deletionStatus === 'in_progress') {
        // Show cancel deletion option with status badge
        const daysRemaining = callbacks.scheduledDeletionDate
          ? Math.ceil((new Date(callbacks.scheduledDeletionDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : 0;

        deletionRows.push({
          key: 'cancel_deletion',
          type: 'nav',
          title: 'CANCEL ACCOUNT DELETION',
          icon: Shield,
          iconColorKey: 'primary',
          onPress: callbacks.onCancelDeletion,
          badge: {
            text: callbacks.deletionStatus === 'pending' 
              ? `${daysRemaining}d left` 
              : 'IN PROGRESS',
            variant: 'warning',
          },
        });
      } else {
        // Show delete account option
        deletionRows.push({
          key: 'delete_account',
          type: 'nav',
          title: 'DELETE ACCOUNT',
          icon: Trash2,
          iconColorKey: 'destructive',
          onPress: callbacks.onDeleteAccount,
        });
      }

      sections.push({
        title: 'DANGER ZONE',
        rows: deletionRows,
      });
    }

    return sections;
  },
};
