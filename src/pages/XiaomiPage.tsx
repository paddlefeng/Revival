// src/pages/XiaomiPage.tsx
import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import JSZip from "jszip";
import exifr from "exifr";
import Konva from "konva";
import { Stage, Layer, Rect, Image as KonvaImage, Text } from "react-konva";
import { TitleBar, Collapse, Slider, Toggle, ExportScaleSelector } from "../components";
import { useColorMatch, useParameterPersistence, useUndoRedo } from "../hooks";
import { loadImage } from "../utils/imageHelpers";
import { downloadCanvasAsPNG } from "../utils/exportHelpers";

interface XiaomiParams {
  infoBarHeight: number;
  infoBarOpacity: number;
  textSize: number;
  deviceBrand: string;
  deviceModel: string;
  rightLogo: string;
  rightLogoOffsetX: number;
  cameraParams: string;
  showTime: boolean;
  customTime: string;
  leftTextX: number;
  leftTextY: number;
  centerTextX: number;
  centerTextY: number;
  rightTextX: number;
  rightTextY: number;
  colorMatchEnabled: boolean;
  brightness: number;   // 0-200
  contrast: number;     // 0-200
  saturation: number;   // 0-200
  hueRotate: number;    // -180 - 180
  exportScale: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  previewScale: number;
}

interface BatchImage {
  file: File;
  dataUrl: string;
  cameraParams: string;
  deviceBrand: string;
  deviceModel: string;
  rightLogo: string;
  customTime: string;
  showTime: boolean;
}

export function XiaomiPage() {
  const navigate = useNavigate();
  const stageRef = useRef<Konva.Stage>(null);
  const imageRef = useRef<any>(null);
  const videoImageRef = useRef<any>(null);
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

  const initialParams: XiaomiParams = {
    infoBarHeight: 41,
    infoBarOpacity: 40,
    textSize: 12,
    deviceBrand: "Xiaomi",
    deviceModel: "13 Ultra",
    rightLogo: "Xiaomi",
    rightLogoOffsetX: -20,
    cameraParams: "23mm F1.9 1/250s ISO50",
    showTime: true,
    customTime: "2025-04-13 14:30",
    leftTextX: 18,
    leftTextY: 0,
    centerTextX: 198,
    centerTextY: 0.9,
    rightTextX: -127,
    rightTextY: 0,
    colorMatchEnabled: colorMatch.enabled,
    brightness: colorMatch.brightness,
    contrast: colorMatch.contrast,
    saturation: colorMatch.saturation,
    hueRotate: colorMatch.hueRotate,
    exportScale: 2,
    previewScale: 1,
  };

  const { state: params, setValue: setParams, undo, redo, canUndo, canRedo, resetHistory } =
    useUndoRedo<XiaomiParams>(initialParams);

  const updateParam = useCallback(<K extends keyof XiaomiParams>(key: K, value: XiaomiParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, [setParams]);

  const handleBrandChange = (val: string) => {
    let formatted = val;
    if (formatted.length > 0) formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    updateParam("deviceBrand", formatted);
  };

  // 滤镜参数映射（亮度/对比度范围 -1..1，饱和度 0..2，色相 -180..180）
  const brightnessVal = params.colorMatchEnabled ? (params.brightness / 100) - 1 : 0;
  const contrastVal = params.colorMatchEnabled ? (params.contrast / 100) - 1 : 0;
  const saturationVal = params.colorMatchEnabled ? params.saturation / 100 : 1;
  const hueVal = params.colorMatchEnabled ? params.hueRotate : 0;

  // 安全应用滤镜（确保滤镜存在且节点已挂载）
  const applyFilters = useCallback(() => {
    const nodes = [imageRef.current, videoImageRef.current];
    for (const node of nodes) {
      if (!node) continue;
      const layer = node.getLayer();
      if (!layer) continue;
      // 确保滤镜函数存在
      const brightnessFilter = Konva.Filters.Brightness;
      const contrastFilter = Konva.Filters.Contrast;
      const hslFilter = Konva.Filters.HSL;
      if (!brightnessFilter || !contrastFilter || !hslFilter) {
        console.warn("Konva filters not available");
        continue;
      }
      if (params.colorMatchEnabled) {
        node.cache();
        node.filters([brightnessFilter, contrastFilter, hslFilter]);
        node.brightness(brightnessVal);
        node.contrast(contrastVal);
        node.saturation(saturationVal);
        node.hue(hueVal);
      } else {
        node.filters(null);
        node.cache();
      }
      layer.batchDraw();
    }
  }, [params.colorMatchEnabled, brightnessVal, contrastVal, saturationVal, hueVal]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  useEffect(() => {
    updateParam("colorMatchEnabled", colorMatch.enabled);
    updateParam("brightness", colorMatch.brightness);
    updateParam("contrast", colorMatch.contrast);
    updateParam("saturation", colorMatch.saturation);
    updateParam("hueRotate", colorMatch.hueRotate);
  }, [colorMatch.enabled, colorMatch.brightness, colorMatch.contrast, colorMatch.saturation, colorMatch.hueRotate]);

  const { loadSaved, exportToFile, importFromFile } = useParameterPersistence<XiaomiParams>(
    "xiaomi-params",
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
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const animationRef = useRef<number>();

  useEffect(() => {
    const url = getCurrentImageUrl();
    if (mediaType === "image" && url && !isBatchMode) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setImgElement(img);
        setImageAspect(img.width / img.height);
        const w = Math.min(1000, window.innerWidth * 0.6);
        setStageSize({ width: w, height: w / img.width * img.height });
      };
      img.src = url;
    } else if (mediaType === "video" && videoRef.current) {
      setVideoElement(videoRef.current);
      const vid = videoRef.current;
      const onMetadata = () => {
        setImageAspect(vid.videoWidth / vid.videoHeight);
        const w = Math.min(1000, window.innerWidth * 0.6);
        setStageSize({ width: w, height: w / vid.videoWidth * vid.videoHeight });
      };
      if (vid.readyState >= 1) onMetadata();
      else vid.onloadedmetadata = onMetadata;
    }
  }, [mediaType, getCurrentImageUrl, isBatchMode]);

  useEffect(() => {
    if (imgElement || videoElement) {
      setTimeout(applyFilters, 100);
    }
  }, [imgElement, videoElement, applyFilters]);

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

  // 确保所有数值有效（避免 NaN）
  const safeStageWidth = stageSize.width || 1;
  const safeStageHeight = stageSize.height || 1;
  const infoBarY = safeStageHeight - params.infoBarHeight;
  const leftText = `${params.deviceBrand} ${params.deviceModel}`;
  const centerText = params.showTime ? `${params.cameraParams}  ${params.customTime}` : params.cameraParams;

  const exportSingle = async () => {
    if (!stageRef.current) {
      alert("预览区域未就绪，请稍后再试");
      return;
    }
    try {
      const dataURL = stageRef.current.toDataURL({
        pixelRatio: params.exportScale,
        mimeType: "image/png",
      });
      if (!dataURL) throw new Error("toDataURL 返回空");
      const link = document.createElement("a");
      link.download = `xiaomi-frame-${params.exportScale}x.png`;
      link.href = dataURL;
      link.click();
    } catch (err) {
      console.error("导出失败:", err);
      alert("导出失败，请检查控制台错误");
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
            deviceBrand: item.deviceBrand,
            deviceModel: item.deviceModel,
            rightLogo: item.rightLogo,
            cameraParams: item.cameraParams,
            customTime: item.customTime,
            showTime: item.showTime,
          },
          safeStageWidth,
          safeStageHeight
        );
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => (blob ? resolve(blob) : reject("toBlob failed")), "image/png");
        });
        zip.file(`xiaomi_${i + 1}.png`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `xiaomi_batch_${Date.now()}.zip`;
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
    tempParams: XiaomiParams,
    width: number,
    height: number
  ): Promise<HTMLCanvasElement> => {
    const img = await loadImage(imageUrl);
    const stage = new Konva.Stage({ width, height, container: document.createElement("div") });
    const layer = new Konva.Layer();
    stage.add(layer);

    const mainImg = new Konva.Image({ image: img, x: 0, y: 0, width, height });
    if (tempParams.colorMatchEnabled) {
      const brightnessFilter = Konva.Filters.Brightness;
      const contrastFilter = Konva.Filters.Contrast;
      const hslFilter = Konva.Filters.HSL;
      if (brightnessFilter && contrastFilter && hslFilter) {
        mainImg.cache();
        mainImg.filters([brightnessFilter, contrastFilter, hslFilter]);
        mainImg.brightness((tempParams.brightness / 100) - 1);
        mainImg.contrast((tempParams.contrast / 100) - 1);
        mainImg.saturation(tempParams.saturation / 100);
        mainImg.hue(tempParams.hueRotate);
      }
    }
    layer.add(mainImg);

    const infoBarY = height - tempParams.infoBarHeight;
    layer.add(new Konva.Rect({
      x: 0, y: infoBarY, width, height: tempParams.infoBarHeight,
      fill: `rgba(255, 255, 255, ${tempParams.infoBarOpacity})`,
    }));
    layer.add(new Konva.Text({
      text: `${tempParams.deviceBrand} ${tempParams.deviceModel}`,
      x: tempParams.leftTextX,
      y: infoBarY + tempParams.infoBarHeight / 2 + tempParams.leftTextY,
      fontSize: tempParams.textSize,
      fontFamily: "Inter, 'SF Pro Text', system-ui, sans-serif",
      fill: "black",
      offsetY: tempParams.textSize / 2,
    }));
    layer.add(new Konva.Text({
      text: tempParams.rightLogo,
      x: width + tempParams.rightTextX + tempParams.rightLogoOffsetX,
      y: infoBarY + tempParams.infoBarHeight / 2 + tempParams.rightTextY,
      fontSize: tempParams.textSize,
      fontFamily: "Inter, 'SF Pro Text', system-ui, sans-serif",
      fill: "#ff6700",
      align: "right",
      offsetY: tempParams.textSize / 2,
    }));
    let center = tempParams.cameraParams;
    if (tempParams.showTime && tempParams.customTime) center += `  ${tempParams.customTime}`;
    layer.add(new Konva.Text({
      text: center,
      x: width / 2 + tempParams.centerTextX,
      y: infoBarY + tempParams.infoBarHeight / 2 + tempParams.centerTextY,
      fontSize: tempParams.textSize,
      fontFamily: "Inter, 'SF Pro Text', system-ui, sans-serif",
      fill: "black",
      align: "center",
      offsetY: tempParams.textSize / 2,
    }));

    layer.draw();
    const canvas = stage.toCanvas({ pixelRatio: tempParams.exportScale });
    stage.destroy();
    return canvas;
  };

  const detectFromExif = async () => {
    if (mediaType === "video") { alert("视频模式暂不支持 EXIF 识别"); return; }
    let file = null;
    if (isBatchMode && batchImages[currentBatchIndex]) file = batchImages[currentBatchIndex].file;
    else file = singleFileRef.current || fileInputRef.current?.files?.[0] || null;
    if (!file || !file.type.startsWith("image")) { alert("请先上传本地图片文件"); return; }
    try {
      const exifData = await exifr.parse(file);
      if (!exifData) { alert("未找到 EXIF 信息"); return; }
      let brand = "", model = "";
      if (exifData.Make) {
        brand = exifData.Make;
        if (brand === "NIKON CORPORATION") brand = "NIKON";
        if (brand.length) brand = brand.charAt(0).toUpperCase() + brand.slice(1);
      }
      if (exifData.Model) model = exifData.Model;
      const fNumber = exifData.FNumber ? `F${exifData.FNumber}` : "";
      let shutter = "";
      if (exifData.ExposureTime) {
        const et = exifData.ExposureTime;
        if (et < 1) shutter = `1/${Math.round(1 / et)}s`;
        else shutter = `${et}s`;
      }
      const iso = exifData.ISO ? `ISO${exifData.ISO}` : "";
      const focalLength = exifData.FocalLength ? `${Math.round(exifData.FocalLength)}mm` : "";
      const parts = [focalLength, fNumber, shutter, iso].filter(p => p);
      const exifParams = parts.join(" ");
      let dateTime = "";
      if (exifData.DateTimeOriginal) dateTime = new Date(exifData.DateTimeOriginal).toLocaleString();
      if (isBatchMode && batchImages[currentBatchIndex]) {
        setBatchImages(prev => prev.map((img, idx) => idx === currentBatchIndex ? {
          ...img,
          deviceBrand: brand || img.deviceBrand,
          deviceModel: model || img.deviceModel,
          cameraParams: exifParams || img.cameraParams,
          customTime: dateTime || img.customTime,
        } : img));
      } else {
        if (brand) updateParam("deviceBrand", brand);
        if (model) updateParam("deviceModel", model);
        if (exifParams) updateParam("cameraParams", exifParams);
        if (dateTime) updateParam("customTime", dateTime);
        if (!brand && !model && !exifParams && !dateTime) alert("未提取到有用信息");
      }
    } catch (err) { console.error(err); alert("解析 EXIF 失败"); }
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
        cameraParams: params.cameraParams,
        deviceBrand: params.deviceBrand,
        deviceModel: params.deviceModel,
        rightLogo: params.rightLogo,
        customTime: params.customTime,
        showTime: params.showTime,
      }));
      setBatchImages(newBatch);
      setCurrentBatchIndex(0);
      setIsBatchMode(true);
      setMediaType("image");
    });
  };

  const exitBatchMode = () => { setIsBatchMode(false); setBatchImages([]); setCurrentBatchIndex(0); };
  const toggleVideoPlay = useCallback(() => {
    if (!videoRef.current) return;
    isVideoPlaying ? videoRef.current.pause() : videoRef.current.play();
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

  const currentBrand = isBatchMode && batchImages[currentBatchIndex] ? batchImages[currentBatchIndex].deviceBrand : params.deviceBrand;
  const currentModel = isBatchMode && batchImages[currentBatchIndex] ? batchImages[currentBatchIndex].deviceModel : params.deviceModel;
  const currentRightLogo = isBatchMode && batchImages[currentBatchIndex] ? batchImages[currentBatchIndex].rightLogo : params.rightLogo;
  const currentCameraParams = isBatchMode && batchImages[currentBatchIndex] ? batchImages[currentBatchIndex].cameraParams : params.cameraParams;
  const currentCustomTime = isBatchMode && batchImages[currentBatchIndex] ? batchImages[currentBatchIndex].customTime : params.customTime;
  const currentShowTime = isBatchMode && batchImages[currentBatchIndex] ? batchImages[currentBatchIndex].showTime : params.showTime;

  const onDragLeftEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const newX = e.target.x();
    const newY = e.target.y() - (infoBarY + params.infoBarHeight / 2);
    updateParam("leftTextX", Math.min(safeStageWidth - 20, Math.max(0, newX)));
    updateParam("leftTextY", newY);
  };
  const onDragCenterEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const newX = e.target.x() - safeStageWidth / 2;
    const newY = e.target.y() - (infoBarY + params.infoBarHeight / 2);
    updateParam("centerTextX", newX);
    updateParam("centerTextY", newY);
  };
  const onDragRightEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const newX = e.target.x() - safeStageWidth;
    const newY = e.target.y() - (infoBarY + params.infoBarHeight / 2);
    updateParam("rightTextX", newX);
    updateParam("rightTextY", newY);
  };

  const leftPosX = params.leftTextX;
  const leftPosY = infoBarY + params.infoBarHeight / 2 + params.leftTextY;
  const centerPosX = safeStageWidth / 2 + params.centerTextX;
  const centerPosY = infoBarY + params.infoBarHeight / 2 + params.centerTextY;
  const rightPosX = safeStageWidth + params.rightTextX + params.rightLogoOffsetX;
  const rightPosY = infoBarY + params.infoBarHeight / 2 + params.rightTextY;

  return (
    <div className="h-screen w-screen bg-transparent overflow-hidden">
      <div className="h-full w-full bg-black flex flex-col relative">
        <TitleBar showBackButton onBack={() => navigate("/templates")} title="XIAOMI" />
        <div className="flex-1 overflow-hidden editor-layout h-full">
          {/* 预览区 */}
          <div className="editor-preview-area relative flex items-center justify-center p-4 lg:p-6 overflow-auto">
            <div style={{ transform: `scale(${params.previewScale})`, transformOrigin: "center center" }}>
              <Stage ref={stageRef} width={safeStageWidth} height={safeStageHeight}>
                <Layer>
                  {imgElement && !videoElement && <KonvaImage ref={imageRef} image={imgElement} x={0} y={0} width={safeStageWidth} height={safeStageHeight} />}
                  {videoElement && <KonvaImage ref={videoImageRef} image={videoElement} x={0} y={0} width={safeStageWidth} height={safeStageHeight} />}
                  <Rect x={0} y={infoBarY} width={safeStageWidth} height={params.infoBarHeight} fill={`rgba(255,255,255,${params.infoBarOpacity})`} />
                  <Text text={leftText} x={leftPosX} y={leftPosY} fontSize={params.textSize} fontFamily="Inter, 'SF Pro Text', system-ui, sans-serif" fill="black" offsetY={params.textSize/2} draggable onDragEnd={onDragLeftEnd} />
                  <Text text={centerText} x={centerPosX} y={centerPosY} fontSize={params.textSize} fontFamily="Inter, 'SF Pro Text', system-ui, sans-serif" fill="black" align="center" offsetY={params.textSize/2} draggable onDragEnd={onDragCenterEnd} />
                  <Text text={params.rightLogo} x={rightPosX} y={rightPosY} fontSize={params.textSize} fontFamily="Inter, 'SF Pro Text', system-ui, sans-serif" fill="#ff6700" align="right" offsetY={params.textSize/2} draggable onDragEnd={onDragRightEnd} />
                </Layer>
              </Stage>
            </div>
          </div>
          {/* 右侧控制面板 */}
          <div className="editor-control-panel overflow-y-auto bg-[#0b1220]/95 backdrop-blur-3xl border-l border-white/10 p-4 lg:p-6">
            <div className="flex gap-2 mb-4">
              <button onClick={undo} disabled={!canUndo} className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-30">↶ 撤销 (Ctrl+Z)</button>
              <button onClick={redo} disabled={!canRedo} className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white disabled:opacity-30">↷ 重做 (Ctrl+Y)</button>
            </div>
            <div className="space-y-5 mb-6">
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 rounded-xl bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 font-medium hover:bg-cyan-500/30 transition-all">📸 上传照片或视频</button>
              <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={e => { const files = Array.from(e.target.files || []); if (files.length) files[0].type.startsWith("video") ? handleVideoUpload(e) : handleSingleImageUpload(e); }} className="hidden" />
            </div>
            <div className="flex gap-2 mb-6 bg-white/5 p-1 rounded-xl">
              <button onClick={() => { setMediaType("image"); setIsBatchMode(false); }} className={`flex-1 py-2 rounded-lg transition-all ${mediaType === "image" && !isBatchMode ? "bg-cyan-500/30 text-white" : "text-white/40"}`}>图片模式</button>
              <button onClick={() => { setMediaType("video"); setIsBatchMode(false); }} className={`flex-1 py-2 rounded-lg transition-all ${mediaType === "video" && !isBatchMode ? "bg-cyan-500/30 text-white" : "text-white/40"}`}>视频模式</button>
            </div>
            {mediaType === "video" && <div className="mb-6"><button onClick={toggleVideoPlay} className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all">{isVideoPlaying ? "⏸️ 暂停视频" : "▶️ 播放视频"}</button></div>}
            {isBatchMode && <div className="mb-4 p-3 bg-white/10 rounded-lg flex justify-between items-center"><span className="text-white/80 text-sm">批量模式: {batchImages.length} 张图片</span><button onClick={exitBatchMode} className="text-red-300 text-xs">退出批量</button></div>}
            {isBatchMode && batchImages.length > 1 && <div className="flex justify-center gap-4 mb-4"><button onClick={() => setCurrentBatchIndex(p => Math.max(0, p-1))} disabled={currentBatchIndex===0} className="px-4 py-1 rounded bg-white/10 text-white disabled:opacity-30">◀ 上一张</button><span className="text-white">{currentBatchIndex+1}/{batchImages.length}</span><button onClick={() => setCurrentBatchIndex(p => Math.min(batchImages.length-1, p+1))} disabled={currentBatchIndex===batchImages.length-1} className="px-4 py-1 rounded bg-white/10 text-white disabled:opacity-30">下一张 ▶</button></div>}
            <div className="space-y-6">
              <Collapse title="📱 信息栏样式" defaultOpen>
                <div className="space-y-4">
                  <Slider title="信息栏高度" value={params.infoBarHeight} min={30} max={80} step={1} suffix="px" onChange={v => updateParam("infoBarHeight", v)} />
                  <Slider title="信息栏不透明度" value={params.infoBarOpacity*100} min={0} max={100} step={1} suffix="%" onChange={v => updateParam("infoBarOpacity", v/100)} />
                  <Slider title="文字大小" value={params.textSize} min={10} max={24} step={1} suffix="px" onChange={v => updateParam("textSize", v)} />
                  <div className="border-t border-white/10 pt-2 mt-2">
                    <p className="text-xs text-white/50 mb-2">💡 提示：下方三个文字区域可直接拖拽移动位置</p>
                    <Slider title="左下文字 X 偏移" value={params.leftTextX} min={-200} max={200} step={1} suffix="px" onChange={v => updateParam("leftTextX", v)} />
                    <Slider title="左下文字 Y 偏移" value={params.leftTextY} min={-100} max={100} step={1} suffix="px" onChange={v => updateParam("leftTextY", v)} />
                    <Slider title="中央文字 X 偏移" value={params.centerTextX} min={-200} max={200} step={1} suffix="px" onChange={v => updateParam("centerTextX", v)} />
                    <Slider title="中央文字 Y 偏移" value={params.centerTextY} min={-100} max={100} step={1} suffix="px" onChange={v => updateParam("centerTextY", v)} />
                    <Slider title="右下文字 X 偏移" value={params.rightTextX} min={-200} max={200} step={1} suffix="px" onChange={v => updateParam("rightTextX", v)} />
                    <Slider title="右下文字 Y 偏移" value={params.rightTextY} min={-100} max={100} step={1} suffix="px" onChange={v => updateParam("rightTextY", v)} />
                    <Slider title="右下标识额外左移" value={params.rightLogoOffsetX} min={-100} max={100} step={1} suffix="px" onChange={v => updateParam("rightLogoOffsetX", v)} />
                  </div>
                </div>
              </Collapse>
              <Collapse title="🏷️ 设备信息" defaultOpen>
                <div className="space-y-4">
                  <div className="flex items-center justify-between"><h3 className="text-white/80 text-sm">设备信息</h3><button onClick={detectFromExif} className="px-3 py-1 rounded-lg bg-green-500/20 text-green-300 text-xs">🔍 一键识别</button></div>
                  <input type="text" value={currentBrand} onChange={e => { if (isBatchMode && batchImages[currentBatchIndex]) setBatchImages(prev => prev.map((img, idx) => idx === currentBatchIndex ? {...img, deviceBrand: e.target.value} : img)); else handleBrandChange(e.target.value); }} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white" placeholder="品牌" />
                  <input type="text" value={currentModel} onChange={e => { if (isBatchMode && batchImages[currentBatchIndex]) setBatchImages(prev => prev.map((img, idx) => idx === currentBatchIndex ? {...img, deviceModel: e.target.value} : img)); else updateParam("deviceModel", e.target.value); }} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white" placeholder="型号" />
                  <input type="text" value={currentRightLogo} onChange={e => { if (isBatchMode && batchImages[currentBatchIndex]) setBatchImages(prev => prev.map((img, idx) => idx === currentBatchIndex ? {...img, rightLogo: e.target.value} : img)); else updateParam("rightLogo", e.target.value); }} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white" placeholder="右下角标识" />
                </div>
              </Collapse>
              <Collapse title="📷 摄影参数" defaultOpen>
                <div className="space-y-4">
                  <input type="text" value={currentCameraParams} onChange={e => { if (isBatchMode && batchImages[currentBatchIndex]) setBatchImages(prev => prev.map((img, idx) => idx === currentBatchIndex ? {...img, cameraParams: e.target.value} : img)); else updateParam("cameraParams", e.target.value); }} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white" placeholder="23mm F1.9 1/250s ISO50" />
                  <Toggle label="显示拍摄时间" enabled={currentShowTime} onChange={v => { if (isBatchMode && batchImages[currentBatchIndex]) setBatchImages(prev => prev.map((img, idx) => idx === currentBatchIndex ? {...img, showTime: v} : img)); else updateParam("showTime", v); }} />
                  {currentShowTime && <input type="text" value={currentCustomTime} onChange={e => { if (isBatchMode && batchImages[currentBatchIndex]) setBatchImages(prev => prev.map((img, idx) => idx === currentBatchIndex ? {...img, customTime: e.target.value} : img)); else updateParam("customTime", e.target.value); }} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white" placeholder="2025-04-13 14:30" />}
                </div>
              </Collapse>
              <Collapse title="🎨 色调匹配" defaultOpen>
                <div className="space-y-4">
                  <Toggle label="启用色调匹配" enabled={colorMatch.enabled} onChange={colorMatch.setEnabled} />
                  {colorMatch.enabled && <>
                    <Slider title="亮度" value={colorMatch.brightness} min={0} max={200} step={1} suffix="%" onChange={colorMatch.setBrightness} />
                    <Slider title="对比度" value={colorMatch.contrast} min={0} max={200} step={1} suffix="%" onChange={colorMatch.setContrast} />
                    <Slider title="饱和度" value={colorMatch.saturation} min={0} max={200} step={1} suffix="%" onChange={colorMatch.setSaturation} />
                    <Slider title="色相旋转" value={colorMatch.hueRotate} min={-180} max={180} step={1} suffix="°" onChange={colorMatch.setHueRotate} />
                    <button onClick={colorMatch.applyReferenceStyle} className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold">🖌️ 应用参考图风格</button>
                  </>}
                </div>
              </Collapse>
              <Collapse title="📐 导出清晰度" defaultOpen>
                <div className="space-y-4">
                  <ExportScaleSelector value={params.exportScale} onChange={v => updateParam("exportScale", v)} />
                  <div className="flex gap-2 mt-4"><button onClick={exportToFile} className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm">💾 导出参数</button><label className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm text-center cursor-pointer">📂 导入参数<input type="file" accept=".json" onChange={e => { if (e.target.files?.[0]) importFromFile(e.target.files[0], () => alert("参数导入成功")); }} className="hidden" /></label></div>
                  <div className="flex gap-2 mt-2"><button onClick={exportSingle} className="flex-1 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold">导出单张</button>{isBatchMode && <button onClick={exportBatchToZip} className="flex-1 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold">导出全部为ZIP</button>}</div>
                  {isExporting && <div className="text-center text-white/50 text-sm mt-2">导出中...</div>}
                </div>
              </Collapse>
              <Collapse title="🔍 预览缩放" defaultOpen>
                <div className="space-y-4">
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