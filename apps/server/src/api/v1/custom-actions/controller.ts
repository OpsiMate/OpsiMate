import { CustomAction } from '@OpsiMate/custom-actions';
import { Logger } from '@OpsiMate/shared';
import { Request, Response } from 'express';
import { CustomActionBL } from '../../../bl/custom-actions/customAction.bl';
import { providerConnectorFactory } from '../../../bl/providers/provider-connector/providerConnectorFactory';
import { CustomActionRepository } from '../../../dal/customActionRepository';
import { ProviderRepository } from '../../../dal/providerRepository';
import { ServiceRepository } from '../../../dal/serviceRepository';

const logger: Logger = new Logger('api/custom-actions');

export class CustomActionsController {
    constructor(
        private bl: CustomActionBL,
        private providerRepo: ProviderRepository,
        private serviceRepo: ServiceRepository,
        private actionRepo: CustomActionRepository
    ) {
    }

    private isValidBashAction(body: unknown): body is CustomAction {
        if (!body || typeof body !== 'object') return false;
        const b = body as Record<string, unknown>;
        return (
            typeof b.name === 'string' &&
            typeof b.description === 'string' &&
            b.type === 'bash' &&
            ('target' in b ? b.target === 'service' || b.target === 'provider' || b.target === null : true) &&
            ('script' in b ? (b.script === null || typeof b.script === 'string') : true)
        );
    }

    create = async (req: Request, res: Response) => {
        // if (!this.isValidBashAction(req.body)) {
        //     return res.status(400).json({success: false, error: 'Invalid custom action payload'});
        // }
        const id = await this.bl.create(req.body);
        return res.status(201).json({success: true, data: {id}});
    };

    list = async (_: Request, res: Response) => {
        const data = await this.bl.list();
        return res.status(200).json({success: true, data: {actions: data}});
    };

    getById = async (req: Request, res: Response) => {
        const id = Number(req.params.actionId);
        const data = await this.bl.getById(id);
        if (!data) return res.status(404).json({success: false, error: 'Not found'});
        return res.status(200).json({success: true, data});
    };

    update = async (req: Request, res: Response) => {
        const id = Number(req.params.actionId);
        if (!this.isValidBashAction(req.body)) {
            return res.status(400).json({success: false, error: 'Invalid custom action payload'});
        }
        await this.bl.update(id, req.body);
        return res.status(200).json({success: true});
    };

    delete = async (req: Request, res: Response) => {
        const id = Number(req.params.actionId);
        await this.bl.delete(id);
        return res.status(200).json({success: true});
    };

    runForProvider = async (req: Request, res: Response) => {
        const providerId = Number(req.params.providerId);
        const actionId = Number(req.params.actionId);
        const provider = await this.providerRepo.getProviderById(providerId);
        if (!provider) return res.status(404).json({success: false, error: 'Provider not found'});
        const action = await this.actionRepo.getById(actionId);
        if (!action) return res.status(404).json({success: false, error: 'Action not found'});

        const connector = providerConnectorFactory(provider.providerType);
        await connector.runCustomAction(provider, action);
        logger.info(`Ran custom action id=${actionId} on provider id=${providerId}`);
        return res.status(200).json({success: true});
    };

    runForService = async (req: Request, res: Response) => {
        const serviceId = Number(req.params.serviceId);
        const actionId = Number(req.params.actionId);
        const service = await this.serviceRepo.getServiceById(serviceId);
        if (!service) return res.status(404).json({success: false, error: 'Service not found'});
        const provider = await this.providerRepo.getProviderById(service.providerId);
        if (!provider) return res.status(404).json({success: false, error: 'Provider not found'});
        const action = await this.actionRepo.getById(actionId);
        if (!action) return res.status(404).json({success: false, error: 'Action not found'});

        const connector = providerConnectorFactory(provider.providerType);
        await connector.runCustomAction(provider, action, service);
        logger.info(`Ran custom action id=${actionId} on service id=${serviceId}`);
        return res.status(200).json({success: true});
    };


}
