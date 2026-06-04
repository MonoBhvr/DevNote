# DevNote

DevNote is a MarkNote based GitHub Pages blog template.

## 바로 쓰기

이 저장소는 루트에 바로 배포 가능한 정적 앱을 포함한다. fork한 뒤 GitHub Pages workflow를 실행하면 npm install/build 없이 저장소 루트가 그대로 배포된다.

공개 블로그는 브라우저 JavaScript가 `content/manifest.json`과 `content/**`를 읽어서 화면을 만든다. 그래서 글을 추가하거나 수정할 때마다 HTML을 다시 빌드할 필요가 없다.

템플릿 기본 콘텐츠를 처음부터 다시 복사하거나 스타일/런타임 코드를 바꾼 뒤 루트 앱 파일을 갱신할 때만 아래 명령을 실행한다.

```bash
npm install
npm run build
```

로컬에서 디자인이 적용된 화면을 볼 때는 다음 명령을 사용한다.

```bash
npm run preview
```

색상은 `src/styles/colors.css`에서 바꾸고, 레이아웃은 `src/styles/global.css`에서 바꾼다.

## 글쓰기

정적 사이트라서 서버 secret을 둘 수 없다. `/write/index.html`은 GitHub fine-grained token을 런타임에 입력받아 GitHub API로 현재 사용자를 확인하고, `content/user.json`의 `allowedAuthors`에 있는 사용자에게만 UI 저장을 허용한다.

필요한 토큰 권한:

- 대상 저장소만 선택
- `Contents: Read and write`
- 만료일 설정 권장

토큰은 소스나 workflow 어디에도 저장하지 않는다. 브라우저에 입력한 토큰은 현재 페이지 런타임에서만 사용된다.

작성 화면에서 가능한 작업:

- 포스트 메타데이터와 `content.mnote` 저장
- 이미지 업로드
- `assets.json` 업데이트
- 업로드한 이미지 문법을 본문에 삽입

`/write/`에서 저장하면 repository의 `content/...` 파일과 `content/manifest.json`이 갱신된다. GitHub Pages가 새 commit을 반영하면 앱이 갱신된 JSON과 `.mnote`를 fetch해서 바로 새 글을 보여준다.

`allowedAuthors`는 UI 표시용 게이트이고, 실제 쓰기 권한은 GitHub 저장소 권한과 토큰 권한이 최종적으로 검증한다.
