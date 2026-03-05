const express = require('express');
const router = express.Router();

module.exports = (supabase) => {
    
    // 1. 캐릭터 생성 (1~10 랜덤 스탯 부여)
    router.post('/battle', async (req, res) => {
        const { playerName, ability, ownerId } = req.body;
        
        const imageUrl = `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(playerName)}`;
        
        // 힘, 민첩, 지력 1~10 무작위 생성
        const str = Math.floor(Math.random() * 10) + 1;
        const agi = Math.floor(Math.random() * 10) + 1;
        const intel = Math.floor(Math.random() * 10) + 1;

        const { error } = await supabase.from('characters').insert([{
            player_name: playerName, ability: ability, owner_id: ownerId,
            image_url: imageUrl, growth_points: 0, win_streak: 0, wins: 0, matches: 0,
            str: str, agi: agi, intel: intel, enhance_level: 0
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
        try {
            await supabase.from('characters').delete().eq('id', req.params.id);
            res.json({ message: "은퇴 완료" });
        } catch (err) {
            res.status(500).json({ error: "삭제 실패" });
        }
    });

    // 🔨 4. 캐릭터 강화 API (신규 추가)
    router.post('/api/characters/:id/enhance', async (req, res) => {
        try {
            const { data: char } = await supabase.from('characters').select('*').eq('id', req.params.id).single();
            if (!char) return res.status(404).json({ error: "캐릭터를 찾을 수 없습니다." });

            // 필요 포인트 계산 (5, 7, 9...)
            const cost = 5 + (char.enhance_level * 2);
            if (char.growth_points < cost) return res.status(400).json({ error: `EP가 부족합니다. (필요: ${cost}EP)` });

            // 상승할 스탯(1~3)과 타겟 결정
            const boost = Math.floor(Math.random() * 3) + 1;
            const stats = ['str', 'agi', 'intel'];
            const targetStat = stats[Math.floor(Math.random() * stats.length)];

            // DB 업데이트 (포인트 차감, 레벨+1, 스탯 상승)
            const { error } = await supabase.from('characters').update({
                growth_points: char.growth_points - cost,
                enhance_level: char.enhance_level + 1,
                [targetStat]: char[targetStat] + boost
            }).eq('id', char.id);

            if (error) throw error;
            res.json({ message: `강화 성공! ${targetStat.toUpperCase()} 스탯이 +${boost} 올랐습니다.`, cost });
        } catch (err) {
            res.status(500).json({ error: "강화 중 오류 발생" });
        }
    });

    return router;
};