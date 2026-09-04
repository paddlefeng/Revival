// 根据色调匹配参数生成 CSS filter 字符串
export const createColorFilter = (params: {
  enabled: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  hueRotate: number;
}): string => {
  if (!params.enabled) return "none";
  const b = params.brightness / 100;
  const c = params.contrast / 100;
  const s = params.saturation / 100;
  const h = params.hueRotate;
  return `brightness(${b}) contrast(${c}) saturate(${s}) hue-rotate(${h}deg)`;
};