import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { StackConfig } from '../configs/basic.config';
import { aws_lambda as lambda, aws_s3 as S3, aws_cloudfront as cloudfront, aws_route53 as route53, aws_certificatemanager as acm } from 'aws-cdk-lib';

export class BasicStack {
    private scope: Construct;
    public policies: CachePolicies;
    private region: string;

    constructor(scope: Construct, region?: string) {
        this.scope = scope;
        this.region = region ? region : StackConfig.region;
        this.policies = this.createCachePolicy();
    }

    /**
     * Global Cloudfront Cache Policy Group
     * @returns CachePolicies
     */
    createCachePolicy(): CachePolicies {
        const apiCacheName = 'open-next-api-cache-policy';
        const apiCacheHeader = cloudfront.CacheHeaderBehavior.allowList('x-op-middleware-response-headers', 'x-middleware-prefetch', 'x-nextjs-data', 'x-op-middleware-request-headers');
        const apiCachePolicy = new cloudfront.CachePolicy(this.scope, apiCacheName, {
            cachePolicyName: apiCacheName,
            headerBehavior: apiCacheHeader,
        });

        const nextDataCacheName = 'open-next-next-data-cache-policy';
        const nextDataCacheHeader = cloudfront.CacheHeaderBehavior.allowList('x-op-middleware-response-headers', 'x-middleware-prefetch', 'x-nextjs-data', 'x-op-middleware-request-headers');
        const nextDataCachePolicy = new cloudfront.CachePolicy(this.scope, nextDataCacheName, {
            cachePolicyName: nextDataCacheName,
            headerBehavior: nextDataCacheHeader,
        });

        const nextImageCacheName = 'open-next-next-image-cache-policy';
        const nextImageCacheHeader = cloudfront.CacheHeaderBehavior.allowList('Accept');
        const nextImageCacheQueryString = cloudfront.CacheQueryStringBehavior.all();
        const nextImageCachePolicy = new cloudfront.CachePolicy(this.scope, nextImageCacheName, {
            cachePolicyName: nextImageCacheName,
            headerBehavior: nextImageCacheHeader,
            queryStringBehavior: nextImageCacheQueryString,
        });

        return {
            api: apiCachePolicy,
            nextData: nextDataCachePolicy,
            nextImage: nextImageCachePolicy,
        };
    }

    /**
     * Create a secure s3 storage bucket
     * @param struct
     * @returns Bucket Object
     */
    createBucket(struct: CreateBucketStruct): S3.Bucket {
        const bucketName = `${struct.bucketName}-stack`;

        const props: S3.BucketProps = {
            bucketName: bucketName,
            objectOwnership: struct.objectOwnership ? struct.objectOwnership : S3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
            blockPublicAccess: struct.publicAccess ? struct.publicAccess : S3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            cors: [
                {
                    allowedMethods: [S3.HttpMethods.GET, S3.HttpMethods.HEAD, S3.HttpMethods.POST],
                    allowedOrigins: ['*'],
                    allowedHeaders: ['*'],
                    exposedHeaders: ['x-amz-server-side-encryption', 'x-amz-request-id', 'x-amz-id-2'],
                },
            ],
        };

        const s3Bucket = new S3.Bucket(this.scope, `${bucketName}-bucket`, props);
        return s3Bucket;
    }

    /**
     * Create an empty lambda function
     * @param struct
     * @returns Lambda Object
     */
    createLambdaFunc(struct: ILambdaFunctionStruct): lambda.Function {
        const props: lambda.FunctionProps = {
            runtime: struct.runtime ? struct.runtime : lambda.Runtime.NODEJS_18_X,
            code: new lambda.InlineCode('foo'), // Create an empty lambda function
            handler: 'index.handler', // To use this handler, the code needs to be compatible with this format
            functionName: struct.name,
            memorySize: struct.memory ? struct.memory : 512,
            timeout: Duration.seconds(struct.timeout ? struct.timeout : 10),
            architecture: struct.architecture ? struct.architecture : lambda.Architecture.X86_64,
            environment: struct.env ? struct.env : {},
        };

        const lambdaFunc = new lambda.Function(this.scope, `${struct.name}-lambda`, props);
        return lambdaFunc;
    }

    /**
     * Create a default cloudfront distribution
     * @param struct
     * @returns Cloudfront Distribution Object
     */
    createCloudFront(struct: ICloudFrontStruct): cloudfront.Distribution {
        const props: cloudfront.DistributionProps = {
            defaultBehavior: {
                origin: struct.origin,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            },
            certificate: struct.cert,
            domainNames: struct.alias,
        };

        const cf = new cloudfront.Distribution(this.scope, `${struct.name}-cloudfront`, props);
        return cf;
    }

    /**
     * Create cname record, like app-v1.w3tools.app ---CNAME---> app.w3tools.app
     * @param zone
     * @param src Such as app-v1.w3tools.app
     * @param dist Such as app.w3tools.app
     * @param ttl Default 60s
     * @returns
     */
    createRoute53Cname(zone: route53.IHostedZone, src: string, dist: string, ttl?: number): route53.CnameRecord {
        const record = new route53.CnameRecord(this.scope, `${src}-route53`, {
            zone: zone,
            recordName: src,
            domainName: dist,
            ttl: Duration.seconds(ttl ? ttl : 60),
        });
        return record;
    }
}

export interface CachePolicies {
    api: cloudfront.CachePolicy;
    nextData: cloudfront.CachePolicy;
    nextStatic?: cloudfront.CachePolicy;
    nextImage: cloudfront.CachePolicy;
}

export interface CreateBucketStruct {
    bucketName: string;
    objectOwnership?: S3.ObjectOwnership;
    publicAccess?: S3.BlockPublicAccess;
}

export interface ILambdaFunctionStruct {
    name: string;
    memory?: number;
    timeout?: number;
    architecture?: lambda.Architecture;
    env?: { [key: string]: string };
    runtime?: lambda.Runtime;
}

export interface ICloudFrontStruct {
    name: string;
    origin: cloudfront.IOrigin;
    alias?: string[];
    cert?: acm.ICertificate;
}
