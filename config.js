// ============================================================
// 配置文件：API密钥等
// 请将你的API密钥填入下方
// ============================================================

const CONFIG = {
    // ============================================================
    // 千问（通义千问）API 配置 — 阿里云百炼平台
    // ============================================================
    qwen: {
        apiKey: 'sk-ws-H.EIYYXID.SAse.MEUCIQCNItWGBDKWH3vj_c7Wsw8_I28httwyR4CCTwp3BYkD1AIgLVwDFS9Wv4DPq3iSF097a3YkYdW7Zf3sx6WbISx6Wdo',  // 你的API Key
        model: 'qwen3.7-flash-2026-07-15',              // 模型名称
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'  // 兼容OpenAI格式
    },
    
    // GLM-5（智谱AI）配置
    glm: {
        apiKey: '7704533505ed49fdbb232085795240d8.ccSSOcN6eQSqXgAx',  // 从 https://open.bigmodel.cn/ 获取
        model: 'glm-4-flash',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4'
    }
};

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}