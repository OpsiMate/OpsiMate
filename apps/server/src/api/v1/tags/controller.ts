import { Request, Response } from 'express';
import { CreateTagSchema, UpdateTagSchema, TagIdSchema, Logger } from '@OpsiMate/shared';
import { TagRepository } from '../../../dal/tagRepository';
import { isZodError } from '../../../utils/isZodError';

const logger = new Logger('api/v1/tags/controller');

export class TagController {
	constructor(private tagRepo: TagRepository) {}

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
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
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
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
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
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
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
				return res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
			} else {
				logger.error('Error deleting tag:', error);
				return res.status(500).json({ success: false, error: 'Internal server error' });
			}
		}
	};
}
