import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Animated as RNAnimated } from 'react-native';
import { Camera } from 'react-native-vision-camera';
import { useHeartRate } from '../hooks/useHeartRate';
import { useHealth } from '../hooks/useHealth';
import { Button, Header, Screen, AppText, AppView } from '../../../components';
import { InstructionCard } from '../components/heart-rate/InstructionCard';
import { ManualEntryModal } from '../components/heart-rate/ManualEntryModal';
import { ProgressRing } from '../components/heart-rate/ProgressRing';
import { PulseIndicator } from '../components/heart-rate/PulseIndicator';
import { HeartRateResultCard } from '../components/heart-rate/HeartRateResultCard';
import { SavedBanner } from '../components/heart-rate/SavedBanner';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeStyles } from '../../../hooks/makeStyles';
import { MEASURE_DURATION_S } from '../service/heartRate.service';

// Torch warmup duration in ms — gives the LED time to reach full brightness
const TORCH_WARMUP_MS = 1500;

const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight }) => ({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[10],
    alignItems: 'center' as const,
  },
  title: {
    fontSize: 24,
    fontWeight: fontWeight.semiBold,
    color: colors.foreground,
    marginBottom: spacing[4],
    alignSelf: 'flex-start' as const,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  blackBg: {
    backgroundColor: '#000',
  },
  measuringContent: {
    flex: 1,
    alignItems: 'center' as const,
    paddingTop: spacing[6],
    paddingHorizontal: spacing[5],
    gap: spacing[6],
  },
  measuringTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semiBold,
    color: colors.foreground,
    textAlign: 'center' as const,
  },
  measuringSub: {
    fontSize: fontSize.md,
    color: colors.mutedForeground,
    marginTop: spacing[1.5],
    textAlign: 'center' as const,
  },
  cameraContainer: {
    width: 100,
    height: 100,
    borderRadius: radius.xl,
    overflow: 'hidden' as const,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  cameraPreview: {
    width: '100%' as const,
    height: '100%' as const,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingTop: 60,
    paddingBottom: spacing[10],
    paddingHorizontal: spacing[5],
  },
  topBanner: {
    alignItems: 'center' as const,
  },
  topTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.semiBold,
    color: '#fff',
    textAlign: 'center' as const,
  },
  topSub: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.72)',
    marginTop: spacing[1.5],
    textAlign: 'center' as const,
  },
  warmupTrack: {
    marginTop: 14,
    width: 200,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden' as const,
  },
  warmupFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F97316',
  },
  centerArea: {
    alignItems: 'center' as const,
  },
  timerArea: {
    alignItems: 'center' as const,
    gap: spacing[1.5],
  },
  timerText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  timerHint: {
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  bottomArea: {
    width: '100%' as const,
  },
  errorCard: {
    width: '100%' as const,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing[6],
    alignItems: 'center' as const,
    borderWidth: 0.5,
    borderColor: '#FAECE7',
    marginBottom: spacing[5],
  },
  errorIcon: {
    fontSize: 36,
    marginBottom: spacing[2.5],
  },
  errorTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semiBold,
    color: '#D85A30',
    marginBottom: spacing[2],
  },
  errorMsg: {
    fontSize: fontSize.md,
    color: colors.mutedForeground,
    textAlign: 'center' as const,
    lineHeight: 22,
  },
}));

export default function HeartRateScreen() {
  const { bottom } = useSafeAreaInsets();
  const styles = useStyles();
  const { platform } = useHealth();
  const {
    measureState,
    progress,
    result,
    error,
    isSaving,
    saved,
    torchReady,
    device,
    format,
    frameProcessor,
    startMeasurement,
    cancelMeasurement,
    onTorchReady,
    saveResult,
  } = useHeartRate(platform);

  const [showManual, setShowManual] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const warmupAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (measureState !== 'measuring') {
      setTorchOn(false);
      warmupAnim.setValue(0);
    }
  }, [measureState]);

  const handleCameraInit = () => {
    setTorchOn(true);
    warmupAnim.setValue(0);

    const fallbackTimer = setTimeout(() => {
      onTorchReady();
    }, TORCH_WARMUP_MS + 500);

    RNAnimated.timing(warmupAnim, {
      toValue: 1,
      duration: TORCH_WARMUP_MS,
      useNativeDriver: false,
    }).start(({ finished }) => {
      clearTimeout(fallbackTimer);
      if (finished) onTorchReady();
    });
  };

  const handleManualSave = async (bpm: number) => {
    await saveResult(bpm);
    setShowManual(false);
  };

  if (measureState === 'idle' || measureState === 'requesting_permission') {
    return (
      <Screen
        scroll
        safeArea={false}
        header={<Header title="Heart Rate" bordered showBack backLabel="" />}
      >
        <InstructionCard />
        <Button
          fullWidth
          variant="primary"
          label="Start Measuring"
          onPress={startMeasurement}
          loading={measureState === 'requesting_permission'}
        />
        <Button
          fullWidth
          variant="secondary"
          label="Enter Manually"
          onPress={() => setShowManual(true)}
          style={{ marginTop: 10 }}
        />
        <ManualEntryModal
          visible={showManual}
          onClose={() => setShowManual(false)}
          onSave={handleManualSave}
        />
      </Screen>
    );
  }

  if (measureState === 'measuring') {
    return (
      <Screen
        scroll
        safeArea={false}
        header={<Header title="Heart Rate" bordered showBack backLabel="" />}
      >
        {/* Status text */}
        <AppView style={styles.measuringContent}>
          <AppView style={styles.topBanner}>
            {!torchReady ? (
              <>
                <AppText style={styles.measuringTitle}>Warming up torch…</AppText>
                <AppText style={styles.measuringSub}>
                  Hold your finger over the lens and flash
                </AppText>
                <View style={styles.warmupTrack}>
                  <RNAnimated.View
                    style={[
                      styles.warmupFill,
                      { width: warmupAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                    ]}
                  />
                </View>
              </>
            ) : (
              <>
                <AppText style={styles.measuringTitle}>Keep finger on camera</AppText>
                <AppText style={styles.measuringSub}>
                  Cover the lens and flash • Stay still
                </AppText>
              </>
            )}
          </AppView>

          {/* Camera preview in a small rounded square */}
          <AppView style={styles.cameraContainer}>
            {device ? (
              <Camera
                style={styles.cameraPreview}
                device={device}
                {...(format ? { format } : {})}
                isActive={true}
                torch={torchOn ? 'on' : 'off'}
                fps={15}
                photo={false}
                video={false}
                audio={false}
                pixelFormat="yuv"
                exposure={-2}
                frameProcessor={frameProcessor}
                onInitialized={handleCameraInit}
              />
            ) : (
              <AppView style={[styles.cameraPreview, styles.blackBg]} />
            )}
          </AppView>

          {/* Progress ring + pulse */}
          <AppView style={styles.centerArea}>
            <ProgressRing progress={torchReady ? progress : 0} />
            {/* {torchReady && <PulseIndicator active />} */}
          </AppView>

          {/* Timer countdown */}
          {torchReady && (
            <AppView style={styles.timerArea}>
              {/* <AppText style={styles.timerText}>
                {Math.max(0, Math.ceil(MEASURE_DURATION_S * (1 - progress)))}s remaining
              </AppText> */}
              <AppText style={styles.timerHint}>
                {progress < 0.3 ? '📡 Collecting signal…' : progress < 0.7 ? '💓 Detecting heartbeat…' : '✅ Almost done!'}
              </AppText>
            </AppView>
          )}

          {/* Buttons */}
          <AppView style={styles.bottomArea}>
            <Button
              fullWidth
              variant="destructive"
              label="Cancel"
              onPress={cancelMeasurement}
            />
            <Button
              fullWidth
              variant="secondary"
              label="Enter Manually Instead"
              onPress={() => {
                cancelMeasurement();
                setShowManual(true);
              }}
              style={{ marginTop: 10 }}
            />
          </AppView>
        </AppView>

        <ManualEntryModal
          visible={showManual}
          onClose={() => setShowManual(false)}
          onSave={handleManualSave}
        />
      </Screen>
    );
  }

  if (measureState === 'error') {
    return (
      <Screen
        scroll
        safeArea={false}
        header={<Header title="Heart Rate" bordered showBack backLabel="" />}
      >
        <AppView style={styles.errorCard}>
          <AppText style={styles.errorIcon}>⚠️</AppText>
          <AppText variant="headline" style={styles.errorTitle}>Measurement failed</AppText>
          <AppText variant="footnote" secondary align="center" style={styles.errorMsg}>{error}</AppText>
        </AppView>

        <Button
          fullWidth
          variant="primary"
          label="Try Again"
          onPress={startMeasurement}
        />
        <Button
          fullWidth
          variant="secondary"
          label="Enter Manually"
          onPress={() => setShowManual(true)}
          style={{ marginTop: 10 }}
        />
        <ManualEntryModal
          visible={showManual}
          onClose={() => setShowManual(false)}
          onSave={handleManualSave}
        />
      </Screen>
    );
  }

  if (measureState === 'done' && result) {
    return (
      <Screen
        scroll
        safeArea={false}
        header={<Header title="Heart Rate" bordered showBack backLabel="" />}
      >
        <AppText variant="title3" style={styles.title}>Result</AppText>
        <HeartRateResultCard result={result} />
        {saved ? (
          <SavedBanner />
        ) : (
          <Button
            fullWidth
            variant="primary"
            label="Save"
            loading={isSaving}
            onPress={() => saveResult()}
          />
        )}

        <Button
          fullWidth
          variant="secondary"
          label="Measure Again"
          onPress={startMeasurement}
          style={{ marginVertical: 10 }}
        />
        <Button
          fullWidth
          variant="secondary"
          label="Enter Manually Instead"
          onPress={() => setShowManual(true)}
        />
        <ManualEntryModal
          visible={showManual}
          onClose={() => setShowManual(false)}
          onSave={handleManualSave}
        />
      </Screen>
    );
  }

  return null;
}
