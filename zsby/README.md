# 增删卜易 · 六爻占卜系统

基于《增删卜易》的六爻占卜 Web 应用，含起卦（铜钱摇卦 + 手动输卦双模式）、排盘、AI 释卦、历史记录、农历查询。

## 目录结构

本系统位于道玄文集（`F:\github-dx\wx`）的 `zsby/` 子目录，自成体系。

```
F:\github-dx\wx\
├── index1.html          # 道玄文集首页（导航栏"增删卜易"→ zsby/liuyao_divine.html）
├── lunar.js             # 农历计算库（zsby 通过 ../lunar.js 引用，共享）
├── config.js            # API 配置：千问/千问备选 密钥（zsby 通过 ../config.js 引用，共享）
└── zsby/                # 增删卜易子系统
    ├── liuyao_divine.html   # 起卦主页面（铜钱摇卦 + 手动输卦双模式 + 八宫纳甲排盘）
    ├── jiegu.html           # 释卦页面（AI 解读）
    ├── history.html         # 占卜历史（本地存储，目录折叠式）
    ├── help.html            # 使用指南
    ├── nlcx.html            # 农历查询
    ├── api/
    │   ├── qwen.js          # 通义千问（主力）API 调用模块
    │   └── qwen2.js         # 通义千问（备选）API 调用模块
    └── README.md            # 本文件
```

## 核心数据流

1. **起卦**（`liuyao_divine.html`）：支持两种起卦模式
   - **铜钱摇卦**：三枚铜钱六次摇卦 → 生成 `yaoResults`/`dongStatus`
   - **手动输卦**：为六爻逐个选择"少阳/少阴/老阳/老阴" → 生成与摇卦**格式完全一致**的 `yaoResults`/`dongStatus`
   - 两种模式均调用同一 `completeAndDisplay()` 排盘 → 保存 `guaData` 至 `localStorage.currentGua`
   - `guaData` 含：本卦/变卦名与宫、`shiYao`（世爻序）、`yingYao`（应爻序）、`dongDetail`（动爻变化详情）、六爻地支六亲、`dongYao`/`dongStatus`/`yaoResults`、`time`
2. **释卦**（`jiegu.html`）：读取 `currentGua` → 构建 `guaInfo`（世应文本化、`yaoDetail` 含动变、用户信息字段）→ 调用 `callQwen(guaInfo)` / `callQwen2(guaInfo)`
3. **AI 解读**：`systemPrompt` 固化野鹤老人口吻 + 六步框架 + 数据使用规则；`userPrompt` 结构化传入"已排定"数据，**AI 只解读、不计算**
4. **历史**（`history.html`）：读取 `localStorage.guaHistory`，目录折叠式展示，含求卦者资料与 AI 解读回写

## 模型说明

释卦页提供两个模型，均来自阿里云百炼平台（千问同源）：

| 模型 | config 键 | 实际模型名 | 页面标注 | 角色 |
|---|---|---|---|---|
| 千问 3.7 | `CONFIG.qwen` | `qwen3.7-flash-2026-07-15` | 千问 3.7 | **默认主力**（默认选中） |
| 千问备选 | `CONFIG.qwen2` | `qwen3.7-flash` | 千问备选 | 备选 |

两模型的提示词完全一致（野鹤老人口吻 + 核心断卦原则 + 六步框架 + 数据使用规则 + 特别断卦规则 + 野鹤断卦铁律），确保解读风格与准确性统一。

## 本次改进

### 手动输卦模式（2026-08）
- `liuyao_divine.html` 新增"手动输卦"模式，与"铜钱摇卦"可一键切换
- 页面顶部模式切换按钮栏（`.mode-switch-bar` / `.mode-btn`），铜钱区下方新增手动输入面板（`#inputArea`，默认隐藏）
- 每爻可选"少阳/少阴/老阳/老阴"四象（`YAO_OPTIONS` 常量定义），含实时符号预览
- `confirmInput()` 读取六爻选择，生成与摇卦格式一致的 `yaoResults`（1阳0阴）/`dongStatus`（动/静），设置 `currentStep=6` 后直接复用 `completeAndDisplay()` 排盘
- **零侵入**：未修改任何排盘、解卦、数据存储核心逻辑，仅在输入层增加一种数据来源

### 改进一/二：固化 AI 提示词
- `api/qwen.js`、`api/qwen2.js` 的 `systemPrompt` 统一为：野鹤老人口吻 + 核心断卦原则 + 回答风格（六步框架、应期提示）+ **数据使用规则**（禁止 AI 自行推演世应/动变/六亲）
- 另含 **【⚠️ 特别断卦规则】**：明确月破、日破、用神持世、应爻旬空、动爻化出之爻参与生克等判定
- 含 **【📜 野鹤断卦铁律】**：旺衰总纲、合起为旺、动爻虚实、吉凶权衡、结论导向五条最高准则
- `userPrompt` 结构化传入：求卦者信息、卦象数据（世应、六爻排列含动变）、时间信息（月建/日辰/旬空）

### 改进三：起卦保存完整排盘数据
- `liuyao_divine.html` 的 `guaData` 新增 `shiYao`、`yingYao`、`dongDetail` 字段，直接取自排盘结果

### 改进四/五：释卦构建完整 guaInfo
- `jiegu.html` 构建 `guaInfo` 含 `userName/userGender/userBirth/userQuestion/qiGuaTime`、`shiYao/yingYao`（文本化，如"世爻在三爻辰土父母"）、`yaoDetail`（含动变地支六亲）
- `callQwen`/`callQwen2` 内从 `guaInfo` 提取 `userInfo`/`qiGuaTime` 供提示词使用

### 追加任务：文件移入 zsby 子目录
- 5 个页面 + `api/` 文件夹移入 `zsby/`
- 各页导航栏"文集"按钮指向 `../index1.html`
- `jiegu.html`、`nlcx.html` 的 `lunar.js`、`config.js` 通过 `../` 引用父目录
- `index1.html` 的"增删卜易"按钮指向 `zsby/liuyao_divine.html`

### 模型替换历史
1. **智谱 GLM → DeepSeek-V4-Pro**：因智谱断卦错误较多，替换为 DeepSeek
2. **DeepSeek-V4-Pro → 千问备选（qwen3.7-flash）**：经实测 DeepSeek 释卦错误仍较多，改用千问同源备选模型
   - 删除 `api/deepseek.js`，新增 `api/qwen2.js`（`callQwen2`），提示词与千问完全一致
   - `config.js` 原 `CONFIG.deepseek` 改为 `CONFIG.qwen2`（model: `qwen3.7-flash`）
   - 释卦页模型选择：千问 3.7（默认主力，`checked`）/ 千问备选
   - 加载提示、结果记录中的模型名映射：`qwen → 千问 3.7`、`qwen2 → 千问备选`

## 验证方法

1. **手动输卦**：切换到"手动输卦"模式，为六爻选择四象 → 点"确认排盘" → 本卦/变卦/世应/动爻标记准确 → 点"释卦"可正常跳转并出解读
2. **模式切换**：在铜钱摇卦与手动输卦之间来回切换，界面与状态均正常
3. **排盘数据保存**：起卦后 F12 控制台执行 `JSON.parse(localStorage.getItem('currentGua'))`，确认含 `shiYao`、`yingYao`、`dongDetail`
4. **AI 提示词数据**：释卦时控制台查看传入 `callQwen`/`callQwen2` 的 `guaInfo`，确认含 `shiYao`、`yingYao`、`yaoDetail`
5. **AI 解读结果**：解读文本中世爻/动爻与排盘一致（无 AI 自行推演）、以"吾"自称、以"君/道友"称呼求卦者、含应期提示、遵循六步结构
6. **路径联通**：从 `index1.html` 点"增删卜易"可进入起卦页；在 zsby 各页点"文集"可返回文集首页
7. **模型切换**：释卦页可切换"千问 3.7"与"千问备选"，两者均能正常出解读

## 依赖与存储

- `lunar.js`：农历/干支/节气/旬空计算（约 435KB，位于父目录，与文集共享）
- `config.js`：千问（`qwen3.7-flash-2026-07-15`）/ 千问备选（`qwen3.7-flash`）API 密钥与端点配置（位于父目录共享）
- 数据存储：`localStorage`（`currentGua`、`userInfo`、`guaHistory`），仅本地浏览器，换设备/清缓存会丢失

## 技术约束（不可改动）

- `liuyao_divine.html` 排盘核心逻辑（`completeAndDisplay`、`renderFinalResult`、`buildGuaHtml`、八宫纳甲算法）
- `lunar.js` 时间计算核心逻辑
- API 调用函数基本结构（`fetch` / `try-catch` / 响应处理）

---

以《增删卜易》为宗 · 仅供传统文化研究参考
