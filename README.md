# Dee's Blog

Dee 的一体化个人站点，使用 Astro 生成静态页面。当前正式完成课程目录与课程详情：课程按生物科学、生物信息、人工智能编排，详情页统一承载课程感想、Markdown/R Markdown 笔记和 PDF 预览下载。

## 本地运行

环境要求：Node.js `>= 22.12.0`，GitHub Actions 使用 Node.js 24。

```bash
npm install --no-audit --prefer-offline --no-fund
npm run import:notes
npm run server
```

默认预览地址由 Astro 在终端中给出，通常是 `http://localhost:4321`。`npm run import:notes` 会按照 `course-sources.yml` 从仓库内原稿同步已选笔记及其引用图片。

## 内容位置

```text
src/content/courses/     课程元数据与课程感想
src/content/notes/       已导入的 Markdown/Rmd 笔记和关联图片
source/course-notes/     可重新导入的课程笔记原稿与图片
source/files/            PDF 课程资料
source/_data/resources.yml
                         PDF 标题与顺序
course-sources.yml       仓库内笔记来源白名单
```

添加课程时，在 `src/content/courses/` 新建 Markdown。添加 Markdown/Rmd 笔记时，先把原稿放入 `source/course-notes/` 并更新 `course-sources.yml`，再运行 `npm run import:notes`；导入器只复制正文实际引用的图片，并会把 R Markdown 代码围栏转换为可渲染格式。

PDF 放入 `source/files/<category>/`，并在 `source/_data/resources.yml` 设置标题与顺序。启动和构建前，脚本会将 PDF 与站点图片同步到 Astro 的 `public/` 目录。

## 验证

```bash
npm test
npm run check
npm run astro:check
npm run build
```

`npm run check` 会核对站内资源和已导入笔记的完整性；`npm run import:check` 额外对照仓库内原稿检查内容与图片漂移。`npm run build` 产物位于 `dist/`。

## 部署说明

本仓库 `DeeJ6126/DeeJ6126.github.io` 同时存放 Astro 源码并发布网站。

推送到 `main` 后，`.github/workflows/deploy.yml` 依次运行测试、内容检查、Astro 检查和构建，再通过 GitHub Pages Actions 发布 `dist/`。拉取请求运行构建校验。GitHub Pages 的发布来源设为 **GitHub Actions**。

网站地址保持为 <https://deej6126.github.io/>。构建产物通过 Actions artifact 传递，`dist/` 与 `public/` 继续由工具生成。使用仓库内置的 `GITHUB_TOKEN` 和 OIDC 权限发布。

原私有仓库 `DeeJ6126/blog-source` 归档保存旧源码历史。迁移说明见 [docs/repository-layout.md](docs/repository-layout.md)。个人后台、临时验证脚本和调参截图保存在本机。
