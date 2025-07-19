import {ProviderConnector} from "./providerConnector";
import {ContainerDetails, DiscoveredService, Provider, Service, ServiceType} from "@service-peek/shared";
import {deleteK8RPod, getK8RLogs, getK8SServices} from "../../../dal/kubeConnector";

export class K8SProviderConnector implements ProviderConnector {
    async getServiceLogs(provider: Provider, service: Service): Promise<string[]> {
        return [await getK8RLogs(provider, service.name, service.containerDetails?.namespace || 'default')];
    }

    startService(_: Provider, _2: string, _3?: ServiceType): Promise<void> {
        throw new Error("Method not implemented.");
    }

    stopService(provider: Provider, serviceName: string, _3?: ServiceType, containerDetails?: ContainerDetails): Promise<void> {
        return deleteK8RPod(provider, serviceName, containerDetails?.namespace || 'default');
    }

    async discoverServices(provider: Provider): Promise<DiscoveredService[]> {
        return getK8SServices(provider);
    }

    testConnection(_: Provider): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
}