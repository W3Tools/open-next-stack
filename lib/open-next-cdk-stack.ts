import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CreateNextFoundationStack } from './creators/create-next-foundation';

export class OpenNextCdkStack extends cdk.Stack {
    constructor(scope: Construct, stackName: string, props: cdk.StackProps) {
        super(scope, stackName, props);

        new CreateNextFoundationStack(this, `${stackName}-next-foundation`, {
            rootId: stackName,
        });
    }
}
