export const withOpacity = (hex: string, opacity: number) => {
  // hex: #RRGGBB
  const o = Math.max(0, Math.min(1, opacity));
  const alpha = Math.round(o * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${alpha}`;
};
