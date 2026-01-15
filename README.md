# nci-webtools-dceg-FORGE2-TF

## Running Locally with Docker

### Prerequisites
- Docker and Docker Compose installed
- Docker daemon running

### Setup Steps

1. **Create required directories**
   ```bash
   mkdir -p logs logs/apache data data/motif-logos tmp
   ```

2. **Create configuration file**
   ```bash
   cp server/config.example.json server/config.json
   ```
   
   Edit `server/config.json` and update with your AWS credentials and settings.

3. **Build the Docker containers**
   ```bash
   docker compose build
   ```

4. **Start the application**
   ```bash
   docker compose up -d
   ```

5. **Access the application**
   - Frontend: http://localhost:8101
   - Backend API: http://localhost:8000

### Useful Commands

**View logs**
```bash
docker compose logs -f
```

**Stop containers**
```bash
docker compose down
```

**Rebuild and restart**
```bash
docker compose up -d --build
```

**View running containers**
```bash
docker compose ps
```

### Troubleshooting

- If port 8101 or 8000 is already in use, edit [docker-compose.yml](docker-compose.yml) to use different ports
- Check logs with `docker compose logs backend` or `docker compose logs frontend`
- Ensure `server/config.json` exists before starting

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

- **[docker-compose.yml](docker-compose.yml)** - Local development configuration
- **[docker/docker-compose.deploy.yml](docker/docker-compose.deploy.yml)** - Production deployment template (uses environment variables)
- **[.github/workflows/forge2-tf-deploy.yml](.github/workflows/forge2-tf-deploy.yml)** - GitHub Actions deployment workflow