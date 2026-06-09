#!/usr/bin/env python3
"""CDK app entry point for the FORGE2-TF ECS Fargate stack (Python).

Equivalent to infrastructure/bin/cdk.ts. Configuration comes from environment
variables (sourced from cdk.env in CI), matching the TypeScript version exactly.
"""
import os
import sys

import aws_cdk as cdk

from stacks.ecs_app_stack import EcsAppStack

TIER = os.environ.get("TIER")
AWS_ACCOUNT_ID = os.environ.get("AWS_ACCOUNT_ID")

if not TIER:
    print("Error: TIER environment variable is not defined", file=sys.stderr)
    sys.exit(1)

if not AWS_ACCOUNT_ID:
    print("Error: AWS_ACCOUNT_ID environment variable is not defined", file=sys.stderr)
    sys.exit(1)

region = os.environ.get("AWS_REGION", "us-east-1")

app = cdk.App()

EcsAppStack(
    app,
    f"Forge2TfStack-{TIER}",
    env=cdk.Environment(account=AWS_ACCOUNT_ID, region=region),
    stack_name=f"{TIER}-forge2-tf",
    description="ECS Fargate infrastructure for FORGE2-TF",
    tier=TIER,
    app_name=os.environ.get("APP_NAME", "forge2-tf"),
    app_namespace=os.environ.get("APP_NAMESPACE", "analysistools"),
    app_service=os.environ.get("APP_SERVICE", "web"),
    app_domain=os.environ.get(
        "APP_DOMAIN",
        "analysistools.cancer.gov"
        if TIER == "prod"
        else f"analysistools-{TIER}.cancer.gov",
    ),
    app_path_prefix=os.environ.get("APP_PATH_PREFIX", "/forge2-tf"),
    vpc_id=os.environ.get("VPC_ID", ""),
    subnet_ids=os.environ.get("SUBNET_IDS", "").split(","),
    security_group_ids=os.environ.get("SECURITY_GROUP_IDS", "").split(","),
    cluster_arn=os.environ.get("CLUSTER_ARN", ""),
    listener_arn=os.environ.get("LISTENER_ARN", ""),
    app_role_arn=os.environ.get("APP_ROLE_ARN", ""),
    listener_rule_priority=int(os.environ.get("LISTENER_RULE_PRIORITY", "900")),
    health_check_path=os.environ.get("HEALTH_CHECK_PATH", "/forge2-tf/"),
    grace_period=int(os.environ.get("GRACE_PERIOD", "120")),
    cpu=int(os.environ.get("WEB_CPU", "1024")),
    memory=int(os.environ.get("WEB_MEMORY", "2048")),
    desired_count=int(os.environ.get("WEB_DESIRED_COUNT", "1")),
    container_port=int(os.environ.get("WEB_CONTAINER_PORT", "80")),
    non_prod_schedule=os.environ.get("WEB_NON_PROD_SCHEDULE") == "true",
    scheduled_min_capacity=int(os.environ.get("SCHEDULED_MIN_CAPACITY", "1")),
    scheduled_max_capacity=int(os.environ.get("SCHEDULED_MAX_CAPACITY", "1")),
)

app.synth()
