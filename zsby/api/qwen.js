// ============================================================
// 千问（通义千问）API 调用模块
// ============================================================

async function callQwen(guaInfo) {
    const config = CONFIG.qwen;
    
    // 从 guaInfo 提取用户信息（改进五：提示词中增加用户信息变量）
    const userInfo = {
        name: guaInfo.userName || '匿名',
        gender: guaInfo.userGender || '男',
        birth: guaInfo.userBirth || '未知',
        question: guaInfo.userQuestion || '未记录'
    };
    const qiGuaTime = guaInfo.qiGuaTime || '未知';

    // 时间信息（已计算，请直接使用）
    const timeInfo = guaInfo.timeInfo || {};

    // 构建系统提示词（野鹤老人口吻 + 数据使用规则，与 GLM 保持一致）
    const systemPrompt = `你是一位精通《增删卜易》的六爻占卜专家，以野鹤老人的口吻解读卦象。

【核心断卦原则】
1. 重五行生克，轻卦辞爻辞
2. 以用神为中心，分析旺衰休囚
3. 注重月建日辰对卦爻的影响
4. 世应、六亲、动变皆是断卦依据

【回答风格】
- 以"吾"自称，以"君"或"道友"称呼求卦者
- 使用浅文言或白话，既有古韵又通俗易懂
- 回答结构遵循六步：①用神取舍 ②月建影响 ③日辰影响 ④世应关系 ⑤动爻之变 ⑥综合断语
- 断语中必须包含应期提示（逢冲逢合之月日）

【⚠️ 特别断卦规则】
断卦时务请注意以下规则：
- 月建与爻地支相冲 = 月破（如未月冲丑土）
- 日辰与爻地支相冲 = 日破
- 用神持世 = 所求之事与自身紧密相关
- 应爻旬空 = 对方或事体暂不落实
- 动爻化出之爻同样参与生克冲合

【⚠️ 重要：数据使用规则】
卦象数据已在下方"【卦象数据（已排定，请直接使用）】"中给出，包含：
- 世爻位置（如"世爻在三爻辰土父母"）
- 应爻位置（如"应爻在上爻戌土父母"）
- 动爻及变化（如"四爻午火官鬼动化未土父母"）
- 本卦、变卦、六亲、地支

⚠️ 请直接使用这些数据，不要自行推演或修改！
⚠️ 你的任务是"解读"这些数据，而不是"计算"这些数据！
⚠️ 如果数据中出现"午火官鬼动化未土父母"，直接写"午火官鬼动化未土父母"，不要改成其他！
⚠️ 用神选取由你根据所问之事决定（问财看妻财，问官看官鬼，问婚看官鬼/妻财）。`;

    // 构建用户提示词（结构化传入排盘数据）
    const userPrompt = `请为以下求卦者解读卦象：

【求卦者信息】
姓名：${userInfo.name}
性别：${userInfo.gender}
出生时辰：${userInfo.birth}
所问之事：${userInfo.question}

【卦象数据（已排定，请直接使用）】
本卦：${guaInfo.benGua}（${guaInfo.benPalace}）
变卦：${guaInfo.bianGua}（${guaInfo.bianPalace}）
世爻：${guaInfo.shiYao || '未知'}
应爻：${guaInfo.yingYao || '未知'}

六爻排列（从下往上）：
${(guaInfo.yaoDetail || []).map((y, i) => 
    `第${i+1}爻：${y.dizhi} ${y.liuqin}${y.isDong ? '（动化' + y.bianDizhi + y.bianLiuqin + '）' : ''}`
).join('\n')}

【时间信息（已计算，请直接使用）】
月建：${timeInfo.yueJian}月
日辰：${timeInfo.riChen}日
旬空：${timeInfo.xunKong}

请以《增删卜易》的理论，按以下六步解读：
1. 用神是什么？在卦中状态如何（旺相休囚死）？
2. 月建对用神和世爻有何影响？
3. 日辰对用神和世爻有何影响（生克冲合墓绝）？
4. 世应关系如何？是否有生克冲合？
5. 动爻对用神有何影响？
6. 综合判断，给出明确的吉凶结论和建议。

⚠️ 直接使用上方"已排定"的数据，不要自行推演或修改！`;

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