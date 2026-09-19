# NEWSPI (뉴스피)

> 뉴스를 뽑고, 읽고, 투자하라. 읽으면 벌고, 알면 오른다.

NEWSPI는 뉴스를 읽고 객관식 퀴즈로 가상 코인을 얻은 뒤, 관련 **가상 이슈 지수**를 매매하는 게임형 뉴스 MVP입니다. Supabase가 설정되면 로그인 화면 없는 익명 인증과 PostgreSQL에 사용자별 게임 데이터를 저장합니다. 미설정 개발 환경은 Local Demo Mode로 실행됩니다.

## 시작하기

Node.js 22 이상과 npm이 필요합니다.

```bash
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다. API 키 없이도 12개의 명확히 표시된 데모 시나리오로 모든 게임 흐름을 체험할 수 있습니다. DB를 사용하려면 [SUPABASE_SETUP.md](SUPABASE_SETUP.md)의 설정과 SQL 적용을 먼저 완료하세요.

배포용 확인:

```bash
npm run lint
npm test
npm run build
npm run start
```

## 환경변수

`.env.local`에 다음 값을 선택적으로 설정합니다. 이 파일은 Git에서 제외됩니다. 네이버·FactChat 비밀키에는 `NEXT_PUBLIC_` 접두사를 붙이지 마세요. Supabase URL과 publishable key는 공개용 값입니다.

| 변수 | 용도 |
| --- | --- |
| `NAVER_CLIENT_ID` | NAVER Cloud NAVER API HUB Client ID |
| `NAVER_CLIENT_SECRET` | NAVER Cloud NAVER API HUB Client Secret |
| `FACTCHAT_API_KEY` | FactChat API Gateway 키 |
| `FACTCHAT_BASE_URL` | FactChat Gateway 주소. 미설정 시 `https://factchat.mindlogic-kr-api.com/v1/gateway` |
| `FACTCHAT_MODEL` | 분석 모델. `.env.example`의 예시는 `claude-sonnet-5` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL. 없으면 Local Demo Mode |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key. 구형 anon key도 사용 가능 |

NAVER Cloud 콘솔의 NAVER API HUB에서 뉴스 검색 권한이 있는 애플리케이션을 등록하고 발급받은 키를 사용합니다. NEWSPI는 [NAVER API HUB 뉴스 검색 API](https://api.ncloud-docs.com/docs/naver-api-hub-search-news)의 JSON 엔드포인트를 서버에서 호출하며 `display=30`, `start=1`, `sort=date`, `format=json`을 사용합니다. AI 분석은 서버에서 [FactChat API Gateway](https://docs.factchat.kr/docs/korea-seoul/api-gateway/getting-started/overview)를 OpenAI SDK의 Chat Completions로 호출하고 JSON Schema 구조화 출력을 요청합니다.

## 기능과 데모 순서

1. 홈에서 초기 잔액 **20 C**를 확인합니다.
2. **룰렛 돌리기**를 누르면 **5 C**가 차감되고 7개 뉴스 분야 중 하나의 카드를 뽑습니다. 뉴스 요청 자체가 실패하면 5 C를 돌려줍니다.
3. `LIVE` 또는 `DEMO` 배지, 출처, 3줄 요약, 왜 중요한가, 원문 또는 주제 참고 링크를 확인합니다. 분석 가능한 기사 중 약 20%는 게임 내 **AI 분석 시스템 해킹 이벤트**가 나와, 이슈·방향을 예측하고 10/20/30 C를 베팅한 뒤 분석을 복구합니다. 일반 뉴스가 4회 연속 나오면 다음 분석 가능한 기사에는 이벤트가 발생합니다.
4. 실시간 뉴스는 원문 본문을 읽어 퀴즈를 만듭니다. **퀴즈 시작** 후 정답을 고릅니다. 첫 정답 100 C, 첫 오답 뒤 두 번째 정답 50 C입니다. 같은 기사에 대한 보상은 한 번만 지급됩니다.
5. **관련 이슈 거래소 보기**에서 정수 수량을 입력해 매수합니다. 잔액과 보유 수량을 초과한 거래는 거절됩니다.
6. 상단과 거래소의 카운트다운을 확인합니다. **1분마다 7개 가상 이슈 가격이 ±3% 이내로 자동 변동**하고 보유 자산 평가액도 바뀝니다. 기사 분석에서 호재나 악재가 확인되면 관련 이슈 하나가 0.5~5% 이내로 움직입니다. 해킹 이벤트 기사는 예측을 확정하고 분석이 공개될 때 움직입니다. 중립 기사는 가격을 바꾸지 않습니다.
7. **내 포트폴리오**에서 총자산, 평균 매수가, 현재가, 보유 이슈의 평가손익과 투자 수익률을 확인합니다.
8. 새로고침해도 상태가 유지됩니다. 상단의 **데이터 초기화**로 다시 시작할 수 있습니다.
9. **뉴스 기록**에서 최근 100개 기사와 퀴즈·예측 결과, 손익, 요약을 다시 확인합니다. 기록 화면에서는 보상을 다시 받을 수 없습니다.
10. **오늘의 미션**에서 뉴스 3개 읽기, 퀴즈 2개 연속 정답, 해킹 예측 1회 완료를 진행합니다. 각 보상 20 C와 전체 완료 추가 보상 20 C는 직접 버튼을 눌러 하루 한 번씩 수령합니다.
11. 코인이 10 C 미만이면 **행복한 뒤주**에서 응원 문장을 정확히 따라 적고 **문장당 1 C**, 하루 최대 10 C를 받을 수 있습니다. 10 C가 되면 닫히고 다음 날 제한이 초기화됩니다.
12. Supabase 연결 시 **이슈 거래소 → 롱·숏 배틀**에서 7개 이슈 중 하나의 60초 뒤 방향을 예측할 수 있습니다. 10/25/50 C 또는 MAX를 베팅하며 승리 시 베팅금의 1.8배를 정수로 내림해 지급합니다. 무승부는 원금을 돌려주고, 진행 중 베팅은 취소할 수 없습니다.
13. **코인 상점**에서 300~1,500 C 칭호와 600~2,500 C 디자인 테마를 구매하고 장착합니다. 구매 내역과 장착 상태는 게임 데이터에 저장됩니다.

## 실패와 예외 처리

- 네이버 키가 없거나 인증·한도·네트워크·응답 형식에 문제가 있거나 최근 기사 후보가 없으면, 요청한 분야의 **DEMO 카드**로 자동 전환합니다. 데모 카드는 실제 기사로 오해하지 않도록 제목과 배지에 표시되며, 링크는 원문이 아닌 주제 참고 사이트입니다.
- 실시간 뉴스는 서버에서 원문 링크를 읽고 Mozilla Readability로 본문을 추출합니다. 원문을 읽을 수 없으면 네이버 뉴스 링크를 한 번 더 시도합니다. 유효한 본문을 확보하지 못하거나 FactChat 키·호출·형식 검증에 문제가 있으면 **제목과 네이버 description을 그대로** 보여주고 퀴즈를 비활성화합니다. 데모 카드는 미리 작성한 요약과 퀴즈를 사용합니다.
- AI가 입력 정보만으로 사실 확인 가능한 퀴즈를 만들 수 없다고 판단하면 `insufficient` 상태를 표시하고 해당 퀴즈를 비활성화합니다.
- 해킹 이벤트는 정상 분석이 가능한 기사에서만 결정됩니다. 기사별 판정, 베팅·정산, 가격 영향은 저장 계층에서 한 번만 반영됩니다. 이슈와 방향을 모두 맞히면 베팅금의 2배를 반환하고, 방향만 맞히면 원금만 반환합니다. 방향이 다르면 베팅금을 잃습니다. 10 C 미만이면 베팅 없이 복구할 수 있으며 이 경우 미션은 진행되지 않습니다.
- 호재·악재 판단은 AI가 제시한 근거 문구가 기사 본문에 실제로 있는 경우에만 적용합니다. 근거가 없거나 AI 분석에 실패하면 중립으로 처리하고 기사로 인한 가격 변동은 없습니다. 데모 카드에는 미리 작성한 판정을 사용합니다. 같은 기사는 다시 뽑아도 가격에 중복 반영되지 않습니다.
- 추출한 본문 전체를 서버에서만 AI 입력으로 사용하며, 화면이나 게임 DB에 본문을 저장하지 않습니다. 정답과 근거 문구가 추출 본문에 있는지도 검사합니다. 이전 버전의 제목·설명 기반 AI 퀴즈 캐시는 새 퀴즈에 재사용하지 않습니다.
- 기존 `localStorage` 게임 데이터는 검증 후 Supabase로 한 번 이전하고 성공 시 게임 키를 지웁니다. 실패하면 보관하고 재시도할 수 있습니다. Supabase가 없는 Local Demo Mode에서는 기존 저장 방식이 유지됩니다. 새 기록에는 기사 전문을 저장하지 않습니다.
- 이전 버전의 진행 기록은 유지합니다. 새 사용자와 데이터 초기화 이후에는 기본 잔액 20 C가 적용됩니다. 기존 진행 기록을 완전히 새로 시작하려면 상단의 **데이터 초기화**를 사용합니다.
- 이전에 푼 퀴즈의 중복 보상 방지 기록과 과거 보상 총액은 이전합니다. 과거 기사 제목·출처가 저장돼 있지 않았다면 뉴스 기록 목록은 새로 읽은 기사부터 채워집니다.

## 구현 위치

| 경로 | 역할 |
| --- | --- |
| `src/app/api/news/route.ts` | 뉴스 선택, 실시간 실패 시 데모 전환 |
| `src/app/api/analyze/route.ts` | AI 분석, 데모 분석, AI 실패 처리 |
| `src/lib/naver-news.ts` | 검색어 매핑, HTML 정제, 중복·오래된 기사 제거 |
| `src/lib/article-body.ts` | 서버에서 공개 기사 원문을 읽고 본문 추출 |
| `src/lib/analyze-news.ts` | 입력 검증, JSON Schema 분석, 응답 검증 |
| `src/data/fallback-news.json` | 7개 분야의 12개 데모 카드와 퀴즈·시장 판정 |
| `src/data/happy-phrases.ts`, `src/components/HappyDwi.tsx` | 행복한 뒤주 문장과 1 C 보상 화면 |
| `src/data/market-issues.ts`, `src/lib/market.ts` | 가상 이슈와 1분 가격 변동·기사 영향 계산 |
| `src/lib/game.ts` | 해킹 판정·베팅 정산·미션·코인 보상 순수 함수 |
| `src/hooks/useUserState.ts`, `src/hooks/useDbUserState.ts`, `src/lib/storage.ts` | Local Demo Mode 또는 DB 기반 상태 액션 |
| `src/app/api/game/route.ts`, `src/lib/supabase/`, `supabase/migrations/` | 인증된 게임 API, SSR 세션, DB 트랜잭션·RLS |
| `src/components/HackPanel.tsx`, `src/components/NewsHistory.tsx`, `src/components/DailyMissions.tsx` | 예측 이벤트, 뉴스 기록, 미션 화면 |
| `src/components/Shop.tsx`, `src/data/shop-items.ts` | 칭호·디자인 상점과 상품 설정 |
| `tests/core.test.mjs` | 가격·베팅·보상·저장 이전 회귀 테스트 |
| `src/components/` | 룰렛, 뉴스 카드, 퀴즈, 거래소, 포트폴리오 UI |

## MVP 범위와 제한

- 거래 대상은 실제 기업 주식이 아닌 **7개 가상 이슈 지수**입니다. 시작 가격은 12~1,480 C로 구성되며, 1분 변동은 이슈별 -3~+3%, 기사 영향은 0.5~5%로 제한합니다. 최소 가격은 10 C입니다. 실제 시장 시세가 아닙니다.
- Supabase 모드에서는 다음 변동 시각과 가격을 DB에 저장합니다. 여러 탭의 동시 요청은 사용자 행 잠금으로 한 번만 반영됩니다. 탭 복귀나 새로고침 시 최신 DB 상태를 불러옵니다. Local Demo Mode에서는 이전처럼 `localStorage`를 사용합니다.
- 전체 투자 수익률은 **현재 보유 이슈의 미실현 평가손익 ÷ 보유 원가**입니다. 매도 완료분의 실현손익 통계와 멀티 기기 동기화는 제공하지 않습니다.
- 실시간 뉴스 검색은 네이버 결과를 무작위로 선택하므로 키가 있어도 분야별 최신 기사 후보가 없는 경우 데모로 전환될 수 있습니다.
- 일부 언론사는 자동 접근을 차단하거나 본문을 JavaScript로만 표시합니다. 이런 기사는 원문 링크는 열 수 있어도 원문 기반 퀴즈를 제공하지 못합니다.
- 로그인·회원가입 화면, 멀티플레이, 실제 투자, 관리자 기능은 범위에 포함되지 않습니다. 익명 세션을 잃으면 기존 계정에 다시 접근할 수 없습니다.

모든 코인과 가격은 게임용 가상 데이터이며 실제 금융상품이나 투자 조언이 아닙니다.
