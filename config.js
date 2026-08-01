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
    
    // ============================================================
    // 千问备选（qwen3.7-flash）配置 — 替换了原来的 DeepSeek-V4
    // 主力千问 qwen3.7-flash-2026-07-15 在上方 qwen 键，此处为备选模型
    // ============================================================
    qwen2: {
        apiKey: 'sk-ws-H.ELDIXRR.mS3S.MEUCIQCGx4qWCPtx4SgA8ZIQcqliRJU7JSpNrN2NKjPFjpzivgIgEz16QP2UMpsMQVqvfVYP6PGs87HbnVh7SqoI8hgyC9k',  // 使用同一个API Key
        model: 'qwen3.7-flash',              // 备选模型（与主力 qwen3.7-flash-2026-07-15 同源不同版本）
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'  // 阿里云百炼平台统一网关
    }
};

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}