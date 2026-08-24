// src/features/account/hooks/useDataExport.ts

import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { dataExportService } from '../service/dataExport.service';

/**
 * Drives the "download my data" flow from Settings.
 *
 * Confirms first, because building the export reads every collection the user
 * appears in and the server allows only three per day — a mis-tap should not
 * burn one of them.
 */
export function useDataExport() {
  const [isExporting, setIsExporting] = useState(false);

  const requestExport = useCallback(() => {
    Alert.alert(
      'Download Your Data',
      "We'll email you a file containing everything we hold about your account — " +
        'profile, activity history, coins, orders and support messages.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Email',
          onPress: async () => {
            setIsExporting(true);
            try {
              const data = await dataExportService.emailExport();
              Alert.alert(
                'Export Sent',
                `Your data export has been emailed to ${data?.sentTo ?? 'your registered address'}. ` +
                  'It may take a few minutes to arrive.',
              );
            } catch (e: any) {
              // The server's message is specific and actionable — unverified
              // email, or the daily limit — so it is shown rather than replaced
              // with a generic failure the user cannot act on.
              Alert.alert(
                'Export Failed',
                e?.message || 'Could not generate your data export. Please try again later.',
              );
            } finally {
              setIsExporting(false);
            }
          },
        },
      ],
    );
  }, []);

  return { requestExport, isExporting };
}
