import { ProviderType } from '@OpsiMate/shared';
import {ProviderConnector} from "./providerConnector.js";
import {VMProviderConnector} from "./vmProviderConnector.js";
import {K8SProviderConnector} from "./k8sProviderConnector.js";


export function providerConnectorFactory(type: ProviderType): ProviderConnector {
  return providersMap[type];
}

const providersMap = {
  [ProviderType.VM]: new VMProviderConnector(),
  [ProviderType.K8S]: new K8SProviderConnector(),
}