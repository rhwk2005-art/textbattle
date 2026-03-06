const express = require('express');
const router = express.Router();

const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

module.exports = (supabase) => {
    
    // 1. 캐릭터 생성 API
    router.post('/battle', async (req, res) => {
        const { playerName, ability, ownerId } = req.body;
        
        // 🟢 [핵심 신규 추가] 1. Groq AI에게 한글을 영어 이미지 프롬프트로 번역하라고 지시합니다.
        let englishPrompt = `${playerName}, ${ability}`; // 기본값 (혹시 번역 에러가 날 경우 대비)
        
        try {
            const translatePrompt = `당신은 AI 이미지 프롬프트 번역가입니다. 
            다음 한국어 캐릭터 이름과 능력을 Stable Diffusion이 완벽하게 이해할 수 있는 웅장하고 디테일한 영어 명사/키워드 위주로 번역하세요. 
            이름: ${playerName} / 능력: ${ability}
            출력 규칙: 번역된 영어 문장만 정확히 출력하고, 다른 부연 설명은 절대 하지 마세요.`;

            const chat = await groq.chat.completions.create({
                messages: [{ role: 'user', content: translatePrompt }],
                model: 'llama-3.1-8b-instant',
                temperature: 0.3 // 번역의 정확도를 위해 온도를 낮춤
            });
            
            englishPrompt = chat.choices[0].message.content.trim();
            console.log("통역 완료! 영어 프롬프트:", englishPrompt); // 터미널에서 확인용
        } catch (e) {
            console.log("Groq 번역 실패, 원본 한글 사용:", e.message);
        }

        // 🟢 2. 번역된 영어(englishPrompt)를 그림 AI에게 전달합니다.
        const prompt = `A highly detailed fantasy portrait of a warrior named ${englishPrompt}, digital painting, epic lighting, masterpiece`;
        
        let finalImageUrl = ''; 

        try {
            // (이 아래부터는 기존에 작성하신 Hugging Face fetch 코드와 DB insert 코드가 그대로 들어갑니다!)
            const response = await fetch(
                "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0",
            {
                headers: { 
                    "Authorization": `Bearer ${process.env.HF_API_TOKEN}`,
                    "Content-Type": "application/json"
                },
                method: "POST",
                body: JSON.stringify({ inputs: prompt }),
            }
        );

            // 🟢 3. 무료 서버가 자고 있거나 과부하일 때의 방어막
            if (!response.ok) {
                console.error("HF API 에러:", await response.text());
                throw new Error("그림 생성 실패 (서버 로딩 중)");
            }

            // 🟢 4. 성공적으로 받은 그림 파일을 Base64(텍스트)로 변환
            const buffer = await response.arrayBuffer();
            finalImageUrl = `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`;

        } catch (err) {
            // 🟢 5. 실패 시 엑스박스가 뜨지 않도록 멋진 로봇 아바타로 임시 대체 (안전장치)
            console.log("SD 이미지 생성 실패, 로봇 아바타로 대체합니다.");
            finalImageUrl = `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(playerName)}`;
        }
        
        // 힘, 민첩, 지력 1~10 무작위 생성
        const str = Math.floor(Math.random() * 10) + 1;
        const agi = Math.floor(Math.random() * 10) + 1;
        const intel = Math.floor(Math.random() * 10) + 1;

        // DB에 저장 (image_url 칸에 finalImageUrl 변수를 넣음)
        const { error } = await supabase.from('characters').insert([{
            player_name: playerName, ability: ability, owner_id: ownerId,
            image_url: finalImageUrl, growth_points: 0, win_streak: 0, wins: 0, matches: 0,
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