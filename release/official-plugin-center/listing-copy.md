# 官方插件中心上架文案：图片批量上传（支持文件夹+字段匹配）

## 基础信息

- 插件名称：图片批量上传（支持文件夹+字段匹配）
- 英文名称：Batch Image Upload (Folder + Field Matching)
- 一句话简介：按文件夹名匹配表格行，把一批图片写入对应记录。
- 推荐分类：批量处理 / 附件处理 / 导入导出
- 适用用户：电商运营、素材管理、项目资料归档、设计/内容团队
- Firefly 官网：https://firefly.qwjxqn.xyz
- 使用指南：https://gcn6bvkburhk.feishu.cn/docx/GBSldiL5doEsq8xAqIJca6hFnqg?from=from_copylink

## 短描述

按子文件夹名称自动匹配多维表格记录，把商品图、素材包、项目图片批量写入图片/附件字段，减少重复拖拽和手动整理。

## 详细介绍

图片批量上传（支持文件夹+字段匹配）适合需要把大量图片整理进多维表格的团队。你只需要按记录名称准备好子文件夹，在插件里选择匹配字段和图片字段，再选择父目录，插件会把每个子文件夹内的图片写入对应记录。

常见场景：

- 商品图归档：每个 SKU 一个文件夹，快速写入商品图字段。
- 素材包整理：按项目、主题或客户名称建文件夹，统一归档到表格。
- 项目图片上传：把拍摄、设计、交付图片批量写进项目记录。

计费规则：

- 有可上传记录才消耗 10 积分。
- 没有匹配记录或没有可上传图片时不消耗积分。
- 图片不经过 Firefly 服务器，由当前飞书账号权限直接写入多维表格。

## 核心卖点

- 按文件夹匹配：子文件夹名对应表格记录，减少手工找行。
- 批量写入图片：一次选择父目录，集中写入多条记录。
- 主图优先：命中文件名关键词的图片优先排在前面。
- 可控消耗：确认存在可上传记录后才消耗 Firefly 积分。
- 权限清晰：使用当前飞书账号权限写入，图片不上传到 Firefly。

## 审核说明

本插件使用 Firefly 积分计费，用户需在插件内填写自己的 Firefly API Key。API Key 用于确认账户余额、扣除积分和记录消费流水。

图片文件只在用户本地浏览器和飞书多维表格之间处理，由飞书多维表格 JS SDK 直接写入当前表格。Firefly 服务不接收、不存储用户图片。

## 上传素材

- 插件 logo：`public/firefly-batch-image-logo.png`
- 产品设计图：`public/firefly-batch-image-product.png`
- 英文产品设计图：`public/firefly-batch-image-product-en.png`
- 中文运营图：`public/batch_image_upload_cn.png`（580 × 320）
- 英文运营图：`public/batch_image_upload_en.png`（580 × 320）
- GitHub 项目地址：`https://github.com/chenchen1010/sidebar-plugin`
- 官方托管产物：仓库中的 `dist/`

## 用户支持

- 使用指南：Hero 区域「使用指南」链接
- 联系我们：Hero 区域「联系我们」链接，跳转官方群
- 官方群：https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=953t810b-daf3-4b66-8d3c-c6f0c2184690
- 建议用户反馈时提供：表结构截图、文件夹命名示例、运行日志截图

如果有问题，可以[联系我们并加入官方群](https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=953t810b-daf3-4b66-8d3c-c6f0c2184690)，我们会及时优化。
