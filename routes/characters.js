const express = require('express');
const router = express.Router();

// server.js에서 supabase 권한을 넘겨받아 사용합니다.
module.exports = (supabase) => {
    
// 1. 캐릭터 생성 및 아바타 부여
    router.post('/battle', async (req, res) => {
        const { playerName, ability, ownerId } = req.body;
        
        // 🟢 [완벽 수정] 느리고 불안정한 AI 대신, 이름(Seed)에 따라 고유한 판타지 전사 얼굴을 즉시 만들어주는 안정적인 주소로 교체합니다.
        const imageUrl = `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(playerName)}`;

        const { error } = await supabase.from('characters').insert([{
            player_name: playerName, ability: ability, owner_id: ownerId,
            image_url: imageUrl, growth_points: 0, win_streak: 0, wins: 0, matches: 0
        }]);

        if (error) return res.status(500).send(error.message);
        res.redirect(`/success.html?name=${encodeURIComponent(playerName)}`);
    });
    
    // 2. 캐릭터 목록 조회 API
    router.get('/api/characters', async (req, res) => {
        const { data } = await supabase.from('characters').select('*').order('win_streak', { ascending: false });
        res.json(data);
    });

    // 3. 캐릭터 은퇴(삭제) API
    router.delete('/api/characters/:id', async (req, res) => {
        const characterId = req.params.id;
        try {
            const { error } = await supabase.from('characters').delete().eq('id', characterId);
            if (error) throw error;
            res.json({ message: "성공적으로 은퇴 처리되었습니다." });
        } catch (err) {
            res.status(500).json({ error: "삭제 실패" });
        }
    });

    return router;
};