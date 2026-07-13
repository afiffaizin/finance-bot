# ══════════════════════════════════════════════════════
# BotKeuangan — Makefile
# ══════════════════════════════════════════════════════
# Usage: make [command]
# ══════════════════════════════════════════════════════

.PHONY: help build up down restart status logs logs-backend logs-wa logs-dashboard logs-nginx migrate backup restore clean ssl update shell-backend shell-db

# Default
help: ## Tampilkan daftar perintah
	@echo ""
	@echo "╔═══════════════════════════════════════════╗"
	@echo "║     BotKeuangan — Perintah Tersedia       ║"
	@echo "╚═══════════════════════════════════════════╝"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ── Deployment ──────────────────────────────────────
build: ## Build semua Docker images
	docker compose build

up: ## Start semua service (background)
	docker compose up -d --build --remove-orphans

down: ## Stop semua service
	docker compose down

restart: ## Restart semua service
	docker compose restart

update: ## Rebuild & restart (deploy update)
	docker compose up -d --build --remove-orphans

deploy: ## Full deploy (pertama kali)
	chmod +x deploy.sh && ./deploy.sh

# ── Monitoring ──────────────────────────────────────
status: ## Cek status semua container
	docker compose ps

logs: ## Lihat log semua service (follow)
	docker compose logs -f --tail=100

logs-backend: ## Lihat log backend
	docker compose logs -f --tail=100 backend

logs-wa: ## Lihat log wa-listener (scan QR)
	docker compose logs -f --tail=100 wa-listener

logs-dashboard: ## Lihat log dashboard
	docker compose logs -f --tail=100 dashboard

logs-nginx: ## Lihat log nginx
	docker compose logs -f --tail=100 nginx

logs-db: ## Lihat log PostgreSQL
	docker compose logs -f --tail=100 postgres

health: ## Cek health semua service
	@echo "── PostgreSQL ──"
	@docker compose exec -T postgres pg_isready -U finance_user 2>/dev/null && echo "✅ Healthy" || echo "❌ Unhealthy"
	@echo ""
	@echo "── Backend ──"
	@docker compose exec -T backend curl -sf http://localhost:3002/health 2>/dev/null && echo "" && echo "✅ Healthy" || echo "❌ Unhealthy"
	@echo ""
	@echo "── WA Listener ──"
	@docker compose exec -T wa-listener curl -sf http://localhost:3001/health 2>/dev/null && echo "" && echo "✅ Healthy" || echo "❌ Unhealthy"

# ── Database ────────────────────────────────────────
migrate: ## Jalankan migrasi database
	docker compose exec backend node src/migrate.js

seed: ## Load data dummy (testing)
	docker compose exec -T postgres psql -U finance_user finance_db < database/migrations/002_seed.sql

backup: ## Backup database
	chmod +x backup.sh && ./backup.sh

restore: ## Restore database dari backup
	chmod +x deploy.sh && ./deploy.sh --restore

# ── Shell Access ────────────────────────────────────
shell-backend: ## Masuk shell backend container
	docker compose exec backend sh

shell-db: ## Masuk PostgreSQL shell
	docker compose exec postgres psql -U finance_user finance_db

shell-wa: ## Masuk shell wa-listener container
	docker compose exec wa-listener sh

# ── SSL ─────────────────────────────────────────────
ssl: ## Setup SSL certificate
	chmod +x deploy.sh && ./deploy.sh --ssl

ssl-renew: ## Renew SSL certificate
	docker compose --profile ssl run --rm certbot renew && docker compose exec nginx nginx -s reload

# ── Cleanup ─────────────────────────────────────────
clean: ## Stop & hapus semua container + images (data AMAN)
	docker compose down --rmi local --remove-orphans

clean-all: ## ⚠️  Stop & hapus SEMUA termasuk volumes (DATA HILANG!)
	@echo "⚠️  PERHATIAN: Ini akan menghapus semua data termasuk database!"
	@read -p "Lanjutkan? (y/N): " confirm && [ "$$confirm" = "y" ] && docker compose down -v --rmi local --remove-orphans || echo "Dibatalkan."

prune: ## Hapus unused Docker resources (images, volumes, networks)
	docker system prune -f
	docker volume prune -f
