
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
| Public IPv4 | _TODO: fill in from console_ |
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

### EC2 first-time setup (over SSH)

```bash
# Node 24
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs nginx

# MongoDB — follow the official MongoDB apt repo steps for Ubuntu, then:
sudo systemctl enable --now mongod

# PM2 (process manager for the Node backend)
sudo npm install -g pm2

# App directory
sudo mkdir -p /var/www/debateapp && sudo chown ubuntu:ubuntu /var/www/debateapp
```

### Deploy checklist

- [x] EC2 instance launched (`i-0ff37f4b83f53f928`, Ubuntu)
- [ ] Public IP recorded; security group rules (22/80) set
- [ ] SSH connection confirmed
- [ ] Node 24 + Nginx + MongoDB + PM2 installed on box
- [ ] GitHub Actions secrets created
- [ ] CI workflow fixed (currently broken YAML, pinned to Node 14)
- [ ] Deploy workflow added (SSH pull + build + `pm2 reload`)
- [ ] App reachable at public URL

---

