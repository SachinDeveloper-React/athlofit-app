// ─── COLORS ───────────────────────────────────────────────────────────────

export const C = {
  bg1: '#0A0F1E',
  bg2: '#0D1B2A',
  accent: '#FF3D6E',
  teal: '#00E5C3',
  blue: '#4A90F5',
  gold: '#FFD166',
  white: '#FFFFFF',
  muted: 'rgba(255,255,255,0.45)',
  card: 'rgba(255,255,255,0.06)',
} as const;

// ─── GEOMETRY HELPERS ─────────────────────────────────────────────────────

const r2 = (n: number): number => Math.round(n * 100) / 100;

function buildLeg(
  hipX: number,
  hipY: number,
  thighDeg: number,
  shinDeg: number,
) {
  const ta = (thighDeg * Math.PI) / 180;
  const sa = ((thighDeg + shinDeg) * Math.PI) / 180;
  const kneeX = r2(hipX + Math.sin(ta) * 28);
  const kneeY = r2(hipY + Math.cos(ta) * 28);
  const ankleX = r2(kneeX + Math.sin(sa) * 26);
  const ankleY = r2(kneeY + Math.cos(sa) * 26);
  const fa = sa + 0.3;
  const toeX = r2(ankleX + Math.sin(fa) * 14);
  const toeY = r2(ankleY + Math.cos(fa) * 6);
  return { kneeX, kneeY, ankleX, ankleY, toeX, toeY };
}

function buildArm(shX: number, shY: number, upperDeg: number, foreDeg: number) {
  const ua = (upperDeg * Math.PI) / 180;
  const fa = ((upperDeg + foreDeg) * Math.PI) / 180;
  const elbowX = r2(shX + Math.sin(ua) * 20);
  const elbowY = r2(shY + Math.cos(ua) * 20);
  const wristX = r2(elbowX + Math.sin(fa) * 18);
  const wristY = r2(elbowY + Math.cos(fa) * 18);
  return { elbowX, elbowY, wristX, wristY };
}

// ─── 8-FRAME RUN CYCLE ────────────────────────────────────────────────────
// columns: frontThigh, frontShin, backThigh, backShin,
//          frontUpperArm, frontForearm, backUpperArm, backForearm, bodyBob

const RAW_FRAMES: readonly (readonly number[])[] = [
  [-28, 20, 22, -30, -30, 40, 28, -35, 0],
  [-18, 10, 30, -40, -22, 30, 22, -28, -3],
  [-5, 5, 32, -48, -10, 20, 14, -20, -5],
  [10, -5, 28, -52, 2, 12, 4, -12, -4],
  [22, -15, 18, -42, 14, 8, -8, -8, -2],
  [30, -25, 5, -28, 26, 12, -18, -14, 0],
  [28, -32, -10, -18, 32, 20, -26, -22, -3],
  [20, -28, -20, -5, 30, 32, -30, -32, -5],
] as const;

export const POSES = RAW_FRAMES.map(([ft, fs, bt, bs, fa, ff, ba, bf, bob]) => {
  const hipL = { x: 38, y: 73 };
  const hipR = { x: 62, y: 73 };
  const shoulderL = { x: 36, y: 40 };
  const shoulderR = { x: 64, y: 40 };
  return {
    legF: buildLeg(hipL.x, hipL.y, ft, fs),
    legB: buildLeg(hipR.x, hipR.y, bt, bs),
    armF: buildArm(shoulderR.x, shoulderR.y, fa, ff),
    armB: buildArm(shoulderL.x, shoulderL.y, ba, bf),
    bob,
    hipL,
    hipR,
    shoulderL,
    shoulderR,
  };
});

export const SHADOW_SCALES = [
  1, 0.92, 0.85, 0.82, 0.85, 0.92, 1, 0.95,
] as const;
