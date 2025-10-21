import {DiscoveredPod, DiscoveredService, Provider, Service, ServiceType} from "@OpsiMate/shared";
import * as sshClient from "../../../dal/sshClient";
import {ProviderConnector} from "./providerConnector";


export class VMProviderConnector implements ProviderConnector {
    async discoverServices(provider: Provider): Promise<DiscoveredService[]> {
        return sshClient.connectAndListContainers(provider);
    }

    async startService(provider: Provider, serviceName: string, serviceType?: ServiceType): Promise<void> {
        if (serviceType === ServiceType.SYSTEMD) {
            return sshClient.startSystemService(provider, serviceName);
        } else {
            // Default to Docker service
            return sshClient.startService(provider, serviceName);
        }
    }

    async stopService(provider: Provider, serviceName: string, serviceType?: ServiceType): Promise<void> {
        if (serviceType === ServiceType.SYSTEMD) {
            return sshClient.stopSystemService(provider, serviceName);
        } else {
            // Default to Docker service
            return sshClient.stopService(provider, serviceName);
        }
    }

    async getServiceLogs(provider: Provider, service: Service): Promise<string[]> {
        if (service.serviceType === ServiceType.SYSTEMD) {
            return sshClient.getSystemServiceLogs(provider, service.name);
        } else {
            // Default to Docker service
            return sshClient.getServiceLogs(provider, service.name);
        }
    }

    async testConnection(provider: Provider): Promise<{success: boolean, error?: string}> {
        return sshClient.testConnection(provider);
    }

    getServicePods(_: Provider, _2: Service): Promise<DiscoveredPod[]> {
        throw new Error("Method not implemented.");
    }
}
