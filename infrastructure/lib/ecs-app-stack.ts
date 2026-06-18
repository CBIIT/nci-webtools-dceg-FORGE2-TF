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

    cdk.Tags.of(this).add("EnvironmentTier", tier);
    cdk.Tags.of(this).add("ResourceName", `${tier}-${appName}`);
    cdk.Tags.of(this).add("ManagedBy", "cdk");
    cdk.Tags.of(this).add("CreatedBy", "cdk");
    cdk.Tags.of(this).add("Project", "dceg-analysistools");
    cdk.Tags.of(this).add("ApplicationName", appName);

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

    // EFS access points on the shared, platform-provisioned filesystem. The task
    // role is scoped to these access points, so every EFS volume must mount via an
    // access point (a raw rootDirectory mount is denied at mount time).
    const accessPoint = new efs.CfnAccessPoint(this, "DataAccessPoint", {
      fileSystemId: efsId,
      posixUser: { uid: posixUid.toString(), gid: posixGid.toString() },
      rootDirectory: {
        path: `/${appName}`,
        creationInfo: {
          ownerUid: posixUid.toString(),
          ownerGid: posixGid.toString(),
          permissions: "0777",
        },
      },
      accessPointTags: [
        { key: "Name", value: `${tier}-${appName}` },
        { key: "ApplicationName", value: appName },
        { key: "Project", value: "dceg-analysistools" },
        { key: "CreatedBy", value: "cdk" },
        { key: "EnvironmentTier", value: tier.toUpperCase() },
        { key: "ResourceFunction", value: "efs" },
      ],
    });

    // Dedicated access point for the motif-logos subdirectory. The frontend mounts
    // this read-only; without its own access point the volume can't authorize.
    const motifLogosAccessPoint = new efs.CfnAccessPoint(
      this,
      "MotifLogosAccessPoint",
      {
        fileSystemId: efsId,
        posixUser: { uid: posixUid.toString(), gid: posixGid.toString() },
        rootDirectory: {
          path: `/${appName}/motif-logos`,
          creationInfo: {
            ownerUid: posixUid.toString(),
            ownerGid: posixGid.toString(),
            permissions: "0777",
          },
        },
        accessPointTags: [
          { key: "Name", value: `${tier}-${appName}-motif-logos` },
          { key: "ApplicationName", value: appName },
          { key: "Project", value: "dceg-analysistools" },
          { key: "CreatedBy", value: "cdk" },
          { key: "EnvironmentTier", value: tier.toUpperCase() },
          { key: "ResourceFunction", value: "efs" },
        ],
      }
    );

    const logGroup = new logs.LogGroup(this, "WebLogGroup", {
      logGroupName: `/${appNamespace}/${tier}/${appName}/web`,
      retention: logs.RetentionDays.SIX_MONTHS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Placeholder task definition; the real one is registered by deploy-app from
    // web.yml. The CfnService override below pins the service to the family.
    const taskDef = new ecs.FargateTaskDefinition(this, "WebTaskDef", {
      family: `${tier}-${appName}-${appService}`,
      cpu: props.cpu,
      memoryLimitMiB: props.memory,
      executionRole,
      taskRole,
    });

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
        // healthyHttpCodes omitted — defaults to "200" so a broken SPA returning
        // 4xx is treated as unhealthy and pulled from rotation.
      },
    });

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

    // Let deploy-app own the task-definition revision and desired count.
    const cfnService = service.node.defaultChild as ecs.CfnService;
    cfnService.addPropertyOverride(
      "TaskDefinition",
      `${tier}-${appName}-${appService}`
    );
    cfnService.addPropertyDeletionOverride("DesiredCount");

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
      description: "EFS File System ID",
    });

    new cdk.CfnOutput(this, "EfsAccessPointId", {
      value: accessPoint.attrAccessPointId,
      description: "EFS Access Point ID",
    });

    new cdk.CfnOutput(this, "EfsMotifLogosAccessPointId", {
      value: motifLogosAccessPoint.attrAccessPointId,
      description: "EFS motif-logos Access Point ID",
    });
  }
}
