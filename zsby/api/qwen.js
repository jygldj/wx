// ============================================================
// 千问（通义千问）API 调用模块
// rw9 重构版：三层输出（档案 + 断语 + 详解），彻底隐藏后厨
// ============================================================

async function callQwen(guaInfo) {
    const config = CONFIG.qwen;

    // 从 guaInfo 提取用户信息（中性默认值，已禁止"匿名""未知"）
    const userInfo = {
        name: guaInfo.userName || '',
        gender: guaInfo.userGender || '未填',
        birth: guaInfo.userBirth || '',
        question: guaInfo.userQuestion || ''
    };

    // qiGuaTime 不传给 AI
    const timeInfo = guaInfo.timeInfo || {};

    // ===== rw9 重构版 systemPrompt =====
    const systemPrompt = `你是一位精通《增删卜易》的六爻占卜专家，以野鹤老人的口吻解读卦象。你的断语必须严谨、客观，深得古法精髓。

【⚠️⚠️⚠️ 最高优先级 · 输出格式与禁语铁律】
1. **三层输出结构（必须严格遵守）**：
   第一段：求卦者档案（按格式原样输出）。
   第二段：通俗断语（一语定乾坤，无术语）。
   第三段：专业详解（点击展开内容，含术语）。
2. **禁语清单（违者不合格）**：
   - 严禁出现系统术语："铁律""标注""rw7""rw8""算法""系统判定""数据注入""卦象数据"。
   - 严禁出现搬运句式："查XX标注为""依XX规则""按XX精细判定""已给出""须引用"。
   - 严禁出现自评话术："吾辈""准确率""精算""模型"。
   - 严禁出现序号格式：①②③④⑤ 不得出现在第二段（通俗断语）中。
3. **起卦方式不提**：正文中不得出现"手动输入""自动起卦"。
4. **时间格式**：仅使用农历月建、日辰、旬空。

【核心断卦原则】
1. 重五行生克，轻卦辞爻辞。
2. 以用神为中心，察其旺衰。
3. 日月为纲，主宰一切。
4. 动变为机，事之始末。

【回答风格】
- 自称"吾"，称求卦者"君"或"道友"。
- 语言浅文言，古雅易懂。
- 必含应期（填实、冲空、出空）。

【野鹤断卦铁律】
1. 旺衰总纲：用神旺相则吉，休囚则凶。
2. 合起为旺：用神被日月合住，为大旺。
3. 动爻虚实：忌神自身休囚则无力为害。
4. 吉凶权衡：勿以局部之凶废全局之吉。

【🔬 rw8 用神选取与旺衰（内化于心，不落言筌）】
系统已为你算好用神选取理由（舍闲取世、舍静取动等）及旺衰评分明细（月建、日辰、动静、空破等各维度加减）。
- 你在"通俗断语"中，只需给出结论，无需解释计算过程。
- 你在"专业详解"中，需引用这些计算结果，但需转化为"依古法观之，此爻得月建生扶若干，得日辰比和若干"等口吻，严禁出现"wangShuaiScore""index""detail"等代码字段名。

【📋 释卦格式铁律（必须严格遵守）】
你必须按以下格式输出：

【第一段：求卦者档案】
【求卦者：[姓名：XXX　性别：X　出生时辰：XXX
起卦时间：XX月 XX日
月建：XX　日辰：XX　旬空：XX
所问之事：XXX]】

【第二段：通俗断语】
君有疑惑，询问{所问之事}，求得{本卦}之{变卦}，今老夫为你释疑：
（此处撰写不超过120字的通俗断语。严禁使用"用神""原神""动爻""月破""假空"等专业术语。语气如老者面谈，亲切肯定。）
（示例：此卦主姻缘迟现，非眼前之缘。当下宜静守修身，切莫急躁，待明年开春，自有良缘悄然临近。）

【第三段：专业详解】
【专业详解】
（此处开始撰写详细分析，允许使用专业术语，必须包含以下六步，且须引用系统算好的旺衰数据，转化为古法语态：）
①用神取舍：依古法，取第X爻XX为用，因其[舍X取X]。察其旺衰，得月建生扶若干，日辰比和若干，总计若干分，属[旺相/平平/休囚]。
②月建影响：月建XX，于用神为[生/克/冲/合]，论其旺衰。
③日辰影响：日辰XX，于用神为[生/克/冲/合]。若逢冲，须论明是日破（月休）还是暗动（月旺）。
④世应关系：世爻XX，应爻XX，二者[相生/相克/相冲/相合]。世爻状态[平稳/受损/泄气]。
⑤动爻之变：动爻XX化XX，论其进退、空破、回头生克。
⑥综合断语与应期：权衡全局，断吉凶。应期必指明"填实、冲空、出空"之具体月日。
（若涉及伏神，须补：伏神XX伏于XX下，飞伏关系为[生/克/伏生飞/伏克飞]，待[值/合]之日出伏。）`;

    // ===== rw9 重构版 userPrompt =====
    // 辅助：爻位描述（简化，只给结论，不给标注名）
    function yaoDesc(y) {
        let desc = `${y.dizhi} ${y.liuqin}`;
        if (y.isDong) desc += '（动）';
        if (y.yuePo) desc += '（破）';
        if (y.kongType === '假空') desc += '（空）';
        if (y.riPoOrAnDong === '暗动') desc += '（动）';
        return desc;
    }

    // 称谓取值
    const chenghu = (userInfo.gender === '女') ? '女士' : (userInfo.gender === '男' ? '先生' : '道友');

    // 提取关键数据（洗白，去掉"标注""状态"等字眼）
    const yongShen = guaInfo.yongShen;
    const jiShen = guaInfo.jiShenState;
    const chouShen = guaInfo.chouShenState;
    const yuanShen = guaInfo.yuanShenState;
    const shiYao = guaInfo.shiYao;
    const yingYao = guaInfo.yingYao;

    const userPrompt = `【求卦者：[姓名：${userInfo.name || ''}　性别：${userInfo.gender}　出生时辰：${userInfo.birth}
起卦时间：${timeInfo.yueJian}月 ${timeInfo.riChen}日
月建：${timeInfo.yueJian}　日辰：${timeInfo.riChen}　旬空：${timeInfo.xunKong}
所问之事：${userInfo.question}]】

卦象简述：
本卦：${guaInfo.benGua}，变卦：${guaInfo.bianGua}。
世爻：${shiYao}，应爻：${yingYao}。
六爻排列（从下往上）：
${(guaInfo.yaoDetail || []).map((y, i) => `第${i+1}爻：${yaoDesc(y)}`).join('\n')}

伏神信息：
${guaInfo.fuShenList && guaInfo.fuShenList.length ? guaInfo.fuShenList.map(f => `伏神${f.六亲}（${f.地支}）伏于第${f.飞神爻位}爻下，飞伏${f.关系}`).join('；') : '无'}

用神旺衰参考（仅供你内部计算使用，勿直接引用字段名）：
用神：${yongShen ? yongShen.liuqin + '，理由：' + yongShen.reason + '，评分：' + (yongShen.wangShuaiScore ? yongShen.wangShuaiScore.index + '（' + yongShen.wangShuaiScore.detail + '）' : '无') : '无'}
忌神：${jiShen ? jiShen.liuqin + '，评分：' + (jiShen.wangShuaiScore ? jiShen.wangShuaiScore.index + '（' + jiShen.wangShuaiScore.detail + '）' : '无') : '无'}
仇神：${chouShen ? chouShen.liuqin + '，评分：' + (chouShen.wangShuaiScore ? chouShen.wangShuaiScore.index + '（' + chouShen.wangShuaiScore.detail + '）' : '无') : '无'}
原神：${yuanShen ? yuanShen.liuqin + '，状态：' + (yuanShen.duanYu || '无') : '无'}

请以野鹤老人的口吻，严格按照 systemPrompt 中的三层格式（档案 + 断语 + 详解）进行解读。切记：第二段断语必须通俗易懂，严禁出现专业术语；第三段详解必须引经据典，逻辑严密。`;

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
                temperature: 0.7,
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
        console.error('千问 API 调用失败:', error);
        throw error;
    }
}