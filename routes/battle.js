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
        1. 이름의 위압감: 이름에서 느껴지는 서사적 포스(10%)
        2. 능력 설정과 상성: 능력의 파괴력 및 상대방의 능력을 카운터 치는 속성 상성(40%)
        3. 실제 능력치 (힘/민첩/지력): 스탯의 총합과 분배가 전투에 미치는 물리적/마법적 영향(20%)
        4. 강화 횟수: 강화 레벨에 따른 압도적인 등급 차이(30%)

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
        1. 두 전사의 격돌을 반드시 박진감 넘치는 소설 형식 1문단으로 간결하게 묘사한다. 상대방의 능력은 구체적으로 설명은 하지 않는다.
        2. 전투 묘사 바로 다음 줄에 한 줄 띄우고, [승자: 이름] 형식으로 승자의 이름만 정확히 출력한다.`;

        // 🟢 [완벽 수정됨] 아래 4줄의 AI 호출 코드가 반드시 "한 번만" 있어야 합니다.
        const chat = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.7 
        });

        let story = chat.choices[0].message.content;
        story = story.replace(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\uFAFF\uFF66-\uFF9F]/g, '');
        
        // 🟢 [복구됨] 승자 이름 판독 로직
        const winnerName = (story.includes(playerA.player_name) && story.lastIndexOf(playerA.player_name) > story.lastIndexOf(playerB.player_name)) 
            ? playerA.player_name : playerB.player_name;

        // 기존 승자 판독 로직 및 DB 업데이트 로직은 그대로 유지합니다.
        const winner = winnerName === playerA.player_name ? playerA : playerB;
        const loser = winnerName === playerA.player_name ? playerB : playerA;

        // 🟢 [신규 추가] 현상금(보너스 EP) 계산 로직
        let bonusEP = 0;
        let bountyMessage = "";
        
        // 상대방(패자)이 3연승 이상 달리고 있던 랭커라면 현상금 발동!
        if (loser.win_streak >= 3) {
            bonusEP = loser.win_streak * 2; // 연승 1회당 2 EP 보너스
            bountyMessage = `<br><br><span style="color:#facc15; font-weight:bold; font-size:18px;">💰 잭팟! ${loser.player_name}의 ${loser.win_streak}연승을 저지하여 현상금 ${bonusEP} EP를 추가 획득했습니다!</span>`;
        }

        const totalEarnedEP = 5 + bonusEP; // 기본 5점에 보너스를 합산

        // 승자 업데이트 (합산된 totalEarnedEP 부여)
        await supabase.from('characters').update({
            wins: (winner.wins || 0) + 1,
            matches: (winner.matches || 0) + 1,
            win_streak: (winner.win_streak || 0) + 1,
            growth_points: (winner.growth_points || 0) + totalEarnedEP
        }).eq('id', winner.id);

        // 패자 업데이트 (기존과 동일)
        await supabase.from('characters').update({
            matches: (loser.matches || 0) + 1,
            win_streak: 0,
            growth_points: Math.max(0, (loser.growth_points || 0) - 3)
        }).eq('id', loser.id);

        // 프론트엔드로 소설과 함께 현상금 메시지도 몰래 전달
        return { 
            playerA: playerA.player_name, 
            playerB: playerB.player_name, 
            story: story + bountyMessage // 소설 밑에 알림창을 붙임
        };
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