// src/utils/exifUtils.ts
import exifr from "exifr";

/**
 * 从图片文件提取摄影参数（光圈、快门、ISO），返回一行字符串或换行分隔
 * @param file 图片文件
 * @param multiline 是否多行显示（\n 分隔）
 * @returns 参数字符串，如 "F2.8 1/125 ISO400"
 */
export const extractCameraParams = async (file: File, multiline = false): Promise<string> => {
  try {
    const exifData = await exifr.parse(file);
    if (!exifData) return "";
    const fNumber = exifData.FNumber ? `F${exifData.FNumber}` : "";
    let shutter = "";
    if (exifData.ExposureTime) {
      const et = exifData.ExposureTime;
      if (et < 1) {
        shutter = `1/${Math.round(1 / et)}`;
      } else {
        shutter = `${et}`;
      }
    }
    const iso = exifData.ISO ? `ISO${exifData.ISO}` : "";
    const parts = [fNumber, shutter, iso].filter(p => p !== "");
    return multiline ? parts.join("\n") : parts.join(" ");
  } catch (err) {
    console.error(err);
    return "";
  }
};

/**
 * 从图片文件提取相机品牌，返回标准化的小写名称（用于匹配 SVG 文件名）
 * @param file 图片文件
 * @returns 品牌名小写，如 "vivo", "iphone", "huawei"
 */
export const extractBrandFromExif = async (file: File): Promise<string> => {
  try {
    const exifData = await exifr.parse(file);
    if (!exifData?.Make) return "";
    let brand = exifData.Make.toUpperCase();
    // 品牌名称标准化
    if (brand === "NIKON CORPORATION") brand = "NIKON";
    if (brand === "CANON") brand = "CANON";
    if (brand === "SONY") brand = "SONY";
    if (brand === "FUJIFILM") brand = "FUJIFILM";
    if (brand === "INSTA360") brand = "INSTA360";
    // 返回小写，用于匹配 public/logos/ 下的文件名（如 vivo.svg, iphone.svg）
    return brand.toLowerCase();
  } catch (err) {
    console.error(err);
    return "";
  }
};