ARGS ?=
SERVICE ?= aqa-pulse-server

.PHONY: setup deploy update restart down logs ps health

setup:
	npm run setup:docker -- $(ARGS)

deploy:
	npm run deploy:self-hosted -- $(ARGS)

update:
	npm run update:docker -- --build-package $(ARGS)

restart:
	docker compose restart $(SERVICE)

down:
	docker compose down

logs:
	docker compose logs -f $(SERVICE)

ps:
	docker compose ps

health:
	curl -fsS http://127.0.0.1:$${PORT:-3000}/api/health
