// zsby/ly/__tests__/suanfa.test.js
// 算法层纯函数单测（node 内置 test runner，零第三方依赖）
// 运行：cd zsby/ly && node --test __tests__/suanfa.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 用 vm 沙箱加载浏览器全局脚本（shuju → suanfa），返回共享上下文
// 注：const 声明在 vm 中是词法作用域，不挂到 sandbox 对象上，须经函数间接验证
function loadLibs() {
  const sandbox = { console, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  for (const f of ['shuju.js', 'suanfa.js']) {
    const p = path.join(__dirname, '..', f);
    vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: f });
  }
  return sandbox;
}

const s = loadLibs();

// ============ 1. 六亲计算 ============
test('六亲五行生克：乾金宫 5 种六亲正确', () => {
  assert.strictEqual(s.jiSuanLiuQin('金', '子'), '子孙'); // 金生水
  assert.strictEqual(s.jiSuanLiuQin('金', '午'), '官鬼'); // 火克金
  assert.strictEqual(s.jiSuanLiuQin('金', '寅'), '妻财'); // 金克木
  assert.strictEqual(s.jiSuanLiuQin('金', '辰'), '父母'); // 土生金
  assert.strictEqual(s.jiSuanLiuQin('金', '申'), '兄弟'); // 同金
});

test('六亲边界：非法输入不抛异常', () => {
  // 未知卦五行 → 回退 ta（此处为地支五行），不崩溃
  assert.strictEqual(s.jiSuanLiuQin('X', '子'), '水');
});

// ============ 2. 六神排定 ============
test('六神起点：甲/乙→青龙，壬/癸→玄武', () => {
  assert.strictEqual(s.getLiuShenStart('甲'), 0);
  assert.strictEqual(s.getLiuShenStart('乙'), 0);
  assert.strictEqual(s.getLiuShenStart('壬'), 5);
  assert.strictEqual(s.getLiuShenStart('癸'), 5);
});

test('paiLiuShen 六神顺排：甲日起青龙（字符串比较规避跨 Realm 引用）', () => {
  assert.strictEqual(s.paiLiuShen('甲').join(''), '青龙朱雀勾陈螣蛇白虎玄武');
  assert.strictEqual(s.paiLiuShen('戊').join(''), '勾陈螣蛇白虎玄武青龙朱雀');
});

// ============ 3. 模式查卦 ============
test('getGuaByPattern 模式查卦正确', () => {
  assert.strictEqual(s.getGuaByPattern('111111').卦名, '乾为天');
  assert.strictEqual(s.getGuaByPattern('000000').卦名, '坤为地');
});

test('getGuaByName 按名查卦', () => {
  assert.strictEqual(s.getGuaByName('天风姤').卦名, '天风姤');
  assert.strictEqual(s.getGuaByName('不存在的卦'), null);
});

// ============ 4. 伏神降妖三式 ============
test('天风姤缺妻财，伏神寅木伏于 2 爻', () => {
  const fu = s.zhaoFuShen('天风姤', '妻财');
  assert.ok(fu, 'zhaoFuShen 应返回伏神对象');
  assert.strictEqual(fu.fuShenLiuQin, '妻财');
  assert.strictEqual(fu.fuShenDizhi, '寅');
});

test('paiPanDaiFuShen 完整伏神挂载', () => {
  const guaInfo = s.paiPanDaiFuShen('天风姤');
  assert.ok(guaInfo && guaInfo.fuShenList);
  assert.ok(guaInfo.missingLiuQin.includes('妻财'), '天风姤缺妻财');
});

// ============ 5. 变卦六亲（以本卦宫五行为我） ============
test('变卦六亲以本卦宫五行为我：乾为天金宫变天风姤', () => {
  const bian = s.paiPanBianGua('天风姤', '金');
  assert.ok(bian && bian.yaoData, 'paiPanBianGua 应返回含 yaoData 的对象');
  assert.strictEqual(bian.yaoData.length, 6);
  // 天风姤初爻丑土，金宫为"我"→ 土生金 = 父母
  const first = bian.yaoData[0];
  assert.strictEqual(first.yaoWei, 1);
  assert.strictEqual(first.diZhi, '丑');
  assert.strictEqual(first.liuQin, '父母');
  // 金宫变卦天风姤应缺妻财（伏神降妖逻辑后续处理）
  const liuqins = bian.yaoData.map((y) => y.liuQin);
  assert.ok(!liuqins.includes('妻财'), '天风姤六爻不含妻财');
});

// ============ 6. 旬空判定 ============
test('isKongRW7 旬空判定', () => {
  // 甲子旬空戌亥
  assert.strictEqual(s.isKongRW7('戌', '戌亥'), true);
  assert.strictEqual(s.isKongRW7('寅', '戌亥'), false);
});

// ============ 7. 飞伏关系（收敛后单源） ============
test('fuShenRelationRW8 五行关系', () => {
  assert.strictEqual(s.fuShenRelationRW8('木', '火'), '生'); // 木生火
  assert.strictEqual(s.fuShenRelationRW8('木', '土'), '克'); // 木克土
  assert.strictEqual(s.fuShenRelationRW8('木', '木'), '比和');
  assert.strictEqual(s.fuShenRelationRW8('木', '水'), '无关'); // 水生木（反方向）
  assert.strictEqual(s.fuShenRelationRW8('', ''), '未知');
});

// ============ 8. 用神映射（单源 QUESTION_TO_YONGSHEN） ============
// const 常量不挂 vm sandbox，经 xuanYongShen / jiSuanYuanShenKongFu 间接验证
test('用神映射经 xuanYongShen 间接验证全部问题类型', () => {
  const expect = {
    '婚姻': '官鬼', '感情': '官鬼', '财运': '妻财', '求财': '妻财',
    '事业': '官鬼', '诉讼': '官鬼', '学业': '父母', '考试': '父母',
    '健康': '官鬼', '病': '官鬼', '出行': '父母', '失物': '妻财',
    '寻人': '子孙', '子孙': '子孙'
  };
  for (const [type, liuqin] of Object.entries(expect)) {
    const guaInfo = {
      yaoDetail: [{ liuqin, dizhi: '子' }],
      fuShenList: [],
      shiYaoIndex: -1,
      timeInfo: { yueJian: '申', riChen: '甲子' }
    };
    s.xuanYongShen(guaInfo, type);
    assert.strictEqual(guaInfo.yongShen.liuqin, liuqin, `问题类型 ${type} 用神应映射为 ${liuqin}`);
  }
});

test('原神映射经 jiSuanYuanShenKongFu 间接验证', () => {
  // 婚姻→官鬼→原神妻财
  const guaInfo = {
    yaoDetail: [{ liuqin: '妻财', dizhi: '子' }],
    fuShenList: [],
    timeInfo: { yueJian: '申', riChen: '甲子' }
  };
  s.jiSuanYuanShenKongFu(guaInfo, '婚姻');
  assert.ok(guaInfo.yuanShenState, '婚姻 应产出原神状态');
});

// ============ 9. 用神两现选取 ============
test('xuanYongShen 未知问题类型降级（未知所问之事）', () => {
  const guaInfo = { yaoDetail: [], fuShenList: [], shiYaoIndex: -1, timeInfo: {} };
  s.xuanYongShen(guaInfo, '跳槽'); // 未命中关键词
  assert.strictEqual(guaInfo.yongShen.liuqin, null);
  assert.ok(guaInfo.yongShen.reason.includes('未知所问之事'));
});

// ============ 10. 旺衰评分 ============
test('jiWangShuaiScore 动爻加分', () => {
  const yao = { dizhi: '子', isDong: true, kongType: 'none', yuePo: false, isFuShen: false };
  const guaInfo = { timeInfo: { yueJian: '申', riChen: '甲子' } };
  const sc = s.jiWangShuaiScore(yao, guaInfo);
  assert.ok(sc.score >= 20); // 动爻 +20 为基础
});

test('jiWangShuaiScore 月建克爻减分', () => {
  // 申月（金）克寅木爻 → 月建克爻-20；甲午日午火，木生火（泄）-5
  const yao = { dizhi: '寅', isDong: false, kongType: 'none', yuePo: false, isFuShen: false };
  const guaInfo = { timeInfo: { yueJian: '申', riChen: '甲午' } };
  const sc = s.jiWangShuaiScore(yao, guaInfo);
  assert.ok(sc.score < 0, `月建克爻应显著减分，实际 score=${sc.score}`);
  assert.ok(sc.detail.includes('月建克爻-20'), 'detail 应含月建克爻项');
});

test('jiWangShuaiScore 月建生爻加分', () => {
  // 申月（金）生子水爻 → 月建生爻+30
  const yao = { dizhi: '子', isDong: false, kongType: 'none', yuePo: false, isFuShen: false };
  const guaInfo = { timeInfo: { yueJian: '申', riChen: '甲午' } };
  const sc = s.jiWangShuaiScore(yao, guaInfo);
  assert.ok(sc.score > 0, `月建生爻应显著加分，实际 score=${sc.score}`);
});
