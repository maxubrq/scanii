# 🛡️ Skanii

**Your lightning‑fast malware‑scanning sidekick**

Skanii turns any server—or your own laptop—into a private, mini‑VirusTotal. Spin it up in minutes, drop in suspicious files, and get clear answers *fast* without sending your data to third‑party clouds.

---

## 👀 At‑a‑Glance

| What you get                                              | Why it matters                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------- |
| **Sub‑2‑second verdicts** on common file sizes            | Keep incident‑response momentum—no waiting around.             |
| **Private by design**—runs 100 % on your hardware         | Sensitive samples stay inside your own perimeter.              |
| **Central Logic Processor** orchestrates every scan       | Confidence that all engines ran and every result was captured. |
| **Plug‑and‑play engines** (start with File‑Type + ClamAV) | Drop in YARA, ML, or commercial AVs when you’re ready.         |
| **Audit‑ready history**                                   | Every scan is logged for compliance and learning.              |
| **One‑command deployment** via Docker Compose             | From zero to first verdict in < 10 minutes.                    |

---

## 🏆 Who Uses Skanii?

* **Blue‑team analysts** who need answers *now* without tipping off adversaries.
* **DevSecOps teams** embedding malware checks into CI/CD pipelines.
* **SaaS platforms** offering secure file uploads and wanting an in‑house scanner.
* **Researchers & educators** who need a safe, local playground for malware analysis.

---

## ✨ Core Features

### Instant Verdicts

Drag‑and‑drop or script uploads through a simple REST or CLI interface. Skanii hashes, queues, and scans in parallel—delivering results before coffee brews.

### Central Logic Processor (CLP)

A smart brain that decides which engines to fire, waits for all responses, and publishes one clean, aggregated verdict. No half‑baked results—ever.

### Audit Trail

Every action, from upload to final verdict, is immutably logged. Perfect for SOC evidence, reports, or post‑mortems.

### Future‑Proof Engine Layer

Start small. Add YARA rules, ML classifiers, or sandbox integrations later with minimal boilerplate.

### Open‑Source Freedom

Apache‑2.0 licence. Fork away, audit the code, and tailor it to your threat model.

---

## 🚀 Getting Started (3‑Step Quick‑Run)

1. **Clone & start**

   ```bash
   git clone https://github.com/your-org/skanii.git
   cd skanii && docker compose up -d
   ```
2. **Upload a file**

   ```bash
   curl -F "file=@eicar.com" -H "X-API-Key: YOUR_KEY" http://localhost:3000/upload
   ```
3. **Fetch the verdict**

   ```bash
   curl http://localhost:3000/files/<SHA256>
   ```

Total time: \~3 minutes (first‑run includes signature download).

---

## 🔍 How Skanii Works (Simple View)

1. **Ingest** – You upload a file.
2. **Dedup** – Skanii hashes it and skips previously scanned files.
3. **Orchestrate** – CLP dispatches the job to all enabled engines.
4. **Scan** – Engines run in isolated sandboxes.
5. **Aggregate** – CLP fuses engine results into one verdict.
6. **Respond** – You query once and get the consolidated answer.

---

## 🛣️ What’s Next

| Coming Soon                       | Why we’re excited                       |
| --------------------------------- | --------------------------------------- |
| **YARA engine**                   | Custom rule matching for deeper intel   |
| **Drag‑and‑drop desktop app**     | Instant local verdicts—no cURL needed   |
| **GPT‑powered verdict explainer** | Plain‑English reasons behind detections |
| **Auto‑scaling Helm chart**       | Effortless on‑prem or cloud growth      |

Track progress or suggest ideas in the **Issues** tab.

---

## 🤝 Join the Community

* **Star** the repo if Skanii saves your day.
* **Open an issue** for bugs, feature requests, or engine integrations.
* **Submit a PR**—we review fast.

Security researchers: please follow our [Responsible Disclosure](SECURITY.md).

---

## 📜 Licence

Skanii is released under the **Apache 2.0** licence. Third‑party engines (e.g., ClamAV) run in separate containers to respect their licences.

> **Your files, your rules, instant peace of mind.**
