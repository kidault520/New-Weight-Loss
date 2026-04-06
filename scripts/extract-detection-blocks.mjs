/**
 * 从 healthMetricDetectionService 中截取 detectionPatterns 数组体，便于对照更新 config。
 * 用法：先手动从 service 复制 `const detectionPatterns = [` 与 `];` 之间的内容到
 * src/config/_raw_patterns.txt，再运行：node scripts/extract-detection-blocks.mjs
 */
import fs from "fs";

const rawPath =
  "d:/Trae/New Weight Loss/project/src/config/_raw_patterns.txt";
if (!fs.existsSync(rawPath)) {
  console.error("Missing", rawPath, "- see script header.");
  process.exit(1);
}
const raw = fs.readFileSync(rawPath, "utf8");
const parts = raw.split(/\n    \/\/ /);
const blocks = [];

function extractBlock(segment) {
  const mt = segment.indexOf("metricType:");
  if (mt === -1) return null;
  const brace = segment.indexOf("{");
  if (brace === -1) return null;
  return segment.slice(brace + 1, mt).trim();
}

const head0 = extractBlock(parts[0]);
if (head0) blocks.push(head0);

for (let i = 1; i < parts.length; i++) {
  const b = extractBlock(parts[i]);
  if (b) blocks.push(b);
}

console.log("blocks", blocks.length);
blocks.forEach((b, i) =>
  console.log(i, b.slice(0, 90).replace(/\s+/g, " ")),
);

const out = `// Auto-generated from healthMetricDetectionService — do not edit by hand; re-run scripts/extract-detection-blocks.mjs\n\n`;
fs.writeFileSync(
  "d:/Trae/New Weight Loss/project/src/config/_blocks_preview.ts", // 人工核对后合并进 healthMetricDetectionConfig.ts
  out +
    blocks
      .map(
        (b, i) =>
          `/* --- block ${i} --- */\nexport const block${i} = {\n${b}\n} as const;\n`,
      )
      .join("\n"),
  "utf8",
);
