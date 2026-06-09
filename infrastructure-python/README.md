# infrastructure-python

A **Python CDK** port of the FORGE2-TF infrastructure. It is functionally
identical to the TypeScript stack in [`../infrastructure`](../infrastructure) —
same resources, same logical IDs where they matter, same SSM parameters, same
CDK feature flags (`cdk.json` context) — and synthesizes equivalent
CloudFormation. Use whichever language your team prefers; you only need one.

## Layout

```
app.py                  ECS Fargate app entry point   (== bin/cdk.ts)
app_ecr.py              ECR repository entry point     (== bin/ecr.ts)
stacks/
  ecs_app_stack.py      EcsAppStack: EFS, Fargate service, target group,
                        listener rule, log group, autoscaling, SSM params
  ecr_stack.py          EcrStack
cdk.json                app = "python3 app.py" + matching context flags
requirements.txt        aws-cdk-lib + constructs (pinned to the TS versions)
cdk.env.example         documented environment variables
```

## Prerequisites

- Python 3.9+
- The CDK CLI (a Node tool, not a pip package): `npm install -g aws-cdk`

## Setup

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Synthesize / deploy

Configuration is read from environment variables (same set as the TS stack;
see `cdk.env.example`).

```sh
cp cdk.env.example cdk.env      # fill in real values
set -a && source cdk.env && set +a

# ECS Fargate app stack
cdk synth   --app "python3 app.py"
cdk deploy  --app "python3 app.py" --require-approval never

# ECR stack
cdk deploy  --app "python3 app_ecr.py" --require-approval never
```

## Using this instead of the TypeScript stack in CI

The existing GitHub workflows (`.github/workflows/deploy-infrastructure.yml` and
`deploy-ecr.yml`) target the TypeScript `infrastructure/` directory. To drive
the Python version instead, point them at this directory and swap the CDK
commands, e.g.:

```yaml
env:
  CDK_DIR: infrastructure-python
steps:
  - run: npm install -g aws-cdk
  - run: pip install -r requirements.txt
    working-directory: ${{ env.CDK_DIR }}
  - run: cdk deploy --app "python3 app.py" --require-approval never
    working-directory: ${{ env.CDK_DIR }}
```

The data-plane pieces (Docker images, `.github/aws/web.yml` task definition,
`deploy-app.yml`) are language-agnostic and unchanged — only the IaC language
differs.
