import { askGemini } from './geminiService.js';

/**
 * 중개인 마케팅 콘텐츠(브랜딩 리포트)를 생성하는 오피(Opie) 전용 서비스입니다.
 */
export async function generateMarketingReport(district, agencyName, brokerName, phone) {
    const month = new Date().getMonth() + 1;
    
    // 모의 지역별 상권 특성 (다이나믹한 텍스트 생성을 위한 시드 데이터)
    const districtHotspots = {
        '강남구': { hot: '압구정 로데오, 신사동 가로수길', cool: '역삼역 이면도로', keyword: '하이엔드 F&B, 팝업스토어', price: '권리금 평균 15% 상승' },
        '서초구': { hot: '교대역 골목상권, 양재천 까페거리', cool: '강남역 9번 출구 이면', keyword: '스페셜티 커피, 프리미엄 다이닝', price: '보합세 조짐' },
        '송파구': { hot: '송리단길 확징구역, 잠실새내', cool: '문정동 법조타운 외곽', keyword: '디저트 성지, 캐주얼 다이닝', price: '신축 상가 프리미엄 상승' },
        '성동구': { hot: '성수역 연무장길, 뚝섬역 북측', cool: '왕십리역 뒷골목', keyword: 'MZ 타겟 어패럴, 베이커리', price: '역대 최고가 갱신 중' },
        '마포구': { hot: '연남동 미로길, 합정역 당인리', cool: '홍대 걷고싶은거리 일부', keyword: '무인 사진관 포화, 와인바 강세', price: '권리금 회복세 전환' },
        '용산구': { hot: '용리단길, 한남동 대사관로', cool: '이태원 앤틱가구거리', keyword: '에스프레소 바, 이국적 펍', price: '매물 품귀 현상 지속' }
    };

    const targetData = districtHotspots[district] || { hot: '주요 메인 스트리트', cool: '외곽 이면도로', keyword: '다목적 프랜차이즈, F&B', price: '보합세 안정권' };

    const systemPrompt = `
당신은 '오피(Opie)'라는 이름의 부동산 콘텐츠 마케팅 디렉터입니다.
목적: 부동산 중개인(${brokerName} 공인중개사, ${agencyName})의 브랜드 인지도를 높이고 고객을 유치하는 것.

요청 사항:
${district} 지역의 ${month}월 상권 동향 리포트를 작성해야 합니다.

[작성 가이드라인 - Tone & Manner]
- 전문성과 깊이를 보여주면서도, 모바일 기기나 SNS(인스타그램, 네이버 블로그)에서 읽기 쉽도록 친친절하고 신뢰감 있는 어투를 사용합니다. (존댓말 사용)
- 이모티콘을 적재적소에 배치하여 시각적 피로도를 줄여주세요.
- 너무 딱딱한 논문체가 아닌, "현장에서 발로 뛰는 전문가의 생생한 리포트" 느낌을 줘야 합니다.
- 마크다운(Markdown) 문법을 적극 활용해 제목, 리스트, 인용구 등으로 예쁘게 구조화하세요.

[리포트 뼈대 구조 및 제공 정보]
아래 정보를 기반으로 구체적이고 현실적인 데이터를 상상하여 채워넣어 작성하세요. (수치는 현장감 있게 가공)

▶ 제목: [${district}] ${month}월 상권 동향 프라이빗 리포트 📊 - by ${agencyName} ${brokerName} 대표
▶ 도입부: ${month}월의 계절적 특성과 결부한 인사이트 (2~3문장)
▶ 1. 이달의 핫스팟 & 쿨다운 지점
   - 뜨는 곳: ${targetData.hot} (유동인구 분석 포함)
   - 조심할 곳: ${targetData.cool}
▶ 2. 신규 진입 프랜차이즈 트렌드
   - 현재 '${targetData.keyword}' 업종이 강세라는 점을 언급하며, 최근 한 달간 문의가 급증한 업종 TOP 3 분석.
▶ 3. 상가 실거래가 & 권리금 트렌드
   - '${targetData.price}' 트렌드를 바탕으로 예비 창업자/투자자들에게 주는 현실적인 조언.
▶ 4. 다음 달 상권 기상도 (AI 전망)
   - 전략적 제언 1~2가지
▶ 5. 하단 CTA(Call To Action) 영역
   - 아래의 정보를 인용구(>) 블럭 안에 넣어서 강조해주세요.
   - 🏢 상가/건물 매물 접수 및 상권 분석 상담
   - 💼 **${agencyName} | ${brokerName} 공인중개사**
   - 📞 **${phone}**

위 조건에 맞추어 전문성 높고 시선을 사로잡는 약 1000자 분량의 SNS/블로그용 텍스트 결과물(마크다운 형태)을 즉시 작성하세요. (별도의 인사말 없이 리포트 본문만 깔끔하게 출력)
`;

    try {
        const markdown = await askGemini(systemPrompt);
        return markdown;
    } catch (error) {
        console.error('Gemini API Error in OpieService:', error);
        throw new Error('마케팅 리포트 생성에 실패했습니다. AI 연동 상태를 확인하세요.');
    }
}
