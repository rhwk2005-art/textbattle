require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { Groq } = require('groq-sdk');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// 🔍 접속 로그 (CCTV)
app.use((req, res, next) => {
  console.log(`[CCTV] 유저가 ${req.url} 페이지에 접근했습니다.`);
  next();
});

// 🔐 DB 및 AI 권한 설정
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// 🔗 새로 만든 부서장(라우터) 호출 및 권한 부여
const characterRoutes = require('./routes/characters')(supabase);
const battleRoutes = require('./routes/battle')(supabase, groq);

// 🚀 부서별 담당 구역(URL) 배정
app.use('/', characterRoutes);               // 용사 관련 요청은 characters.js로 전달
app.use('/api/battle', battleRoutes);        // /api/battle로 시작하는 요청은 battle.js로 전달

// 아이콘 404 에러 무시
app.get('/favicon.ico', (req, res) => res.status(204).end());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`서버가 ${PORT}번 포트에서 전장을 감시 중...`));