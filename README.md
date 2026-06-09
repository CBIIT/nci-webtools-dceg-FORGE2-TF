# nci-webtools-dceg-FORGE2-TF

## CI/CD Deployment

### GitHub Actions Workflow

The application uses GitHub Actions for automated deployment to EC2 via [.github/workflows/forge2-tf-deploy.yml](.github/workflows/forge2-tf-deploy.yml).

### Deployment Prerequisites

1. **AWS Resources**
   - ECR repository: `analysistools/{tier}/forge2-tf`
   - EC2 instance with Docker and Docker Compose installed
   - IAM role: `ec2-role-analysistools-{tier}-role` with:
     - ECR pull permissions
     - SSM permissions for remote command execution

2. **GitHub Secrets** (per environment: dev/qa/stage/prod)
   - `AWS_ACCOUNT_ID` - Your AWS account ID
   - `EC2_INSTANCE_NAME` - EC2 instance tag name for deployment target

3. **EC2 Configuration**
   - Config file must exist at: `/local/content/docker_apps/forge2-tf/config/config.json`
   - Docker and Docker Compose installed
   - AWS CLI configured with ECR access
   - SSM Agent running

### Deployment Configuration

**Ports:**
- Frontend: `8101`
- Backend: `8000`

**Directories on EC2:**
- App root: `/local/content/docker_apps/forge2-tf`
- Config: `/local/content/docker_apps/forge2-tf/config`
- Logs: `/local/content/docker_apps/forge2-tf/logs`
- Data: `/local/content/docker_apps/forge2-tf/data`

**Image Tiers:**
- `dev/qa` → `development` images
- `stage/prod` → `release` images

### How to Deploy

1. Go to **Actions** tab in GitHub repository
2. Select **Deploy FORGE2-TF to EC2** workflow
3. Click **Run workflow**
4. Select deployment tier (dev/qa/stage/prod)
5. Click **Run workflow** to start deployment

### Deployment Process

The workflow automatically:
1. ✅ Builds Docker images for frontend and backend
2. ✅ Pushes images to Amazon ECR with build caching
3. ✅ Generates docker-compose configuration from template
4. ✅ Deploys to EC2 via AWS SSM
5. ✅ Stops existing containers on specified ports
6. ✅ Pulls latest images
7. ✅ Starts new containers
8. ✅ Verifies deployment success

### Files

- **[docker-compose.deploy.yml](docker-compose.deploy.yml)** - Production deployment template for GitHub Actions (uses environment variables)
- **[.github/workflows/forge2-tf-deploy.yml](.github/workflows/forge2-tf-deploy.yml)** - GitHub Actions deployment workflow

---

## Serverless (ECS Fargate) Deployment

In addition to the EC2 + docker-compose pipeline documented above, this repo now
also supports a **serverless deployment on AWS ECS Fargate**. The two models
coexist: the EC2 path (`forge2-tf-deploy.yml`) is unchanged, and the serverless
path lives in separate, clearly-named workflows and an `infrastructure/` /
`infrastructure-python/` IaC layer. Pick whichever you need per environment.

This mirrors the CBIIT Fargate pattern used by `nci-webtools-dceg-pimixture`
and `nci-analysis-tools-web-presence`.

### Architecture

```
        Application Load Balancer (shared, imported)
           host: analysistools[-tier].cancer.gov  path: /forge2-tf*
           ▼
   ECS Fargate service — one task, sibling containers (awsvpc):
     frontend (Apache)  :80   ◀── ALB target; proxies /forge2-tf/api → localhost:8000
     backend  (Node)    :8000
     logs     (FireLens / fluent-bit) ─▶ Datadog
   EFS mounts:  /deploy/data (data AP),  assets/motif-logos (read-only AP)
```

Because the frontend and backend run as siblings in a single task, Apache reaches
the backend over the shared network namespace at `http://localhost:8000` — no
service discovery needed. On Fargate, `config.json` is rendered at container
start from task environment variables by
[`docker/backend-entrypoint.sh`](docker/backend-entrypoint.sh); when a
`config.json` is bind-mounted (local/EC2), the entrypoint detects it and leaves
it untouched, so the legacy local flow is unaffected.

### Infrastructure as Code (choose one language)

Two functionally-equivalent CDK implementations are provided; you only need one:

- **[infrastructure/](infrastructure/)** — TypeScript CDK (`bin/cdk.ts`, `bin/ecr.ts`)
- **[infrastructure-python/](infrastructure-python/)** — Python CDK (`app.py`, `app_ecr.py`)

The serverless workflows take an `iac_language` input so you can select
`typescript` (default) or `python` at run time.

### Serverless workflows

All are `workflow_dispatch` (Actions → Run workflow → pick a tier and IaC language):

1. **[deploy-serverless-ecr.yml](.github/workflows/deploy-serverless-ecr.yml)** — create/update the `forge2-tf` ECR repository (CDK).
2. **[deploy-serverless-infrastructure.yml](.github/workflows/deploy-serverless-infrastructure.yml)** — provision the ECS service, EFS + access points, ALB target group/rule, log group, autoscaling, and SSM parameters (CDK).
3. **[deploy-serverless-app.yml](.github/workflows/deploy-serverless-app.yml)** — build & push the frontend/backend images, render [`.github/aws/web.yml`](.github/aws/web.yml), register the task definition, and force a new service deployment.

After the infrastructure exists, **stage the reference data onto EFS once per
environment** (tabix `*.gz.tbi` indexes, the SQLite SNP-filter DB from
[`scripts/`](scripts/), and `motif-logos/`) — it is not baked into images or git.

### Serverless prerequisites

One-time setup before the serverless workflows can run — full instructions in
**[docs/serverless-deployment-setup.md](docs/serverless-deployment-setup.md)**:

- **OIDC IAM role** `power-user-github-actions-cicd` in each target account, trusting this repo's GitHub OIDC.
- **S3 `cdk.env`** per tier at `s3://<CICD_BUCKET>/env/<tier>/forge2-tf/cdk.env` (template: [`infrastructure/cdk.env.example`](infrastructure/cdk.env.example)).
- **GitHub Environments** dev/qa/stage/prod with `vars` `AWS_ACCOUNT_ID` and `CICD_BUCKET`.

### Local development (serverless topology)

[`docker-compose-local.yml`](docker-compose-local.yml) mirrors the single-task
Fargate topology for local runs (see [`run-docker.sh`](run-docker.sh) and the
`diagnose-*.sh` helpers). The original `docker-compose.deploy*.yml` flow still
works exactly as before.