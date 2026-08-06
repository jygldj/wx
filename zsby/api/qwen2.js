// ============================================================
// 千问备选（qwen3.7-flash）API 调用模块
// rw10 精炼版：与主力 qwen.js 提示词逐字一致，仅配置键与函数名不同
// ============================================================

async function callQwen2(guaInfo) {
    const config = CONFIG.qwen2;

    const userInfo = {
        name: guaInfo.userName || '',
        gender: guaInfo.userGender || '未填',
        birth: guaInfo.userBirth || '',
        question: guaInfo.userQuestion || '此事'
    };

    const timeInfo = guaInfo.timeInfo || {};

    const chenghu = userInfo.gender === '女' ? '女士'
                  : userInfo.gender === '男' ? '先生'
                  : '道友';

    const fixedOpening = `君有疑惑，询问${userInfo.question}，求得《${guaInfo.benGua}》之《${guaInfo.bianGua}》，今老夫为你释疑：`;

    function yaoDesc(y) {
        let desc = `${y.dizhi}${y.liuqin}`;
        const tags = [];
        if (y.isDong) tags.push('动');
        if (y.yuePo) tags.push('月破');
        if (y.riPoOrAnDong && y.riPoOrAnDong !== 'none') tags.push(y.riPoOrAnDong);
        if (y.kongType && y.kongType !== 'none') tags.push(y.kongType);
        return tags.length ? `${desc}（${tags.join('、')}）` : desc;
    }

    const yaoLines = (guaInfo.yaoDetail || [])
        .map((y, i) => `第${i + 1}爻：${yaoDesc(y)}${y.isDong && y.bianDizhi ? ' → 化' + y.bianDizhi + (y.bianLiuqin || '') : ''}`)
        .join('\n') || '无';

    const fuShenText = (guaInfo.fuShenList && guaInfo.fuShenList.length)
        ? guaInfo.fuShenList.map(f => {
            const base = `伏神${f.六亲 || ''}${f.地支 || ''}伏于第${f.飞神爻位 || '?'}爻${f.飞神地支 || ''}${f.飞神六亲 || ''}之下，${f.关系 || ''}`;
            const tags = [];
            if (f.kongType && f.kongType !== 'none') tags.push(f.kongType);
            return tags.length ? `${base}（${tags.join('、')}）` : base;
        }).join('；')
        : '无';

    function wsDesc(ws) {
        if (!ws || !ws.wangShuaiScore) return '未计算';
        const s = ws.wangShuaiScore;
        return `${s.index || 0}分（${s.detail || '无明细'}）`;
    }

    const yongShenText = guaInfo.yongShen
        ? `${guaInfo.yongShen.liuqin || ''}${typeof guaInfo.yongShen.primaryIndex === 'number' ? '（第' + guaInfo.yongShen.primaryIndex + '爻）' : ''}，选取理由：${guaInfo.yongShen.reason || ''}，旺衰：${wsDesc(guaInfo.yongShen)}`
        : '未计算';

    const jiShenText = guaInfo.jiShenState
        ? `${guaInfo.jiShenState.liuqin || ''}${guaInfo.jiShenState.positions && typeof guaInfo.jiShenState.positions[0] === 'number' ? '（第' + guaInfo.jiShenState.positions[0] + '爻）' : ''}，旺衰：${wsDesc(guaInfo.jiShenState)}，断语：${guaInfo.jiShenState.duanYu || ''}`
        : '无';

    const chouShenText = guaInfo.chouShenState
        ? `${guaInfo.chouShenState.liuqin || ''}${guaInfo.chouShenState.positions && typeof guaInfo.chouShenState.positions[0] === 'number' ? '（第' + guaInfo.chouShenState.positions[0] + '爻）' : ''}，旺衰：${wsDesc(guaInfo.chouShenState)}，断语：${guaInfo.chouShenState.duanYu || ''}`
        : '无';

    const yuanShenText = guaInfo.yuanShenState
        ? `${guaInfo.yuanShenState.liuqin || ''}（${guaInfo.yuanShenState.isFuCang ? '伏藏' : '显'}，${guaInfo.yuanShenState.isKong ? '旬空' : '不空'}）—— ${guaInfo.yuanShenState.duanYu || ''}`
        : '无';

    const systemPrompt = `你是一位精通《增删卜易》的六爻占卜专家，以野鹤老人口吻释卦。断语严谨、客观、得古法精髓。

【⚠️ 最高优先级 · 输出格式铁律（违反即不合格）】
1. 首句锁死：回复必须且只能以以下固定首句开头，不得增减一字、不得换行、不得添加任何前缀或寒暄：
   "${fixedOpening}"
2. 严禁输出任何段落标题，包括但不限于：第一段、第二段、第三段、求卦者档案、通俗断语、专业详解、卦象档案等。
3. 正文结构仅两段：
   - 首句之后紧接通俗断语：120字以内，无专业术语（禁用"用神、原神、动爻、月破、旬空、日破、暗动、伏神、旺衰"等），语气如老者面谈，亲切肯定，一语定乾坤。
   - 随后只写一个标记"【专业详解】"（前后各空一行），之后展开专业分析（可用专业术语）。
4. 严禁重复求卦者档案、起卦时间、月建日辰旬空等前端卡片已展示的信息；释卦文本中不再出现姓名、性别、出生时辰、起卦时间。
5. 时间仅用农历月建、日辰、旬空；禁写公历日期；禁"手动输入""自动起卦"。
6. 禁用系统术语与代码字段名："铁律""rw7""rw8""算法""系统""数据注入""标注""wangShuaiScore""index""detail""positions"等。
7. 自称"老夫"，称求卦者"君"或"道友"；浅文言，古雅易懂。
8. 严禁使用任何 markdown 强调或 HTML 强调标签：释卦正文通体不加粗、不变色、不倾斜、不下划线。禁用 **加粗**、__加粗__、_倾斜_、<b>、<strong>、<i>、<em>、<font color>、<span style> 等写法。所有文字纯文本平铺，样式（如断语加红加粗、按钮加黑）由前端统一控制，你不必、也不得自行着色。

【断卦原则】
1. 重五行生克，轻卦辞爻辞。
2. 以用神为中心，察其旺衰。
3. 日月为纲，主宰一切。
4. 动变为机，事之始末。

【数据使用规则】
- 卦象数据已由系统按野鹤古法算好，你只需解读，不得自行推演或推翻。
- 旺衰评分须转化为古语表述，如"得月建生扶""得日辰比和""受月建克制"，禁止出现代码字段名或数字算式。
- 用神选取理由须原文复述，不可简化、不可篡改。
- 当数据标注与你的判断冲突时，以标注为准。

【专业详解六步】
1. 用神取舍：取何六亲、第几爻、理由、旺衰状态。
2. 月建影响：月建对用神、世爻的生克冲合，有无月破。
3. 日辰影响：日辰对用神、世爻的生克冲合，逢冲者辨日破或暗动。
4. 世应关系：世应生克冲合、世爻状态。
5. 动爻之变：动爻化变、进退、空破、回头生克。
6. 综合断语与应期：权衡全局，给出明确吉凶结论，并指明应期（填实、冲空、出空之具体月日）。`;

    const userPrompt = `【固定首句】
${fixedOpening}

【卦象数据（已排定，请直接使用，勿自行推演）】
本卦：${guaInfo.benGua}（${guaInfo.benPalace || ''}）
变卦：${guaInfo.bianGua}（${guaInfo.bianPalace || ''}）
月建：${timeInfo.yueJian || ''}月　日辰：${timeInfo.riChen || ''}日　旬空：${timeInfo.xunKong || ''}
世爻：${guaInfo.shiYao || ''}
应爻：${guaInfo.yingYao || ''}

${yaoLines}

伏神信息：${fuShenText}

用神：${yongShenText}
忌神：${jiShenText}
仇神：${chouShenText}
原神：${yuanShenText}

世爻状态：${guaInfo.shiYaoZhuangTai ? guaInfo.shiYaoZhuangTai + '：' + (guaInfo.shiYaoDetail || '') : '平稳'}

请严格按 systemPrompt 格式输出：
1. 以固定首句开头；
2. 紧接通俗断语（120字内，无术语）；
3. 写"【专业详解】"标记；
4. 随后按六步展开专业分析。`;

    try {
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.5,
                max_tokens: 2048
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;

    } catch(error) {
        console.error('千问备选 API 调用失败:', error);
        throw error;
    }
}
