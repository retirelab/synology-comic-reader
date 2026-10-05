# 내 만화책장 v0.1.1

DS218 시놀로지 NAS 안에 보관된 ZIP/CBZ 만화를 휴대폰 브라우저에서 읽는 개인용 앱 초안입니다.

## 동작 방식

NAS의 Web Station + PHP가 ZIP 파일의 목록을 확인하고, 요청받은 이미지 한 장만 ZIP 스트림으로 읽어 전송합니다. 휴대폰에는 ZIP 전체를 받거나 압축을 미리 풀 필요가 없습니다. 화면에 표시할 이미지 데이터는 전송하며 현재 이미지의 Blob을 브라우저 메모리에 보관합니다. 페이지를 바꾸거나 책을 닫으면 이전 Blob을 해제합니다. 미리 읽기와 오프라인 다운로드는 없습니다. NAS 원본을 수정하거나 압축 해제본을 저장하지 않습니다.

GitHub는 코드 보관용입니다. **GitHub Pages만으로 이 PHP 앱을 실행할 수 없습니다.** 실제 앱은 NAS Web Station에서 실행합니다.

## 구현된 기능

- 폴더 이동 및 현재 폴더 안의 책 검색
- ZIP/CBZ 내부 JPG·JPEG·PNG·WebP·GIF 자연 정렬 (`1`, `2`, `10` 순서)
- 이전/다음, 페이지 번호 이동, 키보드 방향키
- 좌→우 / 우→좌 읽기 방향 (방향키에 적용)
- 너비/높이 맞춤, 지원 브라우저 전체화면, 브라우저 기본 확대
- 정상적으로 표시된 페이지를 기준으로 기기별 이어 읽기
- 별도 뷰어 비밀번호 로그인, 로그아웃, 12시간 비활동 세션 만료
- 앱 화면 상단 `v0.1.1` 표시

책 표지는 자동으로 읽지 않으며, 썸네일 대신 파일명 카드로 표시합니다. 두 페이지 펼침, 스와이프 넘기기, 세로 연속 읽기, NAS에 독서 기록 동기화, 설치형 PWA는 후속 기능입니다. RAR/CBR, 암호 ZIP, ZIP 안에 들어 있는 또 다른 ZIP은 지원하지 않습니다. 한 이미지 32MiB, ZIP 내부 항목 20,000개까지 지원합니다. 오래된 ZIP의 한글 파일명 인코딩은 실제 자료로 추가 확인이 필요합니다.

## 휴대폰에서 설정 파일 만들기 (v0.1.1)

1. `public` 안의 파일들을 웹 루트에 복사합니다. 기존 v0.1.0 설치라면 `api.php`, `index.html`을 교체하고 `setup.html`, `setup.js`, `config-generator.js`를 추가합니다.
2. 볼륨 1에 `comic-reader-private` 공유 폴더를 만듭니다. 웹 공개 폴더 밖에 두어야 합니다.
3. HTTPS 앱 주소의 `/setup.html`을 열고 `/volume1/comics`와 별도 뷰어 비밀번호를 입력합니다.
4. `config.php`를 내려받아 `comic-reader-private` 공유 폴더에 넣습니다.
5. 로컬 그룹 `http`에 설정 공유 폴더 읽기 전용 권한을 줍니다. 원본 만화 폴더 `comics`에도 읽기 전용 권한이 필요합니다.
6. 앱 첫 화면에서 생성 시 정한 비밀번호로 로그인합니다.

도우미는 브라우저 Web Crypto의 PBKDF2-SHA256(600,000회, 무작위 salt 16바이트, 파생값 32바이트)을 사용합니다. 비밀번호는 생성 단계에서 네트워크 요청이나 저장소에 기록하지 않습니다. 생성된 파일에는 salt와 해시만 들어갑니다. 로그인 시에는 정상적인 HTTPS 인증 요청으로 비밀번호가 NAS에 전달됩니다. 기존 CLI로 생성한 bcrypt 설정도 계속 지원합니다.

## DS218 설치 준비

DSM 버전에 따라 메뉴 이름은 달라질 수 있습니다. Web Station 및 해당 모델/DSM에서 제공되는 PHP 8.x 패키지가 필요합니다. PHP 프로필의 `zip`, `fileinfo`, `session` 확장을 활성화합니다. 가능하면 현재 지원되는 PHP 버전을 사용합니다.

1. `public` 폴더의 내용만 Web Station의 웹 루트에 놓습니다. 예: `/volume1/web/comic-reader/`.
2. 만화는 기존 위치에 둡니다. 예: `/volume1/comics/`. 만화 폴더를 웹 루트에 놓지 않습니다.
3. 웹 루트 밖에 `/volume1/comic-reader-private/` 폴더를 만들고 `private/config.example.php`를 `config.php`라는 이름으로 복사합니다. Web Station 실행 계정(`http` 또는 실제 PHP 실행 계정)에 설정 파일 읽기 권한을 줍니다.
4. `config.php`의 `root`를 실제 만화 폴더 절대 경로로 바꿉니다. 만화 폴더와 상위 폴더에 웹 실행 계정의 읽기/탐색 권한만 부여합니다. 쓰기 권한은 필요 없습니다.
5. `private/hash-password.php`를 웹 루트 밖에서 PHP CLI로 실행하여 별도 뷰어 비밀번호 해시를 만듭니다. PHP 실행 경로는 설치 패키지에 따라 다릅니다. 예시: `php private/hash-password.php`. 결과 해시를 `password_hash`에 넣습니다. 이 해시 생성 도구는 웹 요청으로 실행되지 않습니다.
6. Web Station PHP 프로필의 `open_basedir` 설정에 웹 루트, 설정 폴더, 만화 폴더 및 PHP 세션 저장 경로를 허용합니다. 세션 저장 폴더는 PHP 실행 계정이 쓸 수 있어야 합니다.
7. Web Station에서 PHP 웹 서비스를 만들고 HTTPS 포털로 연결합니다. HTTPS에서는 `secure_cookie`를 `true`로 유지합니다. 로컬 HTTP 테스트에만 `false`를 사용합니다.
8. 앱 주소를 휴대폰 브라우저에서 열고 뷰어 비밀번호로 로그인합니다. DSM 계정으로 로그인하는 앱은 아닙니다.

집 밖에서 접속하는 주소와 방법은 별도 설정이 필요합니다. 최초 검증은 집 Wi-Fi에서 진행하고, 외부에서는 NAS에 접속 가능한 VPN + HTTPS를 우선 사용합니다. QuickConnect 링크로 이 웹 서비스까지 자동 접속되는 것으로 가정하지 않습니다. 인터넷에 직접 공개하기 위한 로그인 시도 제한, 서버 접근 제어는 이 초안의 범위 밖입니다.

## 개발 및 검증

브라우저 JavaScript에는 외부 의존성이 없습니다. 빌드 과정 없이 `public` 파일을 사용합니다.

```
node --test tests/*.test.js
python3 tests/api_smoke.py
```

두 번째 검사는 로컬 `php` 실행 파일과 `zip`·`fileinfo`·`session` 확장이 필요합니다. 임시 만화와 설정으로 PHP 개발 서버를 실행하여 로그인, 경로 이탈 차단, 이미지 단위 응답, 자연 정렬 및 원본 보존을 확인합니다.

현재 제작 환경에서는 JavaScript 구문 검사와 저장 기능 관련 2개 테스트를 통과했습니다. PHP 런타임이 없어 API 검사는 이 환경에서 실행하지 못했습니다. 실제 DS218 설치·연결·성능 검증은 아직 완료하지 않았습니다.

## 코드 위치

| 파일 | 수정 대상 |
| --- | --- |
| `public/api.php` | 로그인, 폴더 탐색, ZIP 스트리밍 API |
| `public/app.js` | 책장 및 뷰어 화면 동작 |
| `public/storage.js` | 읽기 기록 및 설정 저장 |
| `public/style.css` | 디자인과 모바일 레이아웃 |
| `public/index.html` | 화면 구조 및 표시 버전 |
| `private/config.example.php` | 배포 설정 예시 |
| `tests/api_smoke.py` | NAS API 주요 동작 검증 |

## GitHub 연결

코드 저장소: https://github.com/retirelab/synology-comic-reader

이 저장소에는 만화 원본이나 실제 NAS 설정/비밀번호가 포함되어 있지 않습니다. GitHub Actions에서 JavaScript 검사와 PHP API 검증을 실행합니다. NAS 설치 및 실제 자료 연결은 별도로 진행해야 합니다.

## 확인한 공식 자료

- Web Station 지원 모델/설명: https://www.synology.com/dsm/packages/WebStation
- Web Station PHP 웹 서비스 구성: https://kb.synology.com/en-id/DSM/tutorial/How_to_host_a_website_on_Synology_NAS
- ZIP 항목의 읽기 전용 스트림: https://www.php.net/manual/en/ziparchive.getstream.php
