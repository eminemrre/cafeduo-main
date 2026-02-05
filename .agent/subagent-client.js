/**
 * Multi-Model Sub-Agent API Client
 * 
 * Bu modül .env.ai'daki API anahtarlarını kullanarak
 * farklı AI modellerine demokratik sorgular gönderir.
 */

// API Endpoints
const ENDPOINTS = {
    kimi: 'https://api.moonshot.cn/v1/chat/completions',
    glm: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    openrouter: 'https://openrouter.ai/api/v1/chat/completions'
};

// Model Configurations
const MODELS = {
    AEGIS: {
        name: 'AEGIS',
        role: 'Güvenlik Uzmanı',
        provider: 'kimi',
        model: 'moonshot-v1-8k',
        apiKeyEnv: 'KIMI_API_KEY',
        systemPrompt: `Sen AEGIS - CafeDuo'nun güvenlik uzmanısın. 
Görevin: Authentication, authorization, XSS/CSRF koruması, SQL injection önleme.
Güvenlik konularında VETO yetkine sahipsin.
Her öneride güvenlik risklerini değerlendir.`
    },
    VOLT: {
        name: 'VOLT',
        role: 'Performans Uzmanı',
        provider: 'glm',
        model: 'glm-4',
        apiKeyEnv: 'GLM_API_KEY',
        systemPrompt: `Sen VOLT - CafeDuo'nun performans uzmanısın.
Görevin: API optimizasyonu, database query analizi, caching stratejisi, bundle size.
Her öneride performans metriklerini dahil et.`
    },
    MUSE: {
        name: 'MUSE',
        role: 'Kalite & UX Uzmanı',
        provider: 'openrouter',
        model: 'anthropic/claude-3-haiku',
        apiKeyEnv: 'OPENROUTER_API_KEY',
        systemPrompt: `Sen MUSE - CafeDuo'nun kalite ve UX uzmanısın.
Görevin: Kod kalitesi, TypeScript tip güvenliği, error handling, UI tutarlılığı.
Her öneride kullanıcı deneyimini öncelikle.`
    },
    INSPECTOR: {
        name: 'INSPECTOR',
        role: 'Test & QA Uzmanı',
        provider: 'openrouter',
        model: 'google/gemini-flash-1.5',
        apiKeyEnv: 'OPENROUTER_API_KEY',
        systemPrompt: `Sen INSPECTOR - CafeDuo'nun test uzmanısın.
Görevin: Test coverage, E2E senaryoları, regression testing, CI/CD.
Her öneride test stratejisi dahil et.`
    }
};

/**
 * Tek bir sub-agent'a sorgu gönder
 * @param {string} agentName - AEGIS, VOLT, MUSE, INSPECTOR
 * @param {string} prompt - Kullanıcı sorusu
 * @returns {Promise<{agent: string, response: string, model: string}>}
 */
async function queryAgent(agentName, prompt) {
    const agent = MODELS[agentName];
    if (!agent) throw new Error(`Unknown agent: ${agentName}`);

    const apiKey = process.env[agent.apiKeyEnv];
    if (!apiKey) throw new Error(`Missing API key: ${agent.apiKeyEnv}`);

    const endpoint = ENDPOINTS[agent.provider];

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    // OpenRouter için ek header
    if (agent.provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://cafeduo.app';
        headers['X-Title'] = 'CafeDuo Sub-Agent System';
    }

    const body = {
        model: agent.model,
        messages: [
            { role: 'system', content: agent.systemPrompt },
            { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1024
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`${agent.name} API error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || 'No response';

        return {
            agent: agent.name,
            role: agent.role,
            model: agent.model,
            response: content
        };
    } catch (error) {
        return {
            agent: agent.name,
            role: agent.role,
            model: agent.model,
            response: `Error: ${error.message}`,
            error: true
        };
    }
}

/**
 * Tüm sub-agent'lara paralel sorgu gönder (demokratik oylama)
 * @param {string} prompt - Sorulacak soru
 * @returns {Promise<{responses: Array, summary: string}>}
 */
async function queryAllAgents(prompt) {
    console.log('🎼 ARCHITECTURE: Demokratik oylama başlatılıyor...\n');

    const agentNames = Object.keys(MODELS);

    const results = await Promise.all(
        agentNames.map(name => queryAgent(name, prompt))
    );

    console.log('📊 Tüm görüşler toplandı:\n');

    results.forEach(result => {
        const icon = result.error ? '❌' : '✅';
        console.log(`${icon} ${result.agent} (${result.role}):`);
        console.log(`   Model: ${result.model}`);
        console.log(`   Görüş: ${result.response.substring(0, 200)}...`);
        console.log('');
    });

    return {
        responses: results,
        timestamp: new Date().toISOString()
    };
}

/**
 * Belirli bir konuda uzman görüşü al
 * @param {string} topic - 'security', 'performance', 'quality', 'testing'
 * @param {string} prompt - Soru
 */
async function consultExpert(topic, prompt) {
    const topicMap = {
        security: 'AEGIS',
        performance: 'VOLT',
        quality: 'MUSE',
        testing: 'INSPECTOR'
    };

    const agentName = topicMap[topic.toLowerCase()];
    if (!agentName) {
        throw new Error(`Unknown topic: ${topic}. Use: security, performance, quality, testing`);
    }

    return queryAgent(agentName, prompt);
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MODELS,
        queryAgent,
        queryAllAgents,
        consultExpert
    };
}

// CLI kullanımı
if (typeof process !== 'undefined' && process.argv[1]?.includes('subagent-client')) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
🤖 CafeDuo Sub-Agent CLI

Kullanım:
  node subagent-client.js all "Soru"        - Tüm agentlara sor
  node subagent-client.js AEGIS "Soru"      - Sadece AEGIS'e sor
  node subagent-client.js security "Soru"   - Güvenlik uzmanına sor
  node subagent-client.js performance "..." - Performans uzmanına sor
  node subagent-client.js quality "..."     - Kalite uzmanına sor
  node subagent-client.js testing "..."     - Test uzmanına sor
`);
        process.exit(0);
    }

    const [target, ...promptParts] = args;
    const prompt = promptParts.join(' ');

    // Load .env.ai
    require('dotenv').config({ path: '.env.ai' });

    (async () => {
        try {
            if (target.toLowerCase() === 'all') {
                await queryAllAgents(prompt);
            } else if (MODELS[target.toUpperCase()]) {
                const result = await queryAgent(target.toUpperCase(), prompt);
                console.log(`\n${result.agent}: ${result.response}`);
            } else {
                const result = await consultExpert(target, prompt);
                console.log(`\n${result.agent}: ${result.response}`);
            }
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    })();
}
