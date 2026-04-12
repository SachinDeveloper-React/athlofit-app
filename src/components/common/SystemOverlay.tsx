import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Dimensions } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSystemStore } from '../../store/systemStore';
import { useTheme } from '../../hooks/useTheme';
import AppText from '../AppText';
import Button from '../Button';
import { Icon } from '../Icon';
import { BASE_URL } from '../../utils/api';

const { width } = Dimensions.get('window');

const SystemOverlay = () => {
  const { colors } = useTheme();
  const { isMaintenance, setMaintenance } = useSystemStore();
  const netInfo = useNetInfo();
  const [polling, setPolling] = useState(false);

  // Network state -> derived from hook
  const isOffline = netInfo.isConnected === false;

  // Poll server when in maintenance mode
  useEffect(() => {
    let interval: any;
    if (isMaintenance) {
      interval = setInterval(async () => {
        try {
          setPolling(true);
          const res = await fetch(BASE_URL);
          const data = await res.json();
          if (data && data.success && !data.isMaintenance) {
            setMaintenance(false);
          }
        } catch (e) {
          // keep polling
        } finally {
          setPolling(false);
        }
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [isMaintenance, setMaintenance]);

  return (
    <>
      {/* Maintenance Mode Overlay */}
      <Modal visible={isMaintenance} animationType="fade" transparent={false}>
        <View
          style={[
            styles.maintenanceContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <Icon name="Wrench" size={64} color={colors.primary} />
          <AppText variant="title1" style={styles.maintenanceTitle}>
            We'll be back soon!
          </AppText>
          <AppText variant="body" secondary style={styles.maintenanceBody}>
            The system is currently undergoing scheduled maintenance. Please
            check back in a little while.
          </AppText>
          <Button
            label={polling ? 'Checking status...' : 'Try again manually'}
            variant="outline"
            onPress={() => {
              // Manual retry will be handled by the next poll block, or we can force a poll
            }}
            disabled={polling}
            style={{ marginTop: 24, paddingVertical: 12 }}
          />
        </View>
      </Modal>

      {/* Offline Slide-up Banner */}
      {isOffline && (
        <Animated.View
          entering={SlideInDown.duration(400)}
          exiting={SlideOutDown.duration(400)}
          style={[
            styles.offlineBanner,
            { backgroundColor: colors.destructive },
          ]}
        >
          <Icon name="WifiOff" size={20} color="#fff" />
          <AppText style={styles.offlineText} variant="subhead">
            No Internet Connection
          </AppText>
        </Animated.View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  maintenanceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  maintenanceTitle: {
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  maintenanceBody: {
    textAlign: 'center',
    lineHeight: 24,
  },
  offlineBanner: {
    position: 'absolute',
    bottom: 0,
    width,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    paddingBottom: 32, // Padding for devices without home bar
    gap: 12,
    zIndex: 99999,
  },
  offlineText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default SystemOverlay;
