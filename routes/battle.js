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
        1. 두 전사의 격돌을 반드시 박진감 넘치는 소설(1문단)로 간결하게 묘사해줘. 상대방이 어떤 능력이있는지 자세하게 적지마.
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

// ⚔️ 무작위 난투 API (소유권 확인 로직 추가)
    router.get('/random', async (req, res) => {
        const ownerId = req.query.ownerId;
        if (!ownerId) return res.status(400).json({ error: "로그인 정보가 없습니다." });

        try {
            // 1. 출전할 '나의 전사' 목록 싹쓸이 조회
            const { data: myChars } = await supabase.from('characters').select('*').eq('owner_id', ownerId);
            if (!myChars || myChars.length === 0) {
                return res.json({ error: "전투에 내보낼 나의 전사가 없습니다. 먼저 전사를 소환하세요!" });
            }

            // 2. 출전할 나의 전사 1명 무작위 선택 (Player A)
            const p1 = myChars[Math.floor(Math.random() * myChars.length)];

            // 3. 맞서 싸울 상대방(나를 제외한 나머지 전사들) 목록 조회
            const { data: opponents } = await supabase.from('characters').select('*').neq('owner_id', ownerId);
            if (!opponents || opponents.length === 0) {
                return res.json({ error: "맞서 싸울 다른 유저의 전사가 아직 존재하지 않습니다." });
            }
            
            // 4. 상대방 전사 1명 무작위 선택 (Player B)
            const p2 = opponents[Math.floor(Math.random() * opponents.length)];

            // 매칭 완료! 전투 시작
            res.json(await runBattle(p1, p2));

        } catch (err) {
            res.status(500).json({ error: "매칭 중 서버 오류가 발생했습니다." });
        }
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