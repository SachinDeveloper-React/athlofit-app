import React, { useEffect, useState } from 'react';
import { View, Modal } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSystemStore } from '../../store/systemStore';
import { useTheme } from '../../hooks/useTheme';
import { makeStyles } from '../../hooks/makeStyles';
import AppText from '../AppText';
import Button from '../Button';
import { Icon } from '../Icon';
import { BASE_URL } from '../../utils/api';

const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight }) => ({
  maintenanceContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: spacing[8],
  },
  maintenanceTitle: { marginTop: spacing[6], marginBottom: spacing[2], textAlign: 'center' as const },
  maintenanceBody:  { textAlign: 'center' as const, lineHeight: 24 },
  offlineBanner: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingTop: spacing[3],
    paddingBottom: spacing[8],
    gap: spacing[3],
    zIndex: 99999,
  },
  offlineText: {
    color: '#fff',
    fontWeight: fontWeight.semiBold,
    fontSize: fontSize.md,
  },
}));

const SystemOverlay = () => {
  const { colors, spacing } = useTheme();
  const styles = useStyles();
  const { isMaintenance, setMaintenance } = useSystemStore();
  const netInfo = useNetInfo();
  const [polling, setPolling] = useState(false);

  const isOffline = netInfo.isConnected === false;

  useEffect(() => {
    let interval: any;
    if (isMaintenance) {
      interval = setInterval(async () => {
        try {
          setPolling(true);
          const res  = await fetch(BASE_URL);
          const data = await res.json();
          if (data?.success && !data.isMaintenance) setMaintenance(false);
        } catch { /* keep polling */ } finally { setPolling(false); }
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [isMaintenance, setMaintenance]);

  return (
    <>
      <Modal visible={isMaintenance} animationType="fade" transparent={false}>
        <View style={[styles.maintenanceContainer, { backgroundColor: colors.background }]}>
          <Icon name="Wrench" size={64} color={colors.primary} />
          <AppText variant="title1" style={styles.maintenanceTitle}>We'll be back soon!</AppText>
          <AppText variant="body" secondary style={styles.maintenanceBody}>
            The system is currently undergoing scheduled maintenance. Please check back in a little while.
          </AppText>
          <Button label={polling ? 'Checking status...' : 'Try again manually'}
            variant="outline" onPress={() => {}} disabled={polling}
            style={{ marginTop: spacing[6], paddingVertical: spacing[3] }} />
        </View>
      </Modal>

      {isOffline && (
        <Animated.View
          entering={SlideInDown.duration(400)}
          exiting={SlideOutDown.duration(400)}
          style={[styles.offlineBanner, { backgroundColor: colors.destructive }]}
        >
          <Icon name="WifiOff" size={20} color="#fff" />
          <AppText style={styles.offlineText} variant="subhead">No Internet Connection</AppText>
        </Animated.View>
      )}
    </>
  );
};

export default SystemOverlay;
