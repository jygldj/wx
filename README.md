# 道玄文集 · 网站说明（README）

> 最后更新：2026-07-25
> 维护人：jygldj ｜ 本地工作目录：`F:\github-dx\wx`

---

## 一、项目简介

- **性质**：个人文集网站（诗 / 词 / 散文 / 其它），自娱自乐，朋友圈分享。
- **类型**：纯静态站点，无构建命令（Cloudflare Pages 直接托管）。
- **线上域名**：https://daoxuanwenji.pages.dev
- **源码仓库**：https://github.com/jygldj/wx
- **部署方式**：推送到 GitHub → Cloudflare Pages **自动部署**（约 1–2 分钟）。
- **划词查字典**：站点内置「新华字典」功能（Cloudflare Pages Functions + KV）。

---

## 二、文件地图

| 文件 / 目录 | 作用 |
|---|---|
| `index.html` | 扉页（封面） |
| `index1.html` | 阅读主页：文章目录 + 正文渲染 + 导航栏（含「新华字典」入口） |
| `search.html` | 全文搜索页（已注入 `dict.js`，支持划词查字） |
| `build.html` | 文章更新工具页（由 `更新网站.bat` 打开） |
| `jianjie.html` | 关于作者 / 版权页 |
| `新华字典.html` | 独立查字页：输入框直查 + 支持 `?word=` 自动查词 |
| `render.js` | 正文渲染器 + 夜间模式 / 字号 / 分享工具条 |
| `articles.js` | 文章索引数据（**由更新工具自动生成，禁止手改**） |
| `build-core.js` | 更新工具核心逻辑（`build.html` 调用） |
| `dict.js` | 划词查字典前端脚本（桌面端即时弹卡 / 移动端 4 秒后弹轻量提示） |
| `style.css` / `cover.css` | 站点样式 |
| `sw.js` | Service Worker（离线缓存；版本号 `dxwj-v4`，改版时递增并清理旧缓存） |
| `articles/` | 文章正文 Markdown 源文件（如 `001-道德经.md`） |
| `images/` | 文章配图等资源 |
| `functions/api/dict.js` | Cloudflare Pages Function：字典查询后端（读 KV `DICT_KV`） |
| `更新网站.bat` | 双击打开 `build.html` 更新工具（Edge 浏览器） |
| `push-now.bat` | 一键提交并推送到 GitHub（已配 `schannel` 后端，规避代理 SSL 问题） |
| `改动说明.md` | 历次重要改动记录 |
| `wsf.jpg` / `wsf.png` / `wsf.webp` | 站点分享卡片配图（OG 图） |

---

## 三、技术架构

```
浏览器
  ├─ 静态资源（HTML/CSS/JS）→ Cloudflare Pages 直接托管
  ├─ 划词查字典
  │     └─ fetch → /api/dict?word=某字 → Pages Function
  │                                      └─ 读 Cloudflare KV (DICT_KV)
  └─ 新华字典.html 直查 → 同上接口
GitHub (jygldj/wx) ──push──> Cloudflare Pages 自动部署
```

- **静态托管**：Cloudflare Pages（`daoxuanwenji` 项目）
- **后端**：Cloudflare Pages Functions（`functions/api/dict.js`）
- **数据存储**：Cloudflare KV，命名空间 **`DICT_KV`**，id：`e9e3ca2874cd4affbc778f7b7e26f765`
- **字典数据源**：[chinese-xinhua](https://github.com/pwxcoo/chinese-xinhua)（单字 / 词语 / 成语），约 5.3 万条键（首字分桶压缩后）

---

## 四、本地工作目录

- **当前目录**：`F:\github-dx\wx`（从 `github.com/jygldj/wx` 克隆，含最新提交）
- 旧工作副本 `F:\WorkBuddy\wx2` 已归档到 `F:\WorkBuddy\_archive_2026-07-25\`，日常不再使用。
- 日常所有修改都在 `F:\github-dx\wx` 内进行，然后推送。

---

## 五、日常工作流（更新网站）

### 1. 写 / 改文章
- 在 `articles/` 下新增 / 编辑 `.md` 文件；或在 `build.html` 工具里操作。
- **`articles.js` 由工具自动生成，切勿手动编辑。**

### 2. 提交并推送
**方式 A（推荐 · 命令行）**：双击 `F:\github-dx\wx\push-now.bat`
- 已内置 `git config http.sslbackend=schannel`，可规避本机代理导致的 SSL 证书错误。

**方式 B（GitHub Desktop）**：
- 打开 GitHub Desktop → 仓库目录选 `F:\github-dx\wx` → `Commit & Push`。
- ⚠️ 若 Desktop 报 `unable to get local issuer certificate` 之类的 SSL 错误，请改用 **方式 A**。

### 3. 自动部署
- 推送成功后，Cloudflare Pages 会在 **1–2 分钟**内自动重新部署。
- 刷新 `https://daoxuanwenji.pages.dev` 即可看到更新（如有缓存，强制刷新 Ctrl/Cmd+Shift+R）。

---

## 六、划词查字典

- **启用范围**：`index1.html`、`search.html` 已引入 `dict.js`。
- **桌面端**：鼠标划中 1–4 个汉字（单字 / 词语 / 成语）→ 即时弹出释义卡片；右上角 `×` 关闭。长释义可在卡片内**滚动**查看。
- **移动端**：手指划中字词 → **等待 4 秒** → 弹出轻量提示「请到字典页面查看 ›」；点链接直达 `/新华字典.html?word=选中词` 看完整释义；`×` 关闭提示。
  - 设计原因：手机屏小、选词不灵敏，故延迟 4 秒避免误触，并用独立页面承载完整释义（避免一屏装不下）。
- **数据来源**：Cloudflare KV `DICT_KV`（单字 / 成语 / 词语桶）。

---

## 七、新华字典.html（独立查字页）

- **入口**：`index1.html` 导航栏「新华字典」；或文章页移动端提示链接。
- **功能**：
  - 顶部输入框直接查单字 / 词语 / 成语。
  - 支持从 URL 参数自动查词：`新华字典.html?word=道` 打开即显示「道」的释义（供文章页跳转）。

---

## 八、故障排查

### ① 推送失败 / SSL 证书错误
- **现象**：`git push` 报 `SSL peer certificate or SSH remote key was not OK`；或 GitHub Desktop 报 `unable to get local issuer certificate`。
- **原因**：本机网络经代理（如 Steam++ / Watt Toolkit）加速 GitHub，SSL 校验失败。
- **解决**：用 `push-now.bat`（已配 `schannel` 后端，走 Windows 系统证书）。

### ② 字典查不到 / 接口 404
- 登录 Cloudflare 控制台 → `daoxuanwenji` Pages 项目 → **Settings → Bindings** → 确认已绑定 KV 命名空间 **`DICT_KV`**（Variable name 必须为 `DICT_KV`）。
- 绑定后需**重新部署一次**（Deployments → 重新部署最新提交），绑定才生效。

### ③ 划词无反应
- 确认页面已加载 `dict.js`（浏览器控制台无报错）。
- 确认选中的不是输入框 / 可编辑区域。
- 移动端需等待 4 秒。
- 强制刷新以清除旧 `sw.js` 缓存（Ctrl/Cmd+Shift+R）。

### ④ 站点样式 / 资源 404
- 确认 `style.css`、`articles.js` 等已一并推送。
- 强制刷新清除 Service Worker 缓存。

---

## 九、清理记录（2026-07-25）

- **废弃独立 Cloudflare Worker 方案**（`dict-worker`）：因国内运营商封锁 `*.workers.dev` 子域，改为 **Pages Functions 同域部署**（`daoxuanwenji.pages.dev/api/dict`）。
- **本地已归档**（保留可恢复）：
  - `F:\WorkBuddy\dict-worker\` → `F:\WorkBuddy\_archive_2026-07-25\dict-worker\`
  - `F:\WorkBuddy\dict-data\` → `F:\WorkBuddy\_archive_2026-07-25\dict-data\`
  - `F:\WorkBuddy\wx2\` → `F:\WorkBuddy\_archive_2026-07-25\wx2\`
- **日常不再使用的工具**：`wrangler` 命令行（KV 数据已建好，日常维护无需它；如需重建 KV 再装）。
- **日常只做一件事**：在 `F:\github-dx\wx` 改完 → 推送 GitHub → Cloudflare 自动拉取部署。

---

## 十、后续可扩展（暂未实施）

- **前端提交新文章**：用 Cloudflare **D1**（SQLite）存文章元数据 + **R2** 存配图，配合 Pages Functions 接收提交，Cloudflare Access 做鉴权。架构可行，但因写作频率低、现有 `更新网站.bat` 流程已够用，暂未做。
- 详情见开发对话记录。
