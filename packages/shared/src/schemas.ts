import {z} from 'zod';
import {IntegrationType, ProviderType, ServiceType, Role} from './types';

export const CreateProviderSchema = z.object({
    name: z.string().min(1, 'Provider name is required'),
    providerIP: z.string().ip('Invalid IP address').optional(),
    username: z.string().min(1, 'Username is required').optional(),
    privateKeyFilename: z.string().min(1, 'private Key Filename is required').optional(),
    password: z.string().min(1, 'Password is required').optional(),
    SSHPort: z.number().int().min(1).max(65535).optional().default(22),
    providerType: z.nativeEnum(ProviderType),
});

export const CreateProviderBulkSchema = z.object({
    providers: z.array(CreateProviderSchema).min(1, 'At least one provider is required'),
});

export const CreateIntegrationSchema = z.object({
    name: z.string().min(1),
    type: z.nativeEnum(IntegrationType),
    externalUrl: z.string().url(),
    credentials: z.record(z.any()),
});

export type Integration = z.infer<typeof CreateIntegrationSchema> & {
    id: number;
    createdAt: string;
};

export const IntegrationTagsquerySchema = z.object({
    tags: z.union([z.string(), z.array(z.string())]),
});

export const AddBulkServiceSchema = z.array(
    z.object({
        name: z.string().min(1, 'Name is required'),
        serviceIP: z.string().ip('Invalid IP address').optional(),
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
    name: z.string().min(1, 'Secret name is required'),
})


export type UserSchemaType = z.infer<typeof UserSchema>;
export type CreateUserRequest = z.infer<typeof CreateUserSchema>;
export type UpdateUserRoleRequest = z.infer<typeof UpdateUserRoleSchema>;
export type UpdateProfileRequest = z.infer<typeof UpdateProfileSchema>;

export type CreateProviderRequest = z.infer<typeof CreateProviderSchema>;
export type CreateProviderBulkRequest = z.infer<typeof CreateProviderBulkSchema>;
export type AddBulkServiceRequest = z.infer<typeof AddBulkServiceSchema>;
export type ProviderIdParams = z.infer<typeof ProviderIdSchema>;

export type CreateSecretRequest = z.infer<typeof CreateSecretsMetadataSchema>;
