// 从 video 元素捕获当前帧为 base64
export const captureVideoFrame = async (videoEl: HTMLVideoElement): Promise<string> => {
  const canvas = document.createElement("canvas");
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(videoEl, 0, 0);
  return canvas.toDataURL("image/png");
};