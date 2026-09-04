import React from "react";
import { AVAILABLE_FONTS } from "../constants/fonts";

interface FontSelectorProps {
  value: string;
  onChange: (fontValue: string) => void;
  label?: string;
  className?: string;
  placeholder?: string;
}

export function FontSelector({
  value,
  onChange,
  label,
  className = "",
  placeholder = "选择字体",
}: FontSelectorProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && <label className="text-sm text-white/80 block">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
        style={{ fontFamily: value }}
      >
        <option value="" disabled>{placeholder}</option>
        {AVAILABLE_FONTS.map((font) => (
          <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
            {font.label}
          </option>
        ))}
      </select>
    </div>
  );
}