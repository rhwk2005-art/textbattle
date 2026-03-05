const express = require('express');
const router = express.Router();

// server.js에서 supabase와 groq(AI) 권한을 모두 넘겨받습니다.
module.exports = (supabase, groq) => {

// ⚔️ 통합 배틀 판정 로직
    async function runBattle(playerA, playerB) {
        // AI 심판에게 실제 스탯과 강화 단계를 제공합니다.
        const prompt = `당신은 판타지 배틀의 공정하고 분석적인 AI 심판입니다.
        아래 4가지 심사 기준을 종합적으로 계산하여 승자를 판정하세요.

        [심사 기준]
        1. 이름의 위압감: 이름에서 느껴지는 서사적 포스
        2. 능력 설정과 상성: 능력의 파괴력 및 상대방의 능력을 카운터 치는 속성 상성
        3. 실제 능력치 (힘/민첩/지력): 스탯의 총합과 분배가 전투에 미치는 물리적/마법적 영향
        4. 강화 횟수: 강화 레벨에 따른 압도적인 등급 차이

        [전사 A 데이터] 
        - 이름: ${playerA.player_name}
        - 능력: ${playerA.ability}
        - 능력치: 힘 ${playerA.str}, 민첩 ${playerA.agi}, 지력 ${playerA.intel}
        - 강화 횟수: +${playerA.enhance_level}

        [전사 B 데이터] 
        - 이름: ${playerB.player_name}
        - 능력: ${playerB.ability}
        - 능력치: 힘 ${playerB.str}, 민첩 ${playerB.agi}, 지력 ${playerB.intel}
        - 강화 횟수: +${playerB.enhance_level}

        [출력 규칙 - 반드시 아래 양식을 지킬 것]
        1. 두 전사의 격돌을 박진감 넘치는 소설(1~3문단)로 묘사해줘. 묘사 중에 스탯(힘/민첩/지력)과 강화 단계가 어떻게 승패를 갈랐는지 자연스럽게 녹여내.
        2. 맨 마지막 줄에는 반드시 [승자: 이름] 형식으로 승자의 이름만 정확히 출력해.`;

        const chat = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.7 // 약간의 논리적 일관성을 위해 추가
        });

        const story = chat.choices[0].message.content;
        
        // 기존 승자 판독 로직 및 DB 업데이트 로직은 그대로 유지합니다.
        const winnerName = (story.includes(playerA.player_name) && story.lastIndexOf(playerA.player_name) > story.lastIndexOf(playerB.player_name)) 
            ? playerA.player_name : playerB.player_name;
        
        const winner = winnerName === playerA.player_name ? playerA : playerB;
        const loser = winnerName === playerA.player_name ? playerB : playerA;

        await supabase.from('characters').update({
            wins: (winner.wins || 0) + 1,
            matches: (winner.matches || 0) + 1,
            win_streak: (winner.win_streak || 0) + 1,
            growth_points: (winner.growth_points || 0) + 5
        }).eq('id', winner.id);

        await supabase.from('characters').update({
            matches: (loser.matches || 0) + 1,
            win_streak: 0,
            growth_points: Math.max(0, (loser.growth_points || 0) - 3)
        }).eq('id', loser.id);

        return { playerA: playerA.player_name, playerB: playerB.player_name, story };
    }

    // ⚔️ 무작위 난투 API
    router.get('/random', async (req, res) => {
        const { data } = await supabase.from('characters').select('*');
        if (data.length < 2) return res.json({ story: "전사가 부족합니다." });
        const p1 = data[Math.floor(Math.random() * data.length)];
        let p2 = data[Math.floor(Math.random() * data.length)];
        while(p1.id === p2.id) p2 = data[Math.floor(Math.random() * data.length)];
        res.json(await runBattle(p1, p2));
    });

    // ⚔️ 특정 전사 출격 API
    router.get('/challenge/:id', async (req, res) => {
        try {
            const { data: challenger } = await supabase.from('characters').select('*').eq('id', req.params.id).single();
            const { data: opponents } = await supabase.from('characters').select('*').neq('id', req.params.id);
            if (!challenger || opponents.length === 0) throw new Error("상대를 찾을 수 없습니다.");
            
            const randomOpponent = opponents[Math.floor(Math.random() * opponents.length)];
            res.json(await runBattle(challenger, randomOpponent));
        } catch (err) {
            res.status(500).json({ story: "전장 오류: " + err.message });
        }
    });

    return router;
};