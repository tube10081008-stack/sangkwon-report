import 'dotenv/config';
import { handleCoraChat } from './server/services/coraAgent.js';

const QUESTIONS = [
  // ── 트렌드 연동 테스트 (체감 온도 확인) ──
  `서울 성동구 연무장5길 19 상권 분석해주세요. 지금 이 시점에서 투자 가치가 있는지 알고 싶어요.`,

  // ── 비교 분석 + 트렌드 ──
  `을지로3가랑 익선동 비교해주세요. 어디가 더 미래가 밝아요?`,

  // ── 실전 임대차 ──
  `3층 건물 매입 후 1층은 직영 카페, 2-3층은 임대하려는데, 월세를 얼마로 책정해야 할지 기준이 뭔가요?`,

  // ── 상권 쇠퇴 진단 ──
  `제가 중개하는 구역에서 최근 6개월 새 빈 가게가 5개나 생겼어요. 이게 일시적인 건지 구조적 쇠퇴인지 어떻게 구분하나요?`,

  // ── 역세권 vs 비역세권 ──
  `역세권이 무조건 좋다고들 하는데, 교수님 입장에서 역세권의 함정 같은 건 없나요?`,

  // ── 업종 변환 시 주의점 ──
  `기존에 세탁소였던 자리를 카페로 바꾸려는 임차인이 왔는데, 업종 전환 시 상권 관점에서 주의할 점이 있을까요?`,

  // ── MZ세대 상권 ──
  `MZ세대가 이끄는 상권이랑 40-50대 중심 상권은 수명이 다른 건가요? 어떤 상권이 더 안정적이에요?`,

  // ── 대형 개발 호재 ──
  `근처에 GTX 역이 들어온다는 뉴스가 있어요. 이런 개발 호재가 상권에 미치는 실제 영향이 어떤가요? 항상 좋기만 한 건가요?`,

  // ── 공유 오피스 영향 ──
  `상가 건물에 공유 오피스가 2개나 들어왔어요. 이게 주변 상권에 좋은 영향일까요 나쁜 영향일까요?`,

  // ── 종합 전략 ──
  `교수님, 2026년 하반기에 서울에서 소규모 상가 투자를 한다면, 어떤 기준으로 지역을 고르시겠어요? 핵심 체크리스트 3가지만 알려주세요.`
];

async function runInterview() {
  const results = [];
  
  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`📋 Q${i+1}/10: ${q.substring(0, 60)}...`);
    console.log(`${'═'.repeat(70)}`);
    
    try {
      const result = await handleCoraChat(
        [{ role: 'user', content: q }],
        (chunk) => {}
      );
      
      results.push({ question: q, answer: result.text, success: true });
      console.log(`✅ ${result.text.length}자`);
    } catch (e) {
      results.push({ question: q, answer: e.message, success: false });
      console.log(`❌ ${e.message}`);
    }
    
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // 전체 결과 출력
  console.log(`\n\n${'█'.repeat(70)}`);
  console.log(`█  코라 V2.1 인터뷰 결과 (${results.filter(r=>r.success).length}/10)`);
  console.log(`${'█'.repeat(70)}\n`);
  
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`❓ Q${i+1}: ${r.question}`);
    console.log(`${'─'.repeat(70)}`);
    console.log(`💬 A${i+1} (${r.answer.length}자):`);
    console.log(r.answer);
  }
  
  // 메타 분석
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📊 메타 분석`);
  console.log(`${'═'.repeat(70)}`);
  const lengths = results.filter(r=>r.success).map(r=>r.answer.length);
  console.log(`평균 답변 길이: ${Math.round(lengths.reduce((a,b)=>a+b,0)/lengths.length)}자`);
  console.log(`인사말 포함 답변 수: ${results.filter(r=>r.answer.includes('안녕하세요! 저는 **코라**')).length}/10`);
  console.log(`수치 포함 답변 수: ${results.filter(r=>/\d+[점%개]/.test(r.answer)).length}/10`);
  console.log(`후속질문 포함 답변 수: ${results.filter(r=>r.answer.includes('?') && r.answer.lastIndexOf('?') > r.answer.length - 200).length}/10`);
  console.log(`트렌드 언급 답변 수: ${results.filter(r=>/(체감|트렌드|검색|관심도|모멘텀)/.test(r.answer)).length}/10`);
  console.log(`프레임워크 인용 수: ${results.filter(r=>/(젠트리피케이션|생명주기|포터|5 Forces|Cap Rate|임대차보호법|집적|창조적 파괴|체감 온도)/.test(r.answer)).length}/10`);
}

runInterview().catch(console.error);
