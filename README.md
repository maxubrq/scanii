# 🔬 Skanii

> **Tiny, open‑source malware‑scanning pipeline (mini‑VirusTotal) built with Node.js + TypeScript, RabbitMQ, Redis and Postgres.**

[![CI](https://github.com/your‑handle/skanii/actions/workflows/ci.yml/badge.svg)](…)
[![Docker Pulls](https://img.shields.io/docker/pulls/skanii/worker)](…)
[![License](https://img.shields.io/github/license/your‑handle/skanii)](LICENSE)

---

## ✨ Why Skanii?

* **Practice‑ready OSS** – mono‑repo + `docker‑compose`, up in < 5 min.
* **Async pipeline** – upload once, scan in the background, poll or subscribe.
* **Lightweight engines** – ships with **ClamAV** & **YARA**; easy to add more.
* **Cache‑first** – SHA‑256 verdicts kept 24 h in Redis to avoid duplicate scans.
* **Observability by default** – Prometheus metrics & Grafana dashboards.
* **MIT‑licensed** – fork, extend, embed, no strings attached.

---

## 🏗️ Architecture (MVP)

```text
┌──────────────┐   POST /upload   ┌──────────────────┐
│  Upload API  │ ───────────────► │  MinIO  (S3)     │
└─────┬────────┘                 └────────┬─────────┘
      │  scan job (id, sha256)            │
      ▼                                   ▼
┌──────────────┐        RabbitMQ        ┌────────────────┐
│ Result API & │◄────────────────────── │  Scan Worker   │
│ Dashboard    │   status / events      │  pool (ClamAV) │
└──────────────┘                         └────────────────┘
       ▲
       │   Redis (24 h verdict cache)
       │
       ▼
  PostgreSQL (metadata, audit, billing)
```

---

## 🚀 Quick Start

> **Prerequisites:** Docker Desktop ≥ 24 or compatible Linux Docker Engine.

```bash
# 1. Clone & launch
$ git clone https://github.com/your-handle/skanii.git
$ cd skanii
$ make dev        # or: docker compose up -d --build

# 2. Upload a sample
$ curl -F "file=@tests/eicar.com" http://localhost:4000/upload
{"scan_id":"e2d1...","status":"queued"}

# 3. Poll result
$ curl http://localhost:4002/scan/e2d1...
{"verdict":"malicious","engines":{"ClamAV":"EICAR-Test-Signature"}}
```

Login to Grafana at `http://localhost:3000` (admin / admin) to view queue depth, API latency, cache hit‑rate.

---

## ⚙️ Configuration

| ENV            | Default                | Description                         |
| -------------- | ---------------------- | ----------------------------------- |
| `SCAN_WORKERS` | `2`                    | # of parallel scan containers       |
| `REDIS_URL`    | `redis://redis:6379`   | Redis connection string             |
| `RABBIT_URL`   | `amqp://rabbitmq:5672` | RabbitMQ host                       |
| `S3_ENDPOINT`  | `http://minio:9000`    | MinIO/S3 endpoint                   |
| `S3_BUCKET`    | `skanii-samples`       | Bucket for uploaded files           |
| `MAX_FILE_MB`  | `100`                  | Reject files larger than this value |

All variables can be overridden via `.env` or the Compose override file.

---

## 📚 API (v1)

### `POST /upload`

Upload a file (multipart‑form). Returns `scan_id`.

### `GET /scan/{scan_id}`

Fetch scan result JSON. Returns `202 Accepted` if still in queue, or `200` with verdict when finished.

### `WS /ws/scan/{scan_id}` *(optional)*

WebSocket endpoint that pushes `scan.progress` & `scan.done` events.

See full Swagger/OpenAPI spec at `http://localhost:4000/docs` once the stack is running.

---

## 🛣️ Roadmap

* [ ] **CLI** (`npx skanii scan file.exe`)
* [ ] **Webhook callbacks** for async notification
* [ ] **Cuckoo Sandbox plugin** (optional heavy mode)
* [ ] Multi‑engine adapter (vendor cloud AV)
* [ ] Edge upload proxy + rate‑limit per IP

Track progress in [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

## 🤝 Contributing

1. Fork → Branch → PR. Follow Conventional Commits.
2. `npm run test` must pass (unit + integration).
3. Docs live in `docs/` (Markdown); kept in sync with code.

Good first issues are labelled **`good‑first‑issue`**.

---

## 🔒 Security & Responsible Disclosure

Scanning malware is risky. Workers run **unprivileged** with seccomp, read‑only rootfs and limited CPU/IO. If you discover a security issue, please email ***[security@skanii.dev](mailto:security@skanii.dev)*** instead of opening a public issue.

---

## 📜 License

skanii is released under the **MIT License** – see [`LICENSE`](LICENSE) for details.

---

> Built with ❤️ & ☕ by contributors around the world – star the repo if skanii helps you learn!
