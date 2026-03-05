const supabaseUrl = 'https://cjtshlrvuhhjmrlksohi.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdHNobHJ2dWhoam1ybGtzb2hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MTc3MzEsImV4cCI6MjA4ODA5MzczMX0.ANiPuMSvCW7C8ybJNXU1BhpG1tO18VKGYbxXUrfWVKM'; 
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('gameSection').style.display = 'block';
        document.getElementById('currentUserEmail').innerText = '접속자: ' + session.user.email;
        loadCharacters();
    } else {
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('gameSection').style.display = 'none';
    }
});

function getTitleBadge(streak, enhanceLevel) {
    let badge = '';
    if (streak >= 50) badge = '<span style="color: #facc15;">👑 전설</span> ';
    else if (streak >= 30) badge = '<span style="color: #c084fc;">⚔️ 파괴왕</span> ';
    else if (streak >= 5) badge = '<span style="color: #60a5fa;">🔥 도전자</span> ';
    else badge = '<span style="color: #4ade80;">🌱 훈련병</span> ';

    // 강화 단계 표시 추가
    const enhanceText = enhanceLevel > 0 ? `<span style="color: #ff9f43; font-weight: bold;">[+${enhanceLevel}]</span> ` : '';
    return badge + enhanceText;
}

async function loadCharacters() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const myId = session ? session.user.id : null;
    const response = await fetch('/api/characters');
    let characters = await response.json();

    const isMyOnly = document.getElementById('myFilter').checked;
    if (isMyOnly && myId) {
        characters = characters.filter(char => char.owner_id === myId);
    }

    const top3 = [...characters].sort((a,b) => (b.win_streak || 0) - (a.win_streak || 0)).slice(0,3);
    const hallOfFame = document.getElementById('hallOfFame');
    hallOfFame.innerHTML = top3.length > 0 && top3[0].win_streak > 0 ? '' : '<p style="color:#666;">아직 기록이 없습니다.</p>';
    top3.forEach((char, i) => {
        if (char.win_streak > 0) {
            hallOfFame.innerHTML += `
                <div style="text-align:center; flex:1; background:rgba(0,0,0,0.2); padding:15px; border-radius:15px; min-width:120px;">
                    <div style="font-size:20px;">${['🥇','🥈','🥉'][i]}</div>
                    <div><strong>${char.player_name}</strong></div>
                    <div style="color:#ec4899; font-weight:bold;">${char.win_streak}연승</div>
                </div>`;
        }
    });

    const listDiv = document.getElementById('characterList');
    listDiv.innerHTML = ''; 

    characters.forEach(char => {
        const gp = char.growth_points || 0;
        const streak = char.win_streak || 0;
        const enhanceLv = char.enhance_level || 0;
        const isOwner = myId === char.owner_id;
        const cardClass = (streak >= 50 ) ? 'char-card legend-card' : 'char-card';
        
        // 🟢 다음 강화에 필요한 EP 계산 공식 적용
        const enhanceCost = 5 + (enhanceLv * 2);
        const canEnhance = gp >= enhanceCost;

        const buttons = isOwner ? `
            <button onclick="startChallenge(${char.id})" style="background:linear-gradient(135deg, #3b82f6, #8b5cf6); margin-top:10px; font-size:14px;">⚔️ 출격하기</button>
            <button onclick="enhanceCharacter(${char.id})" style="background:${canEnhance ? '#10b981' : '#4b5563'}; margin-top:5px; font-size:14px; cursor:${canEnhance ? 'pointer' : 'not-allowed'};" ${canEnhance ? '' : 'disabled'}>
                🔨 강화하기 (${enhanceCost} EP)
            </button>
            <button onclick="deleteCharacter(${char.id})" class="secondary-btn" style="font-size:12px; margin-top:5px;">🗑️ 은퇴 (삭제)</button>
        ` : '';

        // 🟢 스탯 UI 추가
        listDiv.innerHTML += `
            <div class="${cardClass}">
                <img src="${char.image_url || 'https://api.dicebear.com/9.x/adventurer/svg?seed=' + char.player_name}" class="char-img">
                <h3>${getTitleBadge(streak, enhanceLv)}${char.player_name}</h3>
                <div style="background:rgba(0,0,0,0.3); border-radius:8px; padding:5px; margin:10px 0; font-size:13px; color:#facc15;">
                    ⚔️ ${char.matches || 0}전 ${char.wins || 0}승 (연승: ${streak})
                </div>
                
                <div style="display:flex; justify-content:space-around; background:#1e1e2f; padding:8px; border-radius:10px; margin-bottom:10px; font-size:14px; border:1px solid #444;">
                    <span style="color:#ef4444;">💪힘: ${char.str || 1}</span>
                    <span style="color:#3b82f6;">⚡민: ${char.agi || 1}</span>
                    <span style="color:#a855f7;">🧠지: ${char.intel || 1}</span>
                </div>

                <div style="margin:15px 0; background:#222; border-radius:20px; padding:5px; border:1px solid #444;">
                    <div style="font-size:11px; color:#aaa; display:flex; justify-content:space-between; margin-bottom:3px; padding:0 5px;">
                        <span>Lv.${Math.floor(gp / 10)}</span>
                        <span>${gp} EP</span>
                    </div>
                    <div style="background:#111; height:8px; border-radius:4px; overflow:hidden;">
                        <div style="background:linear-gradient(90deg, #4f46e5, #10b981); width:${Math.min(gp, 100)}%; height:100%; transition:width 0.5s;"></div>
                    </div>
                </div>
                <p style="font-size:13px; color:#94a3b8; margin:5px 0;">능력: ${isOwner ? char.ability : '비공개'}</p>
                ${buttons}
            </div>
        `;
    });
}

// 🟢 신규: 강화 API 호출 로직
async function enhanceCharacter(id) {
    if (!confirm("포인트를 소모하여 스탯을 강화하시겠습니까?")) return;
    
    try {
        const response = await fetch(`/api/characters/${id}/enhance`, { method: 'POST' });
        const result = await response.json();
        
        if (response.ok) {
            alert(result.message); // 예: "강화 성공! STR 스탯이 +2 올랐습니다."
            loadCharacters(); // 화면 새로고침
        } else {
            alert(result.error);
        }
    } catch (err) {
        alert("강화 서버에 연결할 수 없습니다.");
    }
}

// 🟢 무작위 난투 API 호출 로직 (내 ID 포함하여 전송)
async function startRandomBattle() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const myId = session ? session.user.id : null;
    
    if (!myId) {
        alert("전장에 참여하려면 로그인이 필요합니다.");
        return;
    }

    const arena = document.getElementById('battleArena');
    arena.style.display = 'block';
    arena.innerHTML = '<h3>⏳ AI 심판이 매칭을 준비 중입니다...</h3>';
    arena.scrollIntoView({ behavior: 'smooth' });

    // 내 ID(ownerId)를 꼬리표로 달아서 서버에 요청합니다.
    const response = await fetch(`/api/battle/random?ownerId=${myId}`);
    const result = await response.json();
    
    // 전사가 없거나 에러가 발생한 경우 알림 표시
    if (result.error) {
        arena.innerHTML = `<h3 style="color: #ef4444;">❌ ${result.error}</h3>`;
        return;
    }
    
    typeWriterEffect(result);
}

async function startChallenge(id) {
    const arena = document.getElementById('battleArena');
    arena.style.display = 'block';
    arena.scrollIntoView({ behavior: 'smooth' });
    arena.innerHTML = '<h3>🚀 도전장을 수락했습니다! 대결을 준비합니다...</h3>';
    const response = await fetch(`/api/battle/challenge/${id}`);
    const result = await response.json();
    typeWriterEffect(result);
}

function typeWriterEffect(result) {
    const arena = document.getElementById('battleArena');
    arena.innerHTML = `<h2 style="color:#ec4899;">⚔️ ${result.playerA} VS ${result.playerB}</h2><div id="typewriter" style="font-size:16px; line-height:1.8; color:#cbd5e1;"></div>`;
    const box = document.getElementById('typewriter');
    let i = 0;
    const story = result.story || "전투 기록을 불러올 수 없습니다.";
    function type() {
        if (i < story.length) {
            box.innerHTML += story.charAt(i) === '\n' ? '<br>' : story.charAt(i);
            i++;
            setTimeout(type, 15);
        } else { loadCharacters(); }
    }
    type();
}

async function handleSignup() {
    const { error } = await supabaseClient.auth.signUp({ email: emailInput.value, password: passwordInput.value });
    authMessage.innerText = error ? '오류: ' + error.message : '이메일 확인 후 로그인해 주세요!';
}
async function handleLogin() {
    const { error } = await supabaseClient.auth.signInWithPassword({ email: emailInput.value, password: passwordInput.value });
    if (error) authMessage.innerText = '로그인 실패: 정보를 확인하세요.';
}
async function handleLogout() { await supabaseClient.auth.signOut(); }
async function deleteCharacter(id) {
    if (confirm("은퇴시키겠습니까?")) {
        await fetch(`/api/characters/${id}`, { method: 'DELETE' });
        loadCharacters();
    }
}