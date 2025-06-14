window.addEventListener('error', (e) => {
  console.error('全局错误:', e.message, e.filename, e.lineno);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('未处理的 Promise 错误:', e.reason);
});

/**
 * 张三文学阁 - 全功能脚本 (修复版)
 * 功能：动态加载文章列表和内容
 * 使用方法：只需维护articles.json  文件 
 */
// 全局变量 
let currentCategory = 'poetry'; // 默认显示诗词 

// DOM加载完成后执行 
document.addEventListener('DOMContentLoaded', function() {
    // 初始化加载 
    loadCategory(currentCategory);
    
    // 导航栏点击事件
    document.querySelectorAll('.top-nav a[data-category]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();  
            currentCategory = this.dataset.category;  
            loadCategory(currentCategory);
        });
    });
});

/**
 * 加载分类文章列表 
 */
async function loadCategory(category) {
    try {
        // 显示加载状态 
        document.getElementById('article-list').innerHTML = '<li class="loading">正在加载...</li>';
        document.getElementById('category-title').textContent = 
            { poetry: '诗词集', prose: '散文集', essays: '杂记录' }[category];
        
        // 直接访问 articles.json
        const response = await fetch('articles.json');  
        if (!response.ok) throw new Error('网络响应不正常');
        const data = await response.json();  
        
        // 生成文章列表
        const articles = data[category] || [];
        const listHtml = articles.length ? articles.map(article => `
                <li>
                    <a href="#" onclick="loadArticle('${category}', '${article.filename}')">  
                        ${article.title}   
                        ${article.date ? `<span class="date">${article.date}</span>` : ''}
                    </a>
                </li>
              `).join('') : '<li class="empty">暂无文章</li>';
        
        document.getElementById('article-list').innerHTML = listHtml;
        
        // 默认加载第一篇文章
        if (articles.length > 0) {
            loadArticle(category, articles[0].filename);
        } else {
            document.getElementById('article-content').innerHTML = 
                '<div class="empty">暂无内容</div>';
        }
    } catch (error) {
        console.error(' 加载失败:', error);
        document.getElementById('article-list').innerHTML = 
            '<li class="error">加载失败，请刷新试试</li>';
    }
}

/**
 * 加载单篇文章内容 
 */
async function loadArticle(category, filename) {
    try {
        document.getElementById('article-content').innerHTML = 
            '<div class="loading">文章加载中...</div>';
        
        // 确保路径拼接正确
        // 如果 filename 已经包含子目录，则不需要再加 category
        let filePath;
        if (filename.includes('/')) {
            filePath = `articles/${filename}`;
        } else {
            filePath = `articles/${category}/${filename}`;
        }
        
        // 确保文件扩展名正确
        if (!filePath.endsWith('.md')) {
            filePath += '.md';
        }
        
        // 直接访问文章内容
        const response = await fetch(filePath);
        if (!response.ok) throw new Error('文章不存在');
        const content = await response.text();  
        
        // 简单 Markdown 转换
        const htmlContent = content 
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\n/g, '</p><p>');
        
        document.getElementById('article-content').innerHTML = `
            <div class="markdown-body">
                <p>${htmlContent}</p>
            </div>
        `;
    } catch (error) {
        console.error(' 加载文章失败:', error);
        document.getElementById('article-content').innerHTML = `
            <div class="error">
                文章加载失败<br>
                <button onclick="loadCategory('${currentCategory}')">返回列表</button>
            </div>
        `;
    }
}

// 全局暴露函数（用于 HTML 直接调用）
window.loadArticle = loadArticle;