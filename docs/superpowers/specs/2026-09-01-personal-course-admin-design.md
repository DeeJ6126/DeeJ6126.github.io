# 2026-09-01 个人课程后台 admin v2 — spec

## 目标（与 v3 差异）

v3 把栏目塞进单一 .md 文件用 `## ` 切分（"结构藏在字符串里"），用户反馈："看不懂 admin"、"想拖图片上传"、"想预览图片"。

v2 把每个栏目独立成文件，admin 改成资源化分层，新增图片拖拽 + 预览。

## 数据模型

```
src/content/courses/<slug>/
  _meta.md                 课程元数据（front matter only）
  sections.yml             栏目清单（顺序 + 类型 + 标题）
  01-课程感想.md           text 栏目
  02-课程笔记/             files 栏目
    _section.md            栏目前置元数据（front matter: title, type=files, order, files: [...]）
    files/                 真实文件目录（PDF 引用 / 图片物理位置）
  03-复习提纲.md           text 栏目
```

`sections.yml` 显式声明顺序：
```yaml
- id: 课程感想
  type: text
  title: 课程感想
- id: 课程笔记
  type: files
  title: 课程笔记
- id: 复习提纲
  type: text
  title: 复习提纲
```

### 文件存放规则

| 类型 | 物理位置 | 引用形式 |
| --- | --- | --- |
| PDF | `source/files/<resourceCategory>/<name>.pdf` | files 栏目的 `files:` 引用 pool |
| Markdown 笔记 | `source/course-notes/<slug>/<name>.md` | Astro `notes` 集合 + files 引用 |
| 图片 | `source/img/courses/<slug>/<section>/<name>.<ext>` | markdown `![alt](/img/courses/...)` |

## 架构

```
admin/
  server.mjs              bind 127.0.0.1:4322 + 路由分发
  config.mjs              常量
  lib/                    http.mjs / path-safe.mjs / yaml.mjs
  api/                    courses.mjs / sections.mjs / files.mjs
  storage/                courses.mjs / sections.mjs / files.mjs
  views/                  layout.mjs + pages/{index,course,section-text,section-files}.mjs
  assets/                 style.css + app.js
```

storage/ 是唯一写盘层；api/ 不直接调 fs；views/ 只产 HTML 字符串；app.js 处理拖拽 / 预览 / 异步保存。

## 路由

### 页面
- `GET /` — 课程列表
- `GET /courses/:slug` — 课程编辑主页（侧栏树 + 元数据表单 + 栏目列表）
- `GET /courses/:slug/sections/new?type=text|files` — 新增栏目表单
- `GET /courses/:slug/sections/:id/edit?type=text|files` — 编辑栏目

### API
- `GET /api/courses` 列表
- `GET /api/courses/:slug` 单门课 + sections 列表
- `PUT /api/courses/:slug` 改 front matter
- `POST /api/courses/:slug/sections` 新增栏目 `{id, type, title}`
- `PUT /api/courses/:slug/sections/:id` 改 title / id（重命名）
- `POST /api/courses/:slug/sections/:id/reorder` `{direction}` 上下移
- `POST /api/courses/:slug/sections/reorder` `{order: [id1,id2,...]}` 整体重排
- `DELETE /api/courses/:slug/sections/:id` 删栏目 + 子文件
- `PUT /api/courses/:slug/sections/:id/text` 改 text 栏目正文 `{body}`
- `GET /api/courses/:slug/sections/:id/files` 列出 files 引用
- `POST /api/courses/:slug/sections/:id/files/upload` multipart 上传（PDF/图片/MD）
- `PUT /api/courses/:slug/sections/:id/files/:name` 改引用 metadata（title/shareUrl）
- `DELETE /api/courses/:slug/sections/:id/files/:name` 删引用 + 物理文件（图片/笔记）

## 路径白名单
- `src/content/courses/<slug>/**`
- `src/content/notes/**`
- `source/course-notes/**`
- `source/files/**`
- `source/img/courses/**`
- `source/_data/resources.yml`
- `course-sources.yml`

## 上传类型
- PDF: `.pdf`
- Markdown: `.md` / `.Rmd` / `.rmd`
- 图片: `.png` / `.jpg` / `.jpeg` / `.webp` / `.svg` / `.gif`
- 单文件上限 10 MB

## 迁移 `tools/migrate-v1-to-v2.js`

替代 `add-default-sections.js`，对每门 v1 课程：

1. 建 `src/content/courses/<slug>/` 目录。
2. v1 的 front matter → `<slug>/_meta.md`。
3. 解析 v1 body，按 `## ` 切栏目：
   - text 栏目 → `<slug>/<id>.md`（body 是原 section body）
   - files 栏目 → `<slug>/<id>/_section.md`（front matter 含 `files:` 列表，从原 `- [title](url)` 行解析 + `<!-- share:... -->` 注释）；建 `files/` 目录（**不**复制物理文件，PDF 仍在 `source/files/`）
4. 写 `<slug>/sections.yml`。
5. 删原 `<slug>.md`。

## Astro 集成

- `content.config.ts` courses loader 改 `'**/_meta.md'`
- `[slug].astro` 直接读 `sections.yml` 渲染栏目（不开新 collection）
- 图片 markdown 引用 `/img/courses/...` 由 `tools/sync-static-assets.js` 同步到 `public/`
- 现有 `parse-course-body.js` 保留但不再被 [slug].astro 直接调用

## YAGNI
实时预览 / CodeMirror / 项目页 / 远程访问 / 并发锁 / 自动 build / 草稿 / 撤销 / admin 入库 — 都不做。

## 验收
- `npm test` ≥ 8 条 admin 断言通过
- `npm run check` 不报新错
- `npm run build` 17 页产出，迁移后视觉一致
- 迁移脚本 dry-run 13 门课有合理计划
- admin 启动后 `<body data-admin-version="2">`
- 删除 admin/ 后 `npm test` / `npm run build` 行为不变
