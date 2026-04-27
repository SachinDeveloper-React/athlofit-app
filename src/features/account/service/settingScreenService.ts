import { FileText, LifeBuoy, LogOut, Mail, User, Shield, Ruler, Trash2 } from 'lucide-react-native';
import { Section } from '../types/setting.types';
import { DeletionStatus } from './accountDeletion.service';

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
      isMetric: boolean;
      onUnitToggle: (v: boolean) => void;
      onDeleteAccount?: () => void;
      onCancelDeletion?: () => void;
      deletionStatus?: DeletionStatus;
      scheduledDeletionDate?: string | null;
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
        title: 'PREFERENCES',
        rows: [
          {
            key: 'unit_system',
            type: 'toggle',
            title: 'USE METRIC UNITS (KG/CM)',
            icon: Ruler,
            value: callbacks.isMetric,
            onValueChange: callbacks.onUnitToggle,
          },
        ],
      },
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
