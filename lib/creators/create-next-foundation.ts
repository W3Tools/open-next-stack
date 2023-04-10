import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IConfig } from '../common/config-parse';
import { BasicStack } from '../common/basic-stack';
import { aws_iam as iam, aws_lambda as lambda, aws_cloudfront as cloudfront, aws_cloudfront_origins as origins, aws_s3 as S3, aws_certificatemanager as acm } from 'aws-cdk-lib';

export interface CreateNextFoundationStackProps extends cdk.NestedStackProps {
    rootId: string;
    projects: IConfig[];
}

export interface NextFoundationResultProps {
    region: string;
    domain: string;
    bucket: string;
    cloudfrontId: string;
    defaultDomain: string;
    customDomain: string[];
    serverFunction: FunctionResultProps;
    imageOptimizationFunction: FunctionResultProps;
}

export interface FunctionResultProps {
    name: string;
    url?: string;
}

export class CreateNextFoundationStack extends cdk.NestedStack {
    private modules: BasicStack;
    private scope: Construct;
    public result: NextFoundationResultProps[] = [];
    private props: CreateNextFoundationStackProps;

    constructor(scope: Construct, id: string, props: CreateNextFoundationStackProps) {
        super(scope, id, props);
        this.scope = scope;
        this.props = props;
        this.modules = new BasicStack(this, this.region);
        this.main();
    }

    main() {
        for (const item of this.props.projects) {
            this.buildFoundation(item);
        }
    }

    /**
     * Create a set of frameworks based on open next deployment
     * Include: S3, server-lambda-function, image-optimization-lambda-function, cloudfront
     * @param name Project name
     */
    buildFoundation(cfg: IConfig) {
        // create aws s3 bucket
        const bucket = this.modules.createBucket({
            bucketName: cfg.name,
        });

        // create server function
        const serverFunc = this.createServerFunction(cfg.name);

        // create image optimization function
        const imageFunc = this.createImageOptimizationFunction(cfg.name, bucket);

        // create cloudfront
        const alias = cfg.certArn ? (cfg.alias ? [cfg.name, ...cfg.alias] : [cfg.name]) : [];
        const cf = this.createCloudFrontDistribution(cfg.name, bucket, serverFunc.url, imageFunc.url, cfg.certArn, alias);

        // create cname
        if (cfg.hostZone) {
            for (const name of alias) {
                this.modules.createRoute53Cname(cfg.hostZone, name, cf.distributionDomainName);
            }
        }

        this.result.push({
            region: this.region,
            domain: cfg.name,
            bucket: bucket.bucketName,
            cloudfrontId: cf.distributionId,
            defaultDomain: cf.distributionDomainName,
            customDomain: alias,
            serverFunction: { name: serverFunc.func.functionName, url: serverFunc.url },
            imageOptimizationFunction: { name: imageFunc.func.functionName, url: imageFunc.url },
        });
    }

    /**
     * Create the server lambda function, Using the base configuration
     * @param name Basic function name
     * @returns
     */
    createServerFunction(name: string) {
        const func = this.modules.createLambdaFunc({
            name: `${name.replaceAll('.', '_')}-server-function`, // like: app.google.com -> app_google_com-server-function
        });

        const funcUrl = func.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });
        return { func: func, url: funcUrl.url };
    }

    /**
     * Create the image optimization lambda function, Using ARM architecture and add an environment variable to identify which storage bucket
     * @param name Basic function name
     * @param bucket
     * @returns
     */
    createImageOptimizationFunction(name: string, bucket: S3.Bucket) {
        const func = this.modules.createLambdaFunc({
            name: `${name.replaceAll('.', '_')}-image-optimization-function`, // like: app.google.com -> app_google_com-image-optimization-function
            architecture: lambda.Architecture.ARM_64, // image-optimization-function using ARM
            env: { BUCKET_NAME: bucket.bucketName },
        });

        func.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['s3:GetObject'],
                resources: [`${bucket.bucketArn}/*`],
            })
        );

        const funcUrl = func.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });
        return { func: func, url: funcUrl.url };
    }

    /**
     * Create a cloudfront distribution based on s3 lambda
     * @param name Basic Project Name
     * @param bucket
     * @param serverFunUrl
     * @param imageFuncUrl
     * @returns
     */
    createCloudFrontDistribution(name: string, bucket: S3.Bucket, serverFunUrl: string, imageFuncUrl: string, cert?: acm.ICertificate, alias?: string[]): cloudfront.Distribution {
        const s3Origin = new origins.S3Origin(bucket);
        const serverFunctionOrigin = new origins.HttpOrigin(cdk.Fn.parseDomainName(serverFunUrl)); // see https://github.com/aws/aws-cdk/issues/20254
        const imageFunctionOrigin = new origins.HttpOrigin(cdk.Fn.parseDomainName(imageFuncUrl));
        const originGroup = new origins.OriginGroup({
            primaryOrigin: s3Origin,
            fallbackOrigin: serverFunctionOrigin,
            fallbackStatusCodes: [400, 403, 404],
        });

        let domain: string[] = [];
        if (alias) {
            for (let item of alias) {
                if (item.startsWith('www.')) {
                    const aliasArr = item.split('.');
                    domain.push(`${aliasArr[1]}.${aliasArr[2]}`);
                }
                domain.push(item);
            }
        }

        const cf = this.modules.createCloudFront({ name: name, origin: originGroup, alias: domain, cert: cert });
        cf.addBehavior('/api/*', serverFunctionOrigin, this.getApiBehaviorOptions(this.modules.policies.api.cachePolicyId));
        cf.addBehavior('/_next/data/*', serverFunctionOrigin, this.getNextDataBehaviorOptions(this.modules.policies.nextData.cachePolicyId));
        cf.addBehavior('/_next/static/*', s3Origin, this.getNextStaticBehaviorOptions());
        cf.addBehavior('/_next/image', imageFunctionOrigin, this.getNextImageBehaviorOptions(this.modules.policies.nextImage.cachePolicyId));

        return cf;
    }

    private getApiBehaviorOptions(id: string): cloudfront.AddBehaviorOptions {
        return {
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: { cachePolicyId: id },
        };
    }

    private getNextDataBehaviorOptions(id: string): cloudfront.AddBehaviorOptions {
        return {
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: { cachePolicyId: id },
        };
    }

    private getNextStaticBehaviorOptions(): cloudfront.AddBehaviorOptions {
        return {
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        };
    }

    private getNextImageBehaviorOptions(id: string): cloudfront.AddBehaviorOptions {
        return {
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: { cachePolicyId: id },
        };
    }
}
