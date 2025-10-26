import {z} from 'zod';
import {IntegrationType, ProviderType, ServiceType, Role, SecretType} from './types';

const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const hostnameRegex = /^(?![\d.]+$)(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
const isValidHostnameOrIP = (value: string): boolean => ipRegex.test(value) || hostnameRegex.test(value);

export const CreateProviderSchema = z.object({
    name: z.string().min(1, 'Provider name is required'),
    providerIP: z.string().min(1, "Hostname/IP is required").refine((value) => {
        return isValidHostnameOrIP(value);
    }, {
        message: "Must be a valid IP address or hostname"
    }).optional(),
    username: z.string().min(1, 'Username is required').optional(),
    secretId: z.number().optional(),
    password: z.string().min(1, 'Password is required').optional(),
    SSHPort: z.number().int().min(1).max(65535).optional().default(22),
    providerType: z.nativeEnum(ProviderType),
}).refine(data => data.secretId || data.password, {
    message: "Either secret ID or password is required",
    path: ["secretId"],
});

export const CreateProviderBulkSchema = z.object({
    providers: z.array(CreateProviderSchema).min(1, 'At least one provider is required'),
});

export const CreateIntegrationSchema = z.object({
    name: z.string().min(1),
    type: z.nativeEnum(IntegrationType),
    externalUrl: z.string().url(),
     credentials: z.object({
        apiKey: z.string().refine(
            (val) => !/\s/.test(val),
            { message: 'API key cannot contain spaces' }
        ).optional(),
        appKey: z.string().refine(
            (val) => !/\s/.test(val),
            { message: 'Application key cannot contain spaces' }
        ).optional(),
    }).passthrough(),
});

export type Integration = z.infer<typeof CreateIntegrationSchema> & {
    id: number;
    createdAt: string;
};

export type IntegrationResponse = Omit<Integration, 'credentials'>;

export const IntegrationTagsquerySchema = z.object({
    tags: z.union([z.string(), z.array(z.string())]),
});

export const AddBulkServiceSchema = z.array(
    z.object({
        name: z.string().min(1, 'Name is required'),
        serviceIP: z.string().min(1, "Hostname/IP is required").refine((value) => {
            return isValidHostnameOrIP(value);
        }, {
            message: "Must be a valid IP address or hostname"
        }).optional(),
        serviceStatus: z.string().min(1),
        serviceType: z.nativeEnum(ServiceType),
    })
)

export const ProviderIdSchema = z.object({
    providerId: z.string().transform((val) => {
        const parsed = parseInt(val);
        if (isNaN(parsed)) {
            throw new Error('Invalid provider ID');
        }
        return parsed;
    })
});

export const ServiceSchema = z.object({
    providerId: z.number(),
    name: z.string().min(1, 'Service name is required'),
    serviceIP: z.string().optional(),
    serviceStatus: z.string(),
    serviceType: z.nativeEnum(ServiceType),
    containerDetails: z.object({
        id: z.string().optional(),
        image: z.string().optional(),
        created: z.string().optional(),
        namespace: z.string().optional(),
    }).optional(),
});

export const CreateServiceSchema = ServiceSchema;

export const UpdateServiceSchema = ServiceSchema.partial().extend({
    id: z.number()
});

export const ServiceIdSchema = z.object({
    serviceId: z.string().transform((val) => {
        const parsed = parseInt(val);
        if (isNaN(parsed)) {
            throw new Error('Invalid service ID');
        }
        return parsed;
    })
});

export const TagSchema = z.object({
    name: z.string().min(1, 'Tag name is required').max(50, 'Tag name must be less than 50 characters'),
    color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color')
});

export const CreateTagSchema = TagSchema;

export const UpdateTagSchema = TagSchema.partial().extend({
    id: z.number()
});

export const ServiceTagSchema = z.object({
    serviceId: z.number(),
    tagId: z.number()
});

export const TagIdSchema = z.object({
    tagId: z.string().transform((val) => {
        const parsed = parseInt(val);
        if (isNaN(parsed)) {
            throw new Error('Invalid tag ID');
        }
        return parsed;
    })
});

export const RoleSchema = z.nativeEnum(Role);

export const UserSchema = z.object({
    id: z.number(),
    email: z.string().email(),
    fullName: z.string(),
    role: RoleSchema,
    createdAt: z.string(),
});

export const CreateUserSchema = z.object({
    email: z.string().email(),
    fullName: z.string().min(1),
    password: z.string().min(6),
    role: RoleSchema
});

export const UpdateUserRoleSchema = z.object({
    email: z.string().email(),
    newRole: RoleSchema
});

export const RegisterSchema = CreateUserSchema.omit({role: true});

export const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6)
});

export const UpdateProfileSchema = z.object({
    fullName: z.string().min(1, 'Full name is required'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters').optional()
});


export const CreateSecretsMetadataSchema = z.object({
    displayName: z.string().min(1, 'Secret name is required'),
    secretType: z.nativeEnum(SecretType).optional().default(SecretType.SSH),
})

export const UpdateSecretsMetadataSchema = z.object({
    displayName: z.string().min(1, 'Secret name is required').optional(),
    secretType: z.nativeEnum(SecretType).optional(),
})

export const CreateApiKeySchema = z.object({
    name: z.string()
        .min(1, 'API key name is required')
        .max(100, 'API key name must be less than 100 characters')
        .trim()
        .refine((val) => val.length > 0, { message: 'API key name cannot be empty or whitespace only' }),
    expiresAt: z.string()
        .optional()
        .transform((val) => {
            if (!val) return undefined;
            // Handle datetime-local format (YYYY-MM-DDTHH:mm) by adding seconds and timezone
            if (val && val.length === 16 && !val.includes('Z') && !val.includes('+') && !val.includes('.')) {
                return val + ':00.000Z';
            }
            // Return as-is if it's already in ISO format
            return val;
        })
        .refine((val) => {
            if (!val) return true;
            const expirationDate = new Date(val);
            if (isNaN(expirationDate.getTime())) return false;
            const now = new Date();
            return expirationDate > now;
        }, { message: 'Expiration date must be a valid date in the future' }),
});

export const ApiKeyIdSchema = z.object({
    apiKeyId: z.string().transform((val) => {
        const parsed = parseInt(val);
        if (isNaN(parsed) || parsed < 1) {
            throw new Error('Invalid API key ID');
        }
        return parsed;
    })
});

export const UpdateApiKeySchema = z.object({
    name: z.string()
        .min(1, 'API key name is required')
        .max(100, 'API key name must be less than 100 characters')
        .trim()
        .refine((val) => val.length > 0, { message: 'API key name cannot be empty or whitespace only' })
        .optional(),
    isActive: z.boolean().optional(),
}).refine((data) => {
    // At least one field must be provided
    return data.name !== undefined || data.isActive !== undefined;
}, { message: 'At least one field (name or isActive) must be provided for update' });


export type UserSchemaType = z.infer<typeof UserSchema>;
export type CreateUserRequest = z.infer<typeof CreateUserSchema>;
export type UpdateUserRoleRequest = z.infer<typeof UpdateUserRoleSchema>;
export type UpdateProfileRequest = z.infer<typeof UpdateProfileSchema>;

export type CreateProviderRequest = z.infer<typeof CreateProviderSchema>;
export type CreateProviderBulkRequest = z.infer<typeof CreateProviderBulkSchema>;
export type AddBulkServiceRequest = z.infer<typeof AddBulkServiceSchema>;
export type ProviderIdParams = z.infer<typeof ProviderIdSchema>;

export type CreateSecretRequest = z.infer<typeof CreateSecretsMetadataSchema>;
export type UpdateSecretRequest = z.infer<typeof UpdateSecretsMetadataSchema>;

export type CreateApiKeyRequest = z.infer<typeof CreateApiKeySchema>;
export type ApiKeyIdParams = z.infer<typeof ApiKeyIdSchema>;
export type UpdateApiKeyRequest = z.infer<typeof UpdateApiKeySchema>;
