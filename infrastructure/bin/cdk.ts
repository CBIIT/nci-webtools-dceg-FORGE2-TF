#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { EcsAppStack } from "../lib/ecs-app-stack";

const TIER = process.env.TIER;
const AWS_ACCOUNT_ID = process.env.AWS_ACCOUNT_ID;

if (!TIER) {
  console.error("Error: TIER environment variable is not defined");
  process.exit(1);
}

if (!AWS_ACCOUNT_ID) {
  console.error("Error: AWS_ACCOUNT_ID environment variable is not defined");
  process.exit(1);
}

const app = new cdk.App();
const region = process.env.AWS_REGION || "us-east-1";

new EcsAppStack(app, `Forge2TfStack-${TIER}`, {
  env: { account: AWS_ACCOUNT_ID, region },
  stackName: `${TIER}-forge2-tf`,
  description: "ECS Fargate infrastructure for FORGE2-TF",

  tier: TIER,
  appName: process.env.APP_NAME || "forge2-tf",
  appNamespace: process.env.APP_NAMESPACE || "analysistools",
  appService: process.env.APP_SERVICE || "web",
  appDomain:
    process.env.APP_DOMAIN ||
    (TIER === "prod"
      ? "analysistools.cancer.gov"
      : `analysistools-${TIER}.cancer.gov`),
  appPathPrefix: process.env.APP_PATH_PREFIX || "/forge2-tf",

  vpcId: process.env.VPC_ID || "",
  subnetIds: (process.env.SUBNET_IDS || "").split(","),
  securityGroupIds: (process.env.SECURITY_GROUP_IDS || "").split(","),
  clusterArn: process.env.CLUSTER_ARN || "",
  listenerArn: process.env.LISTENER_ARN || "",
  appRoleArn: process.env.APP_ROLE_ARN || "",

  // EFS filesystem provisioned by the platform team and imported by ID.
  efsId: process.env.EFS_ID || "",
  posixUid: Number(process.env.POSIX_UID || "1000"),
  posixGid: Number(process.env.POSIX_GID || "1000"),

  listenerRulePriority: Number(process.env.LISTENER_RULE_PRIORITY || "900"),
  healthCheckPath: process.env.HEALTH_CHECK_PATH || "/forge2-tf/",
  gracePeriod: Number(process.env.GRACE_PERIOD || "120"),

  cpu: Number(process.env.WEB_CPU || "1024"),
  memory: Number(process.env.WEB_MEMORY || "2048"),
  desiredCount: Number(process.env.WEB_DESIRED_COUNT || "1"),
  containerPort: Number(process.env.WEB_CONTAINER_PORT || "80"),

  nonProdSchedule: process.env.WEB_NON_PROD_SCHEDULE === "true",
  scheduledMinCapacity: Number(process.env.SCHEDULED_MIN_CAPACITY || "1"),
  scheduledMaxCapacity: Number(process.env.SCHEDULED_MAX_CAPACITY || "1"),
});

app.synth();
