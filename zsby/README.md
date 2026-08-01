# 增删卜易 · 六爻占卜系统

基于《增删卜易》的六爻占卜 Web 应用，含起卦、排盘、AI 释卦、历史记录、农历查询。

## 目录结构

本系统位于道玄文集（`F:\github-dx\wx`）的 `zsby/` 子目录，自成体系。

```
F:\github-dx\wx\
├── index1.html          # 道玄文集首页（导航栏"增删卜易"→ zsby/liuyao_divine.html）
├── lunar.js             # 农历计算库（zsby 通过 ../lunar.js 引用，共享）
├── config.js            # API 配置：千问/GLM 密钥（zsby 通过 ../config.js 引用，共享）
└── zsby/                # 增删卜易子系统
    ├── liuyao_divine.html   # 起卦主页面（铜钱摇卦 + 八宫纳甲排盘）
    ├── jiegu.html           # 释卦页面（AI 解读）
    ├── history.html         # 占卜历史（本地存储，目录折叠式）
    ├── help.html            # 使用指南
    ├── nlcx.html            # 农历查询
    ├── api/
    │   ├── qwen.js          # 通义千问 API 调用模块
    │   └── glm.js           # 智谱 GLM API 调用模块
    └── README.md            # 本文件
```

## 核心数据流

1. **起卦**（`liuyao_divine.html`）：三枚铜钱六次摇卦 → 八宫纳甲排盘 → 保存 `guaData` 至 `localStorage.currentGua`
   - `guaData` 含：本卦/变卦名与宫、`shiYao`（世爻序）、`yingYao`（应爻序）、`dongDetail`（动爻变化详情）、六爻地支六亲、`dongYao`/`dongStatus`/`yaoResults`、`time`
2. **释卦**（`jiegu.html`）：读取 `currentGua` → 构建 `guaInfo`（世应文本化、`yaoDetail` 含动变、用户信息字段）→ 调用 `callQwen(guaInfo)` / `callGLM(guaInfo)`
3. **AI 解读**：`systemPrompt` 固化野鹤老人口吻 + 六步框架 + 数据使用规则；`userPrompt` 结构化传入"已排定"数据，**AI 只解读、不计算**
4. **历史**（`history.html`）：读取 `localStorage.guaHistory`，目录折叠式展示，含求卦者资料与 AI 解读回写

## 本次改进（2026-08）

### 改进一/二：固化 AI 提示词
- `api/qwen.js`、`api/glm.js` 的 `systemPrompt` 统一为：野鹤老人口吻 + 核心断卦原则 + 回答风格（六步框架、应期提示）+ **数据使用规则**（禁止 AI 自行推演世应/动变/六亲）
- `userPrompt` 结构化传入：求卦者信息、卦象数据（世应、六爻排列含动变）、时间信息（月建/日辰/旬空）

### 改进三：起卦保存完整排盘数据
- `liuyao_divine.html` 的 `guaData` 新增 `shiYao`、`yingYao`、`dongDetail` 字段，直接取自排盘结果

### 改进四/五：释卦构建完整 guaInfo
- `jiegu.html` 构建 `guaInfo` 含 `userName/userGender/userBirth/userQuestion/qiGuaTime`、`shiYao/yingYao`（文本化，如"世爻在三爻辰土父母"）、`yaoDetail`（含动变地支六亲）
- `callQwen`/`callGLM` 内从 `guaInfo` 提取 `userInfo`/`qiGuaTime` 供提示词使用

### 追加任务：文件移入 zsby 子目录
- 5 个页面 + `api/` 文件夹移入 `zsby/`
- 各页导航栏"文集"按钮指向 `../index1.html`
- `jiegu.html`、`nlcx.html` 的 `lunar.js`、`config.js` 通过 `../` 引用父目录
- `index1.html` 的"增删卜易"按钮指向 `zsby/liuyao_divine.html`

## 验证方法

1. **排盘数据保存**：起卦后 F12 控制台执行 `JSON.parse(localStorage.getItem('currentGua'))`，确认含 `shiYao`、`yingYao`、`dongDetail`
2. **AI 提示词数据**：释卦时控制台查看传入 `callQwen`/`callGLM` 的 `guaInfo`，确认含 `shiYao`、`yingYao`、`yaoDetail`
3. **AI 解读结果**：解读文本中世爻/动爻与排盘一致（无 AI 自行推演）、以"吾"自称、以"君/道友"称呼求卦者、含应期提示、遵循六步结构
4. **路径联通**：从 `index1.html` 点"增删卜易"可进入起卦页；在 zsby 各页点"文集"可返回文集首页

## 依赖与存储

- `lunar.js`：农历/干支/节气/旬空计算（约 435KB，位于父目录，与文集共享）
- `config.js`：千问（`qwen3.7-flash`）/ GLM（`glm-4-flash`）API 密钥与端点配置（位于父目录共享）
- 数据存储：`localStorage`（`currentGua`、`userInfo`、`guaHistory`），仅本地浏览器，换设备/清缓存会丢失

## 技术约束（不可改动）

- `liuyao_divine.html` 排盘核心逻辑（`renderFinalResult`、`buildGuaHtml`、八宫纳甲算法）
- `lunar.js` 时间计算核心逻辑
- API 调用函数基本结构（`fetch` / `try-catch` / 响应处理）

---

以《增删卜易》为宗 · 仅供传统文化研究参考
