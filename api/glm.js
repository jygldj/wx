// ============================================================
// GLM-5（智谱AI）API 调用模块（含月建日辰时间信息）
// ============================================================

async function callGLM(guaInfo) {
    const config = CONFIG.glm;
    
    // 构建系统提示词（与千问保持一致）
    const systemPrompt = `你是一位精通《增删卜易》的六爻占卜专家。
你的解读风格遵循野鹤老人的核心理念：
1. 重五行生克，轻卦辞爻辞
2. 以用神为中心，分析旺衰休囚
3. 注重月建日辰对卦爻的影响
4. 世应、六亲、动变皆是断卦依据

断卦核心原则：
- 用神旺相则吉，休囚则凶
- 月建为纲，决定爻的旺相休囚死
- 日辰为君，决定爻的生克冲合墓绝
- 动爻为事之始，变爻为事之终
- 世爻为自己，应爻为对方或所测之事

请以《增删卜易》的理论体系，为用户解读卦象。
解读要具体、实用，避免空泛的吉凶断语。
语气温和、理性，既有传统智慧，又有现代视角。`;

    // 构建用户提示词（包含时间信息）
    const timeInfo = guaInfo.timeInfo || {};
    const userPrompt = `请为我解读以下卦象：

【起卦时间】${timeInfo.solarTime || '未知'}（公历）
             ${timeInfo.lunarTime || '未知'}（农历）
【月建】${timeInfo.yueJian || '未知'}月
【日辰】${timeInfo.riChen || '未知'}日
【旬空】${timeInfo.xunKong || '未知'}

【本卦】${guaInfo.benGua}（${guaInfo.benPalace}）
【变卦】${guaInfo.bianGua}（${guaInfo.bianPalace}）
【动爻】第 ${guaInfo.dongYao.join('、')} 爻

六爻排列（从下往上）：
${guaInfo.yaoResults.map((y, i) => `第${i+1}爻：${y === 1 ? '阳⚊' : '阴⚋'}${guaInfo.dongStatus[i] ? '（动）' : ''}`).join('\n')}

【求卦者】姓名：${guaInfo.userInfo?.name || '匿名'}　性别：${guaInfo.userInfo?.gender || '未知'}　出生时辰：${guaInfo.userInfo?.birth || '未知'}
【用户所问】${guaInfo.question}

请以《增删卜易》的理论，结合月建日辰分析：
1. 用神是什么？在卦中状态如何（旺相休囚死）？
2. 月建对用神和世爻有何影响？
3. 日辰对用神和世爻有何影响（生克冲合墓绝）？
4. 世应关系如何？是否有生克冲合？
5. 动爻对用神有何影响？
6. 综合判断，给出明确的吉凶结论和建议。

请用流畅的中文回答，结构清晰，既有专业分析又有通俗解读。`;

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
        console.error('GLM API 调用失败:', error);
        throw error;
    }
}