#!/usr/bin/env node
// toolbox-mcp —— 前端实用工具箱 MCP 服务器(TypeScript 版)
// 通过 stdio 与 Kiro / Claude 等客户端通信,暴露若干前端高频工具。
// 第一行 #!/usr/bin/env node 是 shebang:编译后 tsc 会保留它,
// 让 `npx github:用户名/toolbox-mcp` 能把编译产物当命令直接启动。
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// 创建服务器实例。name/version 会在客户端里显示。
const server = new McpServer({
  name: "toolbox-mcp",
  version: "2.0.0",
});

// 小工具:把一段文本包成 MCP 标准返回结构。
function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

// ============================================================
// 工具 1:px_to_rem —— 单位换算 px ⇆ rem / vw
// ============================================================
server.registerTool(
  "px_to_rem",
  {
    title: "px 单位换算",
    description:
      "把 px 换算成 rem 和 vw。rootFontSize 是根字号(默认16),designWidth 是设计稿宽度(默认375,用于算 vw)。",
    inputSchema: {
      px: z.number().describe("要换算的像素值"),
      rootFontSize: z.number().default(16).describe("根字号,rem 基准,默认 16"),
      designWidth: z.number().default(375).describe("设计稿宽度,vw 基准,默认 375"),
    },
  },
  async ({ px, rootFontSize, designWidth }) => {
    const rem = px / rootFontSize;
    const vw = (px / designWidth) * 100;
    const fmt = (n: number) => parseFloat(n.toFixed(4)).toString();
    return textResult(
      [
        `${px}px 换算结果:`,
        `  rem: ${fmt(rem)}rem  (基准 ${rootFontSize}px)`,
        `  vw:  ${fmt(vw)}vw   (设计稿 ${designWidth}px)`,
      ].join("\n")
    );
  }
);

// ============================================================
// 工具 2:color_convert —— 颜色格式互转 hex ⇆ rgb ⇆ hsl
// ============================================================
interface RGB {
  r: number;
  g: number;
  b: number;
  a: number;
}

// 解析多种颜色写法为 {r,g,b,a}
function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase();

  // hex: #rgb / #rgba / #rrggbb / #rrggbbaa
  const hex = s.replace(/^#/, "");
  if (/^([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(hex)) {
    let r: number, g: number, b: number, a = 1;
    if (hex.length === 3 || hex.length === 4) {
      r = parseInt(hex[0]! + hex[0]!, 16);
      g = parseInt(hex[1]! + hex[1]!, 16);
      b = parseInt(hex[2]! + hex[2]!, 16);
      if (hex.length === 4) a = parseInt(hex[3]! + hex[3]!, 16) / 255;
    } else {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
      if (hex.length === 8) a = parseInt(hex.slice(6, 8), 16) / 255;
    }
    return { r, g, b, a };
  }

  // rgb(a): rgb(255, 0, 0) / rgba(255,0,0,0.5)
  const rgbMatch = s.match(/rgba?\(([^)]+)\)/);
  if (rgbMatch) {
    const parts = rgbMatch[1]!.split(/[,/]/).map((p) => p.trim());
    if (parts.length >= 3) {
      return {
        r: parseInt(parts[0]!, 10),
        g: parseInt(parts[1]!, 10),
        b: parseInt(parts[2]!, 10),
        a: parts[3] !== undefined ? parseFloat(parts[3]) : 1,
      };
    }
  }
  return null;
}

function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

server.registerTool(
  "color_convert",
  {
    title: "颜色格式转换",
    description:
      "输入任意颜色(如 #ff0000、rgb(255,0,0)、rgba(0,0,0,.5)),返回 hex / rgb / hsl 三种格式。",
    inputSchema: {
      color: z.string().describe("颜色值,支持 hex / rgb / rgba"),
    },
  },
  async ({ color }) => {
    const rgb = parseColor(color);
    if (!rgb) {
      return textResult(`无法识别的颜色格式:${color}\n支持:#ff0000 / rgb(255,0,0) / rgba(0,0,0,.5)`);
    }
    const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
    const hex = `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}${rgb.a < 1 ? toHex(rgb.a * 255) : ""}`;
    const rgbStr =
      rgb.a < 1
        ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${parseFloat(rgb.a.toFixed(3))})`
        : `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    const { h, s, l } = rgbToHsl(rgb);
    const hslStr = rgb.a < 1 ? `hsla(${h}, ${s}%, ${l}%, ${parseFloat(rgb.a.toFixed(3))})` : `hsl(${h}, ${s}%, ${l}%)`;
    return textResult([`hex: ${hex}`, `rgb: ${rgbStr}`, `hsl: ${hslStr}`].join("\n"));
  }
);

// ============================================================
// 工具 3:json_to_ts —— 把 JSON 转成 TypeScript 接口
// ============================================================
function tsTypeOf(value: unknown, interfaces: string[], nameHint: string): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "unknown[]";
    // 用第一个元素推断数组元素类型
    const elemType = tsTypeOf(value[0], interfaces, singularize(nameHint));
    return `${elemType}[]`;
  }
  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object": {
      const ifaceName = pascalCase(nameHint);
      const obj = value as Record<string, unknown>;
      const lines = Object.entries(obj).map(([k, v]) => {
        const propType = tsTypeOf(v, interfaces, k);
        const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
        return `  ${key}: ${propType};`;
      });
      interfaces.push(`interface ${ifaceName} {\n${lines.join("\n")}\n}`);
      return ifaceName;
    }
    default:
      return "unknown";
  }
}

function pascalCase(s: string): string {
  const cleaned = s.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const pc = cleaned
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return pc || "Root";
}

function singularize(s: string): string {
  return s.endsWith("s") ? s.slice(0, -1) : s + "Item";
}

server.registerTool(
  "json_to_ts",
  {
    title: "JSON 转 TS 接口",
    description: "把一段 JSON 字符串转换成 TypeScript interface 定义,嵌套对象会拆成独立接口。",
    inputSchema: {
      json: z.string().describe("要转换的 JSON 字符串"),
      rootName: z.string().default("Root").describe("根接口名,默认 Root"),
    },
  },
  async ({ json, rootName }) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      return textResult(`JSON 解析失败:${(e as Error).message}`);
    }
    const interfaces: string[] = [];
    const rootType = tsTypeOf(parsed, interfaces, rootName);
    // 若根是对象,interfaces 里最后一个就是根接口;否则给个 type 别名
    let output: string;
    if (interfaces.length > 0 && (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed))) {
      output = interfaces.reverse().join("\n\n");
    } else {
      output = [...interfaces].reverse().join("\n\n");
      output += (output ? "\n\n" : "") + `type ${pascalCase(rootName)} = ${rootType};`;
    }
    return textResult(output);
  }
);

// ============================================================
// 工具 4:npm_info —— 查 npm 包的版本、体积等信息(联网)
// ============================================================
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

server.registerTool(
  "npm_info",
  {
    title: "查 npm 包信息",
    description: "查询一个 npm 包的最新版本、描述、许可证、主页,以及打包后体积(gzip)。需要联网。",
    inputSchema: {
      name: z.string().describe("npm 包名,如 react、@types/node"),
    },
  },
  async ({ name }) => {
    // 处理 scoped 包名的 URL 编码
    const encoded = name.startsWith("@") ? name.replace("/", "%2f") : name;
    try {
      const res = await fetchWithTimeout(`https://registry.npmjs.org/${encoded}/latest`, 8000);
      if (!res.ok) {
        return textResult(`没找到包 "${name}"(HTTP ${res.status})。请检查包名是否正确。`);
      }
      const data = (await res.json()) as {
        version?: string;
        description?: string;
        license?: string;
        homepage?: string;
      };
      const lines = [
        `包名: ${name}`,
        `最新版本: ${data.version ?? "未知"}`,
        `描述: ${data.description ?? "无"}`,
        `许可证: ${data.license ?? "未知"}`,
        `主页: ${data.homepage ?? "无"}`,
      ];

      // 额外查体积(bundlephobia),失败则忽略
      try {
        const sizeRes = await fetchWithTimeout(
          `https://bundlephobia.com/api/size?package=${encoded}@${data.version}`,
          6000
        );
        if (sizeRes.ok) {
          const size = (await sizeRes.json()) as { size?: number; gzip?: number };
          const kb = (n?: number) => (n ? `${(n / 1024).toFixed(1)} KB` : "未知");
          lines.push(`体积(min): ${kb(size.size)}`, `体积(min+gzip): ${kb(size.gzip)}`);
        }
      } catch {
        lines.push("体积: 查询超时/失败(不影响其它信息)");
      }

      return textResult(lines.join("\n"));
    } catch (e) {
      return textResult(`查询失败:${(e as Error).message}(可能是网络问题)`);
    }
  }
);

// ============================================================
// 启动服务器(stdio)。调试信息走 stderr,避免污染协议 stdout。
// ============================================================
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("toolbox-mcp 前端工具箱已启动,等待客户端连接...");
}

main().catch((err: unknown) => {
  console.error("服务器启动失败:", err);
  process.exit(1);
});
