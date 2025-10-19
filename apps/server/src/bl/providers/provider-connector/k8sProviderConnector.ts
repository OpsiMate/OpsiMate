import {ProviderConnector} from "./providerConnector.js";
import {DiscoveredService, Provider, Service, LogOptions} from "@OpsiMate/shared";
import {getK8RLogs, getK8SServices, getK8RPods, restartK8RServicePods} from "../../../dal/kubeConnector.js";
import {DiscoveredPod} from "@OpsiMate/shared";

export class K8SProviderConnector implements ProviderConnector {
    async getServiceLogs(provider: Provider, service: Service, options?: LogOptions): Promise<string[]> {
        return [await getK8RLogs(provider, service.name, service.containerDetails?.namespace || 'default', options)];
    }

    startService(provider: Provider, serviceName: string): Promise<void> {
        return restartK8RServicePods(provider, serviceName)
    }

    getServicePods(provider: Provider, service: Service): Promise<DiscoveredPod[]> {
        return getK8RPods(provider, service);
    }

    stopService(provider: Provider, serviceName: string): Promise<void> {
        return restartK8RServicePods(provider, serviceName)
    }

    async discoverServices(provider: Provider): Promise<DiscoveredService[]> {
        return getK8SServices(provider);
    }

    testConnection(_: Provider): Promise<{success: boolean, error?: string}> {
        return Promise.resolve({ success: false, error: "Kubernetes connection testing is not yet implemented" });
    }
}