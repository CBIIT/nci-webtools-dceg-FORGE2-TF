import * as cdk from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface EcrStackProps extends cdk.StackProps {
  tier: string;
  appName: string;
  ecrRepoName: string;
  ecrCountNumber: number;
}

export class EcrStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EcrStackProps) {
    super(scope, id, props);

    const { tier, appName, ecrRepoName, ecrCountNumber } = props;

    cdk.Tags.of(this).add("EnvironmentTier", tier);
    cdk.Tags.of(this).add("ResourceName", `${tier}-${appName}-ecr`);
    cdk.Tags.of(this).add("ManagedBy", "cdk");
    cdk.Tags.of(this).add("CreatedBy", "cdk");
    cdk.Tags.of(this).add("Project", "dceg-analysistools");
    cdk.Tags.of(this).add("ApplicationName", appName);

    if (tier === "dev" || tier === "stage") {
      const repo = new ecr.Repository(this, "EcrRepo", {
        repositoryName: ecrRepoName,
        imageScanOnPush: true,
        imageTagMutability: ecr.TagMutability.MUTABLE,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      });

      repo.addToResourcePolicy(
        new iam.PolicyStatement({
          sid: "LambdaAccess",
          effect: iam.Effect.ALLOW,
          principals: [new iam.ServicePrincipal("lambda.amazonaws.com")],
          actions: ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"],
        })
      );

      if (tier === "dev") {
        repo.addLifecycleRule({
          description: `Keep last ${ecrCountNumber} images`,
          maxImageCount: ecrCountNumber,
          rulePriority: 1,
          tagStatus: ecr.TagStatus.ANY,
        });
      }

      new cdk.CfnOutput(this, "EcrRepoUri", { value: repo.repositoryUri });
    }
  }
}
