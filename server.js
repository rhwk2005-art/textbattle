// 1. 필요한 통신병들 모두 고용하기
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai'); // 🟢 OpenAI 통신병 새로 고용!

// 2. 서버 기본 세팅
const app = express();
const port = 3000;

// 3. AI 심판 세팅 (Groq 사용 - OpenAI 통신병을 그대로 재활용!)
const openai = new OpenAI({
  apiKey: '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',
  baseURL: 'https://api.groq.com/openai/v1', // 🟢 챗GPT 대신 Groq 본사로 목적지를 변경하는 코드입니다.
});

// 4. 영구 창고 세팅 (Supabase)
// 사용자님의 기존 창고 주소와 키를 그대로 살려두었습니다.
const supabaseUrl = 'https://cjtshlrvuhhjmrlksohi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdHNobHJ2dWhoam1ybGtzb2hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MTc3MzEsImV4cCI6MjA4ODA5MzczMX0.ANiPuMSvCW7C8ybJNXU1BhpG1tO18VKGYbxXUrfWVKM';
const supabase = createClient(supabaseUrl, supabaseKey);

// 5. 접수 창구(public) 열기 및 데이터 번역기 달기
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 여기서부터는 업무 지시 (라우팅)
// ==========================================

// 업무 1: 폼에서 배틀 신청서가 도착했을 때 (데이터베이스 저장)
app.post('/battle', async (req, res) => {
  const name = req.body.playerName;
  const skill = req.body.ability;
  const ownerId = req.body.ownerId; // 🟢 새로 추가: 프론트엔드에서 보낸 주인의 이메일(신분증)을 받습니다.

  console.log('--- 창고로 데이터 전송 시작 ---');
  
  // 🟢 새로 추가: owner_id 칸에 주인의 이메일(ownerId)을 같이 꽂아 넣습니다.
  const { data, error } = await supabase
    .from('characters')
    .insert([
      { player_name: name, ability: skill, owner_id: ownerId }
    ]);

  if (error) {
    console.log('❌ 저장 실패:', error.message);
    res.send('<h1>에러 발생!</h1><p>창고에 저장하는 중 문제가 생겼습니다.</p><a href="/">뒤로 가기</a>');
    return;
  }

  console.log('✅ 창고 저장 완료!');
  res.send(`<h1>접수 및 저장 완료!</h1><p>${name}님의 데이터가 영구 창고에 무사히 보관되었습니다.</p><a href="/">새로운 캐릭터 만들기</a>`);
});

// 업무 2: 화면에 캐릭터 명부를 띄워줘야 할 때 (데이터베이스 조회)
app.get('/api/characters', async (req, res) => {
  console.log('--- 누군가 캐릭터 목록을 요청했습니다 ---');
  
  const { data, error } = await supabase.from('characters').select('*'); 

  if (error) {
    console.log('❌ 목록 가져오기 실패:', error.message);
    res.status(500).send('오류가 발생했습니다.');
    return;
  }
  res.json(data);
});

// 🟢 업무 3: 랜덤 배틀 진행 및 AI 판정 (OpenAI 전용으로 교체됨!)
app.get('/api/battle/random', async (req, res) => {
  console.log('--- ⚔️ 랜덤 배틀 매칭을 시작합니다 ---');

  try {
    const { data: chars, error } = await supabase.from('characters').select('*');
    if (error || !chars || chars.length < 2) {
      return res.status(400).send("배틀을 하려면 창고에 최소 2명 이상의 캐릭터가 있어야 합니다!");
    }

    const shuffled = chars.sort(() => 0.5 - Math.random());
    const playerA = shuffled[0];
    const playerB = shuffled[1];

    console.log(`매칭 완료: ${playerA.player_name} VS ${playerB.player_name}`);

    const prompt = `
      너는 텍스트 배틀 게임의 공정하고 재치 있는 AI 심판이야.
      아래 두 캐릭터가 자신의 능력을 사용해 싸운다면 누가 이길지, 어떤 논리로 승부가 날지 3~4줄로 흥미진진한 소설처럼 써줘.
      절대적인 방어나 무적 같은 억지 능력은 논리적인 맹점을 찔러서 파훼하는 쪽으로 판정해.
      마지막 줄에는 반드시 "[최종 승자: OOO]" 형식으로 결과를 명시해줘.

      [캐릭터 A] 이름: ${playerA.player_name} / 능력: ${playerA.ability}
      [캐릭터 B] 이름: ${playerB.player_name} / 능력: ${playerB.ability}
    `;

    // 🟢 Groq의 Llama 3 심판에게 판정 의뢰
    const response = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile", // 🟢 Groq에서 지원하는 빠르고 똑똑한 최신 무료 모델입니다.
      messages: [{ role: "user", content: prompt }],
    });
    const aiStory = response.choices[0].message.content;
    console.log('✅ OpenAI 판정 완료!');
    
    res.json({
      playerA: playerA.player_name,
      playerB: playerB.player_name,
      story: aiStory
    });

  } catch (err) {
    console.log('❌ OpenAI 호출 에러:', err);
    res.status(500).send("AI 심판이 혼란에 빠져 판정을 내리지 못했습니다.");
  }
});

// 6. 3000번 문 열고 방문객 기다리기
app.listen(port, () => {
  console.log(`서버가 켜졌습니다! 주소: http://localhost:${port}`);
  console.log(`클라우드 창고(Supabase)와 새 심판(OpenAI) 연결 완료!`);
});

// 🟢 업무 4: 특정 캐릭터 은퇴(삭제)시키기
app.delete('/api/characters/:id', async (req, res) => {
  const charId = req.params.id; // 프론트엔드에서 보낸 캐릭터 고유번호
  console.log(`--- 캐릭터 삭제 요청 들어옴 (ID: ${charId}) ---`);

  // Supabase 창고에서 해당 번호를 가진 캐릭터를 삭제합니다.
  const { error } = await supabase.from('characters').delete().eq('id', charId);

  if (error) {
    console.log('❌ 삭제 실패:', error.message);
    res.status(500).send('삭제 중 오류가 발생했습니다.');
  } else {
    console.log('✅ 캐릭터 삭제 완료!');
    res.send('삭제 성공');
  }
});