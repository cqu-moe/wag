# 重庆大学分学期加权平均分计算器

浏览器本地读取重庆大学“主修成绩” `.xls` / `.xlsx` 文件，分别计算各学期加权平均分。成绩数据不会上传到服务器。

## 本地运行

```bash
pnpm install
pnpm dev
```

检查测试与生产构建：

```bash
pnpm check
```

## 部署到 Cloudflare Pages

在 Pages 项目中设置：

- 构建命令：`pnpm build`
- 构建输出目录：`dist`

也可以使用 Wrangler：

```bash
pnpm build
pnpm exec wrangler pages deploy dist --project-name <你的 Pages 项目名>
```

## 部署到 Cloudflare Workers

`wrangler.jsonc` 已配置为直接托管 `dist/` 静态资源：

```bash
pnpm deploy:workers
```

## 计算口径

`Σ（课程百分制成绩 × 课程学分）÷ Σ课程学分`

0 学分课程不计入。五级制和两级制按[重庆大学课程成绩评定补充办法（试行）](https://jwc.cqu.edu.cn/info/1075/1011.htm)换算。
