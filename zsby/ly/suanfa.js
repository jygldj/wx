// ============================================================
// suanfa.js - 算法层（纯计算逻辑，不涉及 DOM）
// 职责：
//   1. 六亲实时计算（五行生克 → 六亲）
//   2. 六神排定（日干 → 初爻起点 → 顺排）
//   3. 爻阴阳判定
//   4. 模式查卦（六爻序列 → 64卦）
//   5. 伏神降妖三式（定乾坤 / 寻龙诀 / 显真形）
// 依赖：shuju.js 的 ALL_GUA_DATA / GUA_XIANG / GUA_SYMBOL / NAJIA_GAN
// ============================================================

// ============ 地支五行表 ============
const DIZHI_WUXING = {
    '子': '水', '亥': '水',
    '寅': '木', '卯': '木',
    '巳': '火', '午': '火',
    '申': '金', '酉': '金',
    '辰': '土', '戌': '土', '丑': '土', '未': '土'
};

// ============ 六亲全集 ============
const LIU_QIN_ALL = ['父母', '兄弟', '子孙', '妻财', '官鬼'];

// ============ 六神名 ============
const LIU_SHEN = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'];

// ============================================================
// 一、六亲计算
// ============================================================

/**
 * 五行生克 → 六亲
 * @param {string} wo - 本卦宫位五行（"金""木""水""火""土"）
 * @param {string} ta - 爻地支五行（"金""木""水""火""土"）
 * @returns {string} 六亲名（父母/兄弟/子孙/妻财/官鬼）
 *
 * 规则（以"我"为基准）：
 *   生我者 → 父母    我生者 → 子孙
 *   克我者 → 官鬼    我克者 → 妻财
 *   同我者 → 兄弟
 */
function getLiuQinByWuXing(wo, ta) {
    const map = {
        '金': { '金': '兄弟', '水': '子孙', '木': '妻财', '火': '官鬼', '土': '父母' },
        '木': { '木': '兄弟', '火': '子孙', '土': '妻财', '金': '官鬼', '水': '父母' },
        '水': { '水': '兄弟', '木': '子孙', '火': '妻财', '土': '官鬼', '金': '父母' },
        '火': { '火': '兄弟', '土': '子孙', '金': '妻财', '水': '官鬼', '木': '父母' },
        '土': { '土': '兄弟', '金': '子孙', '水': '妻财', '木': '官鬼', '火': '父母' }
    };
    return (map[wo] && map[wo][ta]) ? map[wo][ta] : ta;
}

/**
 * 封装：卦五行 + 爻地支 → 六亲（自动查地支五行）
 * @param {string} guaWuXing - 卦的宫位五行
 * @param {string} dizhi - 爻的地支
 * @returns {string} 六亲名
 */
function jiSuanLiuQin(guaWuXing, dizhi) {
    const wuXing = DIZHI_WUXING[dizhi] || '';
    return getLiuQinByWuXing(guaWuXing, wuXing);
}

// ============================================================
// 二、六神排定
// ============================================================

/**
 * 由日干推初爻六神起点索引
 * 甲乙→青龙(0) 丙丁→朱雀(1) 戊→勾陈(2)
 * 己→螣蛇(3) 庚辛→白虎(4) 壬癸→玄武(5)
 * @param {string} dayGan - 日柱天干
 * @returns {number} 0~5
 */
function getLiuShenStart(dayGan) {
    if (dayGan === '甲' || dayGan === '乙') return 0;
    if (dayGan === '丙' || dayGan === '丁') return 1;
    if (dayGan === '戊') return 2;
    if (dayGan === '己') return 3;
    if (dayGan === '庚' || dayGan === '辛') return 4;
    if (dayGan === '壬' || dayGan === '癸') return 5;
    return 0;
}

/**
 * 返回初→上爻 6 元六神数组
 * @param {string} dayGan - 日柱天干
 * @returns {string[]} 如 ['青龙','朱雀','勾陈','螣蛇','白虎','玄武']
 */
function getLiuShenSeq(dayGan) {
    const start = getLiuShenStart(dayGan);
    const arr = [];
    for (let i = 0; i < 6; i++) {
        arr.push(LIU_SHEN[(start + i) % 6]);
    }
    return arr;
}

/**
 * 排六神（paiLiuShen，与 getLiuShenSeq 等价，保留独立命名以符cfrw.txt要求）
 * @param {string} dayGan - 日柱天干
 * @returns {string[]} 6 元六神数组
 */
function paiLiuShen(dayGan) {
    return getLiuShenSeq(dayGan);
}

// ============================================================
// 三、爻阴阳判定
// ============================================================

/**
 * 判断某爻是否为阴爻
 * @param {Object} gua - 卦数据（含 上卦/下卦）
 * @param {number} i - 爻索引 0=初爻 … 5=上爻
 * @returns {boolean} true=阴爻, false=阳爻
 *
 * 下卦占 0~2（初/二/三），上卦占 3~5（四/五/上）
 */
function isYaoYin(gua, i) {
    const xiang = i < 3 ? GUA_XIANG[gua.下卦] : GUA_XIANG[gua.上卦];
    const pos = i < 3 ? i : (i - 3);
    return xiang.charAt(pos) === '0';
}

// ============================================================
// 四、模式查卦
// ============================================================

/**
 * 模式→卦 映射表
 * 模式 = 下卦3位 + 上卦3位（如 "111111" = 乾为天）
 */
const patternToGua = {};
(function buildPatternMap() {
    for (const gua of ALL_GUA_DATA) {
        const shang = GUA_XIANG[gua.上卦];
        const xia = GUA_XIANG[gua.下卦];
        const pattern = xia + shang;
        patternToGua[pattern] = gua;
    }
})();

/**
 * 按六爻模式查卦
 * @param {string} pattern - 6位0/1字符串（下卦3位+上卦3位）
 * @returns {Object|null} 卦数据
 */
function getGuaByPattern(pattern) {
    return patternToGua[pattern] || null;
}

/**
 * 按卦名查卦数据
 * @param {string} guaMing - 卦名（如 "乾为天"）
 * @returns {Object|null} 卦数据
 */
function getGuaByName(guaMing) {
    return ALL_GUA_DATA.find(g => g.卦名 === guaMing) || null;
}

// ============================================================
// 五、伏神降妖三式
// ============================================================

// --- 第一式：定乾坤 ---

/**
 * 本宫首卦索引（八纯卦，每宫第一个出现的卦）
 * 结构：{ "乾宫": <乾为天>, "坤宫": <坤为地>, ... }
 */
const BEN_GONG_INDEX = {};
(function buildBenGongIndex() {
    for (const gua of ALL_GUA_DATA) {
        if (!BEN_GONG_INDEX[gua.宫]) {
            BEN_GONG_INDEX[gua.宫] = gua;
        }
    }
})();

/**
 * 根据卦名找到其本宫首卦（八纯卦）
 * @param {string} guaMing - 卦名
 * @returns {Object|null} 本宫首卦数据
 */
function getBenGongShouGua(guaMing) {
    const currentGua = getGuaByName(guaMing);
    if (!currentGua) return null;
    return BEN_GONG_INDEX[currentGua.宫] || null;
}

// --- 第二式：寻龙诀 ---

/**
 * 在本宫首卦中寻找目标六亲
 * @param {string} benGuaMing - 本卦名
 * @param {string} targetLiuQin - 要找的六亲（如 "妻财"）
 * @returns {Object|null} 伏神信息 { fuShenTianGan, fuShenDizhi, fuShenLiuQin, fuShenYaoWei }
 *
 * 遍历本宫首卦六爻，用 jiSuanLiuQin 实时计算每爻六亲，
 * 找到第一个匹配 targetLiuQin 的爻，返回其天干/地支/六亲/爻位。
 */
function zhaoFuShen(benGuaMing, targetLiuQin) {
    const benGongGua = getBenGongShouGua(benGuaMing);
    if (!benGongGua) return null;

    for (let i = 0; i < 6; i++) {
        const yaoInBenGong = benGongGua.爻位[i];
        const liuQin = jiSuanLiuQin(benGongGua.五行, yaoInBenGong.地支);
        if (liuQin === targetLiuQin) {
            return {
                fuShenTianGan: yaoInBenGong.天干,
                fuShenDizhi: yaoInBenGong.地支,
                fuShenLiuQin: liuQin,
                fuShenYaoWei: yaoInBenGong.爻
            };
        }
    }
    return null;
}

// --- 第三式：显真形 ---

/**
 * 为整个卦生成包含伏神信息的完整排盘数据
 * @param {string} benGuaMing - 本卦名
 * @returns {Object} 排盘结果
 *   {
 *     gua:          原始卦数据,
 *     missingLiuQin: [缺少的六亲列表],
 *     fuShenList:   [伏神信息列表],
 *     yaoData: [    6爻增强数据
 *       { yaoWei, tianGan, diZhi, liuQin, fuShen, isYin }
 *     ]
 *   }
 *
 * 伏神挂载规则：
 *   1. 计算本卦每爻六亲，找出缺少的六亲
 *   2. 对每个缺少的六亲，调用 zhaoFuShen 在本宫首卦中查找
 *   3. 伏神挂载到本卦中与本宫首卦同爻位的飞神上
 */
function paiPanDaiFuShen(benGuaMing) {
    const benGua = getGuaByName(benGuaMing);
    if (!benGua) return null;

    // 先算出本卦每爻的六亲
    const yaoLiuQin = benGua.爻位.map(y =>
        jiSuanLiuQin(benGua.五行, y.地支)
    );

    // 找出缺少的六亲
    const existingLiuQin = new Set(yaoLiuQin);
    const missingLiuQinList = LIU_QIN_ALL.filter(lq => !existingLiuQin.has(lq));

    // 对每个缺少的六亲，调用寻龙诀找伏神
    const fuShenList = missingLiuQinList
        .map(lq => zhaoFuShen(benGuaMing, lq))
        .filter(f => f !== null);

    // 构建完整爻位数据
    const yaoData = benGua.爻位.map((yao, index) => {
        const yaoWei = index + 1;
        const liuQin = yaoLiuQin[index];
        const yin = isYaoYin(benGua, index);

        // 伏神挂载：伏神所在爻位 = 飞神爻位
        const fuShen = fuShenList.find(f => f.fuShenYaoWei === yaoWei) || null;

        return {
            yaoWei: yaoWei,
            tianGan: yao.天干,
            diZhi: yao.地支,
            liuQin: liuQin,
            fuShen: fuShen,
            isYin: yin
        };
    });

    return {
        gua: benGua,
        missingLiuQin: missingLiuQinList,
        fuShenList: fuShenList,
        yaoData: yaoData
    };
}

// ============================================================
// 六、辅助：构建变卦排盘数据（六亲以本卦宫位五行为"我"）
// ============================================================

/**
 * 为变卦生成排盘数据
 * 变卦六亲铁律：以本卦宫位五行为"我"，非变卦自身宫位
 * @param {string} bianGuaMing - 变卦名
 * @param {string} benGuaWuXing - 本卦宫位五行
 * @returns {Object|null} 排盘结果（结构同 paiPanDaiFuShen，但六亲以本卦五行计算）
 */
function paiPanBianGua(bianGuaMing, benGuaWuXing) {
    const bianGua = getGuaByName(bianGuaMing);
    if (!bianGua) return null;

    const yaoData = bianGua.爻位.map((yao, index) => {
        const yaoWei = index + 1;
        // 变卦六亲：以本卦宫位五行为"我"
        const liuQin = getLiuQinByWuXing(benGuaWuXing, DIZHI_WUXING[yao.地支] || '');
        const yin = isYaoYin(bianGua, index);

        return {
            yaoWei: yaoWei,
            tianGan: yao.天干,
            diZhi: yao.地支,
            liuQin: liuQin,
            fuShen: null,
            isYin: yin
        };
    });

    return {
        gua: bianGua,
        missingLiuQin: [],
        fuShenList: [],
        yaoData: yaoData
    };
}

// ============================================================
// 七、辅助：从摇卦结果生成模式字符串
// ============================================================

/**
 * 将摇卦结果（0/1数组）转为模式字符串
 * @param {number[]} yaoResults - 6元数组，1=阳 0=阴（初爻在前）
 * @returns {string} 6位0/1字符串
 */
function yaoToPattern(yaoResults) {
    return yaoResults.join('');
}

/**
 * 计算变卦模式
 * @param {number[]} yaoResults - 本卦摇卦结果
 * @param {boolean[]} dongStatus - 动爻状态
 * @returns {string} 变卦6位0/1字符串
 */
function getBianPattern(yaoResults, dongStatus) {
    return yaoResults.map((y, idx) => dongStatus[idx] ? (1 - y) : y).join('');
}
