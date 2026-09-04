import { TitleBar } from "../components/TitleBar";

export function LoadingPage() {
  return (
    <div className="h-screen w-screen bg-[#0b1220] flex flex-col overflow-hidden">
      <TitleBar title="REVIVAL" />
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mb-6" />
        <div className="text-white/70 text-lg tracking-wider">加载资源中...</div>
        <div className="text-white/40 text-xs mt-4">REVIVAL与您一同留存美好</div>
      </div>
    </div>
  );
}