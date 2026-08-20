# Serverless (ECS Fargate) Deployment — Setup Runbook

One-time GitHub- and AWS-side setup required before the `deploy-serverless-*`
workflows can run (the app code and TS CDK in `infrastructure/` are already in the
repo).

> Conventions used below
> - `<AWS_ACCOUNT_ID>` — the 12-digit account for the tier you're deploying to
> - Repo: `CBIIT/nci-webtools-dceg-FORGE2-TF`
> - Region: `us-east-1`
> - Tiers: `dev`, `qa`, `stage`, `prod` (ECR workflow supports `dev`/`stage`)

---

## 0. What the workflows expect (at a glance)

| Prerequisite | Where | Created by |
| --- | --- | --- |
| GitHub OIDC identity provider | each AWS account | AWS IAM (likely already exists) |
| IAM role `power-user-github-actions-cicd` | each AWS account | AWS IAM (this runbook) |
| `cdk.env` per tier | `s3://<CICD_BUCKET>/env/<tier>/forge2-tf/cdk.env` | you (this runbook) |
| GitHub Environments `dev`/`qa`/`stage`/`prod` | repo settings | you (this runbook) |
| Env vars `AWS_ACCOUNT_ID`, `CICD_BUCKET` | each GitHub Environment | you (this runbook) |
| Imported shared resources (VPC, cluster, ALB, app role) | each AWS account | platform team (referenced, not created) |
| EFS filesystem + mount targets + SG (NFS/2049 ingress from task SG) | each AWS account, per tier | platform team (provisioned outside this deploy; hands back `EFS_ID`) |

The existing EC2 workflow (`forge2-tf-deploy.yml`) already uses GitHub OIDC to
assume `ec2-role-analysistools-<tier>-role`, so the **OIDC provider almost
certainly already exists** in each account — you likely only need to add the new
role (Section 2).

---

## 1. GitHub Environments and variables

In the repo: **Settings → Environments**, create one environment per tier you
deploy (`dev`, `qa`, `stage`, `prod`). For each environment add two
**Variables** (Settings → Environments → *tier* → Environment variables — these
are `vars.*`, not secrets):

| Variable | Example | Used for |
| --- | --- | --- |
| `AWS_ACCOUNT_ID` | `123456789012` | builds the role ARN and ECR registry host |
| `CICD_BUCKET` | `nci-cbiit-dceg-cicd-dev` | S3 bucket holding the per-tier `cdk.env` |

Optionally add **required reviewers** on `stage`/`prod` so a human must approve
those deployments. No repo **secrets** are needed — auth is entirely via OIDC.

> The workflows reference `vars.AWS_ACCOUNT_ID` and `vars.CICD_BUCKET`
> consistently. (This differs from some sibling repos that mix `secrets.*` and
> `vars.*`; keep these as environment *variables*.)

---

## 2. AWS IAM — OIDC provider and CI/CD role

### 2a. OIDC identity provider (once per account)

If `ec2-role-analysistools-*` already deploys from Actions, this exists. Verify:

```sh
aws iam list-open-id-connect-providers
# look for .../oidc-provider/token.actions.githubusercontent.com
```

If absent, create it:

```sh
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 2b. Role `power-user-github-actions-cicd`

**Trust policy** — allows only this repo's workflows to assume the role. Save as
`trust-policy.json` (replace `<AWS_ACCOUNT_ID>`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:CBIIT/nci-webtools-dceg-FORGE2-TF:*"
        }
      }
    }
  ]
}
```

Tightening options for the `sub` claim (use the narrowest that still works):
- Any branch/tag/PR in the repo: `repo:CBIIT/nci-webtools-dceg-FORGE2-TF:*`
- Only when running in a named GitHub Environment: `repo:CBIIT/nci-webtools-dceg-FORGE2-TF:environment:prod`
- Only a specific branch: `repo:CBIIT/nci-webtools-dceg-FORGE2-TF:ref:refs/heads/main`

Because the workflows pin `environment: <tier>`, scoping by
`:environment:<tier>` is a good production hardening step.

Create the role:

```sh
aws iam create-role \
  --role-name power-user-github-actions-cicd \
  --assume-role-policy-document file://trust-policy.json \
  --max-session-duration 3600
```

**Permissions policy.** The role must be able to run CDK (CloudFormation, plus
the resource types the stacks create) and the app deploy (ECR push, task-def
register, service update, SSM reads). `PowerUserAccess` works in a non-prod
account; a least-privilege policy is preferable. Minimum action set:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "CdkCloudFormation", "Effect": "Allow",
      "Action": ["cloudformation:*"], "Resource": "*" },
    { "Sid": "CdkAssetsAndBootstrap", "Effect": "Allow",
      "Action": ["s3:*", "ssm:GetParameter", "ssm:GetParameters",
                 "ssm:PutParameter", "ssm:DeleteParameter",
                 "ssm:AddTagsToResource"],
      "Resource": "*" },
    { "Sid": "EcrPushPull", "Effect": "Allow",
      "Action": ["ecr:GetAuthorizationToken", "ecr:BatchCheckLayerAvailability",
                 "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage",
                 "ecr:PutImage", "ecr:InitiateLayerUpload",
                 "ecr:UploadLayerPart", "ecr:CompleteLayerUpload",
                 "ecr:CreateRepository", "ecr:DescribeRepositories",
                 "ecr:PutLifecyclePolicy", "ecr:TagResource"],
      "Resource": "*" },
    { "Sid": "EcsDeploy", "Effect": "Allow",
      "Action": ["ecs:RegisterTaskDefinition", "ecs:DeregisterTaskDefinition",
                 "ecs:ListTaskDefinitions", "ecs:DescribeTaskDefinition",
                 "ecs:UpdateService", "ecs:DescribeServices",
                 "ecs:DescribeClusters", "ecs:CreateService",
                 "ecs:DescribeTasks", "ecs:ListTasks"],
      "Resource": "*" },
    { "Sid": "InfraResources", "Effect": "Allow",
      "Action": ["ec2:*", "elasticfilesystem:*",
                 "elasticloadbalancing:*", "logs:*",
                 "application-autoscaling:*"],
      "Resource": "*" },
    { "Sid": "PassAppAndExecRoles", "Effect": "Allow",
      "Action": ["iam:PassRole", "iam:GetRole", "iam:CreateRole",
                 "iam:AttachRolePolicy", "iam:PutRolePolicy",
                 "iam:CreateServiceLinkedRole"],
      "Resource": "*" }
  ]
}
```

Attach it:

```sh
aws iam put-role-policy \
  --role-name power-user-github-actions-cicd \
  --policy-name forge2-tf-cicd \
  --policy-document file://permissions-policy.json
```

> If the account already uses this role for sibling apps (pimixture,
> analysis-tools), it already exists — you only need to confirm the trust policy
> allows **this** repo's `sub` and that CDK is bootstrapped (next note).

> **CDK bootstrap:** each account/region must be bootstrapped once
> (`cdk bootstrap aws://<AWS_ACCOUNT_ID>/us-east-1`). If sibling CDK apps already
> deploy here, it's done.

---

## 3. Per-tier `cdk.env` in S3

The CDK workflows download `s3://<CICD_BUCKET>/env/<tier>/forge2-tf/cdk.env` and
load it into the job environment (key=value lines). Build it from
[`infrastructure/cdk.env.example`](../infrastructure/cdk.env.example). Upload one
per tier.

```sh
# example for dev — fill in the real imported-resource IDs from the platform team
cat > cdk.env <<'EOF'
TIER=dev
AWS_ACCOUNT_ID=123456789012
AWS_REGION=us-east-1

APP_NAME=forge2-tf
APP_NAMESPACE=analysistools
APP_SERVICE=web
APP_DOMAIN=analysistools-dev.cancer.gov
APP_PATH_PREFIX=/forge2-tf

# Imported shared resources (get these from the platform/infra team)
VPC_ID=vpc-xxxxxxxx
SUBNET_IDS=subnet-aaaa,subnet-bbbb
SECURITY_GROUP_IDS=sg-xxxxxxxx
CLUSTER_ARN=arn:aws:ecs:us-east-1:123456789012:cluster/analysistools-dev
LISTENER_ARN=arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/.../...
APP_ROLE_ARN=arn:aws:iam::123456789012:role/analysistools-dev-forge2-tf-role

# Imported EFS (platform team provisions the filesystem + mount targets + SG and
# NFS/2049 ingress from the task SG, then hands you the EFS_ID). This stack only
# creates the /data and /data/motif-logos access points against it.
EFS_ID=fs-xxxxxxxxxxxxxxxxx
POSIX_UID=1000
POSIX_GID=1000

# ALB routing / health check
LISTENER_RULE_PRIORITY=900
HEALTH_CHECK_PATH=/forge2-tf/
GRACE_PERIOD=120

# Task sizing
WEB_CPU=1024
WEB_MEMORY=2048
WEB_DESIRED_COUNT=1
WEB_CONTAINER_PORT=80

# Non-prod scheduled scale-to-zero (set false for stage/prod)
WEB_NON_PROD_SCHEDULE=true
SCHEDULED_MIN_CAPACITY=1
SCHEDULED_MAX_CAPACITY=1

# ECR
ECR_REPO_NAME=forge2-tf
ECR_COUNT_NUMBER=10
EOF

aws s3 cp cdk.env "s3://nci-cbiit-dceg-cicd-dev/env/dev/forge2-tf/cdk.env"
rm -f cdk.env   # never commit real values; they're git-ignored anyway
```

Notes:
- `LISTENER_RULE_PRIORITY` must be **unique per listener** across all apps
  sharing the ALB — coordinate the value with the platform team.
- `APP_DOMAIN` changes per tier (`analysistools-dev`, `-qa`, `-stage`, and
  `analysistools.cancer.gov` for prod).
- For prod set `WEB_NON_PROD_SCHEDULE=false` so the service isn't scaled to zero
  on nights/weekends.

---

## 4. First-run order

Run from the **Actions** tab (each is "Run workflow", pick the tier):

1. **Deploy Serverless ECR** → creates the `forge2-tf` ECR repository.
2. **Deploy Serverless Infrastructure** → ECS service, EFS access points (against
   the platform-provisioned filesystem, `EFS_ID`), ALB target group/rule, log
   group, autoscaling, and the SSM parameters the app workflow reads.
3. **Stage the EFS data set** (manual, once per environment) — copy the tabix
   `*.gz.tbi` indexes, the SQLite SNP-filter DB (see [`scripts/`](../scripts)),
   and `motif-logos/` onto the EFS access-point root (mount from a bastion or a
   one-off ECS task). Data persists across deploys (the filesystem is owned and
   retained by the platform team, outside this app's CDK).
4. **Deploy Serverless App** → builds & pushes images, renders the task
   definition, registers it, and forces a new service deployment.

Steady-state code redeploys are just step 4. Steps 1–2 re-run only when the
registry or infrastructure changes.

---

## 5. SSM parameters published by the infrastructure stack

The app workflow reads these (either CDK language publishes the same set):

```
/analysistools/<tier>/forge2-tf/ecs_cluster
/analysistools/<tier>/forge2-tf/ecs_web_task
/analysistools/<tier>/forge2-tf/ecs_web_service
/analysistools/<tier>/forge2-tf/role_arn
/analysistools/<tier>/forge2-tf/efs_file_system_id
/analysistools/<tier>/forge2-tf/efs_access_point_id
/analysistools/<tier>/forge2-tf/efs_motif_logos_access_point_id
```

Datadog FireLens logging additionally reads:

```
/analysistools/<tier>/datadog/log_endpoint_host
/analysistools/<tier>/datadog/api_key
```

---

## 6. Smoke test / troubleshooting

- **`Could not assume role ... not authorized to perform sts:AssumeRoleWithWebIdentity`**
  → the role's trust-policy `sub` doesn't match. Confirm it allows
  `repo:CBIIT/nci-webtools-dceg-FORGE2-TF:*` (or the specific `environment:`/`ref:`).
- **`Unable to download cdk.env` / access denied** → `CICD_BUCKET` var wrong, the
  object isn't at `env/<tier>/forge2-tf/cdk.env`, or the role lacks `s3:GetObject`.
- **Frontend container starts with an empty image / pull error** → the task def
  references the immutable `FRONTEND_IMAGE` / `BACKEND_IMAGE` (`:<service>-<timestamp>`)
  tags so each ECS revision (and any circuit-breaker rollback) pins an exact image;
  confirm the app workflow exported them. `:<service>-latest` is still pushed for
  build cache only.
- **`This stack uses assets, so the toolkit stack must be deployed` (bootstrap)**
  → run `cdk bootstrap aws://<AWS_ACCOUNT_ID>/us-east-1` once.
- **ALB rule priority conflict** → pick a unique `LISTENER_RULE_PRIORITY`.
- Service won't stabilize → check the CloudWatch log group and the ECS service
  events; the app workflow's "Wait for service stability" step surfaces this.
