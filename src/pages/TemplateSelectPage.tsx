import { useNavigate } from "react-router-dom";
import { TitleBar } from "../components/TitleBar";

interface Template {
  id: string;
  name: string;
  description: string;
  previewIcon: string;
  previewImage?: string;
  bgClass: string;
  route: string;
}

export function TemplateSelectPage() {
  const navigate = useNavigate();

  const templates: Template[] = [
    {
      id: "shadow-border",
      name: "光影边框",
      description: "专业的照片圆角边框、阴影、水印与色调调整",
      previewIcon: "🎨",
      bgClass: "from-cyan-500/20 to-blue-500/20",
      route: "/editor",
    },
    {
      id: "hasselblad",
      name: "哈苏风・电影感边框",
      description: "高级质感、电影截图氛围、左侧参数信息、冷调背景",
      previewIcon: "🎞️",
      bgClass: "from-emerald-500/20 to-teal-500/20",
      route: "/editor-hasselblad",
    },
    {
      id: "xiaomi",
      name: "小米风・原生信息栏",
      description: "原生相机水印风格，底部信息栏，完整参数，真实纪实",
      previewIcon: "📱",
      bgClass: "from-orange-500/20 to-red-500/20",
      route: "/editor-xiaomi",
    },
    {
      id: "card-params",
      name: "卡片式参数",
      description: "简约现代、黑框白字参数、悬浮卡片画框、通用适配",
      previewIcon: "🃏",
      bgClass: "from-gray-500/20 to-slate-500/20",
      route: "/editor-cardparams",
    },
  ];

  const handleSelectTemplate = (template: Template) => {
    navigate(template.route);
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-[#0a0f1c] to-[#0b1220] flex flex-col overflow-hidden">
      <TitleBar />
      <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Revival
          </h1>
          <p className="text-white/50 mt-2">选择你的创作模板</p>
        </div>
        {/* 动态网格：每个卡片最小宽度 320px，自动填充列数 */}
        <div className="w-full max-w-7xl mx-auto px-4 grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleSelectTemplate(template)}
              className="group relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:border-cyan-500/50 transition-all duration-300 hover:scale-[1.02] text-left w-full"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${template.bgClass} opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="relative p-6">
                <div className="mb-4 rounded-xl overflow-hidden bg-black/30 aspect-video flex items-center justify-center">
                  {template.previewImage ? (
                    <img
                      src={template.previewImage}
                      alt={`${template.name} 预览`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-cyan-500/10 to-blue-500/10 flex flex-col items-center justify-center gap-2">
                      <span className="text-5xl">{template.previewIcon}</span>
                      <span className="text-white/40 text-sm">点击查看效果</span>
                    </div>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">{template.name}</h2>
                <p className="text-white/60 text-sm">{template.description}</p>
                <div className="mt-4 inline-block px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 text-sm font-medium">
                  选择此模板
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-12 text-white/30 text-xs">更多模板即将推出</div>
      </div>
    </div>
  );
}