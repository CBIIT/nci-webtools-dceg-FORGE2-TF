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
    // filesystem and is mounted into the task at /deploy/data.
    // -------------------------------------------------------------------------
    const efsSecurityGroup = new ec2.SecurityGroup(this, "EfsSecurityGroup", {
      vpc,
      description: `${tier}-${appName} EFS security group`,
      allowAllOutbound: true,
    });

    // Allow NFS (2049) from each application security group attached to the task.
    securityGroups.forEach((sg, i) => {
      efsSecurityGroup.addIngressRule(
        ec2.Peer.securityGroupId(sg.securityGroupId),
        ec2.Port.tcp(2049),
        `Allow NFS from app SG ${i}`
      );
    });

    const fileSystem = new efs.FileSystem(this, "DataFileSystem", {
      vpc,
      vpcSubnets: { subnets },
      securityGroup: efsSecurityGroup,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_30_DAYS,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
      encrypted: true,
      enableAutomaticBackups: tier === "prod",
      // Retain data on stack deletion so the reference data set is never lost.
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      fileSystemName: `${tier}-${appName}-data`,
    });

    const accessPoint = fileSystem.addAccessPoint("DataAccessPoint", {
      path: "/data",
      createAcl: { ownerGid: "0", ownerUid: "0", permissions: "0755" },
      posixUser: { gid: "0", uid: "0" },
    });

    // Second access point scoped to just the motif-logos subdirectory, which the
    // frontend mounts read-only into its served assets path. EFS mount points
    // cannot target a subpath of a volume, so a dedicated access point is used.
    const motifLogosAccessPoint = fileSystem.addAccessPoint(
      "MotifLogosAccessPoint",
      {
        path: "/data/motif-logos",
        createAcl: { ownerGid: "0", ownerUid: "0", permissions: "0755" },
        posixUser: { gid: "0", uid: "0" },
      }
    );

    // Grant the task role permission to mount/write the EFS access points.
    // APP_ROLE_ARN is the shared analysistools task role, imported above with
    // fromRoleArn (mutable by default), so CDK attaches a scoped inline policy
    // for THIS filesystem only — the same mechanism that already adds the
    // per-app CloudWatch log-group grants to that role. Required because the
    // task definition mounts these access points with IAM authorization
    // (authorizationConfig.iam = ENABLED) and they run as root (uid/gid 0,
    // hence ClientRootAccess).
    fileSystem.grant(
      taskRole,
      "elasticfilesystem:ClientMount",
      "elasticfilesystem:ClientWrite",
      "elasticfilesystem:ClientRootAccess"
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

    taskDef.addVolume({
      name: "data",
      efsVolumeConfiguration: {
        fileSystemId: fileSystem.fileSystemId,
        transitEncryption: "ENABLED",
        authorizationConfig: {
          accessPointId: accessPoint.accessPointId,
          iam: "ENABLED",
        },
      },
    });

    taskDef.addVolume({
      name: "motif-logos",
      efsVolumeConfiguration: {
        fileSystemId: fileSystem.fileSystemId,
        transitEncryption: "ENABLED",
        authorizationConfig: {
          accessPointId: motifLogosAccessPoint.accessPointId,
          iam: "ENABLED",
        },
      },
    });

    const placeholder = taskDef.addContainer("WebContainer", {
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

    placeholder.addMountPoints({
      containerPath: "/deploy/data",
      sourceVolume: "data",
      readOnly: false,
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

    // Allow the task to reach the EFS mount targets.
    fileSystem.connections.allowDefaultPortFrom(service);

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
      stringValue: fileSystem.fileSystemId,
    });

    new ssm.StringParameter(this, "SsmEfsAccessPointId", {
      parameterName: `/${appNamespace}/${tier}/${appName}/efs_access_point_id`,
      stringValue: accessPoint.accessPointId,
    });

    new ssm.StringParameter(this, "SsmEfsMotifLogosAccessPointId", {
      parameterName: `/${appNamespace}/${tier}/${appName}/efs_motif_logos_access_point_id`,
      stringValue: motifLogosAccessPoint.accessPointId,
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
      value: fileSystem.fileSystemId,
      description: "EFS File System ID (stage data into the /data access point)",
    });

    new cdk.CfnOutput(this, "EfsAccessPointId", {
      value: accessPoint.accessPointId,
      description: "EFS Access Point ID",
    });
  }
}
