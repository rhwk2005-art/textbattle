require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { Groq } = require('groq-sdk');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// 🔍 접속 로그 (CCTV)
app.use((req, res, next) => {
  console.log(`[CCTV] 유저가 ${req.url} 페이지에 접근했습니다.`);
  next();
});

// 🔐 환경 변수 설정
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// 1. 캐릭터 생성 및 무료 AI 이미지 생성
app.post('/battle', async (req, res) => {
    const { playerName, ability, ownerId } = req.body;
    const prompt = encodeURIComponent(`fantasy warrior, ${playerName}, power of ${ability}, epic digital art style`);
    const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?width=512&height=512&seed=${Math.floor(Math.random() * 1000)}`;

    const { error } = await supabase.from('characters').insert([{
        player_name: playerName,
        ability: ability,
        owner_id: ownerId,
        image_url: imageUrl,
        growth_points: 0,
        win_streak: 0,
        wins: 0,
        matches: 0
    }]);

    if (error) return res.status(500).send(error.message);
    res.redirect(`/success.html?name=${encodeURIComponent(playerName)}`);
});

// 2. 캐릭터 목록 조회
app.get('/api/characters', async (req, res) => {
    const { data } = await supabase.from('characters').select('*').order('win_streak', { ascending: false });
    res.json(data);
});

// 3. 통합 배틀 로직 (수정 완료)
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
    
    // 승자 판독 로직
    const winnerName = (story.includes(playerA.player_name) && story.lastIndexOf(playerA.player_name) > story.lastIndexOf(playerB.player_name)) 
        ? playerA.player_name : playerB.player_name;
    
    const winner = winnerName === playerA.player_name ? playerA : playerB;
    const loser = winnerName === playerA.player_name ? playerB : playerA;

    // 📈 통합 정산 (RPC 한 번으로 모든 수치 업데이트)
    const { error } = await supabase.rpc('process_battle_result', { 
        winner_id: winner.id, 
        loser_id: loser.id 
    });

    if (error) console.error("기록 실패:", error);

    return { playerA: playerA.player_name, playerB: playerB.player_name, story };
}

// 4. 랜덤 배틀 API
app.get('/api/battle/random', async (req, res) => {
    const { data } = await supabase.from('characters').select('*');
    if (data.length < 2) return res.json({ story: "전사가 부족합니다." });
    const p1 = data[Math.floor(Math.random() * data.length)];
    let p2 = data[Math.floor(Math.random() * data.length)];
    while(p1.id === p2.id) p2 = data[Math.floor(Math.random() * data.length)];
    res.json(await runBattle(p1, p2));
});

// 5. 출격하기 API
app.get('/api/battle/challenge/:id', async (req, res) => {
    const challengerId = req.params.id;
    try {
        const { data: challenger } = await supabase.from('characters').select('*').eq('id', challengerId).single();
        const { data: opponents } = await supabase.from('characters').select('*').neq('id', challengerId);
        
        if (!challenger || opponents.length === 0) throw new Error("대전 상대를 찾을 수 없습니다.");
        const randomOpponent = opponents[Math.floor(Math.random() * opponents.length)];

        res.json(await runBattle(challenger, randomOpponent));
    } catch (err) {
        res.status(500).json({ story: "전장 오류: " + err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`서버가 ${PORT}번 포트에서 전장을 감시 중...`));