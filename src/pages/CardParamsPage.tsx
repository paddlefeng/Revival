// src/pages/CardParamsPage.tsx
import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import JSZip from "jszip";
import exifr from "exifr";
import Konva from "konva";
import { Stage, Layer, Rect, Image as KonvaImage, Text, Group } from "react-konva";
import { TitleBar, Collapse, Slider, Toggle, ColorPicker, ExportScaleSelector } from "../components";
import { useColorMatch, useParameterPersistence, useUndoRedo } from "../hooks";
import { loadImage } from "../utils/imageHelpers";
import { captureVideoFrame } from "../utils/videoUtils";
import { downloadCanvasAsPNG } from "../utils/exportHelpers";
import { extractCameraParams } from "../utils/exifUtils";

// 预设品牌 Logo 列表
const BRAND_LOGOS = [
  { name: "Canon", file: "canon.svg" },
  { name: "DJI", file: "dji.svg" },
  { name: "Fujifilm", file: "fujifilm.svg" },
  { name: "Huawei", file: "huawei.svg" },
  { name: "Insta360", file: "Insta360.svg" },
  { name: "iPhone", file: "iphone.svg" },
  { name: "Nikon", file: "nikon.svg" },
  { name: "OPPO", file: "oppo.svg" },
  { name: "Sony", file: "sony.svg" },
  { name: "vivo", file: "vivo.svg" },
  { name: "Xiaomi", file: "xiaomi.svg" },
];

interface CardParams {
  leftAreaWidth: number;
  photoCardRadius: number;
  photoCardShadow: number;
  photoCardPadding: number;
  brandLogoFile: string;
  logoWidth: number;
  logoHeight: number;
  logoCornerRadius: number;
  logoOffsetX: number;
  logoOffsetY: number;
  fValue: string;
  isoValue: string;
  sValue: string;
  paramSize: number;
  paramLabelColor: string;
  paramValueColor: string;
  labelBorderWidth: number;
  labelBorderRadius: number;
  rowSpacing: number;
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
  fValue: string;
  isoValue: string;
  sValue: string;
}

export function CardParamsPage() {
  const navigate = useNavigate();
  const stageRef = useRef<Konva.Stage>(null);
  const imageRef = useRef<any>(null);
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

  const initialParams: CardParams = {
    leftAreaWidth: 247,
    photoCardRadius: 24,
    photoCardShadow: 20,
    photoCardPadding: 40,
    brandLogoFile: "xiaomi.svg",
    logoWidth: 100,
    logoHeight: 32,
    logoCornerRadius: 0,
    logoOffsetX: 60,
    logoOffsetY: 112,
    fValue: "F2.8",
    isoValue: "ISO 400",
    sValue: "1/125",
    paramSize: 12,
    paramLabelColor: "#000000",
    paramValueColor: "#000000",
    labelBorderWidth: 1,
    labelBorderRadius: 17,
    rowSpacing: 31,
    colorMatchEnabled: colorMatch.enabled,
    brightness: colorMatch.brightness,
    contrast: colorMatch.contrast,
    saturation: colorMatch.saturation,
    hueRotate: colorMatch.hueRotate,
    exportScale: 2,
    previewScale: 1,
  };

  const { state: params, setValue: setParams, undo, redo, canUndo, canRedo, resetHistory } =
    useUndoRedo<CardParams>(initialParams);

  const updateParam = useCallback(<K extends keyof CardParams>(key: K, value: CardParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, [setParams]);

  useEffect(() => {
    updateParam("colorMatchEnabled", colorMatch.enabled);
    updateParam("brightness", colorMatch.brightness);
    updateParam("contrast", colorMatch.contrast);
    updateParam("saturation", colorMatch.saturation);
    updateParam("hueRotate", colorMatch.hueRotate);
  }, [colorMatch.enabled, colorMatch.brightness, colorMatch.contrast, colorMatch.saturation, colorMatch.hueRotate]);

  const { loadSaved, exportToFile, importFromFile } = useParameterPersistence<CardParams>(
    "card-params-v3",
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

  useEffect(() => { loadSaved(); }, []);

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

  const [imageAspect, setImageAspect] = useState(16 / 10);
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 1000, height: 800 });
  const animationRef = useRef<number>();
  const [logoImageElement, setLogoImageElement] = useState<HTMLImageElement | null>(null);
  const [logoLoadError, setLogoLoadError] = useState(false);

  // 加载 Logo
  useEffect(() => {
    if (!params.brandLogoFile) return;
    setLogoLoadError(false);
    const logoPath = `/logos/${params.brandLogoFile}`;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setLogoImageElement(img);
      setLogoLoadError(false);
    };
    img.onerror = () => {
      console.warn("Logo 加载失败", logoPath);
      setLogoImageElement(null);
      setLogoLoadError(true);
    };
    img.src = logoPath;
  }, [params.brandLogoFile]);

  // 加载主图片/视频
  useEffect(() => {
    const url = getCurrentImageUrl();
    if (mediaType === "image" && url && !isBatchMode) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setImgElement(img);
        setImageAspect(img.width / img.height);
        const w = Math.min(1200, window.innerWidth * 0.6);
        setStageSize({ width: w, height: w / img.width * img.height });
      };
      img.src = url;
    } else if (mediaType === "video" && videoRef.current) {
      setVideoElement(videoRef.current);
      const vid = videoRef.current;
      const onMetadata = () => {
        setImageAspect(vid.videoWidth / vid.videoHeight);
        const w = Math.min(1200, window.innerWidth * 0.6);
        setStageSize({ width: w, height: w / vid.videoWidth * vid.videoHeight });
      };
      if (vid.readyState >= 1) onMetadata();
      else vid.onloadedmetadata = onMetadata;
    }
  }, [mediaType, getCurrentImageUrl, isBatchMode]);

  // 视频实时刷新
  useEffect(() => {
    if (!videoElement) return;
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

  const safeStageWidth = stageSize.width || 1;
  const safeStageHeight = stageSize.height || 1;

  // 右侧照片卡片
  const rightAreaX = params.leftAreaWidth;
  const cardWidth = safeStageWidth - rightAreaX - params.photoCardPadding;
  const cardHeight = safeStageHeight - params.photoCardPadding * 2;
  let photoWidth = cardWidth;
  let photoHeight = cardHeight;
  if (imgElement && !videoElement) {
    const imgAspect = imgElement.width / imgElement.height;
    const cardAspect = cardWidth / cardHeight;
    if (imgAspect > cardAspect) {
      photoWidth = cardWidth;
      photoHeight = cardWidth / imgAspect;
    } else {
      photoHeight = cardHeight;
      photoWidth = cardHeight * imgAspect;
    }
  }
  const photoX = rightAreaX + (cardWidth - photoWidth) / 2;
  const photoY = params.photoCardPadding + (cardHeight - photoHeight) / 2;

  // 左侧参数区布局
  const labelWidth = 70;
  const valueOffset = labelWidth + 16;
  const boxHeight = params.paramSize + 8;
  const startY = (safeStageHeight - (params.rowSpacing * 2 + 3 * boxHeight)) / 2;
  const rows = [
    { label: "F", value: params.fValue },
    { label: "ISO", value: params.isoValue },
    { label: "S", value: params.sValue },
  ];

  // 色调匹配滤镜
  const brightnessVal = params.colorMatchEnabled ? (params.brightness / 100) - 1 : 0;
  const contrastVal = params.colorMatchEnabled ? (params.contrast / 100) - 1 : 0;
  const saturationVal = params.colorMatchEnabled ? params.saturation / 100 : 1;
  const hueVal = params.colorMatchEnabled ? params.hueRotate : 0;

  const applyImageFilters = useCallback(() => {
    const node = imageRef.current;
    if (!node) return;
    const layer = node.getLayer();
    if (!layer) return;
    if (params.colorMatchEnabled) {
      node.cache();
      node.filters([Konva.Filters.Brightness, Konva.Filters.Contrast, Konva.Filters.HSL]);
      node.brightness(brightnessVal);
      node.contrast(contrastVal);
      node.saturation(saturationVal);
      node.hue(hueVal);
    } else {
      node.filters(null);
      node.cache();
    }
    layer.batchDraw();
  }, [params.colorMatchEnabled, brightnessVal, contrastVal, saturationVal, hueVal]);

  useEffect(() => {
    if (imgElement) {
      setTimeout(applyImageFilters, 100);
    }
  }, [imgElement, applyImageFilters]);

  useEffect(() => {
    applyImageFilters();
  }, [applyImageFilters]);

  const exportSingle = async () => {
    if (!stageRef.current) return;
    try {
      const dataURL = stageRef.current.toDataURL({ pixelRatio: params.exportScale, mimeType: "image/png" });
      const link = document.createElement("a");
      link.download = `card-params-${params.exportScale}x.png`;
      link.href = dataURL;
      link.click();
    } catch (err) {
      console.error(err);
      alert("导出失败");
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
          {
            ...params,
            fValue: item.fValue,
            isoValue: item.isoValue,
            sValue: item.sValue,
          },
          safeStageWidth,
          safeStageHeight
        );
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((blob) => (blob ? resolve(blob) : reject()), "image/png")
        );
        zip.file(`card_${i + 1}.png`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `card_params_batch_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("批量导出失败");
    } finally {
      setIsExporting(false);
    }
  };

  const renderWithKonva = async (
    imageUrl: string,
    tempParams: CardParams,
    width: number,
    height: number
  ): Promise<HTMLCanvasElement> => {
    const img = await loadImage(imageUrl);
    const stage = new Konva.Stage({ width, height, container: document.createElement("div") });
    const layer = new Konva.Layer();
    stage.add(layer);

    layer.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: "#ffffff" }));

    // Logo 后备
    const renderLogo = (x: number, y: number, w: number, h: number, radius: number) => {
      if (logoImageElement) {
        layer.add(new Konva.Image({ image: logoImageElement, x, y, width: w, height: h, cornerRadius: radius }));
      } else if (logoLoadError) {
        const brandName = tempParams.brandLogoFile.split('.')[0];
        const initial = brandName.charAt(0).toUpperCase();
        layer.add(new Konva.Rect({ x, y, width: w, height: h, fill: "#ff6700", cornerRadius: radius }));
        layer.add(new Konva.Text({
          text: initial,
          x: x + w / 2,
          y: y + h / 2,
          fontSize: h * 0.5,
          fontFamily: "Helvetica Neue, sans-serif",
          fill: "#ffffff",
          align: "center",
          verticalAlign: "middle",
        }));
      }
    };
    renderLogo(tempParams.logoOffsetX, tempParams.logoOffsetY, tempParams.logoWidth, tempParams.logoHeight, tempParams.logoCornerRadius);

    // 左侧参数区
    const boxHeight = tempParams.paramSize + 8;
    const startY = (height - (tempParams.rowSpacing * 2 + 3 * boxHeight)) / 2;
    const rowsData = [
      { label: "F", value: tempParams.fValue },
      { label: "ISO", value: tempParams.isoValue },
      { label: "S", value: tempParams.sValue },
    ];
    const labelWidth = 70;
    const valueOffset = labelWidth + 16;
    rowsData.forEach((row, i) => {
      const y = startY + i * (boxHeight + tempParams.rowSpacing);
      layer.add(new Konva.Rect({
        x: 0,
        y: y,
        width: labelWidth,
        height: boxHeight,
        fill: "#ffffff",
        stroke: "#000000",
        strokeWidth: tempParams.labelBorderWidth,
        cornerRadius: tempParams.labelBorderRadius,
      }));
      const textY = y + (boxHeight - tempParams.paramSize) / 2;
      layer.add(new Konva.Text({
        text: row.label,
        x: labelWidth / 2,
        y: textY,
        fontSize: tempParams.paramSize,
        fontFamily: "Inter, Segoe UI, sans-serif",
        fill: tempParams.paramLabelColor,
        align: "center",
        verticalAlign: "top",
      }));
      layer.add(new Konva.Text({
        text: row.value,
        x: valueOffset,
        y: textY,
        fontSize: tempParams.paramSize,
        fontFamily: "Inter, Segoe UI, sans-serif",
        fill: tempParams.paramValueColor,
        align: "left",
        verticalAlign: "top",
      }));
    });

    // 右侧照片卡片
    const rightAreaX = tempParams.leftAreaWidth;
    const cardWidth = width - rightAreaX - tempParams.photoCardPadding;
    const cardHeight = height - tempParams.photoCardPadding * 2;
    let photoWidth = cardWidth;
    let photoHeight = cardHeight;
    const imgAspect = img.width / img.height;
    const cardAspect = cardWidth / cardHeight;
    if (imgAspect > cardAspect) {
      photoWidth = cardWidth;
      photoHeight = cardWidth / imgAspect;
    } else {
      photoHeight = cardHeight;
      photoWidth = cardHeight * imgAspect;
    }
    const photoX = rightAreaX + (cardWidth - photoWidth) / 2;
    const photoY = tempParams.photoCardPadding + (cardHeight - photoHeight) / 2;

    layer.add(new Konva.Rect({
      x: rightAreaX,
      y: tempParams.photoCardPadding,
      width: cardWidth,
      height: cardHeight,
      cornerRadius: tempParams.photoCardRadius,
      shadowColor: `rgba(0,0,0,${tempParams.photoCardShadow / 100})`,
      shadowBlur: tempParams.photoCardShadow,
      shadowOffsetX: 4,
      shadowOffsetY: 6,
      fill: "#000000",
    }));
    layer.add(new Konva.Rect({
      x: rightAreaX,
      y: tempParams.photoCardPadding,
      width: cardWidth,
      height: cardHeight,
      cornerRadius: tempParams.photoCardRadius,
      fill: "#ffffff",
    }));
    const mainImg = new Konva.Image({ image: img, x: photoX, y: photoY, width: photoWidth, height: photoHeight, cornerRadius: tempParams.photoCardRadius });
    if (tempParams.colorMatchEnabled) {
      mainImg.cache();
      mainImg.filters([Konva.Filters.Brightness, Konva.Filters.Contrast, Konva.Filters.HSL]);
      mainImg.brightness((tempParams.brightness / 100) - 1);
      mainImg.contrast((tempParams.contrast / 100) - 1);
      mainImg.saturation(tempParams.saturation / 100);
      mainImg.hue(tempParams.hueRotate);
    }
    layer.add(mainImg);

    layer.draw();
    const canvas = stage.toCanvas({ pixelRatio: tempParams.exportScale });
    stage.destroy();
    return canvas;
  };

  const detectCameraParams = async () => {
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
      const fNumber = exifData.FNumber ? `F${exifData.FNumber}` : "";
      let shutter = "";
      if (exifData.ExposureTime) {
        const et = exifData.ExposureTime;
        if (et < 1) shutter = `1/${Math.round(1 / et)}`;
        else shutter = `${et}s`;
      }
      const iso = exifData.ISO ? `ISO ${exifData.ISO}` : "";
      const update = (f: string, i: string, s: string) => {
        if (isBatchMode && batchImages[currentBatchIndex]) {
          setBatchImages(prev => prev.map((img, idx) => idx === currentBatchIndex ? { ...img, fValue: f, isoValue: i, sValue: s } : img));
        } else {
          if (f) updateParam("fValue", f);
          if (i) updateParam("isoValue", i);
          if (s) updateParam("sValue", s);
        }
      };
      update(fNumber, iso, shutter);
      if (!fNumber && !iso && !shutter) alert("未提取到有用的摄影参数。");
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
    if (!files.length) return;
    Promise.all(files.map(f => new Promise<string>(resolve => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.readAsDataURL(f);
    }))).then(dataUrls => {
      const newBatch = files.map((file, idx) => ({
        file,
        dataUrl: dataUrls[idx],
        fValue: params.fValue,
        isoValue: params.isoValue,
        sValue: params.sValue,
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
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setIsVideoPlaying(true);
    const onPause = () => setIsVideoPlaying(false);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, []);

  const currentF = isBatchMode && batchImages[currentBatchIndex]
    ? batchImages[currentBatchIndex].fValue
    : params.fValue;
  const currentISO = isBatchMode && batchImages[currentBatchIndex]
    ? batchImages[currentBatchIndex].isoValue
    : params.isoValue;
  const currentS = isBatchMode && batchImages[currentBatchIndex]
    ? batchImages[currentBatchIndex].sValue
    : params.sValue;

  const renderLogoPreview = () => {
    if (logoImageElement) {
      return (
        <KonvaImage
          image={logoImageElement}
          x={params.logoOffsetX}
          y={params.logoOffsetY}
          width={params.logoWidth}
          height={params.logoHeight}
          cornerRadius={params.logoCornerRadius}
        />
      );
    } else if (logoLoadError) {
      const brandName = params.brandLogoFile.split('.')[0];
      const initial = brandName.charAt(0).toUpperCase();
      return (
        <Group>
          <Rect
            x={params.logoOffsetX}
            y={params.logoOffsetY}
            width={params.logoWidth}
            height={params.logoHeight}
            fill="#ff6700"
            cornerRadius={params.logoCornerRadius}
          />
          <Text
            text={initial}
            x={params.logoOffsetX + params.logoWidth / 2}
            y={params.logoOffsetY + params.logoHeight / 2}
            fontSize={params.logoHeight * 0.5}
            fontFamily="Helvetica Neue, sans-serif"
            fill="#ffffff"
            align="center"
            verticalAlign="middle"
          />
        </Group>
      );
    }
    return null;
  };

  return (
    <div className="h-screen w-screen bg-transparent overflow-hidden">
      <div className="h-full w-full rounded-[34px] overflow-hidden bg-[#0b1220]/95 backdrop-blur-3xl shadow-[0_25px_120px_rgba(0,0,0,0.65)] flex flex-col relative">
        <TitleBar showBackButton onBack={() => navigate("/templates")} title="CARD PARAMS" />

        <div className="flex-1 overflow-hidden editor-layout wide-panel h-full">
          {/* 左侧预览区 */}
          <div className="editor-preview-area relative flex items-center justify-center p-4 lg:p-6 overflow-auto bg-[#0b1220]">
            <div style={{ transform: `scale(${params.previewScale})`, transformOrigin: "center center" }}>
              <Stage ref={stageRef} width={safeStageWidth} height={safeStageHeight} style={{ backgroundColor: "#ffffff" }}>
                <Layer>
                  <Rect x={0} y={0} width={safeStageWidth} height={safeStageHeight} fill="#ffffff" />

                  {/* Logo */}
                  {renderLogoPreview()}

                  {/* 左侧参数区 */}
                  {rows.map((row, i) => {
                    const y = startY + i * (boxHeight + params.rowSpacing);
                    const value = i === 0 ? currentF : i === 1 ? currentISO : currentS;
                    const textY = y + (boxHeight - params.paramSize) / 2;
                    return (
                      <Group key={row.label}>
                        <Rect
                          x={0}
                          y={y}
                          width={labelWidth}
                          height={boxHeight}
                          fill="#ffffff"
                          stroke="#000000"
                          strokeWidth={params.labelBorderWidth}
                          cornerRadius={params.labelBorderRadius}
                        />
                        <Text
                          text={row.label}
                          x={labelWidth / 2}
                          y={textY}
                          fontSize={params.paramSize}
                          fontFamily="Inter, Segoe UI, sans-serif"
                          fill={params.paramLabelColor}
                          align="center"
                          verticalAlign="top"
                        />
                        <Text
                          text={value}
                          x={valueOffset}
                          y={textY}
                          fontSize={params.paramSize}
                          fontFamily="Inter, Segoe UI, sans-serif"
                          fill={params.paramValueColor}
                          align="left"
                          verticalAlign="top"
                        />
                      </Group>
                    );
                  })}

                  {/* 右侧照片卡片 */}
                  <Rect
                    x={rightAreaX}
                    y={params.photoCardPadding}
                    width={cardWidth}
                    height={cardHeight}
                    cornerRadius={params.photoCardRadius}
                    shadowColor={`rgba(0,0,0,${params.photoCardShadow / 100})`}
                    shadowBlur={params.photoCardShadow}
                    shadowOffsetX={4}
                    shadowOffsetY={6}
                    fill="#000000"
                  />
                  <Rect
                    x={rightAreaX}
                    y={params.photoCardPadding}
                    width={cardWidth}
                    height={cardHeight}
                    cornerRadius={params.photoCardRadius}
                    fill="#ffffff"
                  />
                  {imgElement && !videoElement && (
                    <KonvaImage
                      ref={imageRef}
                      image={imgElement}
                      x={photoX}
                      y={photoY}
                      width={photoWidth}
                      height={photoHeight}
                      cornerRadius={params.photoCardRadius}
                    />
                  )}
                  {videoElement && (
                    <KonvaImage
                      image={videoElement}
                      x={photoX}
                      y={photoY}
                      width={photoWidth}
                      height={photoHeight}
                      cornerRadius={params.photoCardRadius}
                    />
                  )}
                </Layer>
              </Stage>
            </div>
          </div>

          {/* 右侧控制面板 */}
          <div className="editor-control-panel overflow-y-auto border-l border-white/10 bg-white/[0.03] backdrop-blur-2xl p-4 lg:p-6 scrollbar-thin scrollbar-thumb-white/10">
            <div className="flex gap-2 mb-4">
              <button onClick={undo} disabled={!canUndo} className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-30">↶ 撤销 (Ctrl+Z)</button>
              <button onClick={redo} disabled={!canRedo} className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-30">↷ 重做 (Ctrl+Y)</button>
            </div>

            <div className="space-y-5 mb-6">
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 rounded-xl bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 font-medium hover:bg-cyan-500/30 transition-all">
                📸 上传照片或视频
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={e => {
                const files = Array.from(e.target.files || []);
                if (files.length) files[0].type.startsWith("video") ? handleVideoUpload(e) : handleSingleImageUpload(e);
              }} className="hidden" />
            </div>

            <div className="flex gap-2 mb-6 bg-white/5 p-1 rounded-2xl">
              <button onClick={() => { setMediaType("image"); setIsBatchMode(false); }} className={`flex-1 py-2 rounded-xl transition-all ${mediaType === "image" && !isBatchMode ? "bg-cyan-500/30 text-white shadow" : "text-white/40 hover:text-white/70"}`}>图片模式</button>
              <button onClick={() => { setMediaType("video"); setIsBatchMode(false); }} className={`flex-1 py-2 rounded-xl transition-all ${mediaType === "video" && !isBatchMode ? "bg-cyan-500/30 text-white shadow" : "text-white/40 hover:text-white/70"}`}>视频模式</button>
            </div>

            {mediaType === "video" && (
              <div className="mb-6">
                <button onClick={toggleVideoPlay} className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all">
                  {isVideoPlaying ? "⏸️ 暂停视频" : "▶️ 播放视频"}
                </button>
              </div>
            )}

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
              <Collapse title="📐 布局与卡片" defaultOpen>
                <div className="space-y-5">
                  <Slider title="左侧参数区宽度" value={params.leftAreaWidth} min={200} max={400} step={1} suffix="px" onChange={v => updateParam("leftAreaWidth", v)} />
                  <Slider title="卡片圆角" value={params.photoCardRadius} min={0} max={40} step={1} suffix="px" onChange={v => updateParam("photoCardRadius", v)} />
                  <Slider title="卡片阴影强度" value={params.photoCardShadow} min={0} max={50} step={1} suffix="%" onChange={v => updateParam("photoCardShadow", v)} />
                  <Slider title="卡片内边距" value={params.photoCardPadding} min={20} max={80} step={1} suffix="px" onChange={v => updateParam("photoCardPadding", v)} />
                </div>
              </Collapse>

              <Collapse title="🏷️ 品牌 Logo" defaultOpen>
                <div className="space-y-5">
                  <div>
                    <label className="text-sm text-white/80 block mb-2">选择品牌 Logo</label>
                    <select
                      value={params.brandLogoFile}
                      onChange={(e) => updateParam("brandLogoFile", e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                    >
                      {BRAND_LOGOS.map((logo) => (
                        <option key={logo.file} value={logo.file}>{logo.name}</option>
                      ))}
                    </select>
                  </div>
                  <Slider title="Logo 宽度" value={params.logoWidth} min={30} max={120} step={1} suffix="px" onChange={v => updateParam("logoWidth", v)} />
                  <Slider title="Logo 高度" value={params.logoHeight} min={30} max={120} step={1} suffix="px" onChange={v => updateParam("logoHeight", v)} />
                  <Slider title="Logo 圆角" value={params.logoCornerRadius} min={0} max={40} step={1} suffix="px" onChange={v => updateParam("logoCornerRadius", v)} />
                  <Slider title="X 偏移" value={params.logoOffsetX} min={0} max={200} step={1} suffix="px" onChange={v => updateParam("logoOffsetX", v)} />
                  <Slider title="Y 偏移" value={params.logoOffsetY} min={0} max={200} step={1} suffix="px" onChange={v => updateParam("logoOffsetY", v)} />
                </div>
              </Collapse>

              <Collapse title="📷 摄影参数" defaultOpen>
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-white/80">光圈 (F)</label>
                    <button onClick={detectCameraParams} className="px-3 py-1 rounded-lg bg-green-500/20 text-green-300 text-xs">🔍 一键识别</button>
                  </div>
                  <input type="text" value={currentF} onChange={e => {
                    if (isBatchMode && batchImages[currentBatchIndex]) {
                      setBatchImages(prev => prev.map((img, idx) => idx === currentBatchIndex ? { ...img, fValue: e.target.value } : img));
                    } else updateParam("fValue", e.target.value);
                  }} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white" />
                  <input type="text" value={currentISO} onChange={e => {
                    if (isBatchMode && batchImages[currentBatchIndex]) {
                      setBatchImages(prev => prev.map((img, idx) => idx === currentBatchIndex ? { ...img, isoValue: e.target.value } : img));
                    } else updateParam("isoValue", e.target.value);
                  }} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white" />
                  <input type="text" value={currentS} onChange={e => {
                    if (isBatchMode && batchImages[currentBatchIndex]) {
                      setBatchImages(prev => prev.map((img, idx) => idx === currentBatchIndex ? { ...img, sValue: e.target.value } : img));
                    } else updateParam("sValue", e.target.value);
                  }} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white" />
                  <Slider title="文字大小" value={params.paramSize} min={12} max={32} step={1} suffix="px" onChange={v => updateParam("paramSize", v)} />
                  <ColorPicker label="标签文字颜色" value={params.paramLabelColor} onChange={v => updateParam("paramLabelColor", v)} />
                  <ColorPicker label="数值文字颜色" value={params.paramValueColor} onChange={v => updateParam("paramValueColor", v)} />
                  <Slider title="标签框边框粗细" value={params.labelBorderWidth} min={0} max={4} step={1} suffix="px" onChange={v => updateParam("labelBorderWidth", v)} />
                  <Slider title="标签框圆角" value={params.labelBorderRadius} min={0} max={20} step={1} suffix="px" onChange={v => updateParam("labelBorderRadius", v)} />
                  <Slider title="行间距" value={params.rowSpacing} min={12} max={48} step={1} suffix="px" onChange={v => updateParam("rowSpacing", v)} />
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

              <Collapse title="📐 导出清晰度" defaultOpen>
                <div className="space-y-5">
                  <ExportScaleSelector value={params.exportScale} onChange={v => updateParam("exportScale", v)} />
                  <div className="flex gap-2 mt-4">
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
                <div className="space-y-5">
                  <Slider title="视觉缩放比例" value={params.previewScale} min={0.5} max={1.5} step={0.01} suffix="x" onChange={v => updateParam("previewScale", v)} />
                  <p className="text-xs text-white/40">仅调整预览显示大小，不影响导出图片质量。</p>
                </div>
              </Collapse>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}