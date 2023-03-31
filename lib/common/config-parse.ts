import { Construct } from 'constructs';
import { ACMConfig } from '../../ACM_config';
import { ItemConfigs } from '../../item_config';
import { aws_route53 as route53, aws_certificatemanager as acm } from 'aws-cdk-lib';

export class ConfigParse {
    private scope: Construct;
    public configs: IConfig[] = [];

    constructor(scope: Construct) {
        this.scope = scope;
        this.parse();
    }

    parse() {
        const acms: IACM[] = [];
        // build cert and hosted zone
        for (const i of ACMConfig) {
            const zone = route53.HostedZone.fromHostedZoneAttributes(this.scope, `${i.domain}-hosted-zone`, {
                hostedZoneId: i.hostZoneId,
                zoneName: i.domain,
            });
            const cert = acm.Certificate.fromCertificateArn(this.scope, `${i.domain}-acm`, i.certArnString);

            acms.push({
                domain: i.domain,
                hostZone: zone,
                certArn: cert,
            });
        }

        for (const item of ItemConfigs) {
            // Basic config
            const cfg: IConfig = {
                name: item.name,
            };
            if (item.alias) cfg.alias = item.alias;

            // Premium config
            const names = item.name.split('.');
            if (names.length >= 2) {
                const acm = acms.filter((i) => {
                    return i.domain == `${names[names.length - 2]}.${names[names.length - 1]}`;
                });

                if (acm && acm.length > 0) {
                    cfg.hostZone = acm[0].hostZone;
                    cfg.certArn = acm[0].certArn;
                }
            }

            this.configs.push(cfg);
        }
    }
}

export interface IConfig {
    name: string;
    alias?: string[];
    hostZone?: route53.IHostedZone;
    certArn?: acm.ICertificate;
}

export interface IACM {
    domain: string;
    hostZone: route53.IHostedZone;
    certArn: acm.ICertificate;
}
