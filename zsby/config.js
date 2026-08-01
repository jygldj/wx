// ============================================================
// 配置文件：API密钥等
// 请将你的API密钥填入下方
// ============================================================
const CONFIG = {
  // ============================================================
  // 千问（通义千问）API 配置 — 阿里云百炼平台
  // （保持原样，完全不动！）
  // ============================================================
  qwen: {
    apiKey: 'sk-ws-H.EIYYXID.SAse.MEUCIQCNItWGBDKWH3vj_c7Wsw8_I28httwyR4CCTwp3BYkD1AIgLVwDFS9Wv4DPq3iSF097a3YkYdW7Zf3sx6WbISx6Wdo', // 你的API Key
    model: 'qwen3.7-flash-2026-07-15', // 保持原样
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' // 保持原样
  },

  // ============================================================
  // DeepSeek-V4-Pro 配置 — 替换了原来的智谱GLM
  // ============================================================
  deepseek: {
    apiKey: 'sk-ws-H.ELDIXRR.mS3S.MEUCIQCGx4qWCPtx4SgA8ZIQcqliRJU7JSpNrN2NKjPFjpzivgIgEz16QP2UMpsMQVqvfVYP6PGs87HbnVh7SqoI8hgyC9k', // 使用同一个API Key
    model: 'deepseek-v4-pro', // 您指定的模型
    // 注意：这里沿用了千问的baseUrl，因为通常聚合平台使用统一网关
    // 如果报错，请检查平台文档是否需要更换地址
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  }
};

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}