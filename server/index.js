import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ⚠️ dotenv를 API 라우트 import보다 먼저 로딩해야 합니다
dotenv.config({ path: join(__dirname, '..', '.env') });

import apiRoutes from './routes/api.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api', apiRoutes);

// 프로덕션: Vite 빌드 결과물 서빙 + SPA 라우팅 폴백
const distPath = join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 상권분석 API 서버 실행 중: http://localhost:${PORT}`);
});
