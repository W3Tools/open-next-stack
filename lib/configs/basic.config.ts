import * as dotenv from 'dotenv';
dotenv.config();

export const StackConfig = {
    accountId: process.env.ACCOUNT_ID,
    region: process.env.REGION ? process.env.REGION : 'us-east-1',
    stackName: process.env.STACK_NAME ? process.env.STACK_NAME : 'open-next-stack',
    description: 'The stack includes all the basic frameworks deployed using the open-next application',
};
