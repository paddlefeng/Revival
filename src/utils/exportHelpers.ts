// 下载 canvas 为 PNG 文件
export const downloadCanvasAsPNG = (canvas: HTMLCanvasElement, filename: string) => {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
};