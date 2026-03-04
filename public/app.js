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

function getTitleBadge(streak) {
    if (streak >= 50) return '<span style="color: #facc15;">👑 전설</span> ';
    if (streak >= 30) return '<span style="color: #c084fc;">⚔️ 파괴왕</span> ';
    if (streak >= 5) return '<span style="color: #60a5fa;">🔥 도전자</span> ';
    return '<span style="color: #4ade80;">🌱 훈련병</span> ';
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
        const isOwner = myId === char.owner_id;
        const cardClass = (streak >= 50 || gp >= 100) ? 'char-card legend-card' : 'char-card';
        
        const buttons = isOwner ? `
            <button onclick="startChallenge(${char.id})" style="background:linear-gradient(135deg, #3b82f6, #8b5cf6); margin-top:10px; font-size:14px;">⚔️ 출격하기</button>
            <button onclick="deleteCharacter(${char.id})" class="secondary-btn" style="font-size:12px; margin-top:5px;">🗑️ 은퇴 (삭제)</button>
        ` : '';

        listDiv.innerHTML += `
            <div class="${cardClass}">
                <img src="${char.image_url || 'https://image.pollinations.ai/prompt/fantasy-warrior?width=512&height=512'}" class="char-img">
                <h3>${getTitleBadge(streak)}${char.player_name}</h3>
                <div style="background:rgba(0,0,0,0.3); border-radius:8px; padding:5px; margin:10px 0; font-size:13px; color:#facc15;">
                    ⚔️ ${char.matches || 0}전 ${char.wins || 0}승 (연승: ${streak})
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

async function startRandomBattle() {
    const arena = document.getElementById('battleArena');
    arena.style.display = 'block';
    arena.innerHTML = '<h3>⏳ AI 심판이 전장을 조성 중입니다...</h3>';
    arena.scrollIntoView({ behavior: 'smooth' });
    const response = await fetch('/api/battle/random');
    const result = await response.json();
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