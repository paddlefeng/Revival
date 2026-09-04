// App.tsx
import { useRef, useState, useEffect, useCallback } from "react";
import html2canvas from "html2canvas";
import exifr from "exifr";

// 品牌配置（仅用于字体样式）
const brandConfigs: Record<string, { logo: string; font: string }> = {
  vivo: { logo: "vivo", font: "font-black tracking-wide" },
  iPhone: { logo: "iPhone", font: "font-semibold tracking-[0.2em]" },
  HUAWEI: { logo: "HUAWEI", font: "font-bold tracking-[0.35em]" },
  Xiaomi: { logo: "Xiaomi", font: "font-bold tracking-[0.15em]" },
  OPPO: { logo: "OPPO", font: "font-bold tracking-[0.3em]" },
  Samsung: { logo: "SAMSUNG", font: "font-semibold tracking-[0.3em]" },
};

// 折叠面板组件
type CollapseProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

function Collapse({ title, children, defaultOpen = true }: CollapseProps) {
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

// 滑块组件（支持吸附）
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

function Slider({ title, value, min, max, step = 1, suffix, snapTo, snapThreshold, onChange }: SliderProps) {
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

// 开关组件
type ToggleProps = {
  label: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
};

function Toggle({ label, enabled, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-white/80">{label}</span>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
          enabled ? "bg-cyan-500" : "bg-white/20"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
  }
}

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    return this;
  };
}

// -------------------------------------------------------------
// 启动加载界面组件
function LoadingScreen() {
  return (
    <div className="h-screen w-screen bg-[#0b1220] flex flex-col items-center justify-center">
      <div className="w-16 h-16 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mb-6" />
      <div className="text-white/70 text-lg tracking-wider">加载资源中...</div>
      <div className="text-white/40 text-xs mt-4">ShadowCam Studio</div>
    </div>
  );
}

// 模板选择界面组件
interface TemplateSelectProps {
  onSelectTemplate: (templateId: string) => void;
}

function TemplateSelect({ onSelectTemplate }: TemplateSelectProps) {
  // 目前只有一个模板，未来可扩展
  const templates = [
    {
      id: "shadow-border",
      name: "光影边框",
      description: "专业的照片圆角边框、阴影、水印与色调调整",
      previewIcon: "🎨",
      bgClass: "from-cyan-500/20 to-blue-500/20",
    },
    // 可添加更多模板
  ];

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-[#0a0f1c] to-[#0b1220] flex flex-col items-center justify-center p-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
          ShadowCam Studio
        </h1>
        <p className="text-white/50 mt-2">选择你的创作模板</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelectTemplate(template.id)}
            className="group relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:border-cyan-500/50 transition-all duration-300 hover:scale-[1.02]"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${template.bgClass} opacity-0 group-hover:opacity-100 transition-opacity`} />
            <div className="relative p-8 text-left">
              <div className="text-6xl mb-4">{template.previewIcon}</div>
              <h2 className="text-2xl font-bold text-white mb-2">{template.name}</h2>
              <p className="text-white/60 text-sm">{template.description}</p>
              <div className="mt-6 inline-block px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 text-sm font-medium">
                选择此模板
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-12 text-white/30 text-xs">更多模板即将推出</div>
    </div>
  );
}

// -------------------------------------------------------------
// 主编辑器组件（原有全部功能）
interface EditorProps {
  // 可接收模板参数，目前无特殊
}

function Editor({}: EditorProps) {
  const exportRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"image" | "video">("image");
  const [image, setImage] = useState(
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1600&auto=format&fit=crop"
  );
  const [video, setVideo] = useState(
    "https://www.w3schools.com/html/mov_bbb.mp4"
  );

  const [mediaAspectRatio, setMediaAspectRatio] = useState(16 / 10);

  const [blur, setBlur] = useState(28);
  const [shadow, setShadow] = useState(70);
  const [radius, setRadius] = useState(42);
  const [padding, setPadding] = useState(60);

  const [brandStyle, setBrandStyle] = useState("vivo");
  const [brandText, setBrandText] = useState("vivo");
  const [cameraInfo, setCameraInfo] = useState("24MM F1.8 1/250S ISO100");
  const [showLogo, setShowLogo] = useState(true);
  const [showCameraInfo, setShowCameraInfo] = useState(true);
  const [watermarkOnBackground, setWatermarkOnBackground] = useState(true);
  
  const [logoX, setLogoX] = useState(41);
  const [logoY, setLogoY] = useState(5);
  const [logoSize, setLogoSize] = useState(37);
  
  const [textX, setTextX] = useState(58);
  const [textY, setTextY] = useState(4);
  const [textSize, setTextSize] = useState(15);
  
  const [showParamBg, setShowParamBg] = useState(false);
  const [showParamBorder, setShowParamBorder] = useState(false);

  const [bgShape, setBgShape] = useState<"square" | "rounded">("rounded");
  const [glowColor, setGlowColor] = useState("cyan-500");
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);

  const [colorMatchEnabled, setColorMatchEnabled] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [hueRotate, setHueRotate] = useState(0);

  const [exportScale, setExportScale] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>(2);
  const [imageFitCover, setImageFitCover] = useState(true);

  const currentBrandStyle = brandConfigs[brandStyle];

  const showVerticalLine = (showLogo && logoX === 50) || (showCameraInfo && textX === 50);
  const showHorizontalLine = (showLogo && logoY === 50) || (showCameraInfo && textY === 50);

  const getColorFilter = useCallback(() => {
    if (!colorMatchEnabled) return 'none';
    const b = brightness / 100;
    const c = contrast / 100;
    const s = saturation / 100;
    const h = hueRotate;
    return `brightness(${b}) contrast(${c}) saturate(${s}) hue-rotate(${h}deg)`;
  }, [colorMatchEnabled, brightness, contrast, saturation, hueRotate]);

  const applyReferenceStyle = () => {
    setBrightness(105);
    setContrast(115);
    setSaturation(90);
    setHueRotate(-5);
    setColorMatchEnabled(true);
  };

  const updateAspectRatioFromImage = (src: string) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      setMediaAspectRatio(ratio);
    };
    img.src = src;
  };

  const updateAspectRatioFromVideo = (videoEl: HTMLVideoElement) => {
    if (videoEl.videoWidth && videoEl.videoHeight) {
      setMediaAspectRatio(videoEl.videoWidth / videoEl.videoHeight);
    }
  };

  const extractExifFromCurrentImage = async () => {
    if (mode === "video") {
      alert("视频模式暂不支持 EXIF 识别。请切换到图片模式。");
      return;
    }
    const file = fileInputRef.current?.files?.[0];
    if (!file || !file.type.startsWith("image")) {
      alert("无法识别：请先上传本地图片文件。");
      return;
    }
    try {
      const exifData = await exifr.parse(file);
      if (!exifData) {
        alert("未找到 EXIF 信息。");
        return;
      }
      const focalLength = exifData.FocalLength ? `${Math.round(exifData.FocalLength)}MM` : "";
      const fNumber = exifData.FNumber ? `F${exifData.FNumber}` : "";
      let shutter = "";
      if (exifData.ExposureTime) {
        const et = exifData.ExposureTime;
        if (et < 1) {
          shutter = `1/${Math.round(1 / et)}S`;
        } else {
          shutter = `${et}S`;
        }
      }
      const iso = exifData.ISO ? `ISO${exifData.ISO}` : "";
      const parts = [focalLength, fNumber, shutter, iso].filter(p => p !== "");
      if (parts.length > 0) {
        setCameraInfo(parts.join(" "));
      } else {
        alert("未提取到有用的摄影参数。");
      }
    } catch (err) {
      console.error(err);
      alert("解析 EXIF 失败。");
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (file.type.startsWith("video")) {
        setVideo(reader.result as string);
        setMode("video");
        setIsVideoPlaying(true);
      } else {
        setImage(reader.result as string);
        setMode("image");
        if (reader.result) updateAspectRatioFromImage(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const onVideoLoadedMetadata = () => {
    if (videoRef.current) {
      updateAspectRatioFromVideo(videoRef.current);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.addEventListener("loadedmetadata", onVideoLoadedMetadata);
      return () => {
        video.removeEventListener("loadedmetadata", onVideoLoadedMetadata);
      };
    }
  }, [videoRef.current]);

  useEffect(() => {
    if (mode === "image" && image) {
      updateAspectRatioFromImage(image);
    } else if (mode === "video" && videoRef.current) {
      updateAspectRatioFromVideo(videoRef.current);
    }
  }, [mode, image]);

  const toggleVideoPlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isVideoPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsVideoPlaying(!isVideoPlaying);
  }, [isVideoPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setIsVideoPlaying(true);
    const onPause = () => setIsVideoPlaying(false);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [videoRef.current]);

  const applyBlur = (src: string, blurPx: number): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.filter = `blur(${blurPx}px) brightness(0.85)`;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = src;
    });

  const captureVideoFrame = async (videoEl: HTMLVideoElement): Promise<string> => {
    const canvas = document.createElement("canvas");
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(videoEl, 0, 0);
    return canvas.toDataURL("image/png");
  };

  const exportImage = async () => {
    if (!exportRef.current) return;
    const container = exportRef.current;

    let wasVideoPlaying = false;
    let videoFrameUrl: string | null = null;
    if (mode === "video" && videoRef.current) {
      wasVideoPlaying = !videoRef.current.paused;
      if (wasVideoPlaying) {
        videoRef.current.pause();
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      videoFrameUrl = await captureVideoFrame(videoRef.current);
    }

    const mainImageUrl = mode === "image" ? image : videoFrameUrl!;
    if (!mainImageUrl) return;
    const bgBlurUrl = await applyBlur(mainImageUrl, blur);

    const rect = container.getBoundingClientRect();
    const baseWidth = rect.width;
    const baseHeight = rect.height;
    const scaleFactor = exportScale;
    const finalWidth = baseWidth * scaleFactor;
    const finalHeight = baseHeight * scaleFactor;

    const canvas = document.createElement("canvas");
    canvas.width = finalWidth;
    canvas.height = finalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scaleFactor, scaleFactor);

    // 背景模糊层（使用 contain，不缩放变形）
    const bgImg = await loadImage(bgBlurUrl);
    const bgRadius = bgShape === "rounded" ? 48 : 0;
    if (bgRadius > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(0, 0, baseWidth, baseHeight, bgRadius);
      ctx.clip();
    }
    const bgImgAspect = bgImg.width / bgImg.height;
    const bgContainerAspect = baseWidth / baseHeight;
    let bgDrawW, bgDrawH, bgDrawX, bgDrawY;
    if (bgImgAspect > bgContainerAspect) {
      bgDrawW = baseWidth;
      bgDrawH = baseWidth / bgImgAspect;
      bgDrawX = 0;
      bgDrawY = (baseHeight - bgDrawH) / 2;
    } else {
      bgDrawH = baseHeight;
      bgDrawW = baseHeight * bgImgAspect;
      bgDrawX = (baseWidth - bgDrawW) / 2;
      bgDrawY = 0;
    }
    ctx.drawImage(bgImg, bgDrawX, bgDrawY, bgDrawW, bgDrawH);
    if (bgRadius > 0) ctx.restore();

    // 主卡片
    const cardInnerPadding = padding;
    const cardW = baseWidth - cardInnerPadding * 2;
    const cardH = baseHeight - cardInnerPadding * 2;
    const cardX = cardInnerPadding;
    const cardY = cardInnerPadding;

    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = shadow * 1.5;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = shadow * 0.5;
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.fill();
    ctx.shadowColor = "transparent";

    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.clip();

    const mainImg = await loadImage(mainImageUrl);
    const imgAspect = mainImg.width / mainImg.height;
    const cardAspect = cardW / cardH;
    let drawImgW, drawImgH, drawImgX, drawImgY;
    if (imageFitCover) {
      if (imgAspect > cardAspect) {
        drawImgH = cardH;
        drawImgW = cardH * imgAspect;
        drawImgX = cardX + (cardW - drawImgW) / 2;
        drawImgY = cardY;
      } else {
        drawImgW = cardW;
        drawImgH = cardW / imgAspect;
        drawImgX = cardX;
        drawImgY = cardY + (cardH - drawImgH) / 2;
      }
    } else {
      if (imgAspect > cardAspect) {
        drawImgW = cardW;
        drawImgH = cardW / imgAspect;
        drawImgX = cardX;
        drawImgY = cardY + (cardH - drawImgH) / 2;
      } else {
        drawImgH = cardH;
        drawImgW = cardH * imgAspect;
        drawImgX = cardX + (cardW - drawImgW) / 2;
        drawImgY = cardY;
      }
    }
    const colorFilter = getColorFilter();
    if (colorFilter !== 'none') {
      ctx.filter = colorFilter;
    }
    ctx.drawImage(mainImg, drawImgX, drawImgY, drawImgW, drawImgH);
    if (colorFilter !== 'none') {
      ctx.filter = 'none';
    }
    ctx.restore();

    // 水印绘制
    const logoElement = container.querySelector(".watermark-logo") as HTMLElement;
    if (logoElement && showLogo) {
      const elRect = logoElement.getBoundingClientRect();
      const left = elRect.left - rect.left;
      const top = elRect.top - rect.top;
      const width = elRect.width;
      const height = elRect.height;
      const textDiv = logoElement.querySelector("div") || logoElement;
      const text = textDiv.innerText;
      const computed = window.getComputedStyle(textDiv);
      const fontSize = parseFloat(computed.fontSize);
      const fontFamily = computed.fontFamily;
      const fontWeight = computed.fontWeight;
      const color = computed.color;
      const textShadow = computed.textShadow;

      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.fillStyle = color;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      if (textShadow && textShadow !== "none") {
        const shadowMatch = textShadow.match(/([-\d.]+)px\s+([-\d.]+)px\s+([-\d.]+)px\s+(.+)/);
        if (shadowMatch) {
          ctx.shadowColor = shadowMatch[4];
          ctx.shadowBlur = parseFloat(shadowMatch[3]);
          ctx.shadowOffsetX = parseFloat(shadowMatch[1]);
          ctx.shadowOffsetY = parseFloat(shadowMatch[2]);
        }
      }
      const centerX = left + width / 2;
      const centerY = top + height / 2;
      ctx.fillText(text, centerX, centerY);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    const cameraElement = container.querySelector(".watermark-camera") as HTMLElement;
    if (cameraElement && showCameraInfo) {
      const elRect = cameraElement.getBoundingClientRect();
      const left = elRect.left - rect.left;
      const top = elRect.top - rect.top;
      const width = elRect.width;
      const height = elRect.height;
      const textDiv = cameraElement.querySelector("div") || cameraElement;
      const text = textDiv.innerText;
      const computed = window.getComputedStyle(textDiv);
      const fontSize = parseFloat(computed.fontSize);
      const fontFamily = computed.fontFamily;
      const fontWeight = computed.fontWeight;
      const color = computed.color;
      const textShadow = computed.textShadow;
      const backgroundColor = computed.backgroundColor;
      const borderRadius = parseFloat(computed.borderRadius);

      if (backgroundColor && backgroundColor !== "rgba(0,0,0,0)" && backgroundColor !== "transparent") {
        ctx.fillStyle = backgroundColor;
        ctx.beginPath();
        ctx.roundRect(left, top, width, height, borderRadius);
        ctx.fill();
      }

      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.fillStyle = color;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      if (textShadow && textShadow !== "none") {
        const shadowMatch = textShadow.match(/([-\d.]+)px\s+([-\d.]+)px\s+([-\d.]+)px\s+(.+)/);
        if (shadowMatch) {
          ctx.shadowColor = shadowMatch[4];
          ctx.shadowBlur = parseFloat(shadowMatch[3]);
          ctx.shadowOffsetX = parseFloat(shadowMatch[1]);
          ctx.shadowOffsetY = parseFloat(shadowMatch[2]);
        }
      }
      const centerX = left + width / 2;
      const centerY = top + height / 2;
      ctx.fillText(text, centerX, centerY);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    const link = document.createElement("a");
    link.download = `shadowcam-frame-${scaleFactor}x.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();

    if (mode === "video" && videoRef.current && wasVideoPlaying) {
      videoRef.current.play();
      setIsVideoPlaying(true);
    }
  };

  const glowClass = `bg-${glowColor}/10`;

  const renderLogo = () => {
    if (!showLogo) return null;
    return (
      <div
        className="absolute pointer-events-none watermark-logo"
        style={{
          bottom: `${logoY}%`,
          right: `${100 - logoX}%`,
          transform: "translate(50%, 50%)",
          zIndex: 20,
        }}
      >
        <div
          className={`${currentBrandStyle.font} text-white/95 drop-shadow-2xl tracking-wider whitespace-nowrap`}
          style={{
            fontSize: `${logoSize}px`,
            textShadow: "0 2px 15px rgba(0,0,0,0.3)",
            display: "inline-block",
          }}
        >
          {brandText}
        </div>
      </div>
    );
  };

  const renderCameraInfo = () => {
    if (!showCameraInfo) return null;
    const bgClass = showParamBg ? "bg-black/20 backdrop-blur-sm" : "";
    const borderClass = showParamBorder ? "border border-gray-400" : "";
    return (
      <div
        className="absolute pointer-events-none watermark-camera"
        style={{
          bottom: `${textY}%`,
          left: `${textX}%`,
          transform: "translate(-50%, 50%)",
          zIndex: 10,
        }}
      >
        <div
          className={`font-mono text-white/80 ${bgClass} ${borderClass} px-3 py-1.5 rounded-full`}
          style={{
            fontSize: `${textSize}px`,
            letterSpacing: "0.05em",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            whiteSpace: "nowrap",
          }}
        >
          {cameraInfo}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen bg-transparent overflow-hidden">
      <div className="h-full w-full rounded-[34px] overflow-hidden bg-[#0b1220]/95 backdrop-blur-3xl shadow-[0_25px_120px_rgba(0,0,0,0.65)] flex flex-col relative">
        {/* 可拖拽标题栏 */}
        <div
          className="h-14 flex items-center px-5 shrink-0 backdrop-blur-xl"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          <div className="flex gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <div onClick={() => window.electronAPI?.close()} className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors cursor-pointer" />
            <div onClick={() => window.electronAPI?.maximize()} className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors cursor-pointer" />
            <div onClick={() => window.electronAPI?.minimize()} className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 transition-colors cursor-pointer" />
          </div>
          <div className="ml-5 text-xs uppercase tracking-[0.35em] text-white/45 font-medium">SHADOWCAM STUDIO</div>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 overflow-hidden grid xl:grid-cols-[1fr_560px] h-full">
          {/* 左侧预览区 */}
          <div className="relative flex items-center justify-center p-6 overflow-hidden">
            <div className={`absolute w-[700px] h-[700px] rounded-full ${glowClass} blur-[180px] opacity-40`} />

            <div
              ref={exportRef}
              className="relative w-full max-w-[1000px] max-h-full"
              style={{
                aspectRatio: mediaAspectRatio,
                height: "auto",
                boxShadow: `0 ${shadow}px ${shadow * 1.5}px -${shadow * 0.5}px rgba(0,0,0,0.6)`,
              }}
            >
              {/* 背景模糊层 - 使用 object-contain 完整显示 */}
              <div
                data-bg-layer
                className={`absolute inset-0 overflow-hidden flex items-center justify-center ${bgShape === "rounded" ? "rounded-[48px]" : ""}`}
              >
                {mode === "image" ? (
                  <img
                    src={image}
                    crossOrigin="anonymous"
                    className="max-w-full max-h-full object-contain"
                    style={{
                      filter: `blur(${blur}px) brightness(0.85)`,
                    }}
                    alt="bg-blur"
                  />
                ) : (
                  <video
                    src={video}
                    ref={videoRef}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="max-w-full max-h-full object-contain"
                    style={{
                      filter: `blur(${blur}px) brightness(0.85)`,
                    }}
                  />
                )}
              </div>

              {/* 背景层上的水印 */}
              {watermarkOnBackground && (
                <div className="absolute inset-0 pointer-events-none">
                  {renderLogo()}
                  {renderCameraInfo()}
                </div>
              )}

              {/* 主卡片区域 */}
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ padding: `${padding}px` }}
              >
                <div
                  className="relative w-full h-full overflow-hidden bg-black"
                  style={{
                    borderRadius: `${radius}px`,
                    boxShadow: `0 25px 50px -12px rgba(0,0,0,0.5)`,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    {mode === "image" ? (
                      <img
                        src={image}
                        crossOrigin="anonymous"
                        className={imageFitCover ? "w-full h-full object-cover" : "max-w-full max-h-full object-contain"}
                        alt="main"
                        style={{ filter: getColorFilter() }}
                      />
                    ) : (
                      <video
                        src={video}
                        ref={videoRef}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className={imageFitCover ? "w-full h-full object-cover" : "max-w-full max-h-full object-contain"}
                        style={{ filter: getColorFilter() }}
                      />
                    )}
                  </div>

                  {/* 前景上的水印 */}
                  {!watermarkOnBackground && (
                    <>
                      {renderLogo()}
                      {renderCameraInfo()}
                    </>
                  )}
                </div>
              </div>

              {/* 辅助线 */}
              {showVerticalLine && (
                <div className="absolute inset-0 pointer-events-none z-30">
                  <div className="absolute left-1/2 top-0 w-px h-full bg-white/40 transform -translate-x-1/2" />
                </div>
              )}
              {showHorizontalLine && (
                <div className="absolute inset-0 pointer-events-none z-30">
                  <div className="absolute top-1/2 left-0 h-px w-full bg-white/40 transform -translate-y-1/2" />
                </div>
              )}
            </div>
          </div>

          {/* 右侧控制面板 */}
          <div
            className="h-full overflow-y-auto border-l border-white/10 bg-white/[0.03] backdrop-blur-2xl p-6 scrollbar-thin scrollbar-thumb-white/10"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <div className="space-y-5 mb-6">
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 font-medium hover:bg-cyan-500/30 transition-all backdrop-blur-sm">
                📸 上传照片或视频
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleUpload} className="hidden" />
            </div>

            <div className="flex gap-2 mb-8 bg-white/5 p-1 rounded-2xl">
              <button onClick={() => setMode("image")} className={`flex-1 py-2 rounded-xl transition-all ${mode === "image" ? "bg-cyan-500/30 text-white shadow" : "text-white/40 hover:text-white/70"}`}>图片模式</button>
              <button onClick={() => setMode("video")} className={`flex-1 py-2 rounded-xl transition-all ${mode === "video" ? "bg-cyan-500/30 text-white shadow" : "text-white/40 hover:text-white/70"}`}>视频模式</button>
            </div>

            {mode === "video" && (
              <div className="mb-6">
                <button onClick={toggleVideoPlay} className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all flex items-center justify-center gap-2">
                  {isVideoPlaying ? "⏸️ 暂停视频" : "▶️ 播放视频"}
                  <span className="text-xs text-white/50">(导出时自动使用当前帧)</span>
                </button>
              </div>
            )}

            <div className="space-y-6">
              <Collapse title="✨ 视觉光效" defaultOpen>
                <div className="space-y-5">
                  <Slider title="背景模糊" value={blur} min={0} max={60} suffix="px" onChange={setBlur} />
                  <Slider title="卡片阴影" value={shadow} min={0} max={120} suffix="px" onChange={setShadow} />
                  <Slider title="卡片圆角" value={radius} min={0} max={80} suffix="px" onChange={setRadius} />
                  <Slider title="内边距" value={padding} min={20} max={120} suffix="px" onChange={setPadding} />
                  <Toggle
                    label="图片填充模式（填满裁剪）"
                    enabled={imageFitCover}
                    onChange={setImageFitCover}
                  />
                  <p className="text-xs text-white/40">开启后图片将填满卡片区域（可能裁剪边缘），关闭则完整显示（可能有黑边）。</p>
                  <div>
                    <label className="text-sm text-white/80 block mb-2">氛围光颜色</label>
                    <div className="flex gap-3">
                      {["cyan-500", "blue-500", "purple-500", "pink-500", "emerald-500"].map((color) => (
                        <button
                          key={color}
                          onClick={() => setGlowColor(color)}
                          className={`w-8 h-8 rounded-full bg-${color} shadow-lg transition-all ${glowColor === color ? "ring-2 ring-white scale-110" : "opacity-60 hover:opacity-100"}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </Collapse>

              <Collapse title="🏷️ 品牌与水印" defaultOpen>
                <div className="space-y-5">
                  <Toggle label="显示品牌 Logo" enabled={showLogo} onChange={setShowLogo} />
                  {showLogo && (
                    <>
                      <div>
                        <label className="text-sm text-white/80 block mb-2">品牌文字</label>
                        <input
                          type="text"
                          value={brandText}
                          onChange={(e) => setBrandText(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-400"
                          placeholder="输入品牌名称"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-white/80 block mb-2">字体样式</label>
                        <select value={brandStyle} onChange={(e) => setBrandStyle(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-400">
                          {Object.keys(brandConfigs).map((b) => (<option key={b} value={b}>{b}</option>))}
                        </select>
                      </div>
                      <Slider title="Logo X 位置" value={logoX} min={0} max={100} suffix="%" snapTo={50} snapThreshold={2} onChange={setLogoX} />
                      <Slider title="Logo Y 位置" value={logoY} min={0} max={100} suffix="%" snapTo={50} snapThreshold={2} onChange={setLogoY} />
                      <Slider title="Logo 大小" value={logoSize} min={24} max={120} suffix="px" onChange={setLogoSize} />
                      <button
                        onClick={() => { setLogoX(50); setLogoY(50); }}
                        className="mt-2 w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold shadow-md hover:shadow-cyan-500/40 transition-all flex items-center justify-center gap-2"
                      >
                        🎯 居中 Logo
                      </button>
                    </>
                  )}
                </div>
              </Collapse>

              <Collapse title="📷 摄影参数" defaultOpen>
                <div className="space-y-5">
                  <Toggle label="显示相机参数" enabled={showCameraInfo} onChange={setShowCameraInfo} />
                  <Toggle label="显示参数背景" enabled={showParamBg} onChange={setShowParamBg} />
                  <Toggle label="显示参数边框" enabled={showParamBorder} onChange={setShowParamBorder} />
                  {showCameraInfo && (
                    <>
                      <input
                        type="text"
                        value={cameraInfo}
                        onChange={(e) => setCameraInfo(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-sm"
                        placeholder="例如: 24MM F1.8 1/100S ISO200"
                      />
                      <button
                        onClick={extractExifFromCurrentImage}
                        className="w-full py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold shadow-md hover:shadow-green-500/40 transition-all flex items-center justify-center gap-2"
                      >
                        🔍 从当前图片识别参数
                      </button>
                      <Slider title="参数 X 位置" value={textX} min={0} max={100} suffix="%" snapTo={50} snapThreshold={2} onChange={setTextX} />
                      <Slider title="参数 Y 位置" value={textY} min={0} max={100} suffix="%" snapTo={50} snapThreshold={2} onChange={setTextY} />
                      <Slider title="参数文字大小" value={textSize} min={10} max={28} suffix="px" onChange={setTextSize} />
                      <button
                        onClick={() => { setTextX(50); setTextY(50); }}
                        className="mt-2 w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold shadow-md hover:shadow-cyan-500/40 transition-all flex items-center justify-center gap-2"
                      >
                        🎯 居中相机参数
                      </button>
                    </>
                  )}
                </div>
              </Collapse>

              <Collapse title="⚙️ 水印位置" defaultOpen>
                <div className="space-y-4">
                  <Toggle label="放置于模糊背景层（虚化处）" enabled={watermarkOnBackground} onChange={setWatermarkOnBackground} />
                  <p className="text-xs text-white/40 mt-2">开启后，水印将显示在虚化背景上。关闭时，水印显示在清晰图片上。</p>
                </div>
              </Collapse>

              <Collapse title="🎨 色调匹配" defaultOpen>
                <div className="space-y-5">
                  <Toggle label="启用色调匹配" enabled={colorMatchEnabled} onChange={setColorMatchEnabled} />
                  {colorMatchEnabled && (
                    <>
                      <Slider title="亮度" value={brightness} min={0} max={200} step={1} suffix="%" onChange={setBrightness} />
                      <Slider title="对比度" value={contrast} min={0} max={200} step={1} suffix="%" onChange={setContrast} />
                      <Slider title="饱和度" value={saturation} min={0} max={200} step={1} suffix="%" onChange={setSaturation} />
                      <Slider title="色相旋转" value={hueRotate} min={-180} max={180} step={1} suffix="°" onChange={setHueRotate} />
                      <button
                        onClick={applyReferenceStyle}
                        className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold shadow-md hover:shadow-orange-500/40 transition-all flex items-center justify-center gap-2"
                      >
                        🖌️ 应用参考图风格
                      </button>
                    </>
                  )}
                </div>
              </Collapse>

              <Collapse title="🖼️ 背景形状" defaultOpen>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <button
                      onClick={() => setBgShape("square")}
                      className={`flex-1 py-2 rounded-xl transition-all ${
                        bgShape === "square"
                          ? "bg-cyan-500/30 text-white shadow"
                          : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      正方形
                    </button>
                    <button
                      onClick={() => setBgShape("rounded")}
                      className={`flex-1 py-2 rounded-xl transition-all ${
                        bgShape === "rounded"
                          ? "bg-cyan-500/30 text-white shadow"
                          : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      圆角
                    </button>
                  </div>
                </div>
              </Collapse>

              <Collapse title="📐 导出清晰度" defaultOpen>
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-2">
                    {([1,2,3,4,5,6,7,8] as const).map((scale) => (
                      <button
                        key={scale}
                        onClick={() => setExportScale(scale)}
                        className={`py-2 rounded-xl transition-all ${
                          exportScale === scale
                            ? "bg-cyan-500/30 text-white shadow"
                            : "text-white/40 hover:text-white/70"
                        }`}
                      >
                        {scale}x
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-white/40">选择导出图片的清晰度倍率（PNG 无损格式）。注意：高倍率会显著增加图片尺寸和内存占用。</p>
                </div>
              </Collapse>

              <button onClick={exportImage} className="w-full mt-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold shadow-lg hover:shadow-cyan-500/25 transition-all transform hover:scale-[1.02]">
                导出图片 ({exportScale}x)
              </button>
              <p className="text-center text-white/30 text-xs pb-4">基于 Canvas 直接合成，支持色调匹配与倍率缩放</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 主应用组件：控制启动流程
export default function App() {
  const [appState, setAppState] = useState<"loading" | "templateSelect" | "editor">("loading");

  useEffect(() => {
    // 模拟加载资源（例如预加载图片、字体等）
    const timer = setTimeout(() => {
      setAppState("templateSelect");
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleSelectTemplate = (templateId: string) => {
    if (templateId === "shadow-border") {
      setAppState("editor");
    } else {
      // 其他模板暂未实现，可提示
      alert("该模板正在开发中");
    }
  };

  if (appState === "loading") {
    return <LoadingScreen />;
  }

  if (appState === "templateSelect") {
    return <TemplateSelect onSelectTemplate={handleSelectTemplate} />;
  }

  return <Editor />;
}