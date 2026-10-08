# 网页鲸鱼娘

本分支把 Coopanion 的鲸鱼娘接到本站原有的桌宠壳中。桌宠默认约 180px 高，可在菜单底部调整到 120–300px，在当前窗口底边自行活动；课程页会量取左侧栏与播放器，避开其占用区域。拖动时可以拎到窗口内任意位置，松手后落地；快速拖动松手会抛出。

## 保留的互动

- 自由溜达、偶尔走走、乖乖待着三档活动频率。
- 走路、跑步、跳跃、坐下、犯困、睡觉、醒来，头发/裙摆/尾巴的惯性与呼吸、眨眼、目光跟随。
- 点击戳一戳；鼠标在角色上来回移动可摸头。普通点击和轻微鼠标抖动保持站立；快速向上拖动并松手可抛出，缓慢拖放或横向拖放自然落下。
- 菜单提供 18 个动作和 19 个表情，含挥手、跳舞、鞠躬、点头、摇头、扑腾，及爱心、睡眠、眼泪、音符等视觉粒子。
- 只使用经典 DeepSeek 原版配色；活动频率、大小、隐藏偏好仅存在浏览器 localStorage。
- 角色附近的“互动”按钮或右键打开菜单；Tab 可聚焦控制，Escape 关闭。隐藏时角色缩小到右下角，变为 48px 圆形 DeepSeek 图标；恢复时将同一组关键帧反向播放，刷新后恢复也保留动画。
- 菜单底部从左到右是“暂时躲起来”、大小滑块、“唱歌”。课程页唱歌时从头顶抛出用户提供的唱片到播放器，再播放《Let Me Go》；没有可见播放器的页面直接播放，不抛唱片、不显示播放器。
- 唱歌时头顶随机浮现彩色像素音符，用 SVG 保持像素边缘清晰；音符尺寸、间距与飘动范围随角色等比缩放，暂停、切歌、隐藏或页面转场时清理。
- 唱歌播放期间固定使用闭合嘴型，保留眼睛、表情与音符；暂停或切歌后恢复普通表情嘴型。

未引入 Electron、麦克风、语音识别、输入对话、模型服务、API Key、电脑控制、遥测或语音合成。全部互动在浏览器本地执行；唱歌使用用户提供的音频，由原站点唯一音频节点播放，保留播放器音量与跨页续播。

## 文件与实现

- `src/components/Live2DMascot.astro`：持久化舞台、命中按钮、气泡和可访问互动菜单。
- `src/scripts/live2d-mascot.js`：网页适配；30 FPS，转场/隐藏标签页/用户隐藏时暂停，不重复装配角色。
- `src/lib/whale-pet-policy.mjs`：偏好校验、显示比例、边界与气泡定位。
- `src/scripts/vendor/coopanion/`：上游浏览器行为模拟、角色绘制和 WebGL 网格引擎。
- `source/img/whale-pet/`：上游经典原版 PNG 与模型描述；由已有资源同步工具复制到 public。

保留 `.live2d-mascot` 与其 transition:persist 名称，接入原开场同一把时钟的淡入。只对角色附近的按钮接收按下事件，其余画面鼠标穿透；站点页头、音乐面板的更高层级保留。按当前 DOM 量取行走区域，每次站内导航和 resize 更新，不逐帧扫描页面。

旧 Live2D 模型与运行库已移除。新渲染器只绘制角色大小的 WebGL canvas；全屏 SVG 负责定位与少量粒子。仅载入经典原版纹理，不引入其他配色。

## 来源与许可

上游：https://github.com/Pal-AI-Lab/Coopanion
固定 commit：`5557c130a1285758ea14086437db7164aa83d997`
原位置：`packages/cortico-world-desktop-pet/web/kit/{body,rig}.js`、`web/whale/figure.js` 与 `web/whale/` 下的原版图片、model.json。
导入时按 Git blob SHA-1 校验来源文件。按用户要求仅保留原版素材，并将 model.json 的 schemes 限为 deepseek。rig.js 保留原样；body.js 增加网站点击与向上抛出的策略参数，figure.js 增加闭嘴选项及纹理加载失败后的缓存清除。

复制的上游代码采用 AGPL-3.0-or-later，完整许可与声明保存在 `src/scripts/vendor/coopanion/LICENSE`、`THIRD_PARTY_NOTICES.md`。鲸鱼娘贴图不在该授权范围内；原设为“溟月”（上善无形），DeepSeek 女仆装二创参考 ZipZipPipe，贴图由上游按参考图生成并拆件。上游要求在其他项目使用时自行确认原设与商标权利。圆形图标的 DeepSeek SVG 来自 `lobehub/lobe-icons` 的 `packages/static-svg/icons/deepseek-color.svg`；唱片与歌曲由用户提供。

## 验证记录

- npm test：73 项通过。
- npm run check：115 份资料、19 篇导入笔记通过。
- npm run astro:check：0 errors、0 warnings（104 条 hints，含既有源码与上游未使用参数提示）。
- npm run build：19 个静态页面构建成功。
- Chromium 实测：自主位移超过 200px；全部 18 个动作、19 个表情；点击与摸头；拖拽、抛出、落地；音乐音量控件；课程→项目→关于→课程详情的角色/音频身份保留；1280×720 和 1920×1080 边界；隐藏偏好、恢复；reduced-motion。最终实测无页面运行错误或资源加载错误。
- 临时脚本、截图、报告留在 .tmp/，不入库。
