# 多维表格边栏插件：批量图片上传

把一批图片按文件夹名写入对应的多维表格记录，适合商品图、素材包、项目图片归档等高频批量上传场景。用户选择父目录后，插件会按子文件夹名称匹配表格行，并将图片写入附件/图片字段。

当前版本接入 Firefly 积分体系：用户填写自己的 Firefly API Key，确认存在可上传记录后，每次运行消耗 10 积分；没有可上传记录不消耗积分。图片仍由飞书多维表格 JS SDK 在当前用户权限下直接写入表格，不经过 Firefly 服务器。

## 快速开始

```bash
cd sidebar-plugin
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

在多维表格左侧「插件」面板点击「自定义插件」→「新增插件」，填入运行地址（本地开发可用 `http://localhost:5173/` 或 `http://你的局域网IP:5173/`），即可加载边栏。

生产发布执行：

```bash
npm run build
```

构建后的 `dist/` 是飞书官方托管时使用的静态产物。插件中心提交的是 GitHub 项目地址；审核通过后，飞书会 Fork 并部署仓库中 `package.json` 的 `output` 字段指定目录。

## 插件中心仓库要求

官方提交地址：`https://github.com/chenchen1010/sidebar-plugin`

1. 每次更新代码后运行 `npm run build`。
2. 将最新 `dist/` 一并提交到 GitHub，不得在 `.gitignore` 忽略该目录。
3. `package.json` 保持 `"output": "dist"`。
4. Vite 保持 `base: "./"`，HTML 和构建产物不得使用站点根路径。
5. 本项目不使用 history 路由；如后续增加多页路由，使用 hash 路由。

## 多语言与主题

- 插件支持中文、英文和日文，默认跟随浏览器语言。
- 本地验收可使用 `?lang=zh`、`?lang=en` 或 `?lang=ja` 切换界面语言。
- 插件监听飞书主题变化，支持浅色和深色外观；本地可使用 `?theme=dark` 验收暗色界面。

## Firefly 配置

默认计费端点：

```text
https://firefly.qwjxqn.xyz/api/products/batch-image-upload/deduct
```

可选环境变量：

```bash
VITE_FIREFLY_BILLING_ENDPOINT=https://firefly.qwjxqn.xyz/api/products/batch-image-upload/deduct
VITE_FIREFLY_HOME_URL=https://firefly.qwjxqn.xyz
VITE_FIREFLY_FEEDBACK_GROUP_URL=填入公开反馈群链接
VITE_BATCH_IMAGE_UPLOAD_GUIDE_URL=填入使用指南链接
```

不要把真实 Firefly API Key 写进 `.env.local` 或源码；API Key 由用户在插件界面输入。

`FIREFLY_FEEDBACK_WEBHOOK_URL` 只允许用于后端/代理服务，不要以 `VITE_` 前缀暴露到前端打包产物。

## 发布素材

- 插件 logo：`public/firefly-batch-image-logo.png`（512 × 512）
- 产品设计图：`public/firefly-batch-image-product.png`（1920 × 960）
- Hero 背景图：`public/firefly-batch-hero-bg.png`（1672 × 941）

## 使用步骤

1. 点击右侧齿轮，填写 Firefly API Key；需要下次自动带入时，可勾选「在当前浏览器记住 Key」。
2. 选择「匹配字段」：子文件夹名称将与该字段值匹配，用来定位表格行。
3. 选择「图片字段」：附件/图片字段，图片会写入这里。
4. 设置「单行上限」和「主图关键词」（默认 `封面`）。
5. 点击「选择文件夹 预览上传效果」，选择包含多个子文件夹的父目录。
6. 确认预览和日志无误后，点击「开始上传」。确认存在可上传记录后才消耗 10 积分。

## 规则与行为

- 支持图片格式：`jpg`、`jpeg`、`png`、`gif`、`bmp`、`webp`。
- 父目录下每个子文件夹对应一条表格记录。
- 子文件夹名称需与匹配字段值一致。
- 上传顺序：命中主图关键词的图片优先，其次按文件名中的数字从小到大排序。
- 每行超过上限的图片会被自动截断。
- 插件在前端运行，使用当前登录用户在多维表格中的权限写入。
- Firefly 只处理 API Key 校验、积分扣除和消费流水；不接收、不存储用户图片。

## 官方插件中心上架检查

- 功能入口：边栏插件首屏可完成 API Key 设置、字段选择、父目录选择和上传。
- 计费说明：界面展示「有可上传记录才消耗10积分」。
- 帮助入口：Hero 中 `使用指南` 链接指向公开飞书文档。
- 支持入口：Hero 中 `联系我们` 链接指向公开反馈群。
- 隐私说明：图片不经过 Firefly 服务器，只在当前浏览器和飞书多维表格之间写入。
- GitHub 仓库：包含最新 `dist/` 和带 `"output": "dist"` 的 `package.json`；不要提交 `.env.local`、`node_modules/`、`tmp/`、`prototypes/`。
- 国际化：`src/locales/` 包含中文、英文和日文文案。
- 主题：界面已适配浅色和深色外观。

## 常见问题

- 日志出现 `无法连接 Firefly 计费服务` / `Failed to fetch` 时，通常不是 Key 或余额问题，而是浏览器没有连上计费接口。先确认 `VITE_FIREFLY_BILLING_ENDPOINT` 指向的 Firefly 版本已部署 `/api/products/batch-image-upload/deduct`，且该接口的 `OPTIONS` 预检返回 CORS 头；修改 `.env.local` 后需要重启 Vite。
- 如果附件字段不允许写入，确认当前账号在表格内有编辑权限。
- 拖拽文件夹时，部分浏览器可能不给出目录结构，若未识别到子文件夹，请改用「选择文件夹 预览上传效果」按钮。
- 如需修改支持的图片格式，可在 `src/App.tsx` 的 `SUPPORTED_IMAGE_EXTS` 常量中调整。
