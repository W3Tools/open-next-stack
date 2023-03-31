#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StackConfig } from '../lib/configs/basic.config';
import { OpenNextCdkStack } from '../lib/open-next-cdk-stack';

const app = new cdk.App();
new OpenNextCdkStack(app, StackConfig.stackName, {
    description: StackConfig.description,
    env: { account: StackConfig.accountId, region: StackConfig.region },
});
