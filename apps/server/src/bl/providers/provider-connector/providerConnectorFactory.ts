import { ProviderType } from '@OpsiMate/shared';
import {ProviderConnector} from "./providerConnector";
import {VMProviderConnector} from "./vmProviderConnector";
import {K8SProviderConnector} from "./k8sProviderConnector";


export function providerConnectorFactory(type: ProviderType): ProviderConnector {
  return providersMap[type];
}

const providersMap = {
  [ProviderType.VM]: new VMProviderConnector(),
  [ProviderType.K8S]: new K8SProviderConnector(),
}