"""ECS Fargate application stack for FORGE2-TF (Python CDK).

A 1:1 port of infrastructure/lib/ecs-app-stack.ts. It imports the shared
VPC / subnets / security groups / cluster / ALB listener / IAM role, provisions
an EFS filesystem (with two access points) for the reference data set, and runs
the app as a Fargate service behind the shared ALB. The real task definition
(frontend + backend + firelens, with the EFS volumes) is rendered and registered
by the deploy-app GitHub workflow from .github/aws/web.yml; the container defined
here is only a placeholder so the service can be created/updated by CDK.
"""
from aws_cdk import (
    Stack,
    Tags,
    Duration,
    RemovalPolicy,
    TimeZone,
    CfnOutput,
    Arn,
    ArnFormat,
    Environment,
    aws_ec2 as ec2,
    aws_ecs as ecs,
    aws_iam as iam,
    aws_logs as logs,
    aws_efs as efs,
    aws_elasticloadbalancingv2 as elbv2,
    aws_ssm as ssm,
    aws_applicationautoscaling as appscaling,
)
from constructs import Construct


class EcsAppStack(Stack):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        env: Environment,
        stack_name: str,
        description: str,
        tier: str,
        app_name: str,
        app_namespace: str,
        app_service: str,
        app_domain: str,
        app_path_prefix: str,
        vpc_id: str,
        subnet_ids: list[str],
        security_group_ids: list[str],
        cluster_arn: str,
        listener_arn: str,
        app_role_arn: str,
        listener_rule_priority: int,
        health_check_path: str,
        grace_period: int,
        cpu: int,
        memory: int,
        desired_count: int,
        container_port: int,
        non_prod_schedule: bool,
        scheduled_min_capacity: int,
        scheduled_max_capacity: int,
    ) -> None:
        super().__init__(
            scope,
            construct_id,
            env=env,
            stack_name=stack_name,
            description=description,
        )

        # Stack-level tags
        Tags.of(self).add("EnvironmentTier", tier)
        Tags.of(self).add("ResourceName", f"{tier}-{app_name}")
        Tags.of(self).add("ManagedBy", "cdk")
        Tags.of(self).add("CreatedBy", "cdk")
        Tags.of(self).add("Project", "dceg-analysistools")
        Tags.of(self).add("ApplicationName", app_name)

        # Import existing shared resources
        vpc = ec2.Vpc.from_lookup(self, "Vpc", vpc_id=vpc_id)

        subnets = [
            ec2.Subnet.from_subnet_id(self, f"Subnet{i}", sid)
            for i, sid in enumerate(subnet_ids)
        ]

        security_groups = [
            ec2.SecurityGroup.from_security_group_id(self, f"SG{i}", sg_id)
            for i, sg_id in enumerate(security_group_ids)
        ]

        cluster_name = Arn.split(
            cluster_arn, ArnFormat.SLASH_RESOURCE_NAME
        ).resource_name
        assert cluster_name is not None
        cluster = ecs.Cluster.from_cluster_attributes(
            self,
            "Cluster",
            cluster_name=cluster_name,
            cluster_arn=cluster_arn,
            vpc=vpc,
            security_groups=security_groups,
        )

        execution_role = iam.Role.from_role_arn(self, "ExecutionRole", app_role_arn)
        task_role = iam.Role.from_role_arn(self, "TaskRole", app_role_arn)

        listener = elbv2.ApplicationListener.from_application_listener_attributes(
            self,
            "Listener",
            listener_arn=listener_arn,
            security_group=security_groups[0],
        )

        # ---------------------------------------------------------------------
        # Persistent storage (EFS) for the FORGE2-TF reference data set.
        #
        # On EC2 the application relied on host bind-mounts under
        #   /local/content/docker_apps/forge2-tf/data
        # (tabix .gz.tbi files, the SQLite SNP-filter DB, and motif-logos).
        # Fargate has no persistent host disk, so that data lives on an EFS
        # filesystem and is mounted into the task at /deploy/data.
        # ---------------------------------------------------------------------
        efs_security_group = ec2.SecurityGroup(
            self,
            "EfsSecurityGroup",
            vpc=vpc,
            description=f"{tier}-{app_name} EFS security group",
            allow_all_outbound=True,
        )

        # Allow NFS (2049) from each application security group attached to the task.
        for i, sg in enumerate(security_groups):
            efs_security_group.add_ingress_rule(
                ec2.Peer.security_group_id(sg.security_group_id),
                ec2.Port.tcp(2049),
                f"Allow NFS from app SG {i}",
            )

        file_system = efs.FileSystem(
            self,
            "DataFileSystem",
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(subnets=subnets),
            security_group=efs_security_group,
            lifecycle_policy=efs.LifecyclePolicy.AFTER_30_DAYS,
            performance_mode=efs.PerformanceMode.GENERAL_PURPOSE,
            throughput_mode=efs.ThroughputMode.BURSTING,
            encrypted=True,
            enable_automatic_backups=(tier == "prod"),
            # Retain data on stack deletion so the reference data set is never lost.
            removal_policy=RemovalPolicy.RETAIN,
            file_system_name=f"{tier}-{app_name}-data",
        )

        access_point = file_system.add_access_point(
            "DataAccessPoint",
            path="/data",
            create_acl=efs.Acl(owner_gid="0", owner_uid="0", permissions="0755"),
            posix_user=efs.PosixUser(gid="0", uid="0"),
        )

        # Second access point scoped to just the motif-logos subdirectory, which the
        # frontend mounts read-only into its served assets path. EFS mount points
        # cannot target a subpath of a volume, so a dedicated access point is used.
        motif_logos_access_point = file_system.add_access_point(
            "MotifLogosAccessPoint",
            path="/data/motif-logos",
            create_acl=efs.Acl(owner_gid="0", owner_uid="0", permissions="0755"),
            posix_user=efs.PosixUser(gid="0", uid="0"),
        )

        # Grant the task role permission to mount/write the EFS access points.
        # APP_ROLE_ARN is the shared analysistools task role, imported above with
        # from_role_arn (mutable by default), so CDK attaches a scoped inline
        # policy for THIS filesystem only -- the same mechanism that already adds
        # the per-app CloudWatch log-group grants to that role. Required because
        # the task definition mounts these access points with IAM authorization
        # (authorization_config.iam = ENABLED) and they run as root (uid/gid 0,
        # hence ClientRootAccess).
        file_system.grant(
            task_role,
            "elasticfilesystem:ClientMount",
            "elasticfilesystem:ClientWrite",
            "elasticfilesystem:ClientRootAccess",
        )

        # CloudWatch log group
        log_group = logs.LogGroup(
            self,
            "WebLogGroup",
            log_group_name=f"/{app_namespace}/{tier}/{app_name}/web",
            retention=logs.RetentionDays.SIX_MONTHS,
            removal_policy=RemovalPolicy.DESTROY,
        )

        # ---------------------------------------------------------------------
        # Placeholder task definition.
        #
        # As in the analysistools-portal reference stack, the real task definition
        # (frontend + backend + firelens, with the EFS volumes) is rendered and
        # registered by the deploy-app GitHub workflow from .github/aws/web.yml.
        # This placeholder only exists so the service can be created/updated by
        # CDK; the CfnService override below pins the service to the task-definition
        # *family* so CDK never reverts the workflow-registered revision.
        # ---------------------------------------------------------------------
        task_def = ecs.FargateTaskDefinition(
            self,
            "WebTaskDef",
            family=f"{tier}-{app_name}-{app_service}",
            cpu=cpu,
            memory_limit_mib=memory,
            execution_role=execution_role,
            task_role=task_role,
        )

        task_def.add_volume(
            name="data",
            efs_volume_configuration=ecs.EfsVolumeConfiguration(
                file_system_id=file_system.file_system_id,
                transit_encryption="ENABLED",
                authorization_config=ecs.AuthorizationConfig(
                    access_point_id=access_point.access_point_id,
                    iam="ENABLED",
                ),
            ),
        )

        task_def.add_volume(
            name="motif-logos",
            efs_volume_configuration=ecs.EfsVolumeConfiguration(
                file_system_id=file_system.file_system_id,
                transit_encryption="ENABLED",
                authorization_config=ecs.AuthorizationConfig(
                    access_point_id=motif_logos_access_point.access_point_id,
                    iam="ENABLED",
                ),
            ),
        )

        placeholder = task_def.add_container(
            "WebContainer",
            container_name="frontend",
            image=ecs.ContainerImage.from_registry("nginx:alpine"),
            essential=True,
            port_mappings=[
                ecs.PortMapping(
                    container_port=container_port,
                    host_port=container_port,
                    protocol=ecs.Protocol.TCP,
                )
            ],
            logging=ecs.LogDrivers.aws_logs(
                log_group=log_group,
                stream_prefix="frontend",
            ),
        )

        placeholder.add_mount_points(
            ecs.MountPoint(
                container_path="/deploy/data",
                source_volume="data",
                read_only=False,
            )
        )

        # Target group
        tg = elbv2.ApplicationTargetGroup(
            self,
            "WebTG",
            target_group_name=f"{tier}-{app_name}-{app_service}",
            port=container_port,
            protocol=elbv2.ApplicationProtocol.HTTP,
            target_type=elbv2.TargetType.IP,
            vpc=vpc,
            health_check=elbv2.HealthCheck(
                enabled=True,
                path=health_check_path,
                port=str(container_port),
                healthy_http_codes="200-499",
            ),
        )

        # ALB listener rule: route the app's host + path prefix to this service.
        listener.add_target_groups(
            "WebListenerRule",
            target_groups=[tg],
            conditions=[
                elbv2.ListenerCondition.host_headers([app_domain]),
                elbv2.ListenerCondition.path_patterns(
                    [app_path_prefix, f"{app_path_prefix}/*"]
                ),
            ],
            priority=listener_rule_priority,
        )

        # Fargate service
        service = ecs.FargateService(
            self,
            "WebService",
            service_name=f"{tier}-{app_name}-{app_service}",
            cluster=cluster,
            task_definition=task_def,
            desired_count=desired_count,
            security_groups=security_groups,
            vpc_subnets=ec2.SubnetSelection(subnets=subnets),
            assign_public_ip=False,
            enable_ecs_managed_tags=True,
            enable_execute_command=True,
            circuit_breaker=ecs.DeploymentCircuitBreaker(rollback=True),
            health_check_grace_period=Duration.seconds(grace_period),
            propagate_tags=ecs.PropagatedTagSource.TASK_DEFINITION,
        )

        service.attach_to_application_target_group(tg)

        # Allow the task to reach the EFS mount targets.
        file_system.connections.allow_default_port_from(service)

        # Prevent CDK from reverting task definitions registered by deploy-app workflow
        cfn_service = service.node.default_child
        cfn_service.add_property_override(
            "TaskDefinition", f"{tier}-{app_name}-{app_service}"
        )
        cfn_service.add_property_deletion_override("DesiredCount")

        # Scheduled auto-scaling (non-prod: scale to 0 nights/weekends)
        if non_prod_schedule:
            scalable = service.auto_scale_task_count(
                min_capacity=0,
                max_capacity=scheduled_max_capacity,
            )

            scalable.scale_on_schedule(
                "ScaleOut",
                schedule=appscaling.Schedule.cron(
                    hour="7", minute="0", week_day="MON-FRI"
                ),
                min_capacity=scheduled_min_capacity,
                max_capacity=scheduled_max_capacity,
                time_zone=TimeZone.AMERICA_NEW_YORK,
            )

            scalable.scale_on_schedule(
                "ScaleIn",
                schedule=appscaling.Schedule.cron(
                    hour="19", minute="0", week_day="MON-FRI"
                ),
                min_capacity=0,
                max_capacity=0,
                time_zone=TimeZone.AMERICA_NEW_YORK,
            )

        # SSM parameters for deploy-app workflow
        ssm.StringParameter(
            self,
            "SsmEcsCluster",
            parameter_name=f"/{app_namespace}/{tier}/{app_name}/ecs_cluster",
            string_value=cluster_name,
        )

        ssm.StringParameter(
            self,
            "SsmEcsWebTask",
            parameter_name=f"/{app_namespace}/{tier}/{app_name}/ecs_web_task",
            string_value=f"{tier}-{app_name}-{app_service}",
        )

        ssm.StringParameter(
            self,
            "SsmEcsWebService",
            parameter_name=f"/{app_namespace}/{tier}/{app_name}/ecs_web_service",
            string_value=f"{tier}-{app_name}-{app_service}",
        )

        ssm.StringParameter(
            self,
            "SsmRoleArn",
            parameter_name=f"/{app_namespace}/{tier}/{app_name}/role_arn",
            string_value=app_role_arn,
        )

        ssm.StringParameter(
            self,
            "SsmEfsFileSystemId",
            parameter_name=f"/{app_namespace}/{tier}/{app_name}/efs_file_system_id",
            string_value=file_system.file_system_id,
        )

        ssm.StringParameter(
            self,
            "SsmEfsAccessPointId",
            parameter_name=f"/{app_namespace}/{tier}/{app_name}/efs_access_point_id",
            string_value=access_point.access_point_id,
        )

        ssm.StringParameter(
            self,
            "SsmEfsMotifLogosAccessPointId",
            parameter_name=(
                f"/{app_namespace}/{tier}/{app_name}/efs_motif_logos_access_point_id"
            ),
            string_value=motif_logos_access_point.access_point_id,
        )

        # Stack outputs
        CfnOutput(
            self,
            "WebServiceName",
            value=service.service_name,
            description="ECS Service Name",
        )

        CfnOutput(
            self,
            "WebTaskDefArn",
            value=task_def.task_definition_arn,
            description="Task Definition ARN",
        )

        CfnOutput(
            self,
            "TargetGroupArn",
            value=tg.target_group_arn,
            description="Target Group ARN",
        )

        CfnOutput(
            self,
            "EfsFileSystemId",
            value=file_system.file_system_id,
            description="EFS File System ID (stage data into the /data access point)",
        )

        CfnOutput(
            self,
            "EfsAccessPointId",
            value=access_point.access_point_id,
            description="EFS Access Point ID",
        )
