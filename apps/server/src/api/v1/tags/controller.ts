import { Request, Response } from 'express';
import { z } from 'zod';
import { CreateTagSchema, UpdateTagSchema, TagIdSchema, ServiceTagSchema, Logger } from '@OpsiMate/shared';
import { TagRepository } from '../../../dal/tagRepository';
import { ServiceRepository } from '../../../dal/serviceRepository'; // can be refactored to use DI as well
import { isZodError } from '../../../utils/isZodError';

import { AlertBL } from '../../../bl/alerts/alert.bl';
const logger = new Logger('api/v1/tags/controller');

export class TagController {
	constructor(
		private tagRepo: TagRepository,
		private serviceRepo: ServiceRepository,
		private alertBL: AlertBL
	) {}

	getAllTagsHandler = async (req: Request, res: Response) => {
		try {
			const tags = await this.tagRepo.getAllTags();
			return res.json({ success: true, data: tags });
		} catch (error) {
			logger.error('Error getting all tags:', error);
			return res.status(500).json({ success: false, error: 'Internal server error' });
		}
	};

	getTagByIdHandler = async (req: Request, res: Response) => {
		try {
			const { tagId } = TagIdSchema.parse({ tagId: req.params.tagId });
			const tag = await this.tagRepo.getTagById(tagId);
			if (!tag) {
				return res.status(404).json({ success: false, error: 'Tag not found' });
			}
			return res.json({ success: true, data: tag });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			} else {
				logger.error('Error getting tag by ID:', error);
				return res.status(500).json({ success: false, error: 'Internal server error' });
			}
		}
	};

	createTagHandler = async (req: Request, res: Response) => {
		try {
			const tagData = CreateTagSchema.parse(req.body);
			const result = await this.tagRepo.createTag(tagData);
			const newTag = await this.tagRepo.getTagById(result.lastID);
			return res.status(201).json({ success: true, data: newTag, message: 'Tag created successfully' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			} else {
				logger.error('Error creating tag:', error);
				return res.status(500).json({ success: false, error: 'Internal server error' });
			}
		}
	};

	updateTagHandler = async (req: Request, res: Response) => {
		try {
			const { tagId } = TagIdSchema.parse({ tagId: req.params.tagId });
			const updateData = UpdateTagSchema.parse({ ...req.body, id: tagId });

			const existingTag = await this.tagRepo.getTagById(tagId);
			if (!existingTag) {
				return res.status(404).json({ success: false, error: 'Tag not found' });
			}

			await this.tagRepo.updateTag(tagId, updateData);
			const updatedTag = await this.tagRepo.getTagById(tagId);

			return res.json({ success: true, data: updatedTag, message: 'Tag updated successfully' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			} else {
				logger.error('Error updating tag:', error);
				return res.status(500).json({ success: false, error: 'Internal server error' });
			}
		}
	};

	deleteTagHandler = async (req: Request, res: Response) => {
		try {
			const { tagId } = TagIdSchema.parse({ tagId: req.params.tagId });

			const existingTag = await this.tagRepo.getTagById(tagId);
			if (!existingTag) {
				return res.status(404).json({ success: false, error: 'Tag not found' });
			}

			await this.tagRepo.deleteTag(tagId);

			return res.json({ success: true, message: 'Tag deleted successfully' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			} else {
				logger.error('Error deleting tag:', error);
				return res.status(500).json({ success: false, error: 'Internal server error' });
			}
		}
	};

	addTagToServiceHandler = async (req: Request, res: Response) => {
		try {
			// Get serviceId from params, tagId from body
			const { serviceId } = req.params;
			const { tagId } = req.body as { tagId: string };
			const parsed = ServiceTagSchema.parse({
				serviceId: Number(serviceId),
				tagId: Number(tagId),
			});

			const service = await this.serviceRepo.getServiceById(parsed.serviceId);
			if (!service) {
				return res.status(404).json({ success: false, error: 'Service not found' });
			}

			const tag = await this.tagRepo.getTagById(parsed.tagId);
			if (!tag) {
				return res.status(404).json({ success: false, error: 'Tag not found' });
			}

			await this.tagRepo.addTagToService(parsed.serviceId, parsed.tagId);
			return res.json({ success: true, message: 'Tag added to service successfully' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			} else {
				logger.error('Error adding tag to service:', error);
				return res.status(500).json({ success: false, error: 'Internal server error' });
			}
		}
	};

	removeTagFromServiceHandler = async (req: Request, res: Response) => {
		try {
			// Get serviceId and tagId from route params
			const { serviceId, tagId } = req.params;
			const parsed = ServiceTagSchema.parse({
				serviceId: Number(serviceId),
				tagId: Number(tagId),
			});

			const tag = await this.tagRepo.getTagById(parsed.tagId);
			if (!tag) {
				return res.status(404).json({ success: false, error: 'Tag not found' });
			}

			await this.tagRepo.removeTagFromService(parsed.serviceId, parsed.tagId);

			return res.json({ success: true, message: 'Tag removed from service successfully' });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			} else {
				logger.error('Error removing tag from service:', error);
				return res.status(500).json({ success: false, error: 'Internal server error' });
			}
		}
	};

	getServiceTagsHandler = async (req: Request, res: Response) => {
		try {
			const { serviceId } = z
				.object({
					serviceId: z.string().transform((val) => {
						const parsed = parseInt(val);
						if (isNaN(parsed)) throw new Error('Invalid service ID');
						return parsed;
					}),
				})
				.parse({ serviceId: req.params.serviceId });

			const tags = await this.tagRepo.getServiceTags(serviceId);
			return res.json({ success: true, data: tags });
		} catch (error) {
			if (isZodError(error)) {
				return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
			} else {
				logger.error('Error getting service tags:', error);
				return res.status(500).json({ success: false, error: 'Internal server error' });
			}
		}
	};
}
