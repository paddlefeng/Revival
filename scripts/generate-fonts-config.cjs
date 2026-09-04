// scripts/generate-fonts-config.js
const fs = require('fs');
const path = require('path');

const txtPath = path.join(__dirname, '../字体名字.txt');
const outputPath = path.join(__dirname, '../src/constants/fonts.ts');

const content = fs.readFileSync(txtPath, 'utf-8');
const lines = content.split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#'));

// 解析文件名，生成字体族名称（去掉扩展名，并处理特殊字符）
const fonts = lines.map(filename => {
  // 去掉扩展名
  let name = filename.replace(/\.(ttf|otf|ttc)$/i, '');
  // 将下划线、连字符等转为空格，用于显示
  let displayName = name.replace(/[-_]/g, ' ');
  // 保留原始文件名作为 font-family（或使用去掉扩展名的名称）
  const fontFamily = name;
  return {
    label: displayName,
    value: fontFamily,
    file: filename,
  };
});

// 导出配置
const tsContent = `// 自动生成，请勿手动编辑
// 字体列表来自 字体名字.txt

export interface FontOption {
  label: string;
  value: string;
  file: string;
}

export const AVAILABLE_FONTS: FontOption[] = ${JSON.stringify(fonts, null, 2)};

// 默认字体
export const DEFAULT_LOGO_FONT = "Helvetica Neue, sans-serif";
export const DEFAULT_TEXT_FONT = "monospace";
`;

fs.writeFileSync(outputPath, tsContent);
console.log(`已生成 ${fonts.length} 个字体配置 → ${outputPath}`);