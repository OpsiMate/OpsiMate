import {
	S3Client as AwsS3Client,
	CreateBucketCommand,
	HeadBucketCommand,
	DeleteObjectCommand,
	PutObjectCommand,
	GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Logger } from '@OpsiMate/shared';
import { getStorageConfig } from '../../config/config';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger('dal/s3-client');

// Allowed content types for avatar uploads
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png'];

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Upload URL expiry: 5 minutes
const UPLOAD_URL_EXPIRY_SECONDS = 5 * 60;

// View URL expiry: 24 hours
const VIEW_URL_EXPIRY_SECONDS = 24 * 60 * 60;

// Cache TTL: 1 hour (shorter than URL expiry to ensure URLs are always valid)
const CACHE_TTL_MS = 60 * 60 * 1000;

// Maximum cache size to prevent memory issues
const MAX_CACHE_SIZE = 10000;

interface UploadUrlResult {
	uploadUrl: string;
	key: string;
}

interface CachedUrl {
	url: string;
	expiresAt: number;
}

/**
 * S3Client handles file storage operations using AWS S3 or LocalStack.
 * It provides methods for generating presigned URLs for secure uploads/downloads.
 * Includes an in-memory cache for presigned view URLs to improve performance.
 */
export class S3Client {
	private client: AwsS3Client | null = null;
	private publicClient: AwsS3Client | null = null; // Client for generating public-facing presigned URLs
	private storageConfig = getStorageConfig();
	private initialized = false;

	// In-memory cache for presigned view URLs
	// Key: S3 object key, Value: { url, expiresAt }
	private urlCache: Map<string, CachedUrl> = new Map();

	/**
	 * Initializes the S3Client by setting up the AWS S3 client and ensuring the bucket exists.
	 * Must be called before using any other methods.
	 * @returns Promise<void>
	 */
	async initialize(): Promise<void> {
		await this.setupClient();
	}

	/**
	 * Sets up the AWS S3 client if storage configuration is available.
	 * Creates the bucket if it doesn't exist (useful for LocalStack).
	 * @returns Promise<void>
	 */
	private async setupClient(): Promise<void> {
		if (!this.isStorageConfigured()) {
			logger.info('S3Client: Storage config is not available or disabled');
			this.client = null;
			return;
		}

		const s3Config = this.storageConfig?.s3;
		if (!s3Config) {
			logger.info('S3Client: S3 config is not available');
			this.client = null;
			return;
		}

		try {
			// Main client for server-side operations (uses internal endpoint)
			this.client = new AwsS3Client({
				region: s3Config.region,
				endpoint: s3Config.endpoint,
				forcePathStyle: s3Config.forcePathStyle ?? false,
				credentials:
					s3Config.accessKeyId && s3Config.secretAccessKey
						? {
								accessKeyId: s3Config.accessKeyId,
								secretAccessKey: s3Config.secretAccessKey,
							}
						: undefined,
			});

			// Public client for generating presigned URLs (uses public endpoint accessible from browser)
			// Falls back to main endpoint if public endpoint not specified
			const publicEndpoint = s3Config.publicEndpoint || s3Config.endpoint;
			this.publicClient = new AwsS3Client({
				region: s3Config.region,
				endpoint: publicEndpoint,
				forcePathStyle: s3Config.forcePathStyle ?? false,
				credentials:
					s3Config.accessKeyId && s3Config.secretAccessKey
						? {
								accessKeyId: s3Config.accessKeyId,
								secretAccessKey: s3Config.secretAccessKey,
							}
						: undefined,
			});

			// Ensure bucket exists (especially important for LocalStack)
			await this.ensureBucketExists();

			this.initialized = true;
			logger.info(
				`S3Client: Initialized with bucket ${s3Config.bucket}, public endpoint: ${publicEndpoint || 'default'}`
			);
		} catch (error) {
			logger.error('S3Client: Error initializing S3 client', error);
			this.client = null;
			this.publicClient = null;
			this.initialized = false;
		}
	}

	/**
	 * Checks if storage configuration is available and enabled.
	 * @returns boolean
	 */
	private isStorageConfigured(): boolean {
		const storageCfg = this.storageConfig;
		return !!(storageCfg && storageCfg.enabled && storageCfg.s3?.bucket && storageCfg.s3?.region);
	}

	/**
	 * Ensures the S3 bucket exists, creating it if necessary.
	 * This is especially useful for LocalStack development.
	 * Includes retry logic to handle cases where S3 service isn't fully ready.
	 * @returns Promise<void>
	 */
	private async ensureBucketExists(): Promise<void> {
		if (!this.client || !this.storageConfig?.s3?.bucket) {
			return;
		}

		const bucket = this.storageConfig.s3.bucket;
		const maxRetries = 5;
		const retryDelayMs = 2000;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
				logger.info(`S3Client: Bucket ${bucket} already exists`);
				return;
			} catch (error) {
				const errorName = (error as { name?: string }).name;
				const httpStatusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;

				logger.debug(
					`S3Client: HeadBucket attempt ${attempt} - error: ${errorName}, status: ${httpStatusCode}`
				);

				// Bucket doesn't exist - try to create it
				if (errorName === 'NotFound' || httpStatusCode === 404 || httpStatusCode === 403) {
					try {
						await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
						logger.info(`S3Client: Created bucket ${bucket}`);
						return;
					} catch (createError) {
						const createErrorName = (createError as { name?: string }).name;
						// BucketAlreadyOwnedByYou means bucket exists (race condition) - that's fine
						if (
							createErrorName === 'BucketAlreadyOwnedByYou' ||
							createErrorName === 'BucketAlreadyExists'
						) {
							logger.info(`S3Client: Bucket ${bucket} already exists (concurrent creation)`);
							return;
						}
						logger.warn(
							`S3Client: Failed to create bucket ${bucket} on attempt ${attempt}: ${(createError as Error).message}`
						);
						// Continue to retry
					}
				} else if (attempt < maxRetries) {
					// S3 service might not be ready yet, retry
					logger.warn(`S3Client: S3 not ready on attempt ${attempt}, retrying in ${retryDelayMs}ms...`);
					await this.delay(retryDelayMs);
				} else {
					logger.error(`S3Client: Failed to ensure bucket exists after ${maxRetries} attempts`, error);
					throw error;
				}
			}
		}
	}

	/**
	 * Helper to delay execution for retry logic.
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Checks if the S3 client is ready to use.
	 * @returns boolean
	 */
	isReady(): boolean {
		return this.initialized && this.client !== null;
	}

	/**
	 * Validates the content type for avatar uploads.
	 * @param contentType - The MIME type of the file
	 * @returns boolean
	 */
	isValidContentType(contentType: string): boolean {
		return ALLOWED_CONTENT_TYPES.includes(contentType);
	}

	/**
	 * Gets the maximum allowed file size.
	 * @returns number - Maximum file size in bytes
	 */
	getMaxFileSize(): number {
		return MAX_FILE_SIZE;
	}

	/**
	 * Generates the S3 key for an avatar.
	 * @param userId - The user's ID
	 * @param extension - The file extension (jpg, png)
	 * @returns string - The S3 object key
	 */
	private generateAvatarKey(userId: string, extension: string): string {
		const uuid = uuidv4();
		return `avatars/${userId}/${uuid}.${extension}`;
	}

	/**
	 * Gets the file extension from a content type.
	 * @param contentType - The MIME type
	 * @returns string - The file extension
	 */
	private getExtensionFromContentType(contentType: string): string {
		switch (contentType) {
			case 'image/jpeg':
				return 'jpg';
			case 'image/png':
				return 'png';
			default:
				return 'jpg';
		}
	}

	/**
	 * Generates a presigned URL for uploading an avatar.
	 * Uses the public client so the URL is accessible from the browser.
	 * @param userId - The user's ID
	 * @param contentType - The MIME type of the file
	 * @returns Promise<UploadUrlResult> - The presigned upload URL and object key
	 */
	async generateUploadUrl(userId: string, contentType: string): Promise<UploadUrlResult> {
		if (!this.publicClient || !this.storageConfig?.s3?.bucket) {
			throw new Error('S3 client is not initialized');
		}

		if (!this.isValidContentType(contentType)) {
			throw new Error(`Invalid content type. Allowed types: ${ALLOWED_CONTENT_TYPES.join(', ')}`);
		}

		const extension = this.getExtensionFromContentType(contentType);
		const key = this.generateAvatarKey(userId, extension);
		const bucket = this.storageConfig.s3.bucket;

		const command = new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			ContentType: contentType,
		});

		// Use publicClient to generate URL accessible from browser
		const uploadUrl = await getSignedUrl(this.publicClient, command, {
			expiresIn: UPLOAD_URL_EXPIRY_SECONDS,
		});

		logger.info(`S3Client: Generated upload URL for user ${userId}, key: ${key}`);

		return { uploadUrl, key };
	}

	/**
	 * Generates a presigned URL for viewing/downloading an avatar.
	 * Uses an in-memory cache to avoid regenerating URLs on every request.
	 * Uses the public client so the URL is accessible from the browser.
	 * @param key - The S3 object key
	 * @returns Promise<string> - The presigned view URL
	 */
	async generateViewUrl(key: string): Promise<string> {
		if (!this.publicClient || !this.storageConfig?.s3?.bucket) {
			throw new Error('S3 client is not initialized');
		}

		// Check cache first
		const cached = this.urlCache.get(key);
		if (cached && cached.expiresAt > Date.now()) {
			return cached.url;
		}

		// Generate new presigned URL using publicClient for browser accessibility
		const bucket = this.storageConfig.s3.bucket;

		const command = new GetObjectCommand({
			Bucket: bucket,
			Key: key,
		});

		const viewUrl = await getSignedUrl(this.publicClient, command, {
			expiresIn: VIEW_URL_EXPIRY_SECONDS,
		});

		// Cache the URL
		this.cacheUrl(key, viewUrl);

		return viewUrl;
	}

	/**
	 * Caches a presigned URL with TTL.
	 * @param key - The S3 object key
	 * @param url - The presigned URL
	 */
	private cacheUrl(key: string, url: string): void {
		// Evict expired entries if cache is getting large
		if (this.urlCache.size >= MAX_CACHE_SIZE) {
			this.cleanupCache();
		}

		this.urlCache.set(key, {
			url,
			expiresAt: Date.now() + CACHE_TTL_MS,
		});
	}

	/**
	 * Removes expired entries from the cache.
	 */
	private cleanupCache(): void {
		const now = Date.now();
		let deletedCount = 0;

		for (const [key, value] of this.urlCache.entries()) {
			if (value.expiresAt <= now) {
				this.urlCache.delete(key);
				deletedCount++;
			}
		}

		// If still too large after cleanup, remove oldest half
		if (this.urlCache.size >= MAX_CACHE_SIZE) {
			const entriesToDelete = Math.floor(this.urlCache.size / 2);
			const keys = Array.from(this.urlCache.keys()).slice(0, entriesToDelete);
			keys.forEach((key) => this.urlCache.delete(key));
			deletedCount += entriesToDelete;
		}

		if (deletedCount > 0) {
			logger.info(`S3Client: Cleaned up ${deletedCount} cached URLs`);
		}
	}

	/**
	 * Invalidates a cached URL (call when avatar is updated/deleted).
	 * @param key - The S3 object key to invalidate
	 */
	invalidateCachedUrl(key: string): void {
		this.urlCache.delete(key);
	}

	/**
	 * Deletes an object from S3.
	 * @param key - The S3 object key to delete
	 * @returns Promise<void>
	 */
	async deleteObject(key: string): Promise<void> {
		if (!this.client || !this.storageConfig?.s3?.bucket) {
			throw new Error('S3 client is not initialized');
		}

		const bucket = this.storageConfig.s3.bucket;

		await this.client.send(
			new DeleteObjectCommand({
				Bucket: bucket,
				Key: key,
			})
		);

		logger.info(`S3Client: Deleted object ${key}`);
	}
}
