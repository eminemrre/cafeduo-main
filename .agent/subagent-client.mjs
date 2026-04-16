/**
 * ODESUS Multi-Agent System
 * OpenRouter SDK ile demokratik sub-agent orkestrasyonu
 * 
 * Mimari: ODESUS (Governor + Takımlar + Shared Resources)
 * Model: tngtech/deepseek-r1t2-chimera:free (OpenRouter)
 */

import { OpenRouter } from '@openrouter/sdk';

// ============================================
// CONFIGURATION
// ============================================

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const openrouter = new OpenRouter({
    apiKey: OPENROUTER_API_KEY
});

// Free models from OpenRouter (updated 2026-02)
const FREE_MODELS = {
    deepseek: 'tngtech/deepseek-r1t2-chimera:free',
    glm: 'z-ai/glm-4.5-air:free', // New working model!
    // qwen3: 'qwen/qwen3-coder:free', // Rate limited often
};

// ============================================
// SUB-AGENT DEFINITIONS (ODESUS Model)
// ============================================

const AGENTS = {
    // TAKIM A - Execution
    CAN: {
        name: 'CAN',
        role: 'Coder',
        team: 'A',
        model: FREE_MODELS.deepseek,
        emoji: '💻',
        systemPrompt: `Sen CAN - CafeDuo'nun baş yazılımcısısın.
Görevin: Kod yazma, refactoring, bug fixing.
KURALLAR:
- 3 dosyadan fazla değişiklik gerekiyorsa parçala
- Test yazmadan kod yazma
- Hasar tespiti yap: değişikliğin neyi bozabileceğini listele`
    },
    KAYA: {
        name: 'KAYA',
        role: 'Analyst',
        team: 'A',
        model: FREE_MODELS.glm,
        emoji: '📊',
        systemPrompt: `Sen KAYA - CafeDuo'nun veri analistsin.
Görevin: Performans analizi, metrik takibi, benchmark.
KURALLAR:
- Sayılarla konuş, metrik ver
- Karşılaştırmalı analiz yap
- Darboğazları tespit et`
    },

    // TAKIM B - Strategy
    ECE: {
        name: 'ECE',
        role: 'Content',
        team: 'B',
        model: FREE_MODELS.deepseek,
        emoji: '📝',
        systemPrompt: `Sen ECE - CafeDuo'nun içerik ve dokümantasyon uzmanısın.
Görevin: README, JSDoc, kullanıcı yardımı, UX yazıları.
KURALLAR:
- Açık ve anlaşılır yaz
- Kullanıcı perspektifinden düşün
- Örneklerle açıkla`
    },
    DEMIR: {
        name: 'DEMIR',
        role: 'Strategist',
        team: 'B',
        model: FREE_MODELS.glm,
        emoji: '🎯',
        systemPrompt: `Sen DEMIR - CafeDuo'nun strateji uzmanısın.
Görevin: Mimari kararlar, roadmap planlaması, risk analizi.
KURALLAR:
- Büyük resmi gör
- Trade-off'ları değerlendir
- Uzun vadeli düşün`
    }
};

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Tek bir agent'a sorgu gönder
 */
async function queryAgent(agentName, prompt) {
    const agent = AGENTS[agentName.toUpperCase()];
    if (!agent) {
        throw new Error(`Unknown agent: ${agentName}. Available: ${Object.keys(AGENTS).join(', ')}`);
    }

    console.log(`${agent.emoji} ${agent.name} (${agent.role}) düşünüyor...`);

    try {
        const stream = await openrouter.chat.send({
            model: agent.model,
            messages: [
                { role: 'system', content: agent.systemPrompt },
                { role: 'user', content: prompt }
            ],
            stream: false
        });

        const content = stream.choices?.[0]?.message?.content || 'Yanıt alınamadı';

        return {
            agent: agent.name,
            role: agent.role,
            team: agent.team,
            emoji: agent.emoji,
            model: agent.model,
            response: content
        };
    } catch (error) {
        return {
            agent: agent.name,
            role: agent.role,
            team: agent.team,
            emoji: agent.emoji,
            model: agent.model,
            response: `Hata: ${error.message}`,
            error: true
        };
    }
}

/**
 * Bir takıma sorgu gönder (paralel)
 */
async function queryTeam(teamId, prompt) {
    const teamAgents = Object.entries(AGENTS)
        .filter(([_, agent]) => agent.team === teamId.toUpperCase())
        .map(([name]) => name);

    console.log(`\n🏢 TAKIM ${teamId.toUpperCase()} toplanıyor...`);

    const results = await Promise.all(
        teamAgents.map(name => queryAgent(name, prompt))
    );

    return {
        team: teamId.toUpperCase(),
        responses: results
    };
}

/**
 * Demokratik oylama - tüm agentlara sor
 */
async function democraticVote(prompt) {
    console.log('\n🗳️ DEMOKRATİK OYLAMA BAŞLADI\n');
    console.log('='.repeat(50));

    const allAgents = Object.keys(AGENTS);

    const results = await Promise.all(
        allAgents.map(name => queryAgent(name, prompt))
    );

    console.log('\n📊 SONUÇLAR:\n');

    // Team A
    console.log('TAKIM A (Execution):');
    results.filter(r => r.team === 'A').forEach(r => {
        console.log(`  ${r.emoji} ${r.name}: ${r.response.substring(0, 150)}...`);
    });

    // Team B
    console.log('\nTAKIM B (Strategy):');
    results.filter(r => r.team === 'B').forEach(r => {
        console.log(`  ${r.emoji} ${r.name}: ${r.response.substring(0, 150)}...`);
    });

    return {
        timestamp: new Date().toISOString(),
        prompt,
        responses: results
    };
}

/**
 * Consensus oluştur - özet çıkar
 */
async function buildConsensus(responses) {
    const summaryPrompt = `
Aşağıdaki 4 uzmanın görüşlerini analiz et ve ortak bir karar çıkar:

${responses.map(r => `${r.emoji} ${r.name} (${r.role}): ${r.response}`).join('\n\n')}

ÇIKTI:
1. KONSENSÜS: Tüm uzmanların hemfikir olduğu noktalar
2. TARTIŞMALI: Farklı görüşler
3. ÖNERİ: En iyi eylem planı
4. RİSKLER: Dikkat edilmesi gerekenler
`;

    // ODESUS (Governor) olarak özetleriz
    const consensus = await openrouter.chat.send({
        model: FREE_MODELS.deepseek,
        messages: [
            { role: 'system', content: 'Sen ODESUS - Governor. Tüm agent çıktılarını review edip final kararı verirsin.' },
            { role: 'user', content: summaryPrompt }
        ],
        stream: false
    });

    return consensus.choices?.[0]?.message?.content || 'Konsensüs oluşturulamadı';
}

// ============================================
// CLI INTERFACE
// ============================================

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
🏛️ ODESUS Multi-Agent System

Kullanım:
  node subagent-client.mjs vote "Soru"     - Demokratik oylama
  node subagent-client.mjs teamA "Soru"    - Sadece Takım A
  node subagent-client.mjs teamB "Soru"    - Sadece Takım B
  node subagent-client.mjs CAN "Soru"      - Sadece CAN (Coder)
  node subagent-client.mjs KAYA "Soru"     - Sadece KAYA (Analyst)
  node subagent-client.mjs ECE "Soru"      - Sadece ECE (Content)
  node subagent-client.mjs DEMIR "Soru"    - Sadece DEMIR (Strategist)

Agentlar:
  TAKIM A (Execution): CAN (💻 Coder), KAYA (📊 Analyst)
  TAKIM B (Strategy): ECE (📝 Content), DEMIR (🎯 Strategist)
`);
        process.exit(0);
    }

    const [target, ...promptParts] = args;
    const prompt = promptParts.join(' ');

    if (!prompt) {
        console.error('❌ Lütfen bir soru girin.');
        process.exit(1);
    }

    try {
        if (target.toLowerCase() === 'vote') {
            const results = await democraticVote(prompt);
            console.log('\n🎯 KONSENSÜS OLUŞTURULUYOR...\n');
            const consensus = await buildConsensus(results.responses);
            console.log('='.repeat(50));
            console.log('📋 ODESUS KARARI:\n');
            console.log(consensus);
        } else if (target.toLowerCase() === 'teama') {
            await queryTeam('A', prompt);
        } else if (target.toLowerCase() === 'teamb') {
            await queryTeam('B', prompt);
        } else if (AGENTS[target.toUpperCase()]) {
            const result = await queryAgent(target, prompt);
            console.log(`\n${result.emoji} ${result.name} (${result.role}):\n`);
            console.log(result.response);
        } else {
            console.error(`❌ Bilinmeyen hedef: ${target}`);
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Hata:', error.message);
        process.exit(1);
    }
}

// ES Module exports
export { AGENTS, queryAgent, queryTeam, democraticVote, buildConsensus };

// Run CLI
main();
