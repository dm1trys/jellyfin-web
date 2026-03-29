<h1 align="center">Jellyfin Web</h1>
<h3 align="center">Part of the <a href="https://jellyfin.org">Jellyfin Project</a></h3>

---

<p align="center">
<img alt="Logo Banner" src="https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/SVG/banner-logo-solid.svg?sanitize=true"/>
<br/>
<br/>
<a href="https://github.com/jellyfin/jellyfin-web">
<img alt="GPL 2.0 License" src="https://img.shields.io/github/license/jellyfin/jellyfin-web.svg"/>
</a>
<a href="https://github.com/jellyfin/jellyfin-web/releases">
<img alt="Current Release" src="https://img.shields.io/github/release/jellyfin/jellyfin-web.svg"/>
</a>
<a href="https://translate.jellyfin.org/projects/jellyfin/jellyfin-web/?utm_source=widget">
<img src="https://translate.jellyfin.org/widgets/jellyfin/-/jellyfin-web/svg-badge.svg" alt="Translation Status"/>
</a>
<br/>
<a href="https://opencollective.com/jellyfin">
<img alt="Donate" src="https://img.shields.io/opencollective/all/jellyfin.svg?label=backers"/>
</a>
<a href="https://features.jellyfin.org">
<img alt="Feature Requests" src="https://img.shields.io/badge/fider-vote%20on%20features-success.svg"/>
</a>
<a href="https://matrix.to/#/+jellyfin:matrix.org">
<img alt="Chat on Matrix" src="https://img.shields.io/matrix/jellyfin:matrix.org.svg?logo=matrix"/>
</a>
<a href="https://www.reddit.com/r/jellyfin">
<img alt="Join our Subreddit" src="https://img.shields.io/badge/reddit-r%2Fjellyfin-%23FF5700.svg"/>
</a>
</p>

Jellyfin Web is the frontend used for most of the clients available for end users, such as desktop browsers, Android, and iOS. We welcome all contributions and pull requests! If you have a larger feature in mind please open an issue so we can discuss the implementation before you start. Translations can be improved very easily from our <a href="https://translate.jellyfin.org/projects/jellyfin/jellyfin-web">Weblate</a> instance. Look through the following graphic to see if your native language could use some work!

<a href="https://translate.jellyfin.org/engage/jellyfin/?utm_source=widget">
<img src="https://translate.jellyfin.org/widgets/jellyfin/-/jellyfin-web/multi-auto.svg" alt="Detailed Translation Status"/>
</a>

## Build Process

### Dependencies

- [Node.js](https://nodejs.org/en/download)
- npm (included in Node.js)

### Getting Started

1. Clone or download this repository.

   ```sh
   git clone https://github.com/jellyfin/jellyfin-web.git
   cd jellyfin-web
   ```

2. Install build dependencies in the project directory.

   ```sh
   npm install
   ```

3. Run the web client with webpack for local development.

   ```sh
   npm start
   ```

4. Build the client with sourcemaps available.

   ```sh
   npm run build:development
   ```

Review the [Contributing Guide](./CONTRIBUTING.md) for more information on our process and tech stack.

## Fork Workflow

This fork includes a custom pause-translate experience for subtitle learning.

- Main feature code lives in `src/apps/stable/features/playback/pauseTranslate/`
- Legacy compatibility import remains in `src/apps/stable/features/playback/utils/pauseTranslateSubscriber.ts`
- Local Windows helper to start the standard Jellyfin backend and the custom built web client lives in `tools/windows/start-jellyfin-with-custom-webdir.ps1`

## Windows Quick Start

### Requirements

- Node.js installed
- Jellyfin Server installed on Windows
- Jellyfin Windows service available as `JellyfinServer`

### Build the custom web client

From the repository root:

```sh
npm run build:production
```

### Start Jellyfin + custom web client

Run:

```powershell
.\tools\windows\start-jellyfin-with-custom-webdir.ps1
```

This starts or reuses:

- standard Jellyfin backend on `http://127.0.0.1:8096`
- custom web client with pause-translate on `http://127.0.0.1:8097`

Open this URL in the browser:

```text
http://127.0.0.1:8097
```

Do not use `8096` if you want the custom subtitle translation UI. `8096` is the normal Jellyfin backend. `8097` is the custom web client from this fork.

### Typical usage

1. Open `http://127.0.0.1:8097`
2. Sign in to your Jellyfin server
3. Start a video with subtitles
4. Pause playback
5. The overlay shows:
phrase translation, clickable words, and a word inspector with lemma, part of speech, translation variants, and German grammar tags.

### Language settings

Inside Jellyfin Web:

1. Go to `Settings`
2. Open `Subtitles`
3. Set:
`Pause Translate Source Language` and `Pause Translate Target Language`.

For German learning, set source language to `de`.

### If it does not work

- Check that Jellyfin backend is listening on `8096`
- Check that the custom web client is listening on `8097`
- Rebuild after code changes:

```sh
npm run build:production
```

- Then start again:

```powershell
.\tools\windows\start-jellyfin-with-custom-webdir.ps1
```

- Web client logs:
`.runtime-web/stdout.log` and `.runtime-web/stderr.log`
