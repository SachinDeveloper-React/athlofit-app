// ─── GEOMETRY ─────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface LegData {
  kneeX: number;
  kneeY: number;
  ankleX: number;
  ankleY: number;
  toeX: number;
  toeY: number;
}

export interface ArmData {
  elbowX: number;
  elbowY: number;
  wristX: number;
  wristY: number;
}

export interface PoseData {
  legF: LegData;
  legB: LegData;
  armF: ArmData;
  armB: ArmData;
  bob: number;
  hipL: Point;
  hipR: Point;
  shoulderL: Point;
  shoulderR: Point;
}

// ─── DATA MODELS ──────────────────────────────────────────────────────────

export interface StatItem {
  label: string;
  value: string;
  color: string;
}

export interface BpItem {
  label: string;
  val: string;
  color: string;
  animatedWidth: import('react-native').Animated.AnimatedInterpolation<
    string | number
  >;
}

export interface MacroItem {
  label: string;
  pct: number;
  color: string;
  val: string;
}

export interface GoalItem {
  label: string;
  target: string;
  curr: string;
  pct: number;
  color: string;
}

export interface SleepStage {
  label: string;
  color: string;
}

// ─── SLIDE CONFIG ─────────────────────────────────────────────────────────

export interface SlideConfig {
  key: string;
  title: string;
  subtitle: string;
  accent: string;
  Scene: React.FC;
}

// ─── COMPONENT PROPS ──────────────────────────────────────────────────────

export interface OnboardingScreenProps {
  onFinish?: () => void;
}

export interface ProgressBarProps {
  progress: import('react-native').Animated.AnimatedInterpolation<
    string | number
  >;
  color: string;
}

export interface DotsProps {
  slides: SlideConfig[];
  activeIndex: number;
  accent: string;
  onPress: (index: number) => void;
}

export interface NextButtonProps {
  isLast: boolean;
  accent: string;
  scale: import('react-native').Animated.Value;
  onPress: () => void;
}

export interface StatCardProps {
  stat: StatItem;
}

export interface MacroRowProps {
  macro: MacroItem;
  widthAnim: import('react-native').Animated.Value;
}

export interface GoalRingProps {
  goal: GoalItem;
}

export interface BpRowProps {
  item: BpItem;
}
