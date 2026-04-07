import React from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { AppView, AppText } from '../../../../components';

import { Animated as RNAnimated } from 'react-native';
import Svg, {
  Circle,
  Path,
  Rect,
  Ellipse,
  Line,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';

import { StatItem } from '../../types';
import { C, POSES, SHADOW_SCALES } from '../../constant';
import { StatCard } from './OnbaordingSubComponents';
import { useLoopAnim, useRunnerFrame } from '../../hooks';

const { width } = Dimensions.get('window');

const STATS: StatItem[] = [
  { label: 'PACE', value: '5\'42"', color: C.teal },
  { label: 'DIST', value: '3.4 km', color: C.gold },
  { label: 'CALS', value: '312', color: C.accent },
];

// Stroke attribute helper
const limb = (color: string, w = 7) =>
  ({
    stroke: color,
    strokeWidth: w,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  } as const);

export const RunnerScene: React.FC = () => {
  const frame = useRunnerFrame();
  const pose = POSES[frame];
  const { legF, legB, armF, armB, hipL, hipR, shoulderL, shoulderR } = pose;

  // Horizontal sweep — native driver ✓
  const runX = useLoopAnim({
    initialValue: -80,
    steps: [
      { toValue: width + 80, duration: 2400 },
      { toValue: -80, duration: 0 },
    ],
  });

  const shadowScale = SHADOW_SCALES[frame];

  return (
    <AppView style={styles.root}>
      {/* Track */}
      <AppView style={styles.trackWrap}>
        <Svg width={width} height={32}>
          <Defs>
            <LinearGradient id="trackGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={C.teal} stopOpacity="0" />
              <Stop offset="0.3" stopColor={C.teal} stopOpacity="0.5" />
              <Stop offset="0.7" stopColor={C.teal} stopOpacity="0.5" />
              <Stop offset="1" stopColor={C.teal} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect
            x={0}
            y={14}
            width={width}
            height={2.5}
            rx={1.2}
            fill="url(#trackGrad)"
          />
          <Rect
            x={0}
            y={22}
            width={width}
            height={1}
            rx={0.5}
            fill={C.teal}
            opacity={0.15}
          />
        </Svg>
      </AppView>

      {/* Shadow */}
      <RNAnimated.View
        style={[styles.shadowWrap, { transform: [{ translateX: runX }] }]}
      >
        <Svg width={90} height={14}>
          <Ellipse
            cx={45}
            cy={7}
            rx={Math.round(28 * shadowScale * 100) / 100}
            ry={5}
            fill="rgba(0,0,0,0.5)"
          />
        </Svg>
      </RNAnimated.View>

      {/* Speed trails */}
      <RNAnimated.View
        style={[styles.trailWrap, { transform: [{ translateX: runX }] }]}
        pointerEvents="none"
      >
        <Svg width={100} height={60}>
          {[0, 1, 2, 3, 4].map(i => (
            <Rect
              key={i}
              x={0}
              y={10 + i * 10}
              width={80 - i * 14}
              height={2.5}
              rx={1.2}
              fill={C.accent}
              opacity={0.55 - i * 0.09}
            />
          ))}
        </Svg>
      </RNAnimated.View>

      {/* Runner */}
      <RNAnimated.View
        style={[styles.runnerWrap, { transform: [{ translateX: runX }] }]}
      >
        <Svg width={100} height={160} viewBox="0 0 100 160">
          {/* Back leg */}
          <Path
            d={`M${hipR.x},${hipR.y} L${legB.kneeX},${legB.kneeY}`}
            {...limb('#C87941', 9)}
          />
          <Path
            d={`M${legB.kneeX},${legB.kneeY} L${legB.ankleX},${legB.ankleY}`}
            {...limb('#C87941', 7.5)}
          />
          <Ellipse cx={legB.toeX} cy={legB.toeY} rx={8} ry={5} fill="#1a1a2e" />
          <Ellipse
            cx={legB.toeX - 1}
            cy={legB.toeY - 1}
            rx={6}
            ry={3.5}
            fill="#333366"
          />

          {/* Back arm */}
          <Path
            d={`M${shoulderL.x},${shoulderL.y} L${armB.elbowX},${armB.elbowY}`}
            {...limb('#C0733A', 8)}
          />
          <Path
            d={`M${armB.elbowX},${armB.elbowY} L${armB.wristX},${armB.wristY}`}
            {...limb('#C0733A', 6)}
          />
          <Circle cx={armB.wristX} cy={armB.wristY} r={5} fill="#C0733A" />

          {/* Torso */}
          <Ellipse cx={50} cy={76} rx={16} ry={9} fill="#1A237E" />
          <Rect x={33} y={38} width={34} height={36} rx={10} fill="#1565C0" />
          <Rect
            x={33}
            y={50}
            width={34}
            height={7}
            rx={3}
            fill={C.teal}
            opacity={0.8}
          />
          <Rect
            x={47}
            y={40}
            width={6}
            height={16}
            rx={2}
            fill="rgba(255,255,255,0.25)"
          />

          {/* Head */}
          <Rect x={45} y={28} width={10} height={12} rx={4} fill="#D4956A" />
          <Circle cx={50} cy={18} r={16} fill="#E8A87C" />
          <Path
            d="M34,14 Q36,4 50,3 Q64,4 66,14 Q62,8 50,8 Q38,8 34,14Z"
            fill="#2C1810"
          />
          <Rect
            x={38}
            y={15}
            width={11}
            height={7}
            rx={3.5}
            fill="rgba(0,0,0,0.75)"
          />
          <Rect
            x={51}
            y={15}
            width={11}
            height={7}
            rx={3.5}
            fill="rgba(0,0,0,0.75)"
          />
          <Rect
            x={48}
            y={18}
            width={4}
            height={2}
            rx={1}
            fill="rgba(255,255,255,0.2)"
          />
          <Rect
            x={40}
            y={16}
            width={4}
            height={3}
            rx={1.5}
            fill="rgba(255,255,255,0.18)"
          />
          <Circle cx={34} cy={20} r={4} fill="#D4956A" />
          <Path
            d="M44,26 Q50,30 56,26"
            stroke="#C0705A"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M34,12 Q50,6 66,12"
            stroke={C.accent}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />

          {/* Front arm */}
          <Path
            d={`M${shoulderR.x},${shoulderR.y} L${armF.elbowX},${armF.elbowY}`}
            {...limb('#D4956A', 8)}
          />
          <Path
            d={`M${armF.elbowX},${armF.elbowY} L${armF.wristX},${armF.wristY}`}
            {...limb('#D4956A', 6)}
          />
          <Circle cx={armF.wristX} cy={armF.wristY} r={5.5} fill="#D4956A" />
          <Rect
            x={armF.wristX - 4}
            y={armF.wristY - 4}
            width={8}
            height={8}
            rx={2}
            fill={C.teal}
            opacity={0.9}
          />

          {/* Front leg */}
          <Path
            d={`M${hipL.x},${hipL.y} L${legF.kneeX},${legF.kneeY}`}
            {...limb('#D4956A', 9)}
          />
          <Path
            d={`M${legF.kneeX},${legF.kneeY} L${legF.ankleX},${legF.ankleY}`}
            {...limb('#D4956A', 7.5)}
          />
          <Circle cx={legF.ankleX} cy={legF.ankleY} r={6} fill="white" />
          <Ellipse
            cx={legF.toeX}
            cy={legF.toeY}
            rx={9}
            ry={5.5}
            fill={C.accent}
          />
          <Ellipse
            cx={legF.toeX - 1}
            cy={legF.toeY - 2}
            rx={6}
            ry={3}
            fill="rgba(255,255,255,0.3)"
          />
          <Path
            d={`M${legF.toeX - 9},${legF.toeY + 4} Q${legF.toeX},${
              legF.toeY + 8
            } ${legF.toeX + 9},${legF.toeY + 4}`}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth={2}
            fill="none"
          />
        </Svg>
      </RNAnimated.View>

      {/* Stats HUD */}
      <AppView style={styles.hud}>
        {STATS.map(s => (
          <StatCard key={s.label} stat={s} />
        ))}
      </AppView>
    </AppView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  trackWrap: { position: 'absolute', bottom: '28%', left: 0, right: 0 },
  shadowWrap: { position: 'absolute', bottom: '27%' },
  trailWrap: { position: 'absolute', bottom: '30%', left: -110 },
  runnerWrap: { position: 'absolute', bottom: '26%' },
  hud: {
    position: 'absolute',
    bottom: '10%',
    left: 28,
    right: 28,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
});
