.PHONY: help install build build-check build-dev lint test stylelint docker-build docker-up docker-web docker-down docker-logs web-start web-stop package

NPM ?= npm
NODE_OPTIONS ?= --max-old-space-size=4096
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
		'make docker-up     - start backend + web via docker compose' \
		'make docker-web    - rebuild and restart only jellyfin-web container' \
		'make docker-down   - stop docker compose services' \
		'make docker-logs   - tail jellyfin-web logs' \
		'make web-start     - start local custom web client helper' \
		'make web-stop      - stop local custom web client helper'

install:
	$(NPM) ci

build:
	NODE_OPTIONS="$(NODE_OPTIONS)" $(NPM) run build:production

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

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f jellyfin-web

web-start:
	./tools/linux/start-jellyfin-with-custom-webdir.sh

web-stop:
	./tools/linux/stop-web-client.sh
