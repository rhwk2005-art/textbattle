// 1. 필요한 통신병들 모두 고용하기
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// 2. 서버 기본 세팅
const app = express();
const port = process.env.PORT || 3000;

// 3. AI 심판 세팅 (보안을 위해 환경 변수 사용)
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || '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',
  baseURL: 'https://api.groq.com/openai/v1', 
});

// 4. 영구 창고 세팅 (Supabase)
const supabaseUrl = 'https://cjtshlrvuhhjmrlksohi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdHNobHJ2dWhoam1ybGtzb2hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MTc3MzEsImV4cCI6MjA4ODA5MzczMX0.ANiPuMSvCW7C8ybJNXU1BhpG1tO18VKGYbxXUrfWVKM';
const supabase = createClient(supabaseUrl, supabaseKey);

// 5. 접수 창구(public) 열기 및 데이터 번역기 달기
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));


// ==========================================
// 여기서부터는 업무 지시 (라우팅)
// ==========================================

// 🟢 업무 1: 폼에서 배틀 신청서가 도착했을 때
app.post('/battle', async (req, res) => {
  const name = req.body.playerName;
  const skill = req.body.ability;
  const ownerId = req.body.ownerId; 

  const { data, error } = await supabase
    .from('characters')
    .insert([{ player_name: name, ability: skill, owner_id: ownerId }]);

  if (error) {
    console.log('❌ 저장 실패:', error.message);
    res.send('<h1>에러 발생!</h1><p>저장 중 문제가 생겼습니다.</p><a href="/">뒤로 가기</a>');
    return;
  }
  res.send(`<h1>접수 완료!</h1><p>${name} 전사가 등록되었습니다.</p><a href="/">새로운 캐릭터 만들기</a>`);
});

// 🟢 업무 2: 화면에 캐릭터 명부를 띄워줘야 할 때
app.get('/api/characters', async (req, res) => {
  const { data, error } = await supabase.from('characters').select('*'); 
  if (error) {
    res.status(500).send('오류가 발생했습니다.');
    return;
  }
  res.json(data);
});

// 🟢 업무 3: 무작위 배틀 매칭 (연승 시스템 완벽 적용)
app.get('/api/battle/random', async (req, res) => {
  const { data: characters, error } = await supabase.from('characters').select('*');
  if (error || characters.length < 2) return res.status(400).send('최소 2명 이상 필요합니다.');

  const shuffled = characters.sort(() => 0.5 - Math.random());
  const playerA = shuffled[0];
  const playerB = shuffled[1];

  const prompt = `
  너는 판타지 배틀 심판이야. 다음 두 캐릭터의 싸움을 3문단 소설로 써줘.
  [캐릭터 A]: 이름 - ${playerA.player_name}, 능력 - ${playerA.ability}
  [캐릭터 B]: 이름 - ${playerB.player_name}, 능력 - ${playerB.ability}
  규칙: 무조건 한 명만 이기고, 마지막 줄에 반드시 [승자: (이긴 캐릭터 이름)] 형식으로 적어.
  `;

  try {
    const response = await openai.chat.completions.create({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }] });
    const story = response.choices[0].message.content;

    let winnerId = null;
    if (story.includes(`[승자: ${playerA.player_name}]`)) winnerId = playerA.id;
    else if (story.includes(`[승자: ${playerB.player_name}]`)) winnerId = playerB.id;

    if (winnerId) {
      const isAWinner = winnerId === playerA.id;
      const isBWinner = winnerId === playerB.id;

      await supabase.from('characters').update({
        matches: (playerA.matches || 0) + 1,
        wins: isAWinner ? (playerA.wins || 0) + 1 : (playerA.wins || 0),
        win_streak: isAWinner ? (playerA.win_streak || 0) + 1 : 0 
      }).eq('id', playerA.id);

      await supabase.from('characters').update({
        matches: (playerB.matches || 0) + 1,
        wins: isBWinner ? (playerB.wins || 0) + 1 : (playerB.wins || 0),
        win_streak: isBWinner ? (playerB.win_streak || 0) + 1 : 0
      }).eq('id', playerB.id);
    }
    res.json({ playerA: playerA.player_name, playerB: playerB.player_name, story: story });
  } catch (err) { res.status(500).send('에러 발생'); }
});

// 🟢 업무 4: 선택형 배틀 매칭 (연승 시스템 완벽 적용)
app.get('/api/battle/challenge/:id', async (req, res) => {
  const challengerId = req.params.id;
  const { data: challengerData } = await supabase.from('characters').select('*').eq('id', challengerId).single();
  const { data: opponents } = await supabase.from('characters').select('*').neq('id', challengerId);
  
  if (!challengerData || opponents.length === 0) return res.status(400).send('상대가 없습니다.');
  const opponentData = opponents[Math.floor(Math.random() * opponents.length)];

  const prompt = `
  너는 판타지 배틀 심판이야. 다음 두 캐릭터의 싸움을 3문단 소설로 써줘.
  [도전자]: 이름 - ${challengerData.player_name}, 능력 - ${challengerData.ability}
  [방어자]: 이름 - ${opponentData.player_name}, 능력 - ${opponentData.ability}
  규칙: 무조건 한 명만 이기고, 마지막 줄에 반드시 [승자: (이긴 캐릭터 이름)] 형식으로 적어.
  `;

  try {
    const response = await openai.chat.completions.create({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }] });
    const story = response.choices[0].message.content;

    let winnerId = null;
    if (story.includes(`[승자: ${challengerData.player_name}]`)) winnerId = challengerData.id;
    else if (story.includes(`[승자: ${opponentData.player_name}]`)) winnerId = opponentData.id;

    if (winnerId) {
      const isChallengerWinner = winnerId === challengerData.id;
      const isOpponentWinner = winnerId === opponentData.id;

      await supabase.from('characters').update({
        matches: (challengerData.matches || 0) + 1,
        wins: isChallengerWinner ? (challengerData.wins || 0) + 1 : (challengerData.wins || 0),
        win_streak: isChallengerWinner ? (challengerData.win_streak || 0) + 1 : 0
      }).eq('id', challengerData.id);

      await supabase.from('characters').update({
        matches: (opponentData.matches || 0) + 1,
        wins: isOpponentWinner ? (opponentData.wins || 0) + 1 : (opponentData.wins || 0),
        win_streak: isOpponentWinner ? (opponentData.win_streak || 0) + 1 : 0
      }).eq('id', opponentData.id);
    }
    res.json({ playerA: challengerData.player_name, playerB: opponentData.player_name, story: story });
  } catch (err) { res.status(500).send('에러 발생'); }
});

// 🟢 업무 5: 캐릭터 삭제 (은퇴)
app.delete('/api/characters/:id', async (req, res) => {
  const charId = req.params.id;
  const { error } = await supabase.from('characters').delete().eq('id', charId);
  if (error) {
    res.status(500).send('삭제 오류');
  } else {
    res.send('삭제 성공');
  }
});

// ==========================================
// 6. 서버 작동 (문 열기) - 반드시 파일 맨 마지막에 딱 한 번만 있어야 합니다!
// ==========================================
app.listen(port, () => {
  console.log(`서버가 켜졌습니다! 주소: http://localhost:${port}`);
});
