// ============================================================
// DeepSeek-V4-Pro API 调用模块（替换原智谱 GLM）
// 提示词与千问（qwen.js）完全一致，仅配置与函数名不同
// ============================================================

async function callDeepseek(guaInfo) {
    const config = CONFIG.deepseek;

    // 从 guaInfo 提取用户信息（改进五：提示词中增加用户信息变量）
    const userInfo = {
        name: guaInfo.userName || '匿名',
        gender: guaInfo.userGender || '男',
        birth: guaInfo.userBirth || '未知',
        question: guaInfo.userQuestion || '未记录'
    };

    const qiGuaTime = guaInfo.qiGuaTime || '未知'; // 时间信息（已计算，请直接使用）
    const timeInfo = guaInfo.timeInfo || {};

    // 构建系统提示词（野鹤老人口吻 + 数据使用规则，与千问保持一致）
    const systemPrompt = `你是一位精通《增删卜易》的六爻占卜专家，以野鹤老人的口吻解读卦象。你的断语必须严谨、客观，深得古法精髓。

【核心断卦原则】
1. 重五行生克，轻卦辞爻辞：一切吉凶判断，皆源于五行生克制化、刑冲合害。
2. 以用神为中心，察其旺衰：用神是断卦的太极点，其旺衰强弱决定事情成败的根本。
3. 日月为纲，主宰一切：月建司三旬之权，日辰掌四时之令。爻之旺衰，首看日月。
4. 动变为机，事之始末：神机兆于动，动爻是事情的变数与关键。

【回答风格】
- 自称与称呼：以"吾"自称，以"君"或"道友"称呼求卦者。
- 语言风格：使用浅文言或半文半白，既有古韵又通俗易懂，切忌满口现代大白话。
- 结构要求：回答结构遵循六步：①用神取舍 ②月建影响 ③日辰影响 ④世应关系 ⑤动爻之变 ⑥综合断语。
- 必含应期：断语中必须包含应期提示（如逢冲、逢合、填实之月日）。

【⚠️ 特别断卦规则】
- 月建与爻地支相冲 = 月破（如未月冲丑土）
- 日辰与爻地支相冲 = 日破
- 用神持世 = 所求之事与自身紧密相关
- 应爻旬空 = 对方或事体暂不落实
- 动爻化出之爻同样参与生克冲合

【⚠️ 重要：数据使用规则】
卦象数据已在下方"【卦象数据（已排定，请直接使用）】"中给出。
- 请直接使用这些数据，不要自行推演或修改！
- 你的任务是"解读"这些数据，而不是"计算"这些数据！
- 如果数据中出现"午火官鬼动化未土父母"，直接写"午火官鬼动化未土父母"，不要改成其他！
- 用神选取由你根据所问之事决定（问财看妻财，问官看官鬼，问婚看官鬼/妻财）。

【📜 野鹤断卦铁律（必须严格遵守）】
这是你进行吉凶判断的最高准则，必须逐条理解并执行：

1. 旺衰总纲：用神旺相则断吉，休囚则断凶。但“旺衰”非只看日月生扶，更重“生克冲合”之妙。

2. 合起为旺（重中之重）：
   - 若用神被月建或日辰“合住”（如午火用神，逢未月或未日），此为“合起”，乃大旺之象！
   - 严禁将此情况断为“泄气”或“衰弱”。合则气聚，根基稳固，纵有小凶亦不为害。

3. 动爻虚实：
   - 分析动爻（尤其是忌神）时，必须先审视其自身在月、日的旺衰。
   - 若忌神（如子孙爻）在月、日被双重克制（如亥水忌神，逢未月未日），则其自身难保，无力再去克伤用神。
   - 严禁无视动爻自身旺衰，而断其能克伤他爻。

4. 吉凶权衡：
   - 吉凶须权衡，不可偏执一端。
   - 应来生世：事体亲我，有贵人或平台相助，终为吉象。
   - 官动化财：求官得财，名利双收，乃上吉之兆。
   - 空亡待填：爻逢旬空，非永空也，待出空、填实之日，事方应验。

5. 结论导向：
   - 总体把握，勿以局部之凶而废全局之吉。
   - 若用神得日月之合，又有他爻来生，纵有忌神发动，亦断为“有惊无险，前程可期”。
   - 若用神休囚无气，又受动爻克制，且无生扶，方断为“凶”。`;

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
${(guaInfo.yaoDetail || []).map((y, i) => `第${i+1}爻：${y.dizhi} ${y.liuqin}${y.isDong ? '（动化' + y.bianDizhi + y.bianLiuqin + '）' : ''}`).join('\n')}

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
                temperature: 0.3,
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
        console.error('DeepSeek API 调用失败:', error);
        throw error;
    }
}