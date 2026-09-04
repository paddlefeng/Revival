import { useState } from "react";

type CollapseProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

export function Collapse({ title, children, defaultOpen = true }: CollapseProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] overflow-hidden backdrop-blur-xl">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-5 flex items-center justify-between hover:bg-white/[0.03] transition-all"
      >
        <div className="text-lg font-bold">{title}</div>
        <div className={`transition-transform duration-300 text-white/50 ${open ? "rotate-180" : ""}`}>▼</div>
      </button>
      <div className={`grid transition-all duration-300 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="px-6 pb-6 pt-3 border-t border-white/5">{children}</div>
        </div>
      </div>
    </div>
  );
}