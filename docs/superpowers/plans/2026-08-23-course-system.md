# Astro Course System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the removed Hexo frontend with a production Astro course experience that imports the user's real PDF, Markdown, R Markdown, and image assets.

**Architecture:** Astro renders static course index and detail routes from validated local content. Existing `source/files/` and `source/_data/resources.yml` remain the PDF source of truth; a reusable Node importer copies external note sources and only their referenced images into `src/content/notes/`. Focused browser scripts enhance native HTML for filtering, scroll highlighting, and mutually exclusive note readers.

**Tech Stack:** Astro, TypeScript, Node.js test runner, js-yaml, remark-math, rehype-katex, KaTeX, CSS, browser-native PDF viewer.

---

### Task 1: Astro Foundation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `_config.yml`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `src/env.d.ts`

- [ ] **Step 1:** Update package scripts so `npm run build` runs content checks then `astro build`, `npm run server` runs `astro dev`, and `npm run preview` runs `astro preview`.
- [ ] **Step 2:** Install `astro`, `@astrojs/check`, `typescript`, `remark-math`, `rehype-katex`, and `katex`; remove unused theme/rendering dependencies after confirming no shared Node module imports them.
- [ ] **Step 3:** Configure Astro for static output at `https://DeeJ6126.github.io`, enable math rendering, and add a small integration that serves `source/files/` and `source/img/` during development and copies them to `dist/files/` and `dist/img/` after build.
- [ ] **Step 4:** Run `npm install` and `npm run build`; expect the first build to fail only because pages do not exist yet.
- [ ] **Step 5:** Commit the foundation files.

### Task 2: External Note Importer

**Files:**
- Create: `lib/course-import.js`
- Create: `tools/import-course-notes.js`
- Create: `test/course-import.test.js`
- Create: `course-sources.yml`

- [ ] **Step 1:** Write failing tests for parsing Markdown image references, converting fenced ````{r}` blocks to ````r`, rejecting missing images, and producing identical output on repeated runs.
- [ ] **Step 2:** Implement `extractLocalImageReferences(markdown)`, `normalizeRMarkdown(markdown)`, `resolveImportedAssets(sourceFile, references)`, and `importCourseSources(config, destination)` using filesystem APIs and normalized forward-slash paths.
- [ ] **Step 3:** Add source declarations for AnnData, R, Scanpy, 动手学深度学习, and 深度学习导论. Each declaration lists exact source files and the destination course slug; no directory-wide wildcard may silently include extra notes.
- [ ] **Step 4:** Implement a CLI with `--check` and `--write`. `--check` reports drift without modifying files; `--write` replaces generated course-note copies and writes a manifest containing source path, destination path, and copied assets.
- [ ] **Step 5:** Run `node --test test/course-import.test.js`; expect all importer tests to pass.
- [ ] **Step 6:** Commit importer code and tests.

### Task 3: Migrate Real Course Content

**Files:**
- Create: `src/content.config.ts`
- Create: `src/content/courses/*.md`
- Create: `src/content/notes/<course-slug>/*.md`
- Create: `src/assets/courses/**`
- Create: `src/assets/notes/**`
- Modify: `source/_data/resources.yml`

- [ ] **Step 1:** Define course and note schemas with unique slugs, discipline enum, positive order, summary, cover, optional `resourceCategory`, course reference, and source metadata.
- [ ] **Step 2:** Add seven course Markdown documents. Their bodies contain existing course descriptions where available and a short factual placeholder-free course reflection when no reflection source exists.
- [ ] **Step 3:** Run `node tools/import-course-notes.js --write`; verify it imports only `AnnData.md`, R projects 1-3, two Scanpy notes, seven D2L notes, and `生成模型.md`, plus referenced images.
- [ ] **Step 4:** Add generated/imported files to content checks. A missing source file, missing referenced image, duplicate slug, or invalid course reference must fail `npm run check` with an exact path.
- [ ] **Step 5:** Run `npm test` and `npm run check`; expect both to pass.
- [ ] **Step 6:** Commit migrated course content and assets.

### Task 4: Shared Layout and Visual System

**Files:**
- Create: `src/layouts/SiteLayout.astro`
- Create: `src/components/SiteHeader.astro`
- Create: `src/styles/global.css`
- Create: `src/styles/reading.css`
- Create: `public/favicon.svg`

- [ ] **Step 1:** Build a fixed header with `DEE'S BLOG`, 课程, 项目, 关于, and a contextual action slot. Nonexistent project/about routes render as non-link labels in this slice rather than broken links.
- [ ] **Step 2:** Implement the confirmed visual tokens: gray-white paper, deep/cobalt blue, cyan, restrained lime, square geometry, one-pixel rules, print grain, zero-radius framed tools, and readable Chinese typography.
- [ ] **Step 3:** Add desktop-first responsive constraints so content never overlaps below 920px; mobile remains a basic readable fallback.
- [ ] **Step 4:** Add SEO title, description, canonical URL, reduced-motion base rules, and semantic landmarks.
- [ ] **Step 5:** Run `npx astro check`; expect zero errors.
- [ ] **Step 6:** Commit the shared shell.

### Task 5: Course Long-Scroll Page

**Files:**
- Create: `src/pages/index.astro`
- Create: `src/components/CourseRail.astro`
- Create: `src/components/CourseEntry.astro`
- Create: `src/scripts/course-index.js`
- Create: `test/course-index.test.js`

- [ ] **Step 1:** Write tests for case-insensitive course-name filtering and preserving discipline order.
- [ ] **Step 2:** Render biology, bioinformatics, and AI sections from the course collection, with alternating exhibition rows and no introductory hero block.
- [ ] **Step 3:** Add the fixed transparent discipline rail. An IntersectionObserver changes the dark active item as sections enter the viewport; clicking a rail item scrolls to it.
- [ ] **Step 4:** Add the small top-right search icon and expandable input. Filtering matches course title only, preserves section headings that contain matches, and displays one no-results message.
- [ ] **Step 5:** Run tests and `npx astro check`; expect all checks to pass.
- [ ] **Step 6:** Commit the course index.

### Task 6: Production Course Detail Page

**Files:**
- Create: `src/pages/courses/[slug].astro`
- Create: `src/components/CourseHero.astro`
- Create: `src/components/NoteList.astro`
- Create: `src/components/MarkdownNote.astro`
- Create: `src/components/PdfNote.astro`
- Create: `src/lib/course-data.ts`
- Create: `src/scripts/note-readers.js`
- Create: `test/course-data.test.js`

- [ ] **Step 1:** Write tests that merge course metadata, Markdown notes, and PDF resources into one ordered list; PDF titles must come from `resources.yml`.
- [ ] **Step 2:** Generate one static route per course and render the confirmed title, cover, 课程感想, and 课程笔记 structure.
- [ ] **Step 3:** Render note entries as native `details`. Markdown bodies include heading links, code highlighting, math, and repository-local images. PDF bodies use an iframe plus open-in-new-window and download fallbacks.
- [ ] **Step 4:** Enhance `details` so opening one closes the previously open note and scrolls the reader into a comfortable viewport position. Without JavaScript, every note remains manually expandable.
- [ ] **Step 5:** Render explicit states for no reflection, no notes, failed PDF embedding, and unavailable downloads without hiding the working actions.
- [ ] **Step 6:** Run tests, content checks, Astro checks, and build; expect all to pass.
- [ ] **Step 7:** Commit the production course details.

### Task 7: End-to-End Verification and Documentation

**Files:**
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`
- Modify: `.github/workflows/pages.yml`
- Modify: `.gitignore`

- [ ] **Step 1:** Update GitHub Pages workflow to install dependencies, run tests/checks/Astro check, build `dist/`, and upload `dist/` without calling `npm run deploy`.
- [ ] **Step 2:** Document course authoring, external-note import, PDF placement, image rules, and local preview commands.
- [ ] **Step 3:** Run `npm test`, `npm run check`, `npx astro check`, and `npm run build`; all commands must exit zero.
- [ ] **Step 4:** Start the Astro dev server and verify with Playwright at desktop and basic mobile widths: index scrolling, rail highlighting, course filtering, 生物化学 PDF preview/download, R Markdown/code/image rendering, and no console errors.
- [ ] **Step 5:** Inspect `git status` and ensure generated `dist/`, user-owned `.dsh-vision-toolkit/`, `docs/blue-sky-demo/`, and unrelated `.gitignore` changes are not accidentally committed.
- [ ] **Step 6:** Commit documentation and workflow changes.

