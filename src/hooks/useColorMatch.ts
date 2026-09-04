import { useState, useCallback } from "react";
import { createColorFilter } from "../utils/filterHelpers";

export function useColorMatch() {
  const [enabled, setEnabled] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [hueRotate, setHueRotate] = useState(0);

  const getFilter = useCallback(() => {
    return createColorFilter({
      enabled,
      brightness,
      contrast,
      saturation,
      hueRotate,
    });
  }, [enabled, brightness, contrast, saturation, hueRotate]);

  const applyReferenceStyle = () => {
    setBrightness(105);
    setContrast(115);
    setSaturation(90);
    setHueRotate(-5);
    setEnabled(true);
  };

  return {
    enabled,
    setEnabled,
    brightness,
    setBrightness,
    contrast,
    setContrast,
    saturation,
    setSaturation,
    hueRotate,
    setHueRotate,
    getFilter,
    applyReferenceStyle,
  };
}