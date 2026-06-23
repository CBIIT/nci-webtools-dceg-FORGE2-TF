#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { EcsAppStack } from "../lib/ecs-app-stack";

/** Returns a required environment variable, or throws if it is unset/empty. */
function required(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

/** Returns an optional environment variable, falling back to a default. */
function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

const TIER = required("TIER");
const AWS_ACCOUNT_ID = required("AWS_ACCOUNT_ID");

const app = new cdk.App();
const region = optional("AWS_REGION", "us-east-1");

new EcsAppStack(app, `Forge2TfStack-${TIER}`, {
  env: { account: AWS_ACCOUNT_ID, region },
  stackName: `${TIER}-forge2-tf`,
  description: "ECS Fargate infrastructure for FORGE2-TF",

  tier: TIER,
  appName: optional("APP_NAME", "forge2-tf"),
  appNamespace: optional("APP_NAMESPACE", "analysistools"),
  appService: optional("APP_SERVICE", "web"),
  appDomain: optional(
    "APP_DOMAIN",
    TIER === "prod"
      ? "analysistools.cancer.gov"
      : `analysistools-${TIER}.cancer.gov`
  ),
  appPathPrefix: optional("APP_PATH_PREFIX", "/forge2-tf"),

  vpcId: required("VPC_ID"),
  subnetIds: required("SUBNET_IDS").split(","),
  securityGroupIds: required("SECURITY_GROUP_IDS").split(","),
  clusterArn: required("CLUSTER_ARN"),
  listenerArn: required("LISTENER_ARN"),
  appRoleArn: required("APP_ROLE_ARN"),

  efsId: required("EFS_ID"),
  posixUid: Number(optional("POSIX_UID", "1000")),
  posixGid: Number(optional("POSIX_GID", "1000")),

  listenerRulePriority: Number(optional("LISTENER_RULE_PRIORITY", "900")),
  healthCheckPath: optional("HEALTH_CHECK_PATH", "/forge2-tf/"),
  gracePeriod: Number(optional("GRACE_PERIOD", "120")),

  cpu: Number(optional("WEB_CPU", "1024")),
  memory: Number(optional("WEB_MEMORY", "2048")),
  desiredCount: Number(optional("WEB_DESIRED_COUNT", "1")),
  containerPort: Number(optional("WEB_CONTAINER_PORT", "80")),

  nonProdSchedule: process.env.WEB_NON_PROD_SCHEDULE === "true",
  scheduledMinCapacity: Number(optional("SCHEDULED_MIN_CAPACITY", "1")),
  scheduledMaxCapacity: Number(optional("SCHEDULED_MAX_CAPACITY", "1")),
});

app.synth();
