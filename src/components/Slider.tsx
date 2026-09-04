type SliderProps = {
  title: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  snapTo?: number;
  snapThreshold?: number;
  onChange: (value: number) => void;
};

export function Slider({ title, value, min, max, step = 1, suffix, snapTo, snapThreshold, onChange }: SliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newVal = Number(e.target.value);
    if (snapTo !== undefined && snapThreshold !== undefined) {
      if (Math.abs(newVal - snapTo) <= snapThreshold) {
        newVal = snapTo;
      }
    }
    onChange(newVal);
  };
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-white/80">{title}</span>
        <span className="text-white/45">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
      />
    </div>
  );
}