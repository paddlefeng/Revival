// src/pages/EditorPage.tsx (Konva 重构版)
import { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import JSZip from "jszip";
import { Stage, Layer, Rect, Image as KonvaImage, Text } from "react-konva";
import Konva from "konva";
import { TitleBar, Collapse, Slider, Toggle, ExportScaleSelector } from "../components";
import { useColorMatch, useParameterPersistence, useUndoRedo } from "../hooks";
import { useResponsive } from "../hooks/useResponsive";
import { loadImage, applyBlurToImage } from "../utils/imageHelpers";
import { captureVideoFrame } from "../utils/videoUtils";
import { downloadCanvasAsPNG } from "../utils/exportHelpers";
import { extractBrandFromExif, extractCameraParams } from "../utils/exifUtils";

// 品牌配置（同原版）
const brandConfigs: Record<string, { logo: string; font: string }> = {
  vivo: { logo: "vivo", font: "font-black tracking-wide" },
  iPhone: { logo: "iPhone", font: "font-semibold tracking-[0.2em]" },
  HUAWEI: { logo: "HUAWEI", font: "font-bold tracking-[0.35em]" },
  Xiaomi: { logo: "Xiaomi", font: "font-bold tracking-[0.15em]" },
  OPPO: { logo: "OPPO", font: "font-bold tracking-[0.3em]" },
  Samsung: { logo: "SAMSUNG", font: "font-semibold tracking-[0.3em]" },
};

// ---------- 参数接口 ----------
interface EditorParams {
  blur: number;
  shadow: number;
  radius: number;
  padding: number;
  brandStyle: string;
  brandText: string;
  cameraInfo: string;
  showLogo: boolean;
  showCameraInfo: boolean;
  watermarkOnBackground: boolean;
  logoX: number;
  logoY: number;
  logoSize: number;
  textX: number;
  textY: number;
  textSize: number;
  bgShape: "square" | "rounded";
  glowColor: string;
  colorMatchEnabled: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  hueRotate: number;
  exportScale: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  imageFitCover: boolean;
  showParamBg: boolean;
  showParamBorder: boolean;
  previewScale: number;
}

interface BatchImage {
  file: File;
  dataUrl: string;
  cameraInfo: string;
  brandText: string;
}

// ---------- Konva 预览组件（内部使用，通过 ref 暴露导出方法）----------
interface KonvaPreviewRef {
  exportAsImage: (scale: number) => Promise<string>;
}

interface KonvaPreviewProps {
  width: number;
  height: number;
  params: EditorParams;
  imageUrl: string | null;
  videoElement?: HTMLVideoElement | null;
  onWatermarkDrag: (type: "logo" | "camera", xPercent: number, yPercent: number) => void;
}

const KonvaPreview = forwardRef<KonvaPreviewRef, KonvaPreviewProps>((props, ref) => {
  const { width, height, params, imageUrl, videoElement, onWatermarkDrag } = props;
  const stageRef = useRef<Konva.Stage>(null);
  const [bgBlurImage, setBgBlurImage] = useState<HTMLImageElement | null>(null);
  const [mainImage, setMainImage] = useState<HTMLImageElement | null>(null);
  const [videoImage, setVideoImage] = useState<HTMLVideoElement | null>(null);
  const animationRef = useRef<number>();

  // 生成模糊背景图
  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    applyBlurToImage(imageUrl, params.blur).then((blurDataUrl) => {
      if (cancelled) return;
      const img = new Image();
      img.onload = () => setBgBlurImage(img);
      img.src = blurDataUrl;
    });
    return () => { cancelled = true; };
  }, [imageUrl, params.blur]);

  // 加载主图片（图片模式）
  useEffect(() => {
    if (!imageUrl || videoElement) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setMainImage(img);
    img.src = imageUrl;
  }, [imageUrl, videoElement]);

  // 视频模式：绑定 video 元素并实时刷新
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
    const dataURL = stageRef.current.toDataURL({
      pixelRatio: scale,
      mimeType: "image/png",
    });
    return dataURL;
  }, []);

  useImperativeHandle(ref, () => ({ exportAsImage }));

  // 计算卡片区域
  const cardPadding = params.padding;
  const cardW = width - cardPadding * 2;
  const cardH = height - cardPadding * 2;
  const cardX = cardPadding;
  const cardY = cardPadding;

  // 背景模糊层缩放
  const bgScale = 1.15;
  const bgDrawW = width * bgScale;
  const bgDrawH = height * bgScale;
  const bgDrawX = (width - bgDrawW) / 2;
  const bgDrawY = (height - bgDrawH) / 2;

  // 水印位置（百分比转像素，Y 轴方向：0% 底部 → 像素 Y = (100 - Y%) * height）
  const logoXpx = (params.logoX / 100) * width;
  const logoYpx = ((100 - params.logoY) / 100) * height;
  const textXpx = (params.textX / 100) * width;
  const textYpx = ((100 - params.textY) / 100) * height;

  // 色调匹配滤镜
  const brightnessFilter = params.colorMatchEnabled ? params.brightness / 100 : 1;
  const contrastFilter = params.colorMatchEnabled ? params.contrast / 100 : 1;
  const saturationFilter = params.colorMatchEnabled ? params.saturation / 100 : 1;
  const hueFilter = params.colorMatchEnabled ? params.hueRotate : 0;

  // 主图片绘制区域计算（cover/contain）
  let mainImgX = cardX, mainImgY = cardY, mainImgW = cardW, mainImgH = cardH;
  if (!params.imageFitCover && mainImage) {
    const imgAspect = mainImage.width / mainImage.height;
    const cardAspect = cardW / cardH;
    if (imgAspect > cardAspect) {
      mainImgW = cardW;
      mainImgH = cardW / imgAspect;
      mainImgY = cardY + (cardH - mainImgH) / 2;
    } else {
      mainImgH = cardH;
      mainImgW = cardH * imgAspect;
      mainImgX = cardX + (cardW - mainImgW) / 2;
    }
  }

  return (
    <Stage ref={stageRef} width={width} height={height} style={{ backgroundColor: "transparent" }}>
      <Layer>
        {/* 1. 背景模糊层（带圆角裁剪） */}
        {bgBlurImage && (
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            cornerRadius={params.bgShape === "rounded" ? 48 : 0}
            fillPatternImage={bgBlurImage}
            fillPatternX={bgDrawX}
            fillPatternY={bgDrawY}
            fillPatternScaleX={bgDrawW / bgBlurImage.width}
            fillPatternScaleY={bgDrawH / bgBlurImage.height}
          />
        )}
        {/* 2. 卡片阴影背景（黑色 + 阴影） */}
        <Rect
          x={cardX}
          y={cardY}
          width={cardW}
          height={cardH}
          cornerRadius={params.radius}
          shadowColor="rgba(0,0,0,0.5)"
          shadowBlur={params.shadow * 1.5}
          shadowOffsetX={0}
          shadowOffsetY={params.shadow * 0.5}
          fill="#000000"
        />
        {/* 3. 卡片半透明层 */}
        <Rect
          x={cardX}
          y={cardY}
          width={cardW}
          height={cardH}
          cornerRadius={params.radius}
          fill="rgba(0,0,0,0.2)"
        />
        {/* 4. 主图片（图片或视频） */}
        {mainImage && !videoElement && (
          <KonvaImage
            image={mainImage}
            x={mainImgX}
            y={mainImgY}
            width={mainImgW}
            height={mainImgH}
            cornerRadius={params.radius}
            filters={[
              Konva.Filters.Brightness,
              Konva.Filters.Contrast,
              Konva.Filters.HSL,
            ]}
            brightness={brightnessFilter}
            contrast={contrastFilter}
            saturation={saturationFilter}
            hue={hueFilter}
          />
        )}
        {videoImage && (
          <KonvaImage
            image={videoImage}
            x={cardX}
            y={cardY}
            width={cardW}
            height={cardH}
            cornerRadius={params.radius}
            filters={[
              Konva.Filters.Brightness,
              Konva.Filters.Contrast,
              Konva.Filters.HSL,
            ]}
            brightness={brightnessFilter}
            contrast={contrastFilter}
            saturation={saturationFilter}
            hue={hueFilter}
          />
        )}
        {/* 5. 品牌水印 */}
        {params.showLogo && (
          <Text
            text={params.brandText}
            x={logoXpx}
            y={logoYpx}
            fontSize={params.logoSize}
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
              onWatermarkDrag("logo", newXPercent, newYPercent);
            }}
          />
        )}
        {/* 6. 相机参数水印 */}
        {params.showCameraInfo && (
          <Text
            text={params.cameraInfo}
            x={textXpx}
            y={textYpx}
            fontSize={params.textSize}
            fontFamily="monospace"
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
              onWatermarkDrag("camera", newXPercent, newYPercent);
            }}
          />
        )}
      </Layer>
    </Stage>
  );
});

// ---------- 主组件 EditorPage ----------
export function EditorPage() {
  const navigate = useNavigate();
  const responsive = useResponsive();
  const previewRef = useRef<KonvaPreviewRef>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const singleFileRef = useRef<File | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // 媒体模式与数据
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [singleImage, setSingleImage] = useState(
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1600&auto=format&fit=crop"
  );
  const [video, setVideo] = useState("https://www.w3schools.com/html/mov_bbb.mp4");
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);

  // 批量模式
  const [batchImages, setBatchImages] = useState<BatchImage[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [isBatchMode, setIsBatchMode] = useState(false);

  // 色调匹配 hook
  const colorMatch = useColorMatch();

  // 参数初始值
  const initialParams: EditorParams = {
    blur: 29,
    shadow: 120,
    radius: 58,
    padding: 113,
    brandStyle: "vivo",
    brandText: "vivo",
    cameraInfo: "24MM F1.8 1/250S ISO100",
    showLogo: true,
    showCameraInfo: true,
    watermarkOnBackground: true,
    logoX: 41,
    logoY: 5,
    logoSize: 37,
    textX: 58,
    textY: 4,
    textSize: 15,
    bgShape: "rounded",
    glowColor: "cyan-500",
    colorMatchEnabled: colorMatch.enabled,
    brightness: colorMatch.brightness,
    contrast: colorMatch.contrast,
    saturation: colorMatch.saturation,
    hueRotate: colorMatch.hueRotate,
    exportScale: 2,
    imageFitCover: true,
    showParamBg: false,
    showParamBorder: false,
    previewScale: 1,
  };

  const { state: params, setValue: setParams, undo, redo, canUndo, canRedo, resetHistory } =
    useUndoRedo<EditorParams>(initialParams);

  const updateParam = useCallback(<K extends keyof EditorParams>(key: K, value: EditorParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, [setParams]);

  // 同步色调匹配
  useEffect(() => {
    updateParam("colorMatchEnabled", colorMatch.enabled);
    updateParam("brightness", colorMatch.brightness);
    updateParam("contrast", colorMatch.contrast);
    updateParam("saturation", colorMatch.saturation);
    updateParam("hueRotate", colorMatch.hueRotate);
  }, [colorMatch.enabled, colorMatch.brightness, colorMatch.contrast, colorMatch.saturation, colorMatch.hueRotate]);

  // 参数持久化
  const { loadSaved, exportToFile, importFromFile } = useParameterPersistence<EditorParams>(
    "editor-params",
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

  // 撤销/重做快捷键
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

  // 预览容器宽高（动态根据图片比例计算）
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
    // 固定预览容器最大宽度 1000px，高度自适应
    const containerWidth = Math.min(1000, window.innerWidth * 0.6);
    setPreviewSize({ width: containerWidth, height: containerWidth / imageAspect });
  }, [imageAspect]);

  // 获取当前显示的品牌文字和参数（批量模式下独立）
  const currentBrandText = isBatchMode && batchImages[currentBatchIndex]
    ? batchImages[currentBatchIndex].brandText
    : params.brandText;
  const currentCameraInfo = isBatchMode && batchImages[currentBatchIndex]
    ? batchImages[currentBatchIndex].cameraInfo
    : params.cameraInfo;

  // EXIF 识别
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
    const brand = await extractBrandFromExif(file);
    const exifParams = await extractCameraParams(file, false);
    if (isBatchMode && batchImages[currentBatchIndex]) {
      setBatchImages(prev => prev.map((img, idx) => idx === currentBatchIndex ? {
        ...img,
        brandText: brand || img.brandText,
        cameraInfo: exifParams || img.cameraInfo,
      } : img));
    } else {
      if (brand) updateParam("brandText", brand);
      if (exifParams) updateParam("cameraInfo", exifParams);
      else alert("未提取到有用的摄影参数。");
    }
  };

  // 上传处理
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

  // 导出单张（使用 Konva 导出）
  const exportSingle = async () => {
    if (!previewRef.current) return;
    let imageUrl = getCurrentImageUrl();
    if (!imageUrl && mediaType === "video" && videoRef.current) {
      // 视频模式：先捕获当前帧，临时替换 imageUrl？但 Konva 预览已经使用 video 元素，导出时直接使用 stage 导出即可，无需额外处理
    }
    const dataURL = await previewRef.current.exportAsImage(params.exportScale);
    if (dataURL) {
      const link = document.createElement("a");
      link.download = `shadowcam-frame-${params.exportScale}x.png`;
      link.href = dataURL;
      link.click();
    }
  };

  // 批量导出 ZIP
  const exportBatchToZip = async () => {
    if (!isBatchMode || batchImages.length === 0) return;
    setIsExporting(true);
    const zip = new JSZip();
    try {
      for (let i = 0; i < batchImages.length; i++) {
        const item = batchImages[i];
        // 临时替换参数中的品牌文字和相机参数，以便 Konva 预览组件重新渲染（通过重新传递 params）
        // 但由于 KonvaPreview 组件接收 params 作为 prop，我们需要临时改变 params 并重新渲染？这会很复杂。
        // 替代方案：批量导出时，我们需要独立于当前预览，为每张图片单独创建一个隐藏的 Konva Stage 并导出。
        // 为了简化，这里暂时保留原有逻辑：调用旧的 renderShadowBorderToCanvas 或新写一个独立导出函数。
        // 考虑到时间，我暂时复用旧的导出函数（原版中有 renderShadowBorderToCanvas），但为了纯 Konva，我们可以创建一个离线渲染函数。
        // 为了代码简洁，我将在下面实现一个独立的 renderWithParams 函数。
        const canvas = await renderWithKonva(item.dataUrl, item.brandText, item.cameraInfo, params);
        const blob = await new Promise<Blob>(resolve => canvas.toBlob(resolve, "image/png"));
        zip.file(`shadowcam_${i + 1}.png`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shadowcam_batch_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("批量导出失败");
    } finally {
      setIsExporting(false);
    }
  };

  // 辅助函数：使用 Konva 离线渲染单张图片（用于批量导出）
  const renderWithKonva = async (
    imageUrl: string,
    brandText: string,
    cameraInfo: string,
    params: EditorParams
  ): Promise<HTMLCanvasElement> => {
    const containerWidth = previewSize.width;
    const containerHeight = previewSize.height;
    const stage = new Konva.Stage({
      width: containerWidth,
      height: containerHeight,
      container: document.createElement("div"),
    });
    const layer = new Konva.Layer();
    stage.add(layer);

    // 加载图片
    const img = await loadImage(imageUrl);
    const bgBlurDataUrl = await applyBlurToImage(imageUrl, params.blur);
    const bgImg = await loadImage(bgBlurDataUrl);

    const cardPadding = params.padding;
    const cardW = containerWidth - cardPadding * 2;
    const cardH = containerHeight - cardPadding * 2;
    const cardX = cardPadding;
    const cardY = cardPadding;

    const bgScale = 1.15;
    const bgDrawW = containerWidth * bgScale;
    const bgDrawH = containerHeight * bgScale;
    const bgDrawX = (containerWidth - bgDrawW) / 2;
    const bgDrawY = (containerHeight - bgDrawH) / 2;

    // 背景模糊层
    const bgRect = new Konva.Rect({
      x: 0,
      y: 0,
      width: containerWidth,
      height: containerHeight,
      cornerRadius: params.bgShape === "rounded" ? 48 : 0,
      fillPatternImage: bgImg,
      fillPatternX: bgDrawX,
      fillPatternY: bgDrawY,
      fillPatternScaleX: bgDrawW / bgImg.width,
      fillPatternScaleY: bgDrawH / bgImg.height,
    });
    layer.add(bgRect);

    // 卡片阴影背景
    const shadowRect = new Konva.Rect({
      x: cardX,
      y: cardY,
      width: cardW,
      height: cardH,
      cornerRadius: params.radius,
      shadowColor: "rgba(0,0,0,0.5)",
      shadowBlur: params.shadow * 1.5,
      shadowOffsetX: 0,
      shadowOffsetY: params.shadow * 0.5,
      fill: "#000000",
    });
    layer.add(shadowRect);

    // 半透明层
    const overlayRect = new Konva.Rect({
      x: cardX,
      y: cardY,
      width: cardW,
      height: cardH,
      cornerRadius: params.radius,
      fill: "rgba(0,0,0,0.2)",
    });
    layer.add(overlayRect);

    // 主图片
    let mainImgX = cardX, mainImgY = cardY, mainImgW = cardW, mainImgH = cardH;
    if (!params.imageFitCover) {
      const imgAspect = img.width / img.height;
      const cardAspect = cardW / cardH;
      if (imgAspect > cardAspect) {
        mainImgW = cardW;
        mainImgH = cardW / imgAspect;
        mainImgY = cardY + (cardH - mainImgH) / 2;
      } else {
        mainImgH = cardH;
        mainImgW = cardH * imgAspect;
        mainImgX = cardX + (cardW - mainImgW) / 2;
      }
    }
    const mainImageNode = new Konva.Image({
      image: img,
      x: mainImgX,
      y: mainImgY,
      width: mainImgW,
      height: mainImgH,
      cornerRadius: params.radius,
    });
    if (params.colorMatchEnabled) {
      mainImageNode.cache();
      mainImageNode.filters([Konva.Filters.Brightness, Konva.Filters.Contrast, Konva.Filters.HSL]);
      mainImageNode.brightness(params.brightness / 100);
      mainImageNode.contrast(params.contrast / 100);
      mainImageNode.saturation(params.saturation / 100);
      mainImageNode.hue(params.hueRotate);
    }
    layer.add(mainImageNode);

    // 品牌水印
    if (params.showLogo) {
      const logoXpx = (params.logoX / 100) * containerWidth;
      const logoYpx = ((100 - params.logoY) / 100) * containerHeight;
      const logoText = new Konva.Text({
        text: brandText,
        x: logoXpx,
        y: logoYpx,
        fontSize: params.logoSize,
        fontFamily: "Helvetica Neue, sans-serif",
        fill: "white",
        shadowColor: "rgba(0,0,0,0.3)",
        shadowBlur: 15,
        align: "center",
        verticalAlign: "middle",
      });
      layer.add(logoText);
    }

    // 相机参数水印
    if (params.showCameraInfo) {
      const textXpx = (params.textX / 100) * containerWidth;
      const textYpx = ((100 - params.textY) / 100) * containerHeight;
      const cameraText = new Konva.Text({
        text: cameraInfo,
        x: textXpx,
        y: textYpx,
        fontSize: params.textSize,
        fontFamily: "monospace",
        fill: "white",
        shadowColor: "rgba(0,0,0,0.3)",
        shadowBlur: 15,
        align: "center",
        verticalAlign: "middle",
      });
      layer.add(cameraText);
    }

    layer.draw();
    const canvas = stage.toCanvas({ pixelRatio: params.exportScale });
    stage.destroy();
    return canvas;
  };

  // 水印拖拽回调
  const handleWatermarkDrag = (type: "logo" | "camera", xPercent: number, yPercent: number) => {
    if (type === "logo") {
      updateParam("logoX", Math.min(100, Math.max(0, xPercent)));
      updateParam("logoY", Math.min(100, Math.max(0, yPercent)));
    } else {
      updateParam("textX", Math.min(100, Math.max(0, xPercent)));
      updateParam("textY", Math.min(100, Math.max(0, yPercent)));
    }
  };

  // 氛围光颜色类名（用于预览区背景光晕，与 Konva 无关，保留）
  const glowClass = `bg-${params.glowColor}/10`;

  // 右侧控制面板中的品牌字体样式（仅用于预览？实际上 Konva 已经接管，但保留以兼容品牌样式下拉框，不影响渲染）
  const currentBrandStyle = brandConfigs[params.brandStyle];

  return (
    <div className="h-screen w-screen bg-transparent overflow-hidden">
      <div className="h-full w-full rounded-[34px] overflow-hidden bg-[#0b1220]/95 backdrop-blur-3xl shadow-[0_25px_120px_rgba(0,0,0,0.65)] flex flex-col relative">
        <TitleBar showBackButton onBack={() => navigate("/templates")} title="SHADOWCAM" />

        <div className="flex-1 overflow-hidden editor-layout wide-panel h-full">
          {/* 左侧预览区（Konva 替换） */}
          <div className="editor-preview-area relative flex items-center justify-center p-4 lg:p-6 overflow-auto">
            <div className={`absolute w-[700px] h-[700px] rounded-full ${glowClass} blur-[180px] opacity-40`} />
            <div
              className="relative"
              style={{
                transform: `scale(${responsive.isMobile ? params.previewScale * 0.8 : params.previewScale})`,
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
                onWatermarkDrag={handleWatermarkDrag}
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
              <Collapse title="✨ 视觉光效" defaultOpen>
                <div className="space-y-5">
                  <Slider title="背景模糊" value={params.blur} min={0} max={60} suffix="px" onChange={(v) => updateParam("blur", v)} />
                  <Slider title="卡片阴影" value={params.shadow} min={0} max={120} suffix="px" onChange={(v) => updateParam("shadow", v)} />
                  <Slider title="卡片圆角" value={params.radius} min={0} max={80} suffix="px" onChange={(v) => updateParam("radius", v)} />
                  <Slider title="内边距" value={params.padding} min={20} max={120} suffix="px" onChange={(v) => updateParam("padding", v)} />
                  <div>
                    <label className="text-sm text-white/80 block mb-2">氛围光颜色</label>
                    <div className="flex gap-3">
                      {["cyan-500", "blue-500", "purple-500", "pink-500", "emerald-500"].map((color) => (
                        <button
                          key={color}
                          onClick={() => updateParam("glowColor", color)}
                          className={`w-8 h-8 rounded-full bg-${color} shadow-lg transition-all ${params.glowColor === color ? "ring-2 ring-white scale-110" : "opacity-60 hover:opacity-100"}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </Collapse>

              <Collapse title="🏷️ 品牌与水印" defaultOpen>
                <div className="space-y-5">
                  <Toggle label="显示品牌 Logo" enabled={params.showLogo} onChange={(v) => updateParam("showLogo", v)} />
                  {params.showLogo && (
                    <>
                      <div>
                        <label className="text-sm text-white/80 block mb-2">品牌文字</label>
                        <input
                          type="text"
                          value={currentBrandText}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (isBatchMode && batchImages[currentBatchIndex]) {
                              setBatchImages(prev => prev.map((img, idx) => idx === currentBatchIndex ? { ...img, brandText: val } : img));
                            } else {
                              updateParam("brandText", val);
                            }
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-white/80 block mb-2">字体样式</label>
                        <select value={params.brandStyle} onChange={(e) => updateParam("brandStyle", e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white">
                          {Object.keys(brandConfigs).map((b) => (<option key={b} value={b}>{b}</option>))}
                        </select>
                      </div>
                      <Slider title="Logo X 位置" value={params.logoX} min={0} max={100} suffix="%" snapTo={50} snapThreshold={2} onChange={(v) => updateParam("logoX", v)} />
                      <Slider title="Logo Y 位置" value={params.logoY} min={0} max={100} suffix="%" snapTo={50} snapThreshold={2} onChange={(v) => updateParam("logoY", v)} />
                      <Slider title="Logo 大小" value={params.logoSize} min={24} max={120} suffix="px" onChange={(v) => updateParam("logoSize", v)} />
                      <button onClick={() => { updateParam("logoX", 50); updateParam("logoY", 50); }} className="mt-2 w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold">🎯 居中 Logo</button>
                    </>
                  )}
                </div>
              </Collapse>

              <Collapse title="📷 摄影参数" defaultOpen>
                <div className="space-y-5">
                  <Toggle label="显示相机参数" enabled={params.showCameraInfo} onChange={(v) => updateParam("showCameraInfo", v)} />
                  <Toggle label="显示参数背景" enabled={params.showParamBg} onChange={(v) => updateParam("showParamBg", v)} />
                  <Toggle label="显示参数边框" enabled={params.showParamBorder} onChange={(v) => updateParam("showParamBorder", v)} />
                  {params.showCameraInfo && (
                    <>
                      <input
                        type="text"
                        value={currentCameraInfo}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (isBatchMode && batchImages[currentBatchIndex]) {
                            setBatchImages(prev => prev.map((img, idx) => idx === currentBatchIndex ? { ...img, cameraInfo: val } : img));
                          } else {
                            updateParam("cameraInfo", val);
                          }
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-sm"
                        placeholder="例如: 24MM F1.8 1/100S ISO200"
                      />
                      <button onClick={detectFromExif} className="w-full py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold">🔍 从当前图片识别参数</button>
                      <Slider title="参数 X 位置" value={params.textX} min={0} max={100} suffix="%" snapTo={50} snapThreshold={2} onChange={(v) => updateParam("textX", v)} />
                      <Slider title="参数 Y 位置" value={params.textY} min={0} max={100} suffix="%" snapTo={50} snapThreshold={2} onChange={(v) => updateParam("textY", v)} />
                      <Slider title="参数文字大小" value={params.textSize} min={10} max={28} suffix="px" onChange={(v) => updateParam("textSize", v)} />
                      <button onClick={() => { updateParam("textX", 50); updateParam("textY", 50); }} className="mt-2 w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold">🎯 居中相机参数</button>
                    </>
                  )}
                </div>
              </Collapse>

              <Collapse title="⚙️ 水印位置" defaultOpen>
                <div className="space-y-4">
                  <Toggle label="放置于模糊背景层（虚化处）" enabled={params.watermarkOnBackground} onChange={(v) => updateParam("watermarkOnBackground", v)} />
                  <p className="text-xs text-white/40 mt-2">开启后，水印将显示在虚化背景上。关闭时，水印显示在清晰图片上。</p>
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

              <Collapse title="🖼️ 背景形状" defaultOpen>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <button onClick={() => updateParam("bgShape", "square")} className={`flex-1 py-2 rounded-xl transition-all ${params.bgShape === "square" ? "bg-cyan-500/30 text-white shadow" : "text-white/40"}`}>正方形</button>
                    <button onClick={() => updateParam("bgShape", "rounded")} className={`flex-1 py-2 rounded-xl transition-all ${params.bgShape === "rounded" ? "bg-cyan-500/30 text-white shadow" : "text-white/40"}`}>圆角</button>
                  </div>
                </div>
              </Collapse>

              <Collapse title="📐 导出清晰度" defaultOpen>
                <div className="space-y-4">
                  <ExportScaleSelector value={params.exportScale} onChange={(v) => updateParam("exportScale", v)} />
                  <div className="flex gap-2 mt-4">
                    <button onClick={exportToFile} className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm">💾 导出参数</button>
                    <label className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm text-center cursor-pointer">
                      📂 导入参数
                      <input type="file" accept=".json" onChange={(e) => { if (e.target.files?.[0]) importFromFile(e.target.files[0], () => alert("参数导入成功")); }} className="hidden" />
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
                  <Slider title="视觉缩放比例" value={params.previewScale} min={0.5} max={1.5} step={0.01} suffix="x" onChange={(v) => updateParam("previewScale", v)} />
                  <p className="text-xs text-white/40">仅调整预览显示大小，不影响导出图片质量。导出使用 Konva 独立渲染。</p>
                </div>
              </Collapse>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}