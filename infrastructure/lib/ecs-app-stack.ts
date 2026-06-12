import * as cdk from "aws-cdk-lib";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as efs from "aws-cdk-lib/aws-efs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as appscaling from "aws-cdk-lib/aws-applicationautoscaling";
import { Construct } from "constructs";

export interface EcsAppStackProps extends cdk.StackProps {
  tier: string;
  appName: string;
  appNamespace: string;
  appService: string;
  appDomain: string;
  appPathPrefix: string;

  vpcId: string;
  subnetIds: string[];
  securityGroupIds: string[];
  clusterArn: string;
  listenerArn: string;
  appRoleArn: string;

  // EFS is provisioned outside the app deploy (by the platform team) and imported
  // here by ID — the same pattern every other DCEG app that mounts EFS uses
  // (pimixture, ezQTL, mSigPortal, linkage). This stack creates only the scoped
  // access points, never the filesystem / mount targets / security group.
  efsId: string;
  posixUid: number;
  posixGid: number;

  listenerRulePriority: number;
  healthCheckPath: string;
  gracePeriod: number;

  cpu: number;
  memory: number;
  desiredCount: number;
  containerPort: number;

  nonProdSchedule: boolean;
  scheduledMinCapacity: number;
  scheduledMaxCapacity: number;
}

export class EcsAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EcsAppStackProps) {
    super(scope, id, props);

    const {
      tier,
      appName,
      appNamespace,
      appService,
      appDomain,
      appPathPrefix,
      vpcId,
      subnetIds,
      securityGroupIds,
      clusterArn,
      listenerArn,
      appRoleArn,
      efsId,
      posixUid,
      posixGid,
      listenerRulePriority,
      healthCheckPath,
      gracePeriod,
    } = props;

    // Stack-level tags
    cdk.Tags.of(this).add("EnvironmentTier", tier);
    cdk.Tags.of(this).add("ResourceName", `${tier}-${appName}`);
    cdk.Tags.of(this).add("ManagedBy", "cdk");
    cdk.Tags.of(this).add("CreatedBy", "cdk");
    cdk.Tags.of(this).add("Project", "dceg-analysistools");
    cdk.Tags.of(this).add("ApplicationName", appName);

    // Import existing shared resources
    const vpc = ec2.Vpc.fromLookup(this, "Vpc", { vpcId });

    const subnets = subnetIds.map((sid, i) =>
      ec2.Subnet.fromSubnetId(this, `Subnet${i}`, sid)
    );

    const securityGroups = securityGroupIds.map((sgId, i) =>
      ec2.SecurityGroup.fromSecurityGroupId(this, `SG${i}`, sgId)
    );

    const clusterName = cdk.Arn.split(
      clusterArn,
      cdk.ArnFormat.SLASH_RESOURCE_NAME
    ).resourceName!;
    const cluster = ecs.Cluster.fromClusterAttributes(this, "Cluster", {
      clusterName,
      clusterArn,
      vpc,
      securityGroups,
    });

    const executionRole = iam.Role.fromRoleArn(this, "ExecutionRole", appRoleArn);
    const taskRole = iam.Role.fromRoleArn(this, "TaskRole", appRoleArn);

    const listener = elbv2.ApplicationListener.fromApplicationListenerAttributes(
      this,
      "Listener",
      {
        listenerArn,
        securityGroup: securityGroups[0],
      }
    );

    // -------------------------------------------------------------------------
    // Persistent storage (EFS) for the FORGE2-TF reference data set.
    //
    // On EC2 the application relied on host bind-mounts under
    //   /local/content/docker_apps/forge2-tf/data
    // (tabix .gz.tbi files, the SQLite SNP-filter DB, and motif-logos).
    // Fargate has no persistent host disk, so that data lives on an EFS
    // filesystem mounted into the task at /deploy/data.
    //
    // The filesystem itself (plus its mount targets, security group and the
    // NFS/2049 ingress from the task security group) is provisioned by the
    // platform team OUTSIDE this app deploy and passed in as EFS_ID. This stack
    // creates only the two scoped access points and resolves their IDs to SSM,
    // matching pimixture / ezQTL / mSigPortal / linkage. The real task
    // definition (web.yml, rendered by deploy-app) does the IAM-auth mount.
    // -------------------------------------------------------------------------

    // Primary data access point → the application mounts this at /deploy/data.
    const accessPoint = new efs.CfnAccessPoint(this, "DataAccessPoint", {
      fileSystemId: efsId,
      posixUser: { uid: posixUid.toString(), gid: posixGid.toString() },
      rootDirectory: {
        path: "/data",
        creationInfo: {
          ownerUid: posixUid.toString(),
          ownerGid: posixGid.toString(),
          permissions: "0755",
        },
      },
      accessPointTags: [
        { key: "Name", value: `${tier}-${appName}-data-ap` },
        { key: "ApplicationName", value: appName },
        { key: "Project", value: "dceg-analysistools" },
        { key: "CreatedBy", value: "cdk" },
        { key: "EnvironmentTier", value: tier.toUpperCase() },
        { key: "ResourceFunction", value: "efs" },
      ],
    });

    // Second access point scoped to just the motif-logos subdirectory, which the
    // frontend mounts read-only into its served assets path. EFS mount points
    // cannot target a subpath of a volume, so a dedicated access point is used.
    const motifLogosAccessPoint = new efs.CfnAccessPoint(
      this,
      "MotifLogosAccessPoint",
      {
        fileSystemId: efsId,
        posixUser: { uid: posixUid.toString(), gid: posixGid.toString() },
        rootDirectory: {
          path: "/data/motif-logos",
          creationInfo: {
            ownerUid: posixUid.toString(),
            ownerGid: posixGid.toString(),
            permissions: "0755",
          },
        },
        accessPointTags: [
          { key: "Name", value: `${tier}-${appName}-motif-logos-ap` },
          { key: "ApplicationName", value: appName },
          { key: "Project", value: "dceg-analysistools" },
          { key: "CreatedBy", value: "cdk" },
          { key: "EnvironmentTier", value: tier.toUpperCase() },
          { key: "ResourceFunction", value: "efs" },
        ],
      }
    );

    // CloudWatch log group
    const logGroup = new logs.LogGroup(this, "WebLogGroup", {
      logGroupName: `/${appNamespace}/${tier}/${appName}/web`,
      retention: logs.RetentionDays.SIX_MONTHS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // -------------------------------------------------------------------------
    // Placeholder task definition.
    //
    // As in the analysistools-portal reference stack, the real task definition
    // (frontend + backend + firelens, with the EFS volume) is rendered and
    // registered by the deploy-app GitHub workflow from .github/aws/web.yml.
    // This placeholder only exists so the service can be created/updated by CDK;
    // the CfnService override below pins the service to the task-definition
    // *family* so CDK never reverts the workflow-registered revision.
    // -------------------------------------------------------------------------
    const taskDef = new ecs.FargateTaskDefinition(this, "WebTaskDef", {
      family: `${tier}-${appName}-${appService}`,
      cpu: props.cpu,
      memoryLimitMiB: props.memory,
      executionRole,
      taskRole,
    });

    // The placeholder mounts no EFS volumes — the real task definition rendered
    // by deploy-app (web.yml) declares the `data` / `motif-logos` volumes and
    // mounts via the access-point IDs published to SSM below.
    taskDef.addContainer("WebContainer", {
      containerName: "frontend",
      image: ecs.ContainerImage.fromRegistry("nginx:alpine"),
      essential: true,
      portMappings: [
        {
          containerPort: props.containerPort,
          hostPort: props.containerPort,
          protocol: ecs.Protocol.TCP,
        },
      ],
      logging: ecs.LogDrivers.awsLogs({
        logGroup,
        streamPrefix: "frontend",
      }),
    });

    // Target group
    const tg = new elbv2.ApplicationTargetGroup(this, "WebTG", {
      targetGroupName: `${tier}-${appName}-${appService}`,
      port: props.containerPort,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      vpc,
      healthCheck: {
        enabled: true,
        path: healthCheckPath,
        port: String(props.containerPort),
        healthyHttpCodes: "200-499",
      },
    });

    // ALB listener rule: route the app's host + path prefix to this service.
    listener.addTargetGroups("WebListenerRule", {
      targetGroups: [tg],
      conditions: [
        elbv2.ListenerCondition.hostHeaders([appDomain]),
        elbv2.ListenerCondition.pathPatterns([
          appPathPrefix,
          `${appPathPrefix}/*`,
        ]),
      ],
      priority: listenerRulePriority,
    });

    // Fargate service
    const service = new ecs.FargateService(this, "WebService", {
      serviceName: `${tier}-${appName}-${appService}`,
      cluster,
      taskDefinition: taskDef,
      desiredCount: props.desiredCount,
      securityGroups,
      vpcSubnets: { subnets },
      assignPublicIp: false,
      enableECSManagedTags: true,
      enableExecuteCommand: true,
      circuitBreaker: { rollback: true },
      healthCheckGracePeriod: cdk.Duration.seconds(gracePeriod),
      propagateTags: ecs.PropagatedTagSource.TASK_DEFINITION,
    });

    service.attachToApplicationTargetGroup(tg);

    // Prevent CDK from reverting task definitions registered by deploy-app workflow
    const cfnService = service.node.defaultChild as ecs.CfnService;
    cfnService.addPropertyOverride(
      "TaskDefinition",
      `${tier}-${appName}-${appService}`
    );
    cfnService.addPropertyDeletionOverride("DesiredCount");

    // Scheduled auto-scaling (non-prod: scale to 0 nights/weekends)
    if (props.nonProdSchedule) {
      const scalable = service.autoScaleTaskCount({
        minCapacity: 0,
        maxCapacity: props.scheduledMaxCapacity,
      });

      scalable.scaleOnSchedule("ScaleOut", {
        schedule: appscaling.Schedule.cron({
          hour: "7",
          minute: "0",
          weekDay: "MON-FRI",
        }),
        minCapacity: props.scheduledMinCapacity,
        maxCapacity: props.scheduledMaxCapacity,
        timeZone: cdk.TimeZone.AMERICA_NEW_YORK,
      });

      scalable.scaleOnSchedule("ScaleIn", {
        schedule: appscaling.Schedule.cron({
          hour: "19",
          minute: "0",
          weekDay: "MON-FRI",
        }),
        minCapacity: 0,
        maxCapacity: 0,
        timeZone: cdk.TimeZone.AMERICA_NEW_YORK,
      });
    }

    // SSM parameters for deploy-app workflow
    new ssm.StringParameter(this, "SsmEcsCluster", {
      parameterName: `/${appNamespace}/${tier}/${appName}/ecs_cluster`,
      stringValue: clusterName,
    });

    new ssm.StringParameter(this, "SsmEcsWebTask", {
      parameterName: `/${appNamespace}/${tier}/${appName}/ecs_web_task`,
      stringValue: `${tier}-${appName}-${appService}`,
    });

    new ssm.StringParameter(this, "SsmEcsWebService", {
      parameterName: `/${appNamespace}/${tier}/${appName}/ecs_web_service`,
      stringValue: `${tier}-${appName}-${appService}`,
    });

    new ssm.StringParameter(this, "SsmRoleArn", {
      parameterName: `/${appNamespace}/${tier}/${appName}/role_arn`,
      stringValue: appRoleArn,
    });

    new ssm.StringParameter(this, "SsmEfsFileSystemId", {
      parameterName: `/${appNamespace}/${tier}/${appName}/efs_file_system_id`,
      stringValue: efsId,
    });

    new ssm.StringParameter(this, "SsmEfsAccessPointId", {
      parameterName: `/${appNamespace}/${tier}/${appName}/efs_access_point_id`,
      stringValue: accessPoint.attrAccessPointId,
    });

    new ssm.StringParameter(this, "SsmEfsMotifLogosAccessPointId", {
      parameterName: `/${appNamespace}/${tier}/${appName}/efs_motif_logos_access_point_id`,
      stringValue: motifLogosAccessPoint.attrAccessPointId,
    });

    // Stack outputs
    new cdk.CfnOutput(this, "WebServiceName", {
      value: service.serviceName,
      description: "ECS Service Name",
    });

    new cdk.CfnOutput(this, "WebTaskDefArn", {
      value: taskDef.taskDefinitionArn,
      description: "Task Definition ARN",
    });

    new cdk.CfnOutput(this, "TargetGroupArn", {
      value: tg.targetGroupArn,
      description: "Target Group ARN",
    });

    new cdk.CfnOutput(this, "EfsFileSystemId", {
      value: efsId,
      description: "EFS File System ID (stage data into the /data access point)",
    });

    new cdk.CfnOutput(this, "EfsAccessPointId", {
      value: accessPoint.attrAccessPointId,
      description: "EFS Access Point ID",
    });
  }
}
