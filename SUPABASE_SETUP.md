# NEWSPI Supabase 설정

NEWSPI는 Supabase가 설정되면 익명 인증 사용자별 PostgreSQL 상태를 사용합니다. URL 또는 publishable key가 빠진 개발 환경에서는 기존 `localStorage` 기반 **Local Demo Mode**로 실행됩니다. DB 연결이 일시적으로 실패해도 로컬 게임 상태로 자동 전환하지 않습니다.

## 1. 프로젝트와 익명 인증

1. [Supabase Dashboard](https://supabase.com/dashboard)에서 프로젝트를 만듭니다.
2. **Authentication → Providers → Anonymous Sign-Ins**를 켭니다.
3. **Connect** 또는 **Project Settings → API Keys**에서 Project URL과 publishable key를 확인합니다. 구형 프로젝트의 anon key도 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 값으로 사용할 수 있습니다.
4. `.env.example`을 `.env.local`로 복사하고 다음 두 값을 입력합니다. URL과 publishable key는 공개용 값입니다. service role key는 사용하지 않습니다.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

5. Supabase SQL Editor에서 [`supabase/migrations/20260918000000_newspi_game_state.sql`](supabase/migrations/20260918000000_newspi_game_state.sql)을 실행합니다. Supabase CLI가 프로젝트에 연결되어 있다면 `supabase db push`로 적용할 수도 있습니다. 기존 원격 데이터를 초기화하거나 삭제하는 명령은 사용하지 마세요.
6. 이어서 [`supabase/migrations/20260919000000_newspi_long_short.sql`](supabase/migrations/20260919000000_newspi_long_short.sql)을 SQL Editor에서 실행합니다. CLI가 연결돼 있다면 두 파일을 순서대로 `supabase db push`로 적용할 수 있습니다.
7. `npm install`로 Supabase SSR 패키지를 설치하고 lockfile을 갱신한 뒤 개발 서버를 다시 시작합니다.

마이그레이션은 `market_assets`의 7개 이슈와 뒤주 문장 데이터를 추가하고 사용자 테이블, RLS, 원자적 게임 액션 RPC를 만듭니다. 기존 프로젝트가 연결돼 있지 않다면 파일만 준비된 상태입니다.

롱·숏 마이그레이션은 `long_short_bets`와 사용자별 조회 정책을 추가합니다. `GET /api/long-short`는 진행 중 베팅을 복구하고 만료된 베팅을 정산하며, `POST /api/long-short`는 서버 가격과 시간으로 새 베팅을 엽니다. SQL을 적용한 뒤 개발 서버를 재시작하고 거래소에서 확인하세요. Supabase가 없는 Local Demo Mode에서는 롱·숏 배틀을 사용할 수 없습니다.

## 2. 저장 구조와 보안 확인

`profiles.game_state`가 게임 상태의 기준입니다. 같은 DB 트랜잭션에서 `user_market_states`, `positions`, `news_history`, `article_progress`, `daily_missions`, `daily_relief_progress`에 조회용 데이터가 반영되고 `trades`에 거래 기록이 추가됩니다. `roulette_spins`는 비용 차감과 환불의 중복을 막습니다.

모든 사용자 테이블에는 RLS가 켜져 있고 자신의 `auth.uid()`와 일치하는 행만 읽을 수 있습니다. 클라이언트의 직접 쓰기 권한은 없으며 기존 게임 액션은 `newspi_game_dispatch`를 거쳐 사용자 행을 잠급니다. 롱·숏 베팅은 `newspi_long_short_action`이 같은 잠금을 사용해 시작과 정산을 한 번만 처리합니다. `market_assets`와 `happy_phrases`는 읽기 전용 공통 데이터입니다.

SQL Editor에서 RLS를 확인할 수 있습니다.

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles','user_market_states','positions','trades',
    'news_history','article_progress','roulette_spins','daily_missions','daily_relief_progress',
    'long_short_bets');
```

모든 `rowsecurity` 값이 `true`여야 합니다. 다른 익명 사용자의 행에 접근하는 테스트에는 서로 다른 브라우저 프로필의 세션을 사용하세요.

## 3. 기존 브라우저 데이터 1회 이전

익명 세션을 만든 뒤 DB의 `profiles.local_migration_completed_at`을 확인합니다. 아직 이전되지 않았다면 기존 키 `newspi:user:v1` 또는 `newspi:user`를 읽고 값과 길이를 검증한 뒤 `/api/game`의 `migrate` 액션으로 보냅니다. DB 액션은 한 트랜잭션으로 상태와 각 테이블을 저장하고 이전 완료 시각을 기록합니다. 성공 응답이 오면 두 게임 데이터 키를 삭제합니다. 이전 실패 시 키를 그대로 두고 로딩 오류와 재시도 버튼을 표시합니다. DB에 이미 진행 기록이 있으면 브라우저 데이터로 덮어쓰지 않고 로컬 키를 보관합니다.

브라우저 개발자 도구의 **Application → Local Storage**에서 이전 키가 사라졌는지 확인하세요. Supabase **Table Editor → profiles**에서 자신의 익명 사용자 행과 `local_migration_completed_at`을 확인할 수 있습니다. `positions`, `trades`, `news_history`에서도 데이터가 기록됩니다. 테마·음향·애니메이션·마지막 탭 같은 UI 설정 키는 현재 앱에서 사용하지 않으므로 게임 데이터 외에 삭제할 키가 없습니다.

기존 브라우저 상태에는 거래별 내역이 없어서 이전 거래를 `trades` 행으로 복원할 수는 없습니다. 이전 보유 수량과 평균 매수가는 `positions`로 옮기며, 거래 기록은 DB 전환 후 거래부터 쌓입니다.

## 4. 브라우저 수동 확인

1. 새 브라우저 프로필에서 접속해 100 C와 7개 초기 가격을 확인합니다.
2. 룰렛을 한 번 돌려 10 C 차감과 뉴스 기록 저장을 확인합니다.
3. 퀴즈 보상, 매수·매도, 포트폴리오를 확인하고 새로고침합니다. 같은 익명 사용자와 값이 유지되어야 합니다.
4. 같은 퀴즈·해킹 이벤트·미션 보상 버튼을 다시 눌러 중복 지급이 없는지 확인합니다.
5. 두 탭을 열고 1분 가격 변동을 확인합니다. 새로고침이나 탭 복귀 시 DB의 최신 가격을 받아야 합니다.
6. 코인이 10 C 미만일 때 뒤주 사용량과 다음 날 초기화를 확인합니다.
7. 데이터 초기화 후 현재 익명 사용자의 상태만 100 C로 돌아가는지 확인합니다. 다른 브라우저 프로필의 데이터는 유지되어야 합니다.

익명 인증은 별도 로그인 화면이 없지만 쿠키와 브라우저 데이터를 모두 지우거나 다른 기기를 쓰면 기존 익명 계정에 다시 접근할 수 없습니다. 이 MVP에는 계정 연결이나 복구 기능이 없습니다.
