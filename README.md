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

정적 사이트라서 서버 secret을 둘 수 없다. `/login/index.html`은 GitHub fine-grained token을 런타임에 입력받아 GitHub API로 현재 사용자를 확인하고, `content/user.json`의 `allowedAuthors`에 있는 사용자에게만 UI 저장을 허용한다. 로그인에 성공하면 `/write/index.html`로 이동한다.

필요한 토큰 권한:

- 대상 저장소만 선택
- `Contents: Read and write`
- 만료일 설정 권장

토큰은 소스나 workflow 어디에도 저장하지 않는다. 로그인에 성공하면 다음 방문 때 자동 로그인을 위해 현재 브라우저의 `localStorage`에 `devnote-authoring-token:{owner/repo}` 키로 저장한다. 이 값은 해당 브라우저에서 실행되는 스크립트가 읽을 수 있으므로, 대상 저장소만 선택한 fine-grained token과 만료일을 사용한다.

`/write/index.html`은 글쓰기 전용 화면이다. 토큰 입력칸은 없고, 브라우저에 저장된 관리자 토큰을 확인한 뒤 에디터를 보여준다. 토큰이 없거나 만료되면 관리자 로그인 링크만 표시한다.

작성 화면에서 가능한 작업:

- 포스트 메타데이터와 `content.mnote` 저장
- 이름 기반 이미지 업로드
- `assets.json`에 이미지 이름과 파일 경로 업데이트
- `[image[이름]]` 문법을 본문에 삽입

이미지 업로드에서 입력한 이름은 소문자 하이픈 형식으로 정규화되어 `content/projects/{project}/assets/images/{name}.{extension}`에 저장된다. alt나 설명은 업로드 UI에 따로 저장하지 않고, 본문에서 `[image[name | caption]]`처럼 MarkNote 문법으로 작성한다.

`/write/`에서 저장하면 repository의 `content/...` 파일과 `content/manifest.json`이 갱신된다. GitHub Pages가 새 commit을 반영하면 앱이 갱신된 JSON과 `.mnote`를 fetch해서 바로 새 글을 보여준다.

`allowedAuthors`는 UI 표시용 게이트이고, 실제 쓰기 권한은 GitHub 저장소 권한과 토큰 권한이 최종적으로 검증한다.

## 댓글

댓글은 Giscus를 사용한다. 글쓰기 로그인 방식은 그대로 fine-grained token 입력 방식이고, 댓글 로그인은 Giscus가 GitHub Discussions를 통해 별도로 처리한다.

사용하려면 GitHub 저장소에서 Discussions를 켜고, Giscus 앱을 설치한 뒤 `config/site.json`의 `giscus` 값을 채운다.

```json
{
  "giscus": {
    "enabled": true,
    "repo": "OWNER/REPO",
    "repoId": "Giscus에서 받은 repo id",
    "category": "General",
    "categoryId": "Giscus에서 받은 category id"
  }
}
```

`repoId`와 `categoryId`는 <https://giscus.app>에서 저장소와 Discussion category를 선택하면 생성된다. 설정 후 `npm run build`를 실행하면 포스트 하단에 댓글 영역이 붙는다.
