SHELL := /bin/bash

.PHONY: help install build build-check build-dev lint test stylelint docker-build docker-up docker-web docker-ard docker-web-ard docker-down docker-logs wiktapi-logs stanza-logs ard-proxy-logs web-start web-stop package

NPM ?= npm
NODE_OPTIONS ?= --max-old-space-size=4096
WEBPACK_PARALLELISM ?= 1
ARCHIVE ?= jellyfin-web-linux-build.tar.gz

help:
	@printf '%s\n' \
		'make install       - install npm dependencies' \
		'make build         - production webpack build' \
		'make build-dev     - development webpack build' \
		'make build-check   - TypeScript noEmit check' \
		'make lint          - run eslint' \
		'make test          - run vitest once' \
		'make stylelint     - run stylelint' \
		'make package       - archive dist into $(ARCHIVE)' \
		'make docker-build  - rebuild jellyfin-web docker image' \
		'make docker-up     - start backend + web + wiktapi via docker compose' \
		'make docker-web    - rebuild and restart only jellyfin-web container' \
		'make docker-ard    - rebuild and restart only ard-proxy container' \
		'make docker-web-ard - rebuild and restart jellyfin-web and ard-proxy' \
		'make docker-down   - stop docker compose services' \
		'make docker-logs   - tail jellyfin-web logs' \
		'make wiktapi-logs  - tail self-hosted wiktapi logs' \
		'make stanza-logs   - tail stanza morphology logs' \
		'make ard-proxy-logs - tail ARD proxy logs' \
		'make web-start     - start local custom web client helper' \
		'make web-stop      - stop local custom web client helper'

install:
	$(NPM) ci

build:
	env SKIP_TS_CHECK=1 NODE_OPTIONS="$(NODE_OPTIONS)" \
	npx webpack --config webpack.prod.js --mode production --parallelism $(WEBPACK_PARALLELISM)

build-dev:
	$(NPM) run build:development

build-check:
	$(NPM) run build:check

lint:
	$(NPM) run lint -- .

test:
	$(NPM) test

stylelint:
	$(NPM) run stylelint

package: build
	tar -C . -czf $(ARCHIVE) dist

docker-build:
	docker compose build jellyfin-web

docker-up:
	docker compose up --build -d

docker-web:
	docker compose up --build -d jellyfin-web

docker-ard:
	docker compose up --build -d ard-proxy

docker-web-ard:
	docker compose up --build -d jellyfin-web ard-proxy

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f jellyfin-web

wiktapi-logs:
	docker compose logs -f wiktapi

stanza-logs:
	docker compose logs -f stanza-morph

ard-proxy-logs:
	docker compose logs -f ard-proxy

web-start:
	./tools/linux/start-jellyfin-with-custom-webdir.sh

web-stop:
	./tools/linux/stop-web-client.sh
