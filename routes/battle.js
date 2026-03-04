const express = require('express');
const router = express.Router();

// server.js에서 supabase와 groq(AI) 권한을 모두 넘겨받습니다.
module.exports = (supabase, groq) => {

    // ⚔️ 통합 배틀 판정 로직 (내부 함수)
    async function runBattle(playerA, playerB) {
        const prompt = `판타지 배틀 심판으로서 승부의 과정을 작성해줘.
        [캐릭터 A]: ${playerA.player_name} (능력: ${playerA.ability}, 강화: ${playerA.growth_points}EP)
        [캐릭터 B]: ${playerB.player_name} (능력: ${playerB.ability}, 강화: ${playerB.growth_points}EP)
        규칙: 반드시 한 명의 승자를 정하고 마지막에 [승자: 이름]을 적어줘.`;

        const chat = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile'
        });

        const story = chat.choices[0].message.content;
        const winnerName = (story.includes(playerA.player_name) && story.lastIndexOf(playerA.player_name) > story.lastIndexOf(playerB.player_name)) 
            ? playerA.player_name : playerB.player_name;
        
        const winner = winnerName === playerA.player_name ? playerA : playerB;
        const loser = winnerName === playerA.player_name ? playerB : playerA;

        // DB에 승패 결과 기록
        const { error } = await supabase.rpc('process_battle_result', { winner_id: winner.id, loser_id: loser.id });
        if (error) console.error("기록 실패:", error);

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