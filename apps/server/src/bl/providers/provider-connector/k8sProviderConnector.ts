import {ProviderConnector} from "./providerConnector";
import {DiscoveredService, Provider, Service} from "@OpsiMate/shared";
import {getK8RLogs, getK8SServices, getK8RPods, restartK8RServicePods} from "../../../dal/kubeConnector";
import {DiscoveredPod} from "@OpsiMate/shared";

export class K8SProviderConnector implements ProviderConnector {
    async getServiceLogs(provider: Provider, service: Service): Promise<string[]> {
        return [await getK8RLogs(provider, service.name, service.containerDetails?.namespace || 'default')];
    }

    async startService(provider: Provider, serviceName: string): Promise<void> {
        await restartK8RServicePods(provider, serviceName);
    }

    getServicePods(provider: Provider, service: Service): Promise<DiscoveredPod[]> {
        return getK8RPods(provider);
    }

    async stopService(provider: Provider, serviceName: string): Promise<void> {
        await restartK8RServicePods(provider, serviceName);
    }

    async discoverServices(provider: Provider): Promise<DiscoveredService[]> {
        return getK8SServices(provider);
    }

    testConnection(_: Provider): Promise<{success: boolean, error?: string}> {
        return Promise.resolve({ success: false, error: "Kubernetes connection testing is not yet implemented" });
    }
}