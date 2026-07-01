#!/usr/bin/env node
// toolbox-mcp —— 自定义 MCP 服务器(TypeScript 版)
// 通过 stdio 与 Kiro / Claude 等客户端通信,暴露若干工具(tool)。
// 第一行 #!/usr/bin/env node 是 shebang:编译后 tsc 会保留它,
// 让 `npx github:用户名/toolbox-mcp` 能把编译产物当命令直接启动。
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
// 1) 创建服务器实例。name/version 会在客户端里显示。
const server = new McpServer({
    name: "toolbox-mcp",
    version: "1.0.0",
});
// 2) 注册工具:add —— 计算两个数之和。
//    参数用 zod 定义,回调的参数类型会由 zod schema 自动推导(无需手写类型)。
server.registerTool("add", {
    title: "加法",
    description: "计算两个数字的和",
    inputSchema: {
        a: z.number().describe("第一个加数"),
        b: z.number().describe("第二个加数"),
    },
}, async ({ a, b }) => {
    return {
        content: [{ type: "text", text: String(a + b) }],
    };
});
// 3) 注册工具:get_time —— 返回当前时间(无参数工具示例)。
server.registerTool("get_time", {
    title: "获取当前时间",
    description: "返回服务器当前的日期和时间(ISO 格式)",
    inputSchema: {},
}, async () => {
    return {
        content: [{ type: "text", text: new Date().toISOString() }],
    };
});
// 4) 注册工具:reverse_text —— 把字符串反转(带一个字符串参数示例)。
server.registerTool("reverse_text", {
    title: "反转文本",
    description: "把输入的字符串首尾反转后返回",
    inputSchema: {
        text: z.string().describe("需要反转的文本"),
    },
}, async ({ text }) => {
    const reversed = [...text].reverse().join("");
    return {
        content: [{ type: "text", text: reversed }],
    };
});
// 5) 用 stdio 传输方式启动服务器。
//    注意:MCP 用 stdout 传协议数据,调试信息一律走 stderr(console.error)。
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("toolbox-mcp 服务器已启动,等待客户端连接...");
}
main().catch((err) => {
    console.error("服务器启动失败:", err);
    process.exit(1);
});
