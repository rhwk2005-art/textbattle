const supabaseUrl = 'https://cjtshlrvuhhjmrlksohi.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdHNobHJ2dWhoam1ybGtzb2hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MTc3MzEsImV4cCI6MjA4ODA5MzczMX0.ANiPuMSvCW7C8ybJNXU1BhpG1tO18VKGYbxXUrfWVKM'; 
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// 🟢 [신규 추가] 탭 상태를 기억하는 변수와 탭 전환 함수
let currentTab = 'global'; 

function switchTab(tabName) {
    currentTab = tabName;
    const globalBtn = document.getElementById('tabGlobal');
    const mineBtn = document.getElementById('tabMine');
    
    // 탭 버튼 색상 및 밑줄 애니메이션 처리
    if (tabName === 'global') {
        globalBtn.style.color = '#ec4899'; globalBtn.style.borderBottomColor = '#ec4899';
        mineBtn.style.color = '#94a3b8'; mineBtn.style.borderBottomColor = 'transparent';
    } else {
        mineBtn.style.color = '#ec4899'; mineBtn.style.borderBottomColor = '#ec4899';
        globalBtn.style.color = '#94a3b8'; globalBtn.style.borderBottomColor = 'transparent';
    }
    loadCharacters(); // 탭을 누를 때마다 화면 데이터를 새로 그려줍니다.
}

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

    const enhanceText = enhanceLevel > 0 ? `<span style="color: #ff9f43; font-weight: bold;">[+${enhanceLevel}]</span> ` : '';
    return badge + enhanceText;
}

// 🟢 [핵심 수정 구간] 캐릭터 불러오기 함수 전면 개편
async function loadCharacters() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const myId = session ? session.user.id : null;
    const response = await fetch('/api/characters');
    let allCharacters = await response.json();

    // 1. 명예의 전당: 이제 탭이 뭐든 상관없이 무조건 '전체 서버 순위'로 보여줍니다.
    const top3 = [...allCharacters].sort((a,b) => (b.win_streak || 0) - (a.win_streak || 0)).slice(0,3);
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

    // 2. 탭 분기 처리: 전체 인구 vs 나의 군단
    if (currentTab === 'global') {
        // [전체 인구 탭] 세로 리스트 정렬 적용
        listDiv.style.display = 'flex';
        listDiv.style.flexDirection = 'column';
        listDiv.style.gap = '10px';

        allCharacters.forEach(char => {
            const streak = char.win_streak || 0;
            const enhanceLv = char.enhance_level || 0;
            
            // 칭호, 이름, 전적만 나오는 심플한 디자인
            listDiv.innerHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(30, 41, 59, 0.7); padding: 15px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="font-size: 16px; display: flex; align-items: center; gap: 8px;">
                        ${getTitleBadge(streak, enhanceLv)} <strong style="color: #f8fafc;">${char.player_name}</strong>
                    </div>
                    <div style="color: #94a3b8; font-size: 14px; background: rgba(0,0,0,0.3); padding: 6px 12px; border-radius: 8px;">
                        ⚔️ ${char.matches || 0}전 ${char.wins || 0}승
                    </div>
                </div>
            `;
        });
    } else {
        // [나의 군단 탭] 나의 캐릭터만 필터링 후 기존 그리드 카드 형태 유지
        const myCharacters = allCharacters.filter(char => char.owner_id === myId);
        
        listDiv.style.display = 'grid';
        listDiv.style.gridTemplateColumns = 'repeat(auto-fill, minmax(240px, 1fr))';
        listDiv.style.gap = '20px';
        listDiv.style.alignItems = 'stretch';

        if (myCharacters.length === 0) {
            listDiv.innerHTML = '<p style="color:#94a3b8; grid-column: 1/-1; text-align:center; padding: 20px;">아직 보유한 전사가 없습니다. 새로운 전사를 소환하세요!</p>';
        }

        myCharacters.forEach(char => {
            const gp = char.growth_points || 0;
            const streak = char.win_streak || 0;
            const enhanceLv = char.enhance_level || 0;
            const cardClass = (streak >= 50 ) ? 'char-card legend-card' : 'char-card';
            
            const enhanceCost = 5 + (enhanceLv * 2);
            const canEnhance = gp >= enhanceCost;

            // 내 캐릭터이므로 조작 버튼이 나옵니다.
            const buttons = `
                <div style="margin-top: auto; display: flex; flex-direction: column; gap: 8px;">
                    <button onclick="startChallenge(${char.id})" style="background:linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 10px; font-size:14px; width: 100%; border-radius: 8px; font-weight: bold; color: white;">⚔️ 출격하기</button>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="enhanceCharacter(${char.id})" style="flex: 2; color: white; border: none; background:${canEnhance ? '#10b981' : '#4b5563'}; font-size:12px; padding: 8px; cursor:${canEnhance ? 'pointer' : 'not-allowed'}; border-radius: 8px; margin: 0;" ${canEnhance ? '' : 'disabled'}>
                            🔨 강화 (${enhanceCost}EP)
                        </button>
                        <button onclick="deleteCharacter(${char.id})" style="flex: 1; border: none; color: white; background: #ef4444; font-size:12px; padding: 8px; border-radius: 8px; margin: 0; cursor:pointer;">🗑️ 은퇴</button>
                    </div>
                </div>
            `;

            listDiv.innerHTML += `
                <div class="${cardClass}" style="display: flex; flex-direction: column; height: 100%; padding: 15px; box-sizing: border-box;">
                    <div style="flex-grow: 1;">
                        <img src="${char.image_url}" onerror="this.src='https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${char.player_name}'; this.onerror=null;" style="width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 12px; margin-bottom: 12px; background: #111;">
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

                        <div title="${char.ability}" style="font-size:12px; color:#94a3b8; margin:10px 0 15px 0; padding:8px; background:rgba(0,0,0,0.15); border-radius:8px; text-align: left; line-height: 1.5; border: 1px solid rgba(255,255,255,0.05); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; min-height: 54px;">
                            <strong>능력:</strong> ${char.ability}
                        </div>
                    </div>
                    ${buttons}
                </div>
            `;
        });
    }
}

// 이 아래의 함수들은 수정 없이 그대로 유지됩니다.
async function enhanceCharacter(id) {
    if (!confirm("포인트를 소모하여 스탯을 강화하시겠습니까?")) return;
    try {
        const response = await fetch(`/api/characters/${id}/enhance`, { method: 'POST' });
        const result = await response.json();
        if (response.ok) {
            alert(result.message); 
            loadCharacters(); 
        } else {
            alert(result.error);
        }
    } catch (err) {
        alert("강화 서버에 연결할 수 없습니다.");
    }
}

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

    const response = await fetch(`/api/battle/random?ownerId=${myId}`);
    const result = await response.json();
    
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
    
    const storyHtml = result.story || "전투 기록을 불러올 수 없습니다.";
    box.innerHTML = storyHtml.replace(/\n/g, '<br>');
    
    setTimeout(() => {
        loadCharacters();
    }, 3000);
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