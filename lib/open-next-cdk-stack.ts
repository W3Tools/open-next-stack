import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ConfigParse } from './common/config-parse';
import { CreateNextFoundationStack } from './creators/create-next-foundation';

export class OpenNextCdkStack extends cdk.Stack {
    constructor(scope: Construct, stackName: string, props: cdk.StackProps) {
        super(scope, stackName, props);

        const obj = new ConfigParse(this);

        const foundation = new CreateNextFoundationStack(this, `${stackName}-next-foundation`, {
            rootId: stackName,
            projects: obj.configs,
        });

        for (const item of foundation.result) {
            new cdk.CfnOutput(this, item.domain, { value: JSON.stringify(item, null, 2) });
        }
    }
}
