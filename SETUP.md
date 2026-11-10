# TimeWorkBox 환경 세팅 가이드

Daily Time Box(Next.js App Router)를 Daily + Weekly + Monthly로 확장하기 위한 사전 세팅입니다.
순서대로 진행하세요: **1. Git/GitHub → 2. Supabase → 3. Vercel → 4. 완료 체크**

현재 PC 상태 (2026-11-10 확인)

| 항목 | 상태 |
|---|---|
| Node.js / npm | v20.20.2 / 10.8.2 — 설치됨 |
| Git | 2.55.0 — 설치됨, `user.name = dh.shin` |
| 로컬 저장소 | `D:\001Project\TimeWorkBox`, 브랜치 `main`, 커밋 없음 |
| origin | `https://github.com/Mzxzllxz/TimeWorkBox.git` — 연결됨 |
| Vercel / Supabase CLI | 미설치 — 설치 불필요, `npx`로 실행 |

---

## 1. Git / GitHub

### 1-1. GitHub 저장소 확인
1. https://github.com/Mzxzllxz/TimeWorkBox 가 열리는지 확인합니다.
2. 없으면 https://github.com/new 에서 생성합니다.
   - Repository name: `TimeWorkBox`
   - **README, .gitignore, license는 추가하지 않습니다** (빈 저장소여야 첫 push가 충돌 없이 됩니다).
   - Private / Public은 자유. Vercel 무료 플랜은 개인 계정의 Private 저장소도 배포됩니다.

### 1-2. 커밋 이메일 설정
PowerShell에서 실행합니다.

```powershell
git config --global user.email
```

아무것도 안 나오면 GitHub 계정 이메일로 설정합니다.

```powershell
git config --global user.email "GitHub에-등록된-이메일"
```

> 이메일이 GitHub 계정과 다르면 Vercel이 커밋 작성자를 인식하지 못해 배포가 막힐 수 있습니다.

### 1-3. GitHub 인증 확인
```powershell
cd D:\001Project\TimeWorkBox
git ls-remote origin
```

- 브라우저 로그인 창이 뜨면 로그인합니다 (Git Credential Manager가 저장합니다).
- 에러 없이 끝나면(빈 저장소라 출력은 없음) 성공입니다.
- `Repository not found`가 나오면 1-1의 저장소 주소 또는 로그인 계정을 확인하세요.

첫 push는 다음 단계에서 코드와 함께 진행합니다.

---

## 2. Supabase

### 2-1. 프로젝트 생성
1. https://supabase.com/dashboard → **New project**
2. 입력값
   - Name: `timeworkbox`
   - Database Password: **Generate a password** 후 비밀번호 관리자에 저장 (다시 볼 수 없습니다)
   - Region: **Northeast Asia (Seoul)** `ap-northeast-2`
   - Plan: Free
3. 생성 완료까지 1~2분 기다립니다.

> Free 플랜은 7일간 요청이 없으면 프로젝트가 일시정지됩니다. 대시보드에서 Restore 하면 복구됩니다.

### 2-2. 키 확인
프로젝트 상단의 **Connect** 버튼(또는 Project Settings → API Keys)에서 아래 두 값을 복사합니다.

| 값 | 형태 | 용도 |
|---|---|---|
| Project URL | `https://<project-ref>.supabase.co` | 클라이언트 접속 주소 |
| Publishable key | `sb_publishable_...` (구 프로젝트는 `anon` 키 `eyJ...`) | 브라우저용 공개 키 |

`<project-ref>` (URL 앞부분의 영문 20자)도 따로 적어둡니다.

> **`secret` / `service_role` 키는 복사하지 마세요.** 이 프로젝트에서는 쓰지 않으며, 채팅이나 저장소에 절대 넣으면 안 됩니다.

### 2-3. 로컬 환경변수 파일
`D:\001Project\TimeWorkBox\.env.local` 파일을 만들고 값을 채웁니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
```

`.env.local`은 `.gitignore`에 등록되어 있어 커밋되지 않습니다.

### 2-4. 로그인 방식 (Authentication)
기기 간 동기화를 하려면 로그인이 필요합니다. 기본값인 **이메일 로그인**은 별도 설정 없이 켜져 있습니다.

- Authentication → Sign In / Providers → **Email** 이 Enabled 인지만 확인합니다.
- Google 로그인을 원하면 다음 단계에서 요청하세요 (Google Cloud OAuth 설정이 추가로 필요합니다).

### 2-5. CLI 로그인 (테이블 생성을 자동으로 하기 위함)
```powershell
npx supabase login
```

브라우저에서 승인하면 끝입니다. 테이블과 RLS 정책은 다음 단계에서 마이그레이션 파일로 만들어 적용하므로 SQL Editor에서 직접 만들 필요가 없습니다.

---

## 3. Vercel

### 3-1. 계정과 GitHub 연결
1. https://vercel.com/signup → **Continue with GitHub** 로 가입/로그인합니다 (Hobby 플랜).
2. GitHub 앱 권한 요청이 나오면 `TimeWorkBox` 저장소를 포함시킵니다.
   - 나중에 바꾸려면: GitHub → Settings → Applications → Vercel → Configure → Repository access

### 3-2. CLI 로그인
```powershell
npx vercel login
```

브라우저에서 승인합니다.

### 3-3. 프로젝트 생성은 첫 push 이후에
지금은 저장소가 비어 있어 Import 하면 빌드가 실패합니다. **코드를 처음 push 한 뒤** 아래 중 하나로 진행합니다.

- 방법 A (권장): 3-2의 CLI 로그인만 해두면 다음 단계에서 프로젝트 생성·환경변수 등록·배포까지 대신 진행합니다.
- 방법 B (직접): https://vercel.com/new → `TimeWorkBox` Import
  - Framework Preset: **Next.js** (자동 감지)
  - Environment Variables에 2-3의 두 값을 그대로 등록 (Production / Preview / Development 모두 체크)
  - Deploy

### 3-4. 배포 후 Supabase에 주소 등록
배포 주소(`https://<프로젝트명>.vercel.app`)가 나오면 Supabase → Authentication → URL Configuration 에서

- Site URL: `https://<프로젝트명>.vercel.app`
- Redirect URLs: `http://localhost:3000/**`, `https://<프로젝트명>.vercel.app/**`

이 설정이 없으면 로그인 메일의 링크가 localhost로 열립니다.

---

## 4. 완료 체크리스트

- [ ] GitHub에 `TimeWorkBox` 저장소가 있고 `git ls-remote origin`이 에러 없이 끝난다
- [ ] `git config --global user.email`이 GitHub 이메일을 출력한다
- [ ] Supabase 프로젝트가 생성되었고 DB 비밀번호를 저장했다
- [ ] `.env.local`에 URL과 Publishable key를 넣었다
- [ ] `npx supabase login` 완료
- [ ] Vercel에 GitHub로 가입했고 `npx vercel login` 완료

다 되면 이렇게 알려주세요.

> 세팅 완료. Supabase project-ref는 `xxxxxxxxxxxxxxxxxxxx`.

키 값은 채팅에 붙여넣지 않아도 됩니다. `.env.local`에서 읽습니다.

## 다음 단계에서 진행할 내용 (참고)

1. 기존 Daily Time Box 화면 분석 후 Next.js 프로젝트 구성
2. Supabase 테이블·RLS 마이그레이션 작성 및 적용
3. Daily / Weekly / Monthly 화면 구현
4. 첫 push, Vercel 프로젝트 생성 및 배포
