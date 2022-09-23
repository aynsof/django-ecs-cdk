import ec2 = require('aws-cdk-lib/aws-ec2');
import ecs = require('aws-cdk-lib/aws-ecs');
import ecs_patterns = require('aws-cdk-lib/aws-ecs-patterns');
import ecr = require('aws-cdk-lib/aws-ecr')
import rds = require('aws-cdk-lib/aws-rds')
import secretsmanager = require('aws-cdk-lib/aws-secretsmanager')
import cdk = require('aws-cdk-lib');
import { Construct } from 'constructs';

export class EcsCdkStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC and Fargate Cluster
    // NOTE: Limit AZs to avoid reaching resource quotas
    const vpc = new ec2.Vpc(this, 'MyVpc', { maxAzs: 2 });
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });
    
    const djangoRepo = ecr.Repository.fromRepositoryArn(
      this,
      'django-app-baked',
      'arn:aws:ecr:ap-southeast-2:147655097661:repository/django-app-baked'
    )
    
    const dbUser = "dbUser";
    const dbName = "mydb";
    const engine = rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_12_11 });
    const dbCreds = new rds.DatabaseSecret(this, 'DBSecret', {
      secretName: "/rds/creds/ecs-rds",
      username: dbUser,
    });
    const db = new rds.DatabaseInstance(this, 'RDSInstance', {
      engine,
      vpc,
      credentials: rds.Credentials.fromSecret(dbCreds),
      databaseName: dbName,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.LARGE),
    })

    // Instantiate Fargate Service with just cluster and image
    new ecs_patterns.ApplicationLoadBalancedFargateService(this, "FargateService3", {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(djangoRepo, '20220923'),
        containerPort: 8000,
        environment: {
          RDS_DB_NAME: dbName,
          RDS_USERNAME: dbUser,
          RDS_PASSWORD: dbCreds.secretValue.unsafeUnwrap(),
          RDS_HOSTNAME: db.dbInstanceEndpointAddress,
          RDS_PORT: "5432",
        }
      },
    });
  }
}