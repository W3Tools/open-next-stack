export interface IACMConfig {
    domain: string;
    hostZoneId: string;
    certArnString: string; // certificates must be in the us-east-1 region
}

export const ACMConfig: IACMConfig[] = [];
