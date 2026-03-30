# AGENTS.md

This repository is a custom `jellyfin-web` fork with additional runtime services and playback behavior. Treat it as an application fork, not a clean upstream workspace.

## Scope

- Main app: `jellyfin-web`
- Custom runtime server: [`serve-dist.js`](/home/dmitrys/work/jellyfin-web/serve-dist.js)
- Pause translator stack:
  - [`src/apps/stable/features/playback/pauseTranslate/`](/home/dmitrys/work/jellyfin-web/src/apps/stable/features/playback/pauseTranslate)
  - [`serve-dist.js`](/home/dmitrys/work/jellyfin-web/serve-dist.js)
- Auxiliary services:
  - ARD proxy: [`services/ard-proxy/`](/home/dmitrys/work/jellyfin-web/services/ard-proxy)
  - Stanza morphology: [`services/stanza-morph/`](/home/dmitrys/work/jellyfin-web/services/stanza-morph)
  - Self-hosted WiktApi: [`Dockerfile.wiktapi`](/home/dmitrys/work/jellyfin-web/Dockerfile.wiktapi), [`patches/`](/home/dmitrys/work/jellyfin-web/patches)

## Working Rules

- Do not run `make build` unless the user explicitly asks for it.
- Do not rebuild Docker images or restart the stack unless the user explicitly asks for it.
- Prefer runtime verification against the already-running stack before asking for a rebuild.
- Use `apply_patch` for manual file edits.
- Prefer `rg` for search.

## Playback Constraints

- Do not modify [`src/plugins/htmlVideoPlayer/plugin.js`](/home/dmitrys/work/jellyfin-web/src/plugins/htmlVideoPlayer/plugin.js) unless there is no viable alternative.
- Prefer changes in:
  - [`src/components/playback/playbackmanager.js`](/home/dmitrys/work/jellyfin-web/src/components/playback/playbackmanager.js)
  - pause-translate feature files
  - service/proxy layers
- Preserve pause-translator compatibility whenever touching playback or subtitles.

## ARD Integration

- ARD data should come from the current ARD JSON APIs, not HTML scraping.
- Normalize ARD responses in [`services/ard-proxy/server.js`](/home/dmitrys/work/jellyfin-web/services/ard-proxy/server.js) and keep the frontend consuming stable internal shapes from:
  - `/api/ard/home`
  - `/api/ard/search`
  - `/api/ard/item/:id`
  - `/api/ard/recommendations/:id`
  - `/api/ard/play/:id`
- Prefer same-origin frontend calls through [`serve-dist.js`](/home/dmitrys/work/jellyfin-web/serve-dist.js) rather than direct browser calls to the proxy service.

## Subtitle and Translation Expectations

- Pause translator is expected to work with:
  - standard text tracks
  - embedded ASS/libass cases where supported by existing code
  - externally attached `webvtt` tracks for non-Jellyfin sources such as ARD
- For word inspection:
  - Stanza provides morphology
  - WiktApi provides dictionary entries
  - low-quality fallback translations are intentionally avoided

## Verification

- Preferred browser validation tool: Playwright in headed mode.
- When testing UI/runtime behavior, verify against the live app on `http://127.0.0.1:8097` unless the user specifies otherwise.
- Check the loaded frontend commit in browser console before assuming new UI code is deployed.
- If the UI looks stale, verify whether the issue is:
  - old `dist`
  - old container image
  - service worker/browser cache

## Local Artifacts

The following may exist locally and should not be treated as source changes to clean up unless requested:

- [`media/`](/home/dmitrys/work/jellyfin-web/media)
- [`wiktapi-data/`](/home/dmitrys/work/jellyfin-web/wiktapi-data)
- [`jellyfin-web-linux-build.tar.gz`](/home/dmitrys/work/jellyfin-web/jellyfin-web-linux-build.tar.gz)
- debug captures like `*-network.txt` and `*-console.txt`

## Deployment Assumptions

- Web client is commonly served through [`serve-dist.js`](/home/dmitrys/work/jellyfin-web/serve-dist.js)
- Docker stack is managed through [`docker-compose.yml`](/home/dmitrys/work/jellyfin-web/docker-compose.yml)
- The running web app is often exposed on `http://127.0.0.1:8097`
- Jellyfin backend is typically on `http://localhost:8096`
