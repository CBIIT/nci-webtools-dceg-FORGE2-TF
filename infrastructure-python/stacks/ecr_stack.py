"""ECR repository stack for FORGE2-TF (Python CDK).

A 1:1 port of infrastructure/lib/ecr-stack.ts.
"""
from aws_cdk import (
    Stack,
    Tags,
    RemovalPolicy,
    CfnOutput,
    Environment,
    aws_ecr as ecr,
    aws_iam as iam,
)
from constructs import Construct


class EcrStack(Stack):
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
        ecr_repo_name: str,
        ecr_count_number: int,
    ) -> None:
        super().__init__(
            scope,
            construct_id,
            env=env,
            stack_name=stack_name,
            description=description,
        )

        Tags.of(self).add("EnvironmentTier", tier)
        Tags.of(self).add("ResourceName", f"{tier}-{app_name}-ecr")
        Tags.of(self).add("ManagedBy", "cdk")
        Tags.of(self).add("CreatedBy", "cdk")
        Tags.of(self).add("Project", "dceg-analysistools")
        Tags.of(self).add("ApplicationName", app_name)

        if tier in ("dev", "stage"):
            repo = ecr.Repository(
                self,
                "EcrRepo",
                repository_name=ecr_repo_name,
                image_scan_on_push=True,
                image_tag_mutability=ecr.TagMutability.MUTABLE,
                removal_policy=RemovalPolicy.RETAIN,
            )

            repo.add_to_resource_policy(
                iam.PolicyStatement(
                    sid="LambdaAccess",
                    effect=iam.Effect.ALLOW,
                    principals=[iam.ServicePrincipal("lambda.amazonaws.com")],
                    actions=["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"],
                )
            )

            if tier == "dev":
                repo.add_lifecycle_rule(
                    description=f"Keep last {ecr_count_number} images",
                    max_image_count=ecr_count_number,
                    rule_priority=1,
                    tag_status=ecr.TagStatus.ANY,
                )

            CfnOutput(self, "EcrRepoUri", value=repo.repository_uri)
