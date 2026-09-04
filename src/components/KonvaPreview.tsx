// src/components/KonvaPreview.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Text } from "react-konva";
import Konva from "konva";
import { loadImage, applyBlurToImage } from "../utils/imageHelpers";

interface KonvaPreviewProps {
  imageUrl: string | null;
  params: EditorParams;   // 你的参数接口
  videoElement?: HTMLVideoElement | null;
  width: number;
  height: number;
  onWatermarkDrag?: (newX: number, newY: number, type: 'logo' | 'camera') => void;
}

export const KonvaPreview: React.FC<KonvaPreviewProps> = ({
  imageUrl,
  params,
  videoElement,
  width,
  height,
  onWatermarkDrag,
}) => {
  const [bgBlurImage, setBgBlurImage] = useState<HTMLImageElement | null>(null);
  const [mainImage, setMainImage] = useState<HTMLImageElement | null>(null);
  const stageRef = useRef<Konva.Stage>(null);

  // 生成模糊背景图片（异步）
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

  // 加载主图片（如果是视频，使用视频当前帧）
  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setMainImage(img);
    img.src = imageUrl;
  }, [imageUrl]);

  // 视频动态更新（如果有 videoElement）
  useEffect(() => {
    if (!videoElement) return;
    let frameId: number;
    const updateFrame = () => {
      if (videoElement && !videoElement.paused && !videoElement.ended) {
        // 直接使用 video 作为 Konva.Image 的源，需要转换为 Image 对象
        // 更简单的方式：创建新的 Image 元素，每帧更新 src？不推荐。可以使用 Konva.Image 的 image 属性直接绑定 video。
        // 但 react-konva 的 Image 组件接受 image 属性，我们可以传入 video 元素本身。
        // 由于 video 元素是动态的，我们需要强制重绘。这里简单起见，用 requestAnimationFrame 刷新 stage。
        stageRef.current?.batchDraw();
        frameId = requestAnimationFrame(updateFrame);
      }
    };
    if (videoElement) {
      videoElement.addEventListener('play', () => {
        frameId = requestAnimationFrame(updateFrame);
      });
      videoElement.addEventListener('pause', () => cancelAnimationFrame(frameId));
      videoElement.addEventListener('ended', () => cancelAnimationFrame(frameId));
    }
    return () => cancelAnimationFrame(frameId);
  }, [videoElement]);

  // 计算卡片区域（与现有逻辑相同）
  const cardPadding = params.padding;
  const cardW = width - cardPadding * 2;
  const cardH = height - cardPadding * 2;
  const cardX = cardPadding;
  const cardY = cardPadding;

  // 背景模糊层绘制参数（缩放 1.15）
  const bgScale = 1.15;
  const bgDrawW = width * bgScale;
  const bgDrawH = height * bgScale;
  const bgDrawX = (width - bgDrawW) / 2;
  const bgDrawY = (height - bgDrawH) / 2;

  // 水印位置（百分比转实际坐标）
  const logoX = (params.logoX / 100) * width;
  const logoY = (100 - params.logoY) / 100 * height;
  const textX = (params.textX / 100) * width;
  const textY = (100 - params.textY) / 100 * height;

  // 导出图片函数（供外部调用）
  const exportAsImage = useCallback(async (scale: number) => {
    if (!stageRef.current) return null;
    const dataURL = stageRef.current.toDataURL({
      pixelRatio: scale,
      mimeType: 'image/png',
    });
    return dataURL;
  }, []);

  // 暴露导出方法给父组件
  React.useImperativeHandle(previewRef, () => ({ exportAsImage }));

  return (
    <Stage ref={stageRef} width={width} height={height} style={{ backgroundColor: 'transparent' }}>
      <Layer>
        {/* 1. 背景模糊层（带圆角裁剪） */}
        {bgBlurImage && (
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            cornerRadius={params.bgShape === 'rounded' ? 48 : 0}
            fillPatternImage={bgBlurImage}
            fillPatternX={bgDrawX}
            fillPatternY={bgDrawY}
            fillPatternScaleX={bgDrawW / bgBlurImage.width}
            fillPatternScaleY={bgDrawH / bgBlurImage.height}
          />
        )}
        {/* 2. 卡片阴影背景 */}
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
        {/* 3. 卡片内层半透明背景 */}
        <Rect
          x={cardX}
          y={cardY}
          width={cardW}
          height={cardH}
          cornerRadius={params.radius}
          fill="rgba(0,0,0,0.2)"
        />
        {/* 4. 主图片（带圆角裁剪） */}
        <Rect
          x={cardX}
          y={cardY}
          width={cardW}
          height={cardH}
          cornerRadius={params.radius}
          clipFunc={(ctx) => {
            ctx.beginPath();
            ctx.arc(0, 0, 0, 0, 0);
            // 简单实现：用 rect 裁剪，实际 Konva 的 clip 用法不同，这里使用 Konva 的 clipping 区域
          }}
        />
        {mainImage && (
          <KonvaImage
            image={mainImage}
            x={cardX}
            y={cardY}
            width={cardW}
            height={cardH}
            crop={params.imageFitCover ? undefined : { /* contain 逻辑暂时略 */ }}
            filters={params.colorMatchEnabled ? [Konva.Filters.Brightness, Konva.Filters.Contrast, Konva.Filters.HSL] : []}
            brightness={params.brightness / 100}
            contrast={params.contrast / 100}
            hue={params.hueRotate}
            saturation={params.saturation / 100}
          />
        )}
        {/* 视频支持：如果传入 videoElement，使用 KonvaImage 的 image 属性绑定 video */}
        {videoElement && (
          <KonvaImage
            image={videoElement}
            x={cardX}
            y={cardY}
            width={cardW}
            height={cardH}
            // 滤镜同上
          />
        )}
        {/* 5. 水印：Logo */}
        {params.showLogo && (
          <Text
            text={params.brandText}
            x={logoX}
            y={logoY}
            fontSize={params.logoSize}
            fontFamily="Helvetica Neue, sans-serif"
            fill="white"
            shadowColor="rgba(0,0,0,0.3)"
            shadowBlur={15}
            align="center"
            verticalAlign="middle"
            offsetX={0} // 需要根据文本宽度动态设置？为了简化，使用默认左对齐，但可通过监听拖拽回调调整
            draggable
            onDragEnd={(e) => {
              const newX = e.target.x();
              const newY = e.target.y();
              // 将像素坐标转换回百分比，并更新 params
              const newLogoX = (newX / width) * 100;
              const newLogoY = 100 - (newY / height) * 100;
              onWatermarkDrag?.(newLogoX, newLogoY, 'logo');
            }}
          />
        )}
        {/* 6. 水印：相机参数 */}
        {params.showCameraInfo && (
          <Text
            text={params.cameraInfo}
            x={textX}
            y={textY}
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
              const newTextX = (newX / width) * 100;
              const newTextY = 100 - (newY / height) * 100;
              onWatermarkDrag?.(newTextX, newTextY, 'camera');
            }}
          />
        )}
      </Layer>
    </Stage>
  );
};