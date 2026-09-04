type Scale = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface ExportScaleSelectorProps {
  value: Scale;
  onChange: (scale: Scale) => void;
}

export function ExportScaleSelector({ value, onChange }: ExportScaleSelectorProps) {
  const scales: Scale[] = [1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <div className="grid grid-cols-4 gap-2">
      {scales.map((scale) => (
        <button
          key={scale}
          onClick={() => onChange(scale)}
          className={`py-2 rounded-xl transition-all ${
            value === scale
              ? "bg-cyan-500/30 text-white shadow"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          {scale}x
        </button>
      ))}
    </div>
  );
}