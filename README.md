# toolbox-mcp

> 前端实用工具箱 MCP 服务器 —— 用 TypeScript 编写，通过 [Model Context Protocol](https://modelcontextprotocol.io) 把一批前端高频工具暴露给 Kiro / Claude 等 AI 客户端调用。

配置一次，就能在对话里直接让 AI 帮你做单位换算、颜色转换、JSON 转 TS 类型、查 npm 包信息，无需离开编辑器。

## 特性

- 🎯 **4 个前端高频工具**，开箱即用
- 📦 **零运行时负担**，基于官方 `@modelcontextprotocol/sdk`
- 🔌 **stdio 通信**，兼容 Kiro、Claude Desktop 等所有支持 MCP 的客户端
- ⚡ **支持 npx 直接运行**，也可本地编译使用
- 🛡️ **TypeScript 严格模式**，参数用 `zod` 做校验

## 内置工具

| 工具 | 说明 | 参数 |
|------|------|------|
| `px_to_rem` | px 换算成 rem / vw | `px`（必填）、`rootFontSize`（默认 16）、`designWidth`（默认 375） |
| `color_convert` | 颜色格式互转 hex ⇆ rgb ⇆ hsl | `color`（必填，支持 hex / rgb / rgba） |
| `json_to_ts` | JSON 字符串转 TypeScript interface | `json`（必填）、`rootName`（默认 Root） |
| `npm_info` | 查 npm 包版本、描述、许可证、体积 | `name`（必填，包名，需联网） |

### 工具详情

**px_to_rem** —— 把设计稿的像素值换算成 rem 和 vw。

```
输入: { px: 32, rootFontSize: 16, designWidth: 375 }
输出:
  32px 换算结果:
    rem: 2rem      (基准 16px)
    vw:  8.5333vw   (设计稿 375px)
```

**color_convert** —— 输入任意颜色写法，一次性返回三种格式，支持带透明度。

```
输入: { color: "#ff0000" }
输出:
  hex: #ff0000
  rgb: rgb(255, 0, 0)
  hsl: hsl(0, 100%, 50%)
```

**json_to_ts** —— 把接口返回的 JSON 快速转成 TS 类型，嵌套对象自动拆成独立 interface。

```
输入: { "json": "{\"id\":1,\"user\":{\"name\":\"a\"}}" }
输出:
  interface Root {
    id: number;
    user: User;
  }

  interface User {
    name: string;
  }
```

**npm_info** —— 查询某个 npm 包的最新版本、描述、许可证、主页，以及打包后体积（数据来自 npm registry 与 bundlephobia，需联网）。

```
输入: { name: "react" }
输出:
  包名: react
  最新版本: 18.x.x
  描述: React is a JavaScript library ...
  许可证: MIT
  主页: https://react.dev/
  体积(min): xx KB
  体积(min+gzip): xx KB
```

## 环境要求

- Node.js >= 18（`npm_info` 依赖 Node 18+ 内置的 `fetch`）

## 安装与构建

```bash
# 克隆项目
git clone https://github.com/alxy-1111/toolbox-mcp.git
cd toolbox-mcp

# 安装依赖
npm install

# 编译 TypeScript（src/ → dist/）
npm run build
```

## 在客户端中配置

编译出 `dist/server.js` 后，在 MCP 配置文件里注册本服务器。

**方式一：本地路径（已 build）**

```json
{
  "mcpServers": {
    "toolbox": {
      "command": "node",
      "args": ["/绝对路径/toolbox-mcp/dist/server.js"],
      "disabled": false
    }
  }
}
```

**方式二：npx 直接从 GitHub 运行（免本地编译）**

```json
{
  "mcpServers": {
    "toolbox": {
      "command": "npx",
      "args": ["-y", "github:alxy-1111/toolbox-mcp"],
      "disabled": false
    }
  }
}
```

> Kiro 的配置文件位于工作区 `.kiro/settings/mcp.json` 或用户级 `~/.kiro/settings/mcp.json`。
> Claude Desktop 位于 `claude_desktop_config.json`。

配置保存后重连 MCP 服务器，即可在对话中调用上述工具。

## 本地调试

用官方 Inspector 可视化测试工具的输入输出：

```bash
npm run inspect
```

该命令会先编译，再启动一个网页调试界面，可手动填参数测试每个工具。

## npm scripts

| 命令 | 作用 |
|------|------|
| `npm run build` | 用 tsc 编译 `src/` 到 `dist/` |
| `npm run start` | 启动服务器（需先 build） |
| `npm run inspect` | 编译并打开 Inspector 可视化调试 |

## 项目结构

```
toolbox-mcp/
├── src/
│   └── server.ts        # 服务器主入口，注册全部工具
├── dist/                # 编译产物（tsc 生成）
├── package.json
├── tsconfig.json
└── README.md
```

## 技术栈

- [TypeScript](https://www.typescriptlang.org/) 5.5（严格模式，ES2022 + NodeNext）
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) 1.x
- [zod](https://zod.dev/) 3.x —— 工具参数校验

## 开发说明

- 服务器通过 **stdio** 与客户端通信，因此**日志必须走 `console.error`（stderr）**，切勿用 `console.log`，否则会污染 stdout 上的协议数据。
- 新增工具在 `src/server.ts` 里调用 `server.registerTool(name, config, handler)` 注册，用 `zod` 定义 `inputSchema`，handler 返回 `textResult(...)` 包装的结果。
- `src/server.ts` 首行的 `#!/usr/bin/env node` shebang 会被 tsc 保留，使 `dist/server.js` 可作为命令直接执行（配合 `package.json` 的 `bin` 字段支持 npx 启动）。

## License

MIT
