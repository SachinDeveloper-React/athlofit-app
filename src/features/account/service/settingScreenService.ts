import { FileText, LifeBuoy, LogOut, Mail, User, Shield, Trash2, HeartPulse, Bell, Footprints, Camera, BatteryWarning } from 'lucide-react-native';
import { Section } from '../types/setting.types';
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
