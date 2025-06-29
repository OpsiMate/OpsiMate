import {DiscoveredService, Provider} from "@service-peek/shared";
import * as sshClient from "../../../dal/sshClient";
import {ProviderConnector} from "./providerConnector";

export class VMProviderConnector implements ProviderConnector {
    async discoverServices(provider: Provider): Promise<DiscoveredService[]> {
        return sshClient.discoverServices(provider);
    }

    async startService(provider: Provider, serviceName: string): Promise<void> {
        return sshClient.startService(provider, serviceName);
    }

    async stopService(provider: Provider, serviceName: string): Promise<void> {
        return sshClient.stopService(provider, serviceName);
    }

    async getServiceLogs(provider: Provider, serviceName: string): Promise<string[]> {
        return sshClient.getServiceLogs(provider, serviceName);
    }

    async testConnection(provider: Provider): Promise<boolean> {
        return sshClient.testConnection(provider);
    }
}
