// src/pages/HasselbladPage.tsx
import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { useNavigate } from "react-router-dom";
import JSZip from "jszip";
import exifr from "exifr";
import Konva from "konva";
import { Stage, Layer, Rect, Image as KonvaImage, Text } from "react-konva";
import { TitleBar, Collapse, Slider, Toggle, ExportScaleSelector } from "../components";
import { useColorMatch, useParameterPersistence, useUndoRedo } from "../hooks";
import { loadImage, applyBlurToImage } from "../utils/imageHelpers";
import { captureVideoFrame } from "../utils/videoUtils";
import { downloadCanvasAsPNG } from "../utils/exportHelpers";

// ---------- 工具函数 ----------
function measureParamBoxSize(text: string, fontSize: number): { width: number; height: number } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${fontSize}px monospace`;
  const lines = text.split("\n");
  let maxWidth = 0;
  for (const line of lines) {
    const w = ctx.measureText(line).width;
    if (w > maxWidth) maxWidth = w;
  }
  const padding = 12;
  return {
    width: maxWidth + padding * 2,
    height: lines.length * fontSize * 1.6 + padding * 2,
  };
}

// ---------- 参数接口 ----------
interface HasselbladParams {
  blur: number;
  shadow: number;
  photoMargin: number;
  coldIntensity: number;
  brandText: string;
  brandSize: number;
  brandX: number;
  brandY: number;
  showBrand: boolean;
  cameraInfo: string;
  paramSize: number;
  paramX: number;
  paramY: number;
  showParamBg: boolean;
  showParamBorder: boolean;
  paramBorderWidth: number;
  colorMatchEnabled: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  hueRotate: number;
  exportScale: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  previewScale: number;
}

interface BatchImage {
  file: File;
  dataUrl: string;
  cameraInfo: string;
  brandText: string;
}

// ---------- Konva 预览组件（正确使用 forwardRef）----------
interface KonvaPreviewRef {
  exportAsImage: (scale: number) => Promise<string>;
}

interface KonvaPreviewProps {
  width: number;
  height: number;
  params: HasselbladParams;
  imageUrl: string | null;
  videoElement?: HTMLVideoElement | null;
  brandText: string;
  cameraInfo: string;
  onBrandDrag: (xPercent: number, yPercent: number) => void;
  onParamDrag: (xPercent: number, yPercent: number) => void;
}

const KonvaPreview = forwardRef<KonvaPreviewRef, KonvaPreviewProps>((props, ref) => {
  const { width, height, params, imageUrl, videoElement, brandText, cameraInfo, onBrandDrag, onParamDrag } = props;
  const stageRef = useRef<Konva.Stage>(null);
  const [bgBlurImage, setBgBlurImage] = useState<HTMLImageElement | null>(null);
  const [mainImage, setMainImage] = useState<HTMLImageElement | null>(null);
  const [videoImage, setVideoImage] = useState<HTMLVideoElement | null>(null);
  const animationRef = useRef<number>();

  // 生成模糊背景
  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    applyBlurToImage(imageUrl, params.blur).then((blurDataUrl) => {
      if (cancelled) return;
      const img = new Image();
      img.onload = () => setBgBlurImage(img);
      img.src = blurDataUrl;
    }).catch(err => console.error("Failed to generate blur background:", err));
    return () => { cancelled = true; };
  }, [imageUrl, params.blur]);

  // 加载主图
  useEffect(() => {
    if (!imageUrl || videoElement) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setMainImage(img);
    img.onerror = (err) => console.error("Failed to load main image:", err);
    img.src = imageUrl;
  }, [imageUrl, videoElement]);

  // 视频刷新
  useEffect(() => {
    if (!videoElement) {
      setVideoImage(null);
      return;
    }
    setVideoImage(videoElement);
    const updateFrame = () => {
      if (videoElement && !videoElement.paused && !videoElement.ended) {
        stageRef.current?.batchDraw();
        animationRef.current = requestAnimationFrame(updateFrame);
      }
    };
    const onPlay = () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = requestAnimationFrame(updateFrame);
    };
    const onPauseOrEnd = () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      stageRef.current?.batchDraw();
    };
    videoElement.addEventListener("play", onPlay);
    videoElement.addEventListener("pause", onPauseOrEnd);
    videoElement.addEventListener("ended", onPauseOrEnd);
    return () => {
      videoElement.removeEventListener("play", onPlay);
      videoElement.removeEventListener("pause", onPauseOrEnd);
      videoElement.removeEventListener("ended", onPauseOrEnd);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [videoElement]);

  // 导出图片
  const exportAsImage = useCallback(async (scale: number) => {
    if (!stageRef.current) return "";
    return stageRef.current.toDataURL({ pixelRatio: scale, mimeType: "image/png" });
  }, []);

  useImperativeHandle(ref, () => ({ exportAsImage }));

  // 布局常量
  const leftParamAreaWidth = 160;
  const photoX = leftParamAreaWidth + params.photoMargin;
  const photoY = params.photoMargin;
  const photoW = width - photoX - params.photoMargin;
  const photoH = height - params.photoMargin * 2;

  // 品牌位置（百分比转像素，Y 轴：0% 为底部 → 像素 Y = (100 - Y%) * height）
  const brandXpx = (params.brandX / 100) * width;
  const brandYpx = ((100 - params.brandY) / 100) * height;

  // 参数框位置（百分比转像素，Y 轴同样使用底部百分比）
  let paramXpx = (params.paramX / 100) * width;
  let paramYpx = ((100 - params.paramY) / 100) * height;

  // 获取参数框实际尺寸并限制位置不超出照片左边缘和底部
  const { width: boxWidth, height: boxHeight } = measureParamBoxSize(cameraInfo, params.paramSize);
  const maxLeftX = Math.max(0, photoX - boxWidth);
  const finalParamX = Math.min(maxLeftX, Math.max(0, paramXpx));
  const finalParamY = Math.min(height - boxHeight, Math.max(0, paramYpx));

  // 色调匹配滤镜值
  const brightnessVal = params.colorMatchEnabled ? params.brightness / 100 : 1;
  const contrastVal = params.colorMatchEnabled ? params.contrast / 100 : 1;
  const saturationVal = params.colorMatchEnabled ? params.saturation / 100 : 1;
  const hueVal = params.colorMatchEnabled ? params.hueRotate : 0;

  return (
    <Stage ref={stageRef} width={width} height={height} style={{ backgroundColor: "transparent" }}>
      <Layer>
        {/* 背景模糊层 */}
        {bgBlurImage && (
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fillPatternImage={bgBlurImage}
            fillPatternX={0}
            fillPatternY={0}
            fillPatternScaleX={width / bgBlurImage.width}
            fillPatternScaleY={height / bgBlurImage.height}
          />
        )}
        {/* 冷色调背景叠加 */}
        {params.coldIntensity > 0 && (
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill={`rgba(100, 150, 255, ${params.coldIntensity / 100 * 0.3})`}
          />
        )}
        {/* 主照片阴影背景（黑色） */}
        <Rect
          x={photoX}
          y={photoY}
          width={photoW}
          height={photoH}
          shadowColor="rgba(0,0,0,0.6)"
          shadowBlur={params.shadow}
          shadowOffsetX={0}
          shadowOffsetY={0}
          fill="#000000"
        />
        {/* 主照片内容 */}
        {mainImage && !videoElement && (
          <KonvaImage
            image={mainImage}
            x={photoX}
            y={photoY}
            width={photoW}
            height={photoH}
            filters={[Konva.Filters.Brightness, Konva.Filters.Contrast, Konva.Filters.HSL]}
            brightness={brightnessVal}
            contrast={contrastVal}
            saturation={saturationVal}
            hue={hueVal}
          />
        )}
        {videoImage && (
          <KonvaImage
            image={videoImage}
            x={photoX}
            y={photoY}
            width={photoW}
            height={photoH}
            filters={[Konva.Filters.Brightness, Konva.Filters.Contrast, Konva.Filters.HSL]}
            brightness={brightnessVal}
            contrast={contrastVal}
            saturation={saturationVal}
            hue={hueVal}
          />
        )}
        {/* 冷色调叠加照片区域 */}
        {params.coldIntensity > 0 && (
          <Rect
            x={photoX}
            y={photoY}
            width={photoW}
            height={photoH}
            fill={`rgba(100, 150, 255, ${params.coldIntensity / 100 * 0.3})`}
          />
        )}
        {/* 摄影参数框（背景和边框） */}
        {params.showBrand && (
          <>
            {params.showParamBg && (
              <Rect
                x={finalParamX}
                y={finalParamY}
                width={boxWidth}
                height={boxHeight}
                fill="rgba(0,0,0,0.3)"
                cornerRadius={8}
              />
            )}
            {params.showParamBorder && (
              <Rect
                x={finalParamX}
                y={finalParamY}
                width={boxWidth}
                height={boxHeight}
                stroke="rgba(255,255,255,0.5)"
                strokeWidth={params.paramBorderWidth}
                cornerRadius={8}
              />
            )}
            <Text
              text={cameraInfo}
              x={finalParamX + 12}
              y={finalParamY + 12}
              fontSize={params.paramSize}
              fontFamily="monospace"
              fill="rgba(255,255,255,0.9)"
              align="left"
              verticalAlign="top"
              draggable
              onDragEnd={(e) => {
                // 拖拽时 Text 的坐标是包括偏移量的，我们需要减去内部偏移得到参数框的左上角坐标
                const newBoxX = e.target.x() - 12;
                const newBoxY = e.target.y() - 12;
                const newXPercent = (newBoxX / width) * 100;
                const newYPercent = 100 - (newBoxY / height) * 100;
                onParamDrag(newXPercent, newYPercent);
              }}
            />
          </>
        )}
        {/* 品牌标识 */}
        {params.showBrand && (
          <Text
            text={brandText}
            x={brandXpx}
            y={brandYpx}
            fontSize={params.brandSize}
            fontFamily="Helvetica Neue, sans-serif"
            fill="white"
            shadowColor="rgba(0,0,0,0.3)"
            shadowBlur={15}
            align="center"
            verticalAlign="middle"
            draggable
            onDragEnd={(e) => {
              const newX = e.target.x();
              const newY = e.target.y();
              const newXPercent = (newX / width) * 100;
              const newYPercent = 100 - (newY / height) * 100;
              onBrandDrag(newXPercent, newYPercent);
            }}
          />
        )}
      </Layer>
    </Stage>
  );
});

// ---------- 主组件 ----------
export function HasselbladPage() {
  const navigate = useNavigate();
  const previewRef = useRef<KonvaPreviewRef>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const singleFileRef = useRef<File | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [singleImage, setSingleImage] = useState(
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1600&auto=format&fit=crop"
  );
  const [video, setVideo] = useState("https://www.w3schools.com/html/mov_bbb.mp4");
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);

  const [batchImages, setBatchImages] = useState<BatchImage[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [isBatchMode, setIsBatchMode] = useState(false);

  const colorMatch = useColorMatch();

  const initialParams: HasselbladParams = {
    blur: 28,
    shadow: 43,
    photoMargin: 60,
    coldIntensity: 0,
    brandText: "HASSELBLAD",
    brandSize: 24,
    brandX: 5,
    brandY: 57.9,
    showBrand: true,
    cameraInfo: "F2.8 ISO 400\n1/125",
    paramSize: 14,
    paramX: 4.5,
    paramY: 54.6,
    showParamBg: true,
    showParamBorder: false,
    paramBorderWidth: 1,
    colorMatchEnabled: colorMatch.enabled,
    brightness: colorMatch.brightness,
    contrast: colorMatch.contrast,
    saturation: colorMatch.saturation,
    hueRotate: colorMatch.hueRotate,
    exportScale: 2,
    previewScale: 1,
  };

  const { state: params, setValue: setParams, undo, redo, canUndo, canRedo, resetHistory } =
    useUndoRedo<HasselbladParams>(initialParams);

  const updateParam = useCallback(<K extends keyof HasselbladParams>(key: K, value: HasselbladParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, [setParams]);

  useEffect(() => {
    updateParam("colorMatchEnabled", colorMatch.enabled);
    updateParam("brightness", colorMatch.brightness);
    updateParam("contrast", colorMatch.contrast);
    updateParam("saturation", colorMatch.saturation);
    updateParam("hueRotate", colorMatch.hueRotate);
  }, [colorMatch.enabled, colorMatch.brightness, colorMatch.contrast, colorMatch.saturation, colorMatch.hueRotate]);

  const { loadSaved, exportToFile, importFromFile } = useParameterPersistence<HasselbladParams>(
    "hasselblad-params",
    params,
    (loaded) => {
      resetHistory(loaded);
      colorMatch.setEnabled(loaded.colorMatchEnabled);
      colorMatch.setBrightness(loaded.brightness);
      colorMatch.setContrast(loaded.contrast);
      colorMatch.setSaturation(loaded.saturation);
      colorMatch.setHueRotate(loaded.hueRotate);
    }
  );

  useEffect(() => {
    loadSaved();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "z") { e.preventDefault(); undo(); }
      else if (e.ctrlKey && (e.key === "y" || (e.shiftKey && e.key === "Z"))) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  const getCurrentImageUrl = useCallback(() => {
    if (isBatchMode && batchImages[currentBatchIndex]) return batchImages[currentBatchIndex].dataUrl;
    if (mediaType === "image") return singleImage;
    return null;
  }, [isBatchMode, batchImages, currentBatchIndex, mediaType, singleImage]);

  // 预览容器尺寸，初始给一个非零值
  const [previewSize, setPreviewSize] = useState({ width: 800, height: 500 });
  const [imageAspect, setImageAspect] = useState(16 / 10);
  useEffect(() => {
    const url = getCurrentImageUrl();
    if (url) {
      const img = new Image();
      img.onload = () => setImageAspect(img.width / img.height);
      img.src = url;
    }
  }, [getCurrentImageUrl]);

  useEffect(() => {
    const containerWidth = Math.min(1200, window.innerWidth * 0.6);
    setPreviewSize({ width: containerWidth, height: containerWidth / imageAspect });
  }, [imageAspect]);

  const currentBrandText = isBatchMode && batchImages[currentBatchIndex]
    ? batchImages[currentBatchIndex].brandText
    : params.brandText;
  const currentCameraInfo = isBatchMode && batchImages[currentBatchIndex]
    ? batchImages[currentBatchIndex].cameraInfo
    : params.cameraInfo;

  const detectFromExif = async () => {
    if (mediaType === "video") {
      alert("视频模式暂不支持 EXIF 识别。请切换到图片模式。");
      return;
    }
    let file: File | null = null;
    if (isBatchMode && batchImages[currentBatchIndex]) {
      file = batchImages[currentBatchIndex].file;
    } else {
      file = singleFileRef.current || fileInputRef.current?.files?.[0] || null;
    }
    if (!file || !file.type.startsWith("image")) {
      alert("请先上传本地图片文件。");
      return;
    }
    try {
      const exifData = await exifr.parse(file);
      if (!exifData) { alert("未找到 EXIF 信息"); return; }
      let brand = "";
      if (exifData.Make) {
        brand = exifData.Make.toUpperCase();
        if (brand === "NIKON CORPORATION") brand = "NIKON";
        if (brand === "CANON") brand = "CANON";
        if (brand === "SONY") brand = "SONY";
        if (brand === "FUJIFILM") brand = "FUJIFILM";
      }
      const fNumber = exifData.FNumber ? `F${exifData.FNumber}` : "";
      let shutter = "";
      if (exifData.ExposureTime) {
        const et = exifData.ExposureTime;
        if (et < 1) shutter = `1/${Math.round(1 / et)}`;
        else shutter = `${et}`;
      }
      const iso = exifData.ISO ? `ISO ${exifData.ISO}` : "";
      const paramParts = [fNumber, shutter, iso].filter(p => p !== "");
      const exifParams = paramParts.join("\n");
      if (isBatchMode && batchImages[currentBatchIndex]) {
        setBatchImages(prev =>
          prev.map((img, idx) =>
            idx === currentBatchIndex
              ? { ...img, brandText: brand || img.brandText, cameraInfo: exifParams || img.cameraInfo }
              : img
          )
        );
      } else {
        if (brand) updateParam("brandText", brand);
        if (exifParams) updateParam("cameraInfo", exifParams);
        else alert("未提取到有用的摄影参数。");
      }
    } catch (err) {
      console.error(err);
      alert("解析 EXIF 失败");
    }
  };

  const handleSingleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    singleFileRef.current = file;
    const reader = new FileReader();
    reader.onload = () => {
      setSingleImage(reader.result as string);
      setIsBatchMode(false);
      setMediaType("image");
    };
    reader.readAsDataURL(file);
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setVideo(reader.result as string);
      setMediaType("video");
      setIsBatchMode(false);
      if (videoRef.current) videoRef.current.load();
    };
    reader.readAsDataURL(file);
  };

  const handleBatchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const readers = files.map(file => new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    }));
    Promise.all(readers).then(dataUrls => {
      const newBatch: BatchImage[] = files.map((file, idx) => ({
        file,
        dataUrl: dataUrls[idx],
        cameraInfo: params.cameraInfo,
        brandText: params.brandText,
      }));
      setBatchImages(newBatch);
      setCurrentBatchIndex(0);
      setIsBatchMode(true);
      setMediaType("image");
    });
  };

  const exitBatchMode = () => {
    setIsBatchMode(false);
    setBatchImages([]);
    setCurrentBatchIndex(0);
  };

  const toggleVideoPlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isVideoPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsVideoPlaying(!isVideoPlaying);
  }, [isVideoPlaying]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const onPlay = () => setIsVideoPlaying(true);
    const onPause = () => setIsVideoPlaying(false);
    videoEl.addEventListener("play", onPlay);
    videoEl.addEventListener("pause", onPause);
    return () => {
      videoEl.removeEventListener("play", onPlay);
      videoEl.removeEventListener("pause", onPause);
    };
  }, [videoRef.current]);

  // 离线渲染函数（用于批量导出，复用 Konva 绘制逻辑）
  const renderWithKonva = async (
    imageUrl: string,
    brandText: string,
    cameraInfo: string,
    params: HasselbladParams,
    width: number,
    height: number
  ): Promise<HTMLCanvasElement> => {
    const img = await loadImage(imageUrl);
    const bgBlurDataUrl = await applyBlurToImage(imageUrl, params.blur);
    const bgImg = await loadImage(bgBlurDataUrl);

    const stage = new Konva.Stage({ width, height, container: document.createElement("div") });
    const layer = new Konva.Layer();
    stage.add(layer);

    // 背景模糊
    const bgRect = new Konva.Rect({
      x: 0, y: 0, width, height,
      fillPatternImage: bgImg,
      fillPatternScaleX: width / bgImg.width,
      fillPatternScaleY: height / bgImg.height,
    });
    layer.add(bgRect);

    // 冷色调背景
    if (params.coldIntensity > 0) {
      const coldRect = new Konva.Rect({
        x: 0, y: 0, width, height,
        fill: `rgba(100, 150, 255, ${params.coldIntensity / 100 * 0.3})`,
      });
      layer.add(coldRect);
    }

    const leftParamAreaWidth = 160;
    const photoX = leftParamAreaWidth + params.photoMargin;
    const photoY = params.photoMargin;
    const photoW = width - photoX - params.photoMargin;
    const photoH = height - params.photoMargin * 2;

    // 主照片阴影
    const shadowRect = new Konva.Rect({
      x: photoX, y: photoY, width: photoW, height: photoH,
      shadowColor: "rgba(0,0,0,0.6)",
      shadowBlur: params.shadow,
      fill: "#000000",
    });
    layer.add(shadowRect);

    // 主照片
    const mainImage = new Konva.Image({
      image: img,
      x: photoX, y: photoY, width: photoW, height: photoH,
    });
    if (params.colorMatchEnabled) {
      mainImage.cache();
      mainImage.filters([Konva.Filters.Brightness, Konva.Filters.Contrast, Konva.Filters.HSL]);
      mainImage.brightness(params.brightness / 100);
      mainImage.contrast(params.contrast / 100);
      mainImage.saturation(params.saturation / 100);
      mainImage.hue(params.hueRotate);
    }
    layer.add(mainImage);

    // 冷色调叠加照片
    if (params.coldIntensity > 0) {
      const coldPhotoRect = new Konva.Rect({
        x: photoX, y: photoY, width: photoW, height: photoH,
        fill: `rgba(100, 150, 255, ${params.coldIntensity / 100 * 0.3})`,
      });
      layer.add(coldPhotoRect);
    }

    // 参数框
    if (params.showBrand) {
      const { width: boxWidth, height: boxHeight } = measureParamBoxSize(cameraInfo, params.paramSize);
      let paramXpx = (params.paramX / 100) * width;
      let paramYpx = ((100 - params.paramY) / 100) * height;
      const maxLeftX = Math.max(0, photoX - boxWidth);
      const finalX = Math.min(maxLeftX, Math.max(0, paramXpx));
      const finalY = Math.min(height - boxHeight, Math.max(0, paramYpx));
      if (params.showParamBg) {
        const bgBox = new Konva.Rect({ x: finalX, y: finalY, width: boxWidth, height: boxHeight, fill: "rgba(0,0,0,0.3)", cornerRadius: 8 });
        layer.add(bgBox);
      }
      if (params.showParamBorder) {
        const borderBox = new Konva.Rect({ x: finalX, y: finalY, width: boxWidth, height: boxHeight, stroke: "rgba(255,255,255,0.5)", strokeWidth: params.paramBorderWidth, cornerRadius: 8 });
        layer.add(borderBox);
      }
      const paramText = new Konva.Text({
        text: cameraInfo,
        x: finalX + 12,
        y: finalY + 12,
        fontSize: params.paramSize,
        fontFamily: "monospace",
        fill: "rgba(255,255,255,0.9)",
        align: "left",
        verticalAlign: "top",
      });
      layer.add(paramText);
    }

    // 品牌标识
    if (params.showBrand) {
      const brandXpx = (params.brandX / 100) * width;
      const brandYpx = ((100 - params.brandY) / 100) * height;
      const brandTextNode = new Konva.Text({
        text: brandText,
        x: brandXpx,
        y: brandYpx,
        fontSize: params.brandSize,
        fontFamily: "Helvetica Neue, sans-serif",
        fill: "white",
        shadowColor: "rgba(0,0,0,0.3)",
        shadowBlur: 15,
        align: "center",
        verticalAlign: "middle",
      });
      layer.add(brandTextNode);
    }

    layer.draw();
    const canvas = stage.toCanvas({ pixelRatio: params.exportScale });
    stage.destroy();
    return canvas;
  };

  const exportSingle = async () => {
    if (!previewRef.current) return;
    const dataURL = await previewRef.current.exportAsImage(params.exportScale);
    if (dataURL) {
      const link = document.createElement("a");
      link.download = `hasselblad-frame-${params.exportScale}x.png`;
      link.href = dataURL;
      link.click();
    }
  };

  const exportBatchToZip = async () => {
    if (!isBatchMode || batchImages.length === 0) return;
    setIsExporting(true);
    const zip = new JSZip();
    try {
      for (let i = 0; i < batchImages.length; i++) {
        const item = batchImages[i];
        const canvas = await renderWithKonva(
          item.dataUrl,
          item.brandText,
          item.cameraInfo,
          params,
          previewSize.width,
          previewSize.height
        );
        const blob = await new Promise<Blob>(resolve => canvas.toBlob(resolve, "image/png"));
        zip.file(`hasselblad_${i + 1}.png`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hasselblad_batch_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("批量导出失败");
    } finally {
      setIsExporting(false);
    }
  };

  const handleBrandDrag = (xPercent: number, yPercent: number) => {
    updateParam("brandX", Math.min(100, Math.max(0, xPercent)));
    updateParam("brandY", Math.min(100, Math.max(0, yPercent)));
  };

  const handleParamDrag = (xPercent: number, yPercent: number) => {
    updateParam("paramX", Math.min(100, Math.max(0, xPercent)));
    updateParam("paramY", Math.min(100, Math.max(0, yPercent)));
  };

  return (
    <div className="h-screen w-screen bg-transparent overflow-hidden">
      <div className="h-full w-full bg-[#1a1a2e] flex flex-col relative">
        <TitleBar showBackButton onBack={() => navigate("/templates")} title="HASSELBLAD" />

        <div className="flex-1 overflow-hidden editor-layout h-full">
          {/* 左侧预览区 */}
          <div className="editor-preview-area relative flex items-center justify-center p-4 lg:p-6 overflow-auto">
            <div
              style={{
                transform: `scale(${params.previewScale})`,
                transformOrigin: "center center",
              }}
            >
              <KonvaPreview
                ref={previewRef}
                width={previewSize.width}
                height={previewSize.height}
                params={params}
                imageUrl={getCurrentImageUrl()}
                videoElement={mediaType === "video" ? videoRef.current : null}
                brandText={currentBrandText}
                cameraInfo={currentCameraInfo}
                onBrandDrag={handleBrandDrag}
                onParamDrag={handleParamDrag}
              />
            </div>
          </div>

          {/* 右侧控制面板 */}
          <div className="editor-control-panel overflow-y-auto border-l border-white/10 bg-white/[0.03] backdrop-blur-2xl p-4 lg:p-6 scrollbar-thin scrollbar-thumb-white/10">
            <div className="flex gap-2 mb-4">
              <button onClick={undo} disabled={!canUndo} className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-30">↶ 撤销 (Ctrl+Z)</button>
              <button onClick={redo} disabled={!canRedo} className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-30">↷ 重做 (Ctrl+Y)</button>
            </div>

            <div className="flex gap-2 mb-6 bg-white/5 p-1 rounded-2xl">
              <button onClick={() => { setMediaType("image"); setIsBatchMode(false); }} className={`flex-1 py-2 rounded-xl transition-all ${mediaType === "image" && !isBatchMode ? "bg-cyan-500/30 text-white shadow" : "text-white/40 hover:text-white/70"}`}>图片模式</button>
              <button onClick={() => { setMediaType("video"); setIsBatchMode(false); }} className={`flex-1 py-2 rounded-xl transition-all ${mediaType === "video" && !isBatchMode ? "bg-cyan-500/30 text-white shadow" : "text-white/40 hover:text-white/70"}`}>视频模式</button>
            </div>

            <div className="space-y-4 mb-6">
              {mediaType === "image" && !isBatchMode && (
                <div className="flex gap-2">
                  <label className="flex-1 py-3 rounded-xl bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 font-medium text-center cursor-pointer hover:bg-cyan-500/30">
                    📸 上传单张图片
                    <input type="file" accept="image/*" onChange={handleSingleImageUpload} className="hidden" />
                  </label>
                  <label className="flex-1 py-3 rounded-xl bg-green-500/20 border border-green-400/30 text-green-300 font-medium text-center cursor-pointer hover:bg-green-500/30">
                    🗂️ 批量上传图片
                    <input type="file" multiple accept="image/*" onChange={handleBatchUpload} className="hidden" />
                  </label>
                </div>
              )}
              {mediaType === "video" && !isBatchMode && (
                <div className="flex gap-2">
                  <label className="flex-1 py-3 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-300 font-medium text-center cursor-pointer hover:bg-purple-500/30">
                    🎥 上传视频
                    <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
                  </label>
                  {video && (
                    <button onClick={toggleVideoPlay} className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all">
                      {isVideoPlaying ? "⏸️ 暂停" : "▶️ 播放"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {isBatchMode && (
              <div className="mb-4 p-3 bg-white/10 rounded-lg flex justify-between items-center">
                <span className="text-white/80 text-sm">批量模式: {batchImages.length} 张图片</span>
                <button onClick={exitBatchMode} className="text-red-300 text-xs">退出批量</button>
              </div>
            )}
            {isBatchMode && batchImages.length > 1 && (
              <div className="flex justify-center gap-4 mb-4">
                <button onClick={() => setCurrentBatchIndex(p => Math.max(0, p - 1))} disabled={currentBatchIndex === 0} className="px-4 py-1 rounded bg-white/10 text-white disabled:opacity-30">◀ 上一张</button>
                <span className="text-white">{currentBatchIndex + 1} / {batchImages.length}</span>
                <button onClick={() => setCurrentBatchIndex(p => Math.min(batchImages.length - 1, p + 1))} disabled={currentBatchIndex === batchImages.length - 1} className="px-4 py-1 rounded bg-white/10 text-white disabled:opacity-30">下一张 ▶</button>
              </div>
            )}

            <div className="space-y-6">
              <Collapse title="🎨 视觉光效" defaultOpen>
                <div className="space-y-5">
                  <Slider title="背景模糊强度" value={params.blur} min={0} max={50} step={1} suffix="px" onChange={v => updateParam("blur", v)} />
                  <Slider title="照片外扩阴影" value={params.shadow} min={0} max={80} step={1} suffix="px" onChange={v => updateParam("shadow", v)} />
                  <Slider title="照片边距" value={params.photoMargin} min={20} max={120} step={1} suffix="px" onChange={v => updateParam("photoMargin", v)} />
                  <Slider title="冷色调强度" value={params.coldIntensity} min={0} max={100} step={1} suffix="%" onChange={v => updateParam("coldIntensity", v)} />
                </div>
              </Collapse>

              <Collapse title="🏷️ 品牌标识" defaultOpen>
                <div className="space-y-5">
                  <Toggle label="显示品牌标识" enabled={params.showBrand} onChange={v => updateParam("showBrand", v)} />
                  {params.showBrand && (
                    <>
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-white/80">品牌文字</label>
                        <button onClick={detectFromExif} className="px-3 py-1 rounded-lg bg-green-500/20 text-green-300 text-xs">🔍 一键识别</button>
                      </div>
                      <input
                        type="text"
                        value={currentBrandText}
                        onChange={e => {
                          const val = e.target.value;
                          if (isBatchMode && batchImages[currentBatchIndex]) {
                            setBatchImages(prev => prev.map((img, idx) => idx === currentBatchIndex ? { ...img, brandText: val } : img));
                          } else {
                            updateParam("brandText", val);
                          }
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                      />
                      <Slider title="文字大小" value={params.brandSize} min={16} max={72} step={1} suffix="px" onChange={v => updateParam("brandSize", v)} />
                      <Slider title="X 位置 (%)" value={params.brandX} min={0} max={100} step={0.5} suffix="%" onChange={v => updateParam("brandX", v)} />
                      <Slider title="Y 位置 (%)" value={params.brandY} min={0} max={100} step={0.5} suffix="%" onChange={v => updateParam("brandY", v)} />
                      <p className="text-xs text-white/40">0% = 底部，100% = 顶部。可拖拽水印调整位置。</p>
                    </>
                  )}
                </div>
              </Collapse>

              <Collapse title="📷 摄影参数" defaultOpen>
                <div className="space-y-5">
                  <Toggle label="显示参数框" enabled={params.showBrand} onChange={v => updateParam("showBrand", v)} />
                  {params.showBrand && (
                    <>
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-white/80">参数内容 (支持换行)</label>
                        <button onClick={detectFromExif} className="px-3 py-1 rounded-lg bg-green-500/20 text-green-300 text-xs">🔍 一键识别</button>
                      </div>
                      <textarea
                        value={currentCameraInfo}
                        onChange={e => {
                          const val = e.target.value;
                          if (isBatchMode && batchImages[currentBatchIndex]) {
                            setBatchImages(prev => prev.map((img, idx) => idx === currentBatchIndex ? { ...img, cameraInfo: val } : img));
                          } else {
                            updateParam("cameraInfo", val);
                          }
                        }}
                        rows={4}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-sm"
                        placeholder="F2.8&#10;ISO 400&#10;1/125"
                      />
                      <Toggle label="显示参数背景" enabled={params.showParamBg} onChange={v => updateParam("showParamBg", v)} />
                      <Toggle label="显示参数边框" enabled={params.showParamBorder} onChange={v => updateParam("showParamBorder", v)} />
                      <Slider title="边框粗细" value={params.paramBorderWidth} min={1} max={6} step={1} suffix="px" onChange={v => updateParam("paramBorderWidth", v)} />
                      <Slider title="文字大小" value={params.paramSize} min={10} max={32} step={1} suffix="px" onChange={v => updateParam("paramSize", v)} />
                      <Slider title="X 位置 (%)" value={params.paramX} min={0} max={100} step={0.5} suffix="%" onChange={v => updateParam("paramX", v)} />
                      <Slider title="Y 位置 (%)" value={params.paramY} min={0} max={100} step={0.5} suffix="%" onChange={v => updateParam("paramY", v)} />
                      <p className="text-xs text-white/40">X 0% = 最左，100% = 最右（不超出照片左边缘）；Y 0% = 底部，100% = 顶部。可拖拽参数框调整位置。</p>
                    </>
                  )}
                </div>
              </Collapse>

              <Collapse title="🎨 色调匹配" defaultOpen>
                <div className="space-y-5">
                  <Toggle label="启用色调匹配" enabled={colorMatch.enabled} onChange={colorMatch.setEnabled} />
                  {colorMatch.enabled && (
                    <>
                      <Slider title="亮度" value={colorMatch.brightness} min={0} max={200} step={1} suffix="%" onChange={colorMatch.setBrightness} />
                      <Slider title="对比度" value={colorMatch.contrast} min={0} max={200} step={1} suffix="%" onChange={colorMatch.setContrast} />
                      <Slider title="饱和度" value={colorMatch.saturation} min={0} max={200} step={1} suffix="%" onChange={colorMatch.setSaturation} />
                      <Slider title="色相旋转" value={colorMatch.hueRotate} min={-180} max={180} step={1} suffix="°" onChange={colorMatch.setHueRotate} />
                      <button onClick={colorMatch.applyReferenceStyle} className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold">🖌️ 应用参考图风格</button>
                    </>
                  )}
                </div>
              </Collapse>

              <Collapse title="📐 导出与参数" defaultOpen>
                <div className="space-y-4">
                  <ExportScaleSelector value={params.exportScale} onChange={v => updateParam("exportScale", v)} />
                  <div className="flex gap-2 mt-2">
                    <button onClick={exportToFile} className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm">💾 导出参数</button>
                    <label className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm text-center cursor-pointer">
                      📂 导入参数
                      <input type="file" accept=".json" onChange={e => { if (e.target.files?.[0]) importFromFile(e.target.files[0], () => alert("参数导入成功")); }} className="hidden" />
                    </label>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={exportSingle} className="flex-1 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold">导出单张</button>
                    {isBatchMode && (
                      <button onClick={exportBatchToZip} className="flex-1 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold">导出全部为ZIP</button>
                    )}
                  </div>
                  {isExporting && <div className="text-center text-white/50 text-sm mt-2">导出中...</div>}
                </div>
              </Collapse>

              <Collapse title="🔍 预览缩放" defaultOpen>
                <div className="space-y-4">
                  <Slider title="视觉缩放比例" value={params.previewScale} min={0.5} max={1.5} step={0.01} suffix="x" onChange={v => updateParam("previewScale", v)} />
                  <p className="text-xs text-white/40">预览缩放只影响显示大小，不影响导出图片质量。</p>
                </div>
              </Collapse>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}