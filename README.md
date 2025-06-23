# 🛡️ **Skanii**  v1.0.0 — tiny, wicked-fast malware-scanning pipeline
*Mini-VirusTotal built with Node.js + TypeScript, RabbitMQ, **Redis-first**, and Postgres.*

[![build](https://img.shields.io/github/actions/workflow/status/your-org/skanii/ci.yml?label=CI)](…) 
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE) 
[![docker](https://img.shields.io/badge/docker-ready-green)](docker-compose.yml)

---

## ✨ Why Skanii?
* ⏱ **<2 s p95 latency** for 1 MB files on a laptop  
* 🔒 Namespaced sandbox for each engine  
* 📜 Append-only **event log** (Postgres) for audit & replay  
* 🚀 CQRS-lite skeleton → any future dashboard/ML projection is just a subscriber  
* 🪄 Road-mapped “Magic” features: ⌛ drag-drop instant verdict, GPT explanations, auto-scaling

---

## 📦  Features in v1.0.0

| Layer | Capability | Engines |
|-------|------------|---------|
| Ingress | REST & CLI upload (≤ 100 MB) | — |
| Core   | SHA-256 dedup · Redis hash as hot store · command→event flow | — |
| Workers | **Typrr** (file-type) → **ClamAV** (AV) | Typrr · ClamAV |
| Results | `GET /files/:sha256` JSON view | — |
| Ops | Docker stack · Prometheus metrics · Grafana dashboard | — |
| Security | API-key auth · token-bucket rate-limit (Redis) | — |

Everything else (YARA, Web UI, ML clustering, auto-scale) lives in `ROADMAP.md`.

---

## 🚀 Quick-start (10 min)

```bash
git clone https://github.com/your-org/skanii.git
cd skanii
docker compose up -d        # web, workers, redis, postgres, rabbitmq, grafana
# wait ~3 min for ClamAV sigs
curl -F "file=@/path/eicar.com" -H "X-API-Key: YOUR_KEY" http://localhost:3000/upload
# → {"sha256":"…","status":"queued"}
curl http://localhost:3000/files/SHA256
# → {"sha256":"…","mime":"application/x-dosexec","clamVerdict":"Win.Test.EICAR_HDB-1","status":"finished"}
````

Power-users: `pnpm i && pnpm dev` runs gateway only; workers start with `pnpm worker`.

---

## 🗺️  High-level architecture

```mermaid
graph TD
  subgraph Command Side
    A[REST /upload] -->|UploadFileCmd| B[CmdHandler]
    B -->|HSET file:{sha}=queued| R[(Redis)]
    B -->|INSERT event row| P[(Postgres events)]
    B -->|Publish msg| Q(RabbitMQ.scan)
  end
  subgraph Workers
    Q --> T(Typrr)
    T -->|Redis update + event| R
    Q --> C(ClamAV)
    C -->|Redis update + event| R
  end
  D[GET /files/:sha] -->|QueryHandler| R
```

*Reads are **always** from Redis; every state change is persisted to the immutable `events` table.*

---

## 🏗️  Project structure

```
/apps
  api/           NestJS gateway (REST)
/packages
  core/
    commands/    CQRS command handlers
    events/      Event definitions & publisher
  engines/
    typrr/       Wrapper & Dockerfile
    clamav/      Wrapper & Dockerfile
docker/          Service images & configs
docs/            Architecture diagrams, ADRs
```

---

## 🧪  CI / CD

* **GitHub Actions**: lint → unit tests → Docker build → Clam sig fetch
* **Nightly** job bumps ClamAV signatures via PR
* Build ≤ 5 min, blocks merge on red
* SBOM & image signing slated for v1.1

---

## 🛣️  Roadmap (abridged)

| Version | Focus                            | Candidate “Magic”                  |
| ------- | -------------------------------- | ---------------------------------- |
| v1.1    | YARA engine · Web UI             | Drag-drop ⇢ instant verdict agent  |
| v1.2    | Helm chart · HPA auto-scale      | GPT-powered plain-English verdicts |
| v1.3    | Global SHA cache · ML clustering | Cross-file campaign grouping       |

See [`ROADMAP.md`](ROADMAP.md) for full backlog.

---

## 🤝  Contributing

1. Fork → feature branch (`feat/xyz`)
2. `pnpm lint && pnpm test` must pass
3. Submit PR; maintainers review event-schema compatibility
4. Once merged, CI publishes edge Docker images.

By contributing you agree to the [Contributor License Agreement](CLA.md).

---

## 📜  License

Licensed under the **Apache License, Version 2.0**.
ClamAV runs in its own GPLv2 container; it communicates via stdout/exit-code only, keeping Skanii’s codebase Apache-2.0-clean.

---

> **Fast, auditable, hackable.** Clone, spin up, and start scanning—Skanii does the rest.
