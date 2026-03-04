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
  // 1. 창고에서 선수 명단 가져오기
  const { data: characters, error } = await supabase.from('characters').select('*');
  if (error || characters.length < 2) {
    return res.status(400).send('배틀을 진행하려면 최소 2명 이상의 캐릭터가 있어야 합니다.');
  }

  // 2. 무작위로 두 명 뽑기
  const shuffled = characters.sort(() => 0.5 - Math.random());
  const playerA = shuffled[0];
  const playerB = shuffled[1];

  // 3. ⭐️ AI 심판을 꽉 잡는 아주 엄격한 명령서 (프롬프트 엔지니어링)
  const prompt = `
  너는 판타지 세계의 무자비한 배틀 심판이야.
  다음 두 캐릭터가 목숨을 걸고 싸우는 흥미진진한 소설을 3문단으로 써줘.

  [캐릭터 A]: 이름 - ${playerA.player_name}, 능력 - ${playerA.ability}
  [캐릭터 B]: 이름 - ${playerB.player_name}, 능력 - ${playerB.ability}

  규칙 1: 둘 중 반드시 한 명만 승리해야 해. 무승부나 화해는 절대 없어.
  규칙 2: 소설이 다 끝난 후, 맨 마지막 줄에 반드시 아래 형식으로 승자를 지목해. (이 형식은 절대 틀리면 안 돼)
  [승자: (여기에 이긴 캐릭터 이름)]
  `;

  try {
    // 4. Groq(Llama 3) 심판에게 판정 의뢰
    const response = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
    });

    const story = response.choices[0].message.content;

    // 5. ⭐️ 기계(서버)가 AI의 답변에서 괄호를 찾아 승자 판별하기
    let winnerId = null;
    if (story.includes(`[승자: ${playerA.player_name}]`)) {
      winnerId = playerA.id;
    } else if (story.includes(`[승자: ${playerB.player_name}]`)) {
      winnerId = playerB.id;
    }

    // 6. ⭐️ 판정이 끝났으니 창고(DB)에 접속해서 점수 올려주기
    if (winnerId) {
      console.log(`승자 확인됨! 창고 전적 업데이트 시작...`);
      
      // Player A 점수표 갱신 (참여 횟수 + 1, 만약 승자라면 승리 횟수 + 1)
      await supabase.from('characters').update({
        matches: (playerA.matches || 0) + 1,
        wins: winnerId === playerA.id ? (playerA.wins || 0) + 1 : (playerA.wins || 0)
      }).eq('id', playerA.id);

      // Player B 점수표 갱신
      await supabase.from('characters').update({
        matches: (playerB.matches || 0) + 1,
        wins: winnerId === playerB.id ? (playerB.wins || 0) + 1 : (playerB.wins || 0)
      }).eq('id', playerB.id);
    }

    // 7. 웹페이지에 결과 보내주기
    res.json({
      playerA: playerA.player_name,
      playerB: playerB.player_name,
      story: story
    });

  } catch (err) {
    console.error('AI 통신 에러:', err);
    res.status(500).send('AI 심판이 판정을 내리지 못했습니다.');
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
