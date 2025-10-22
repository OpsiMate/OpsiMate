import {Provider, DiscoveredService, Service, ServiceType, ContainerDetails, DiscoveredPod, LogOptions} from "@OpsiMate/shared";

export interface ProviderConnector {
    discoverServices(provider: Provider): Promise<DiscoveredService[]>;

    startService(provider: Provider, serviceName: string, serviceType?: ServiceType): Promise<void>;

    stopService(provider: Provider, serviceName: string, serviceType?: ServiceType, containerDetails?: ContainerDetails): Promise<void>;

    getServiceLogs(provider: Provider, service: Service, options?: LogOptions): Promise<string[]>;

    testConnection(provider: Provider): Promise<{success: boolean, error?: string}>;

    getServicePods(provider: Provider, service: Service): Promise<DiscoveredPod[]>;
}