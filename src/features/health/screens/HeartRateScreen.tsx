import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, StatusBar, View, Animated as RNAnimated } from 'react-native';
import { Camera } from 'react-native-vision-camera';
import { useHeartRate } from '../hooks/useHeartRate';
import { Button, Header, Screen, AppText, AppView } from '../../../components';
import { InstructionCard } from '../components/heart-rate/InstructionCard';
import { ManualEntryModal } from '../components/heart-rate/ManualEntryModal';
import { ProgressRing } from '../components/heart-rate/ProgressRing';
import { PulseIndicator } from '../components/heart-rate/PulseIndicator';
import { HeartRateResultCard } from '../components/heart-rate/HeartRateResultCard';
import { SavedBanner } from '../components/heart-rate/SavedBanner';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Torch warmup duration in ms — gives the LED time to reach full brightness
const TORCH_WARMUP_MS = 1500;

export default function HeartRateScreen() {
  const { bottom } = useSafeAreaInsets();
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
  } = useHeartRate();

  const [showManual, setShowManual] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  // Warmup progress 0→1 for the UI bar
  const warmupAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (measureState !== 'measuring') {
      setTorchOn(false);
      warmupAnim.setValue(0);
    }
  }, [measureState]);

  const handleCameraInit = () => {
    setTorchOn(true);
    // Animate warmup bar over TORCH_WARMUP_MS
    warmupAnim.setValue(0);
    RNAnimated.timing(warmupAnim, {
      toValue: 1,
      duration: TORCH_WARMUP_MS,
      useNativeDriver: false,
    }).start(({ finished }) => {
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
      <AppView style={[styles.fullScreen, { marginBottom: bottom }]}>
        <StatusBar hidden />

        {device && format ? (
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            format={format}
            isActive={true}
            torch={torchOn ? 'on' : 'off'}
            fps={30}
            photo={false}
            video={true}
            audio={false}
            pixelFormat="yuv"
            frameProcessor={frameProcessor}
            onInitialized={handleCameraInit}
          />
        ) : (
          <AppView style={[StyleSheet.absoluteFill, styles.blackBg]} />
        )}

        <AppView style={styles.overlay}>
          <AppView style={styles.topBanner}>
            {!torchReady ? (
              <>
                <AppText style={styles.topTitle}>Warming up torch…</AppText>
                <AppText style={styles.topSub}>
                  Hold your finger over the lens and flash
                </AppText>
                {/* Warmup progress bar */}
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
                <AppText style={styles.topTitle}>Keep finger on camera</AppText>
                <AppText style={styles.topSub}>
                  Cover the lens and flash • Stay still
                </AppText>
              </>
            )}
          </AppView>

          <AppView style={styles.centerArea}>
            <ProgressRing progress={torchReady ? progress : 0} />
            {torchReady && <PulseIndicator active />}
          </AppView>

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
      </AppView>
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

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  fullScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  blackBg: {
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  topBanner: {
    alignItems: 'center',
  },
  topTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  topSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 6,
    textAlign: 'center',
  },
  warmupTrack: {
    marginTop: 14,
    width: 200,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  warmupFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F97316',  // warm orange — matches torch glow
  },
  centerArea: {
    alignItems: 'center',
  },
  bottomArea: {
    width: '100%',
  },
  errorCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#FAECE7',
    marginBottom: 20,
  },
  errorIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#D85A30',
    marginBottom: 8,
  },
  errorMsg: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
});
