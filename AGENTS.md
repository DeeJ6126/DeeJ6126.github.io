# AGENTS.md

本文件适用于本仓库及全部子目录。

## 项目与部署

Dee 的 Astro 7 静态个人站点，包含课程、项目、关于三个板块。
公开仓库为 `DeeJ6126/DeeJ6126.github.io`；main 保存源码。
`.github/workflows/deploy.yml` 完成测试、内容检查、Astro 检查、构建与 Pages artifact 发布。
网站地址为 https://deej6126.github.io/。push 到 main 会部署；发布来源为 GitHub Actions。
旧 blog-source 归档保留历史。迁移说明见 docs/repository-layout.md。

## 工作原则

- 前后端、动效、桌宠与音乐播放器均属于正常维护范围。
- 严格遵循用户当前要求，保持改动聚焦。
- 仅在用户明确要求时使用 Skill。
- 绝不覆盖或撤销用户未提交的改动；提交时显式列出文件，不使用 git add -A。
- 使用直接、清晰的表达。
- 默认不需要考虑手机视角。
- 新增依赖前核对现有依赖，并更新锁文件。
- 不将访问令牌、密码或其他秘密写入源码。

## 前端与动效

沿用现有纸面、墨蓝、蓝色、细边框与留白，视觉方向由用户主导。
封面图采用 object-fit: contain 和纸面背景。不要调整用户未指定的视觉部分。
参数调整优先使用可调工具；涉及视觉或动效必须在浏览器测量并截图或采样验证。

SiteLayout.astro 使用 ClientRouter；MotionLayer 跨页面持久化。
site-motion.js 处理导航与生命周期，motion-timelines.mjs 定义 intro、section、course、project 时间线。
开场几何采用 1920×1080 参考帧并居中；所有开场动画使用同一把时钟。
关键帧 offset 单调不减，最后延伸至 1；页面浮现由 JS 驱动。

## 课程与资源

每门课在 src/content/courses/<slug>/，包含 _meta.md、sections.yml 和栏目文件。
text 栏目是 <id>.md；files 栏目是 <id>/_section.md 及资源引用。
笔记原稿在 source/course-notes/，通过 course-sources.yml 与 import:notes 导入。
已导入笔记和图片在 src/content/notes/；项目内容在 src/content/projects/。
PDF、图片、音乐在 source/；tools/sync-static-assets.js 同步到 public/。

## 音乐与桌宠

音频节点由 SiteLayout 的 head 脚本创建，暴露为 window.__bgmAudio，并在 page-load 后挂回 head。
音频事件仅绑定一次，UI 通过 window.__bgmUi 获取当前节点；队列和索引保存在 window。
默认音量 0.18；记住显式暂停和零音量；进度按歌曲 id 保存，写入走 persistTime。
项目与关于页隐藏播放器但继续播放。桌宠唱歌复用已有音频节点。
Coopanion 鲸鱼娘的代码、素材来源与授权说明见 docs/whale-web-pet.md。

## 本机文件与生成物

不得直接编辑 dist/、public/、.astro/、node_modules/。
admin/ 是仅本机运行的后台，不入库，只绑定 127.0.0.1；迁移新机器需从本机备份恢复。
.tmp/ 和 .dsh-vision-toolkit/ 是本机工具与验证产物，已忽略，不提交。

## 验证

完成改动后运行：

```bash
npm test
npm run check
npm run astro:check
npm run build
```

涉及动效、样式、桌宠或播放器还需浏览器实测。
逐帧采样用 requestAnimationFrame 与 getBoundingClientRect；精确时刻以动画自身 currentTime 为准。
临时验证脚本与截图放在 .tmp/。
用户催进度时也要完成验证。未经用户要求不主动 push。
