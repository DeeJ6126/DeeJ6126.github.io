# 单仓库结构

现在统一维护公开仓库 `DeeJ6126/DeeJ6126.github.io`，网站仍为 `https://deej6126.github.io/`。

- `main` 保存 Astro 源码、内容原稿、静态素材、测试和构建配置。
- `.github/workflows/deploy.yml` 在 push 到 main 时完成 test、check、astro:check、build，再把 dist artifact 发布到 Pages；pull request 运行校验。
- Pages 发布来源为 GitHub Actions；发布任务使用 `pages: write` 与 `id-token: write`，构建与发布在同一个仓库内完成。
- `dist/`、`public/`、`.astro/`、`node_modules/` 为生成或依赖目录；`admin/`、`.tmp/`、`.dsh-vision-toolkit/` 留在本机。

本次迁移采用已提交源码 `blog-source@78c924fce9e026507a732361c0e54d5e74893faf`，保留网站仓库已有提交历史。原 `blog-source` 归档保留完整旧源码历史。本机未提交修改不包含在迁移快照中。

本机工作目录仍为 `E:\BlogFile`；origin 指向公开仓库，旧源码远端保留为 blog-source。本机旧源码 main 另外保存在 `codex/source-history-before-consolidation` 分支。
