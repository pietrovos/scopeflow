import { App } from 'aws-cdk-lib';
import { ScopeFlowStack } from '../lib/scopeflow-stack.js';

const app = new App();
new ScopeFlowStack(app, 'ScopeFlow', {
  domain: app.node.tryGetContext('domain'),
  certificateArn: app.node.tryGetContext('certificateArn') ?? '',
  mailFrom: app.node.tryGetContext('mailFrom'),
  // Region/account come from the deploying credentials; synth works without any.
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1' },
});
