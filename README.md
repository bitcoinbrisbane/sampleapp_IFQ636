
**Assessment 1.2 (Total Marks **20**)**

Assignment: **Software requirements analysis and design (**Full-Stack CRUD Application Development with DevOps Practices**)**


---

**Objective**

For this assessment, you have already been assigned a project. Your task is to develop a system that implements CRUD (Create, Read, Update, Delete) operations based on the selected project. The system should include both a user panel and an admin panel. Depending on the nature of your chosen project, you may decide how many CRUD operations are required to support the functionality of the system. You have been provided with a starter project that includes user authentication using Node.js, React.js, and MongoDB, your should extend this application based on your assigned project requirements. Ensure that the implemented features are appropriate and meaningful for your selected project. Your project should include the following:
In this assignment you will complete the following tasks:

* **Basic Version Control using GitHub**
* **Development, CI/CD Integration for Automated Deployment**
* **Project report**

 
---

**GitHub link of the starter project: **[https://github.com/nahaQUT/sampleapp_IFQ636.git](https://github.com/nahaQUT/sampleapp_IFQ636.git)

---

## Project: DebateApp (Lucas Cullen, ID n7641052)

Structured, asynchronous, time-boxed online debates built on this MERN starter.
Members of the public post a motion, an opponent joins, each side argues in fixed
3-round turns under server-enforced time-boxes, and after close the audience votes
to declare a winner.

### Architecture

- **Stack**: MERN (Node.js + Express backend, React frontend, MongoDB).
- **Deploy model**: PM2 (Node backend) + Nginx (serves the React build and
  reverse-proxies `/api` → Node).
- **Database**: MongoDB installed **on the EC2 instance** (`mongodb://localhost:27017/debateapp`).
- **CD**: GitHub Actions — on push to `main`, SSH into EC2, pull, build, `pm2 reload`.

### AWS EC2 instance

| Field | Value |
|-------|-------|
| Instance ID | `i-0ff37f4b83f53f928` |
| OS / AMI | Ubuntu |
| SSH user | `ubuntu` |
| Public IPv4 | `3.106.191.138` |
| Region | ap-southeast-2 (Sydney) |
| Key pair | `lucas.pem` (kept locally outside the repo; **never committed**) |

SSH (key is stored locally, outside this repo):

```bash
ssh -i /path/to/lucas.pem ubuntu@<PUBLIC_IP>
```

Security group inbound rules: **22** (SSH), **80** (HTTP, public URL via Nginx),
optionally **443** (HTTPS). The Node port (5001) stays internal — Nginx proxies to
it on localhost.

### GitHub Actions secrets (repo → Settings → Secrets and variables → Actions)

| Secret | Value |
|--------|-------|
| `EC2_HOST` | instance public IPv4 / DNS |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | **contents** of `lucas.pem` (full PEM, BEGIN…END) |
| `JWT_SECRET` | random secret (do not commit) |

`MONGO_URI` is not a secret — Mongo runs on the box: `mongodb://localhost:27017/debateapp`.

### EC2 box setup (provisioned 2026-11-15)

The box (Ubuntu 26.04 LTS, `t2.micro`) runs:

- **Node 24** (NodeSource) + **PM2** — the Express backend.
- **Nginx** — serves the React `build/` and reverse-proxies `/api` → Node :5001.
- **Docker** → **MongoDB** in a container (`mongo:7`), bound to `127.0.0.1:27017`
  only (not public), persistent `mongo-data` volume, `--restart unless-stopped`.
- **2 GB swap** (safety on the 1 GB box). React is built in CI, not on the box.

Mongo container (reference):

```bash
docker run -d --name debate-mongo --restart unless-stopped \
  -p 127.0.0.1:27017:27017 -v mongo-data:/data/db mongo:7
```

App directory: `/var/www/debateapp` (owned by `ubuntu`).

### Deploy checklist

- [x] EC2 instance launched (`i-0ff37f4b83f53f928`, Ubuntu 26.04)
- [x] Public IP recorded; SG rules set (SSH 22 /32, HTTP 80, HTTPS 443)
- [x] SSH connection confirmed
- [x] Box provisioned: Node 24 + Nginx + Docker/MongoDB + PM2 + swap
- [x] PM2 boot persistence enabled (`pm2-ubuntu.service`)
- [x] Nginx site config + reverse proxy (`/` → build, `/api` → :5001)
- [x] App reachable at public URL (placeholder page, HTTP 200)
- [x] CI workflow fixed (`ci.yml`: Node 24, builds frontend, runs tests)
- [x] Deploy workflow added (`deploy.yml`: build in CI → rsync → `pm2 reload`)
- [ ] **GitHub Actions secrets created** (`EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`, `JWT_SECRET`) ← your step
- [ ] First successful deploy (backend live, `/api` returns 200)

---

