import { Button } from '@/components/ui/button';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { providerApi } from '@/lib/api';
import { getSecretsFromServer } from '@/lib/sslKeys';
import { AddSecretButton } from '@/pages/Settings';
import { zodResolver } from '@hookform/resolvers/zod';
import { Logger, SecretMetadata, ClientProviderType } from '@OpsiMate/shared';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Control, Controller, SubmitHandler, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

const logger = new Logger('ProviderSidebar');

// --- FORM SCHEMAS ---

const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const hostnameRegex =
	/^(?![\d.]+$)(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const isValidHostnameOrIP = (value: string): boolean => ipRegex.test(value) || hostnameRegex.test(value);

const serverSchema = z
	.object({
		name: z.string().min(1, 'Server name is required'),
		hostname: z
			.string()
			.min(1, 'Hostname/IP is required')
			.refine(
				(value) => {
					// Allow both IP addresses and hostnames
					return isValidHostnameOrIP(value);
				},
				{
					message: 'Must be a valid IP address or hostname',
				}
			),
		port: z.coerce.number().min(1).max(65535),
		username: z
			.string()
			.min(1, 'Username is required')
			.refine(
				(value) => {
					return !/\s/.test(value);
				},
				{
					message: 'Username cannot contain whitespace',
				}
			),
		authType: z.enum(['password', 'key']),
		password: z
			.string()
			.refine(
				(value) => {
					if (!value || value.length === 0) return true;
					return !/\s/.test(value);
				},
				{
					message: 'Password cannot contain whitespace',
				}
			)
			.optional(),
		sshKey: z.string().optional(),
	})
	.refine((data) => (data.authType === 'password' ? data.password && data.password.length > 0 : true), {
		message: 'Password is required',
		path: ['password'],
	});

const kubernetesSchema = z.object({
	name: z.string().min(1, 'Cluster name is required'),
	kubeconfigKey: z.string().min(1, 'Kubeconfig key is required'),
	context: z.string().optional(),
});

const awsSchema = z.object({
	name: z.string().min(1, 'Connection name is required'),
	region: z.string().min(1, 'Region is required'),
	accessKeyId: z.string().regex(/^AKIA[0-9A-Z]{16}$/, 'Invalid Access Key ID format'),
	secretAccessKey: z.string().min(1, 'Secret Access Key is required'),
});

const gcpSchema = z.object({
	name: z.string().min(1, 'Connection name is required'),
	projectId: z.string().min(1, 'Project ID is required'),
	zone: z.string().min(1, 'Zone is required'),
	credentialsPath: z.string().min(1, 'Service Account Key Path is required'),
});

const azureSchema = z.object({
	name: z.string().min(1, 'Connection name is required'),
	subscriptionId: z.string().uuid('Invalid Subscription ID'),
	tenantId: z.string().uuid('Invalid Tenant ID'),
	clientId: z.string().uuid('Invalid Client ID'),
	clientSecret: z.string().min(1, 'Client Secret is required'),
	resourceGroup: z.string().min(1, 'Resource Group is required'),
});

type ServerFormData = z.infer<typeof serverSchema>;
type KubernetesFormData = z.infer<typeof kubernetesSchema>;
type AWSFormData = z.infer<typeof awsSchema>;
type GCPFormData = z.infer<typeof gcpSchema>;
type AzureFormData = z.infer<typeof azureSchema>;

type AnyFormData = ServerFormData | KubernetesFormData | AWSFormData | GCPFormData | AzureFormData;

interface ProviderFormProps<T extends AnyFormData> {
	onSubmit: SubmitHandler<T>;
	onClose: () => void;
}

// --- UI COMPONENTS ---

const FormSectionHeader = ({ title }: { title: string }) => (
	<h4 className="text-base font-semibold tracking-tight text-foreground pt-4">{title}</h4>
);

const FieldWrapper = ({ children, error }: { children: React.ReactNode; error?: { message?: string } }) => (
	<div className="space-y-2">
		{children}
		{error && <p className="text-sm text-destructive">{error.message}</p>}
	</div>
);

// --- FORM COMPONENTS ---

const SSHKeySelector = ({ control }: { control: Control<ServerFormData> }) => {
	const [keys, setKeys] = useState<SecretMetadata[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const loadKeys = async () => {
			try {
				const secrets = await getSecretsFromServer();
				// Filter for SSH type secrets only
				const sshSecrets = secrets.filter((secret) => secret.type === 'ssh');
				setKeys(sshSecrets);
				setError(null);
			} catch (err) {
				logger.error('Error loading SSH keys:', err);
				setError('Failed to load SSH keys');
			} finally {
				setLoading(false);
			}
		};
		loadKeys();
	}, []);

	if (loading) {
		return <div className="text-sm text-muted-foreground">Loading keys...</div>;
	}

	if (error) {
		return (
			<div className="space-y-2">
				<div className="text-sm text-destructive">Error loading keys: {error}</div>
			</div>
		);
	}

	if (keys.length === 0) {
		return (
			<div className="space-y-2">
				<div className="text-sm text-muted-foreground">No SSH keys available.</div>
			</div>
		);
	}

	return (
		<Controller
			name="sshKey"
			control={control}
			render={({ field }) => (
				<Select onValueChange={field.onChange} defaultValue={field.value}>
					<SelectTrigger>
						<SelectValue placeholder="Select a key" />
					</SelectTrigger>
					<SelectContent>
						{keys.map((key) => (
							<SelectItem key={key.id} value={key.id.toString()}>
								<b>{key.name}</b>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}
		/>
	);
};

const KubeconfigSelector = ({
	control,
	onSecretCreated,
}: {
	control: Control<KubernetesFormData>;
	onSecretCreated?: (secretId: number) => void;
}) => {
	const [keys, setKeys] = useState<SecretMetadata[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadKeys = async () => {
		try {
			setLoading(true);
			const secrets = await getSecretsFromServer();
			// Filter for kubeconfig type secrets
			const kubeconfigSecrets = secrets.filter(
				(secret) =>
					secret.type === 'kubeconfig' ||
					secret.fileName?.endsWith('.yml') ||
					secret.fileName?.endsWith('.yaml') ||
					secret.fileName?.endsWith('.config')
			);
			setKeys(kubeconfigSecrets);
			setError(null);
		} catch (err) {
			logger.error('Error loading kubeconfig keys:', err);
			setError('Failed to load kubeconfig keys');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadKeys();
	}, []);

	if (loading) {
		return <div className="text-sm text-muted-foreground">Loading kubeconfig keys...</div>;
	}

	if (error) {
		return (
			<div className="space-y-2">
				<div className="text-sm text-destructive">Error loading kubeconfig keys: {error}</div>
			</div>
		);
	}

	if (keys.length === 0) {
		return (
			<div className="space-y-2">
				<div className="text-sm text-muted-foreground">No kubeconfig keys available.</div>
			</div>
		);
	}

	return (
		<Controller
			name="kubeconfigKey"
			control={control}
			render={({ field }) => (
				<Select onValueChange={field.onChange} defaultValue={field.value}>
					<SelectTrigger>
						<SelectValue placeholder="Select a kubeconfig key" />
					</SelectTrigger>
					<SelectContent>
						{keys.map((key) => (
							<SelectItem key={key.id} value={key.id.toString()}>
								<b>{key.name}</b>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}
		/>
	);
};

const ServerForm = ({ onSubmit, onClose }: ProviderFormProps<ServerFormData>) => {
	const {
		control,
		handleSubmit,
		watch,
		setValue,
		formState: { errors, isSubmitting },
	} = useForm<ServerFormData>({
		resolver: zodResolver(serverSchema),
		defaultValues: { port: 22, authType: 'key' },
	});
	const authType = watch('authType');

	// --- Test Connection State ---
	const [testLoading, setTestLoading] = useState(false);
	const [testResult, setTestResult] = useState<null | { ok: boolean; message: string }>(null);
	const [refreshKey, setRefreshKey] = useState(0);

	const handleSecretCreated = (secretId: number) => {
		setRefreshKey((prev) => prev + 1);
	};

	// Helper to get current form values
	const getValues = () => {
		// Use the DOM to get current values (since react-hook-form's getValues is not available here)
		// Instead, we can use the 'watch' function for all fields
		return {
			name: watch('name'),
			hostname: watch('hostname'),
			port: watch('port'),
			username: watch('username'),
			authType: watch('authType'),
			password: watch('password'),
			sshKey: watch('sshKey'),
		};
	};

	const handleTestConnection = async (e: React.MouseEvent) => {
		e.preventDefault();
		setTestResult(null);
		setTestLoading(true);
		// Validate required fields before testing
		const values = getValues();
		if (
			!values.name ||
			!values.hostname ||
			!values.port ||
			!values.username ||
			(values.authType === 'password' && !values.password)
		) {
			setTestResult({
				ok: false,
				message: 'Please fill all required fields before testing connection.',
			});
			setTestLoading(false);
			return;
		}
		try {
			const providerData = {
				name: values.name,
				providerIP: values.hostname,
				username: values.username,
				secretId: values.authType === 'key' && values.sshKey ? parseInt(values.sshKey) : undefined,
				password: values.authType === 'password' ? values.password : undefined,
				SSHPort: values.port,
				providerType: 'VM',
			};
			const response = await providerApi.testProviderConnection(providerData);
			if (response.success && response.data?.isValidConnection) {
				setTestResult({
					ok: true,
					message: 'Successfully connected to the server and verified authentication.',
				});
			} else {
				setTestResult({
					ok: false,
					message:
						response.error || 'Connection test failed. Please check your credentials and network settings.',
				});
			}
		} catch (err: unknown) {
			setTestResult({
				ok: false,
				message: (err as Error)?.message || 'An unexpected error occurred while testing the connection.',
			});
		} finally {
			setTestLoading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
			<FormSectionHeader title="Server Details" />
			<FieldWrapper error={errors.name}>
				<Label htmlFor="name">
					Server Name <span className="text-destructive">*</span>
				</Label>
				<Controller
					name="name"
					control={control}
					render={({ field }) => <Input id="name" placeholder="My Production Server" {...field} />}
				/>
			</FieldWrapper>

			<div className="grid grid-cols-3 gap-4">
				<div className="col-span-2">
					<FieldWrapper error={errors.hostname}>
						<Label htmlFor="hostname">
							Hostname / IP <span className="text-destructive">*</span>
						</Label>
						<Controller
							name="hostname"
							control={control}
							render={({ field }) => <Input id="hostname" placeholder="192.168.1.100" {...field} />}
						/>
					</FieldWrapper>
				</div>
				<FieldWrapper error={errors.port}>
					<Label htmlFor="port">
						SSH Port <span className="text-destructive">*</span>
					</Label>
					<Controller
						name="port"
						control={control}
						render={({ field }) => <Input id="port" type="number" {...field} />}
					/>
				</FieldWrapper>
			</div>

			<FormSectionHeader title="Authentication" />
			<div className="grid grid-cols-2 gap-4">
				<FieldWrapper error={errors.username}>
					<Label htmlFor="username">
						Username <span className="text-destructive">*</span>
					</Label>
					<Controller
						name="username"
						control={control}
						render={({ field }) => <Input id="username" placeholder="root" {...field} />}
					/>
				</FieldWrapper>
				<FieldWrapper error={errors.authType}>
					<Label>Authentication Type</Label>
					<Controller
						name="authType"
						control={control}
						render={({ field }) => (
							<Select onValueChange={field.onChange} defaultValue={field.value}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="password">Password</SelectItem>
									<SelectItem value="key">SSH Key</SelectItem>
								</SelectContent>
							</Select>
						)}
					/>
				</FieldWrapper>
			</div>

			{authType === 'password' && (
				<FieldWrapper error={errors.password}>
					<Label htmlFor="password">
						Password <span className="text-destructive">*</span>
					</Label>
					<Controller
						name="password"
						control={control}
						render={({ field }) => (
							<Input id="password" type="password" placeholder="Enter password" {...field} />
						)}
					/>
				</FieldWrapper>
			)}
			{authType === 'key' && (
				<FieldWrapper error={errors.sshKey}>
					<Label>SSH Key</Label>
					<SSHKeySelector key={refreshKey} control={control} />
					<div className="mt-2">
						<AddSecretButton secretType="ssh" onSecretCreated={handleSecretCreated}>
							<button type="button" className="text-sm text-primary hover:underline">
								+ Add new SSH key
							</button>
						</AddSecretButton>
					</div>
				</FieldWrapper>
			)}

			{/* Test Connection Button and Result */}
			<div className="flex flex-col items-start gap-3 pt-2">
				<Button
					type="button"
					variant="outline"
					onClick={handleTestConnection}
					disabled={testLoading || isSubmitting}
				>
					{testLoading ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Testing...
						</>
					) : (
						'Test Connection'
					)}
				</Button>
				{testResult && (
					<div
						className={`flex items-start gap-2 p-3 rounded-md border ${
							testResult.ok
								? 'bg-green-50 border-green-200 text-green-800'
								: 'bg-red-50 border-red-200 text-red-800'
						}`}
					>
						{testResult.ok ? (
							<CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
						) : (
							<XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
						)}
						<div className="flex-1">
							<p className="font-medium text-sm">
								{testResult.ok ? 'Connection Successful' : 'Connection Failed'}
							</p>
							{testResult.message && <p className="text-sm mt-1">{testResult.message}</p>}
						</div>
					</div>
				)}
			</div>
			{/* End Test Connection */}
			<div className="flex justify-end gap-2 pt-4">
				<Button
					type="button"
					variant="ghost"
					onClick={onClose}
					disabled={isSubmitting}
					className="shadow-sm active:scale-95 dark:border dark:border-white"
				>
					Cancel
				</Button>
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Adding...
						</>
					) : (
						'Add Provider'
					)}
				</Button>
			</div>
		</form>
	);
};

const KubernetesForm = ({ onSubmit, onClose }: ProviderFormProps<KubernetesFormData>) => {
	const {
		control,
		handleSubmit,
		formState: { errors },
	} = useForm<KubernetesFormData>({
		resolver: zodResolver(kubernetesSchema),
	});

	const [refreshKey, setRefreshKey] = useState(0);

	const handleSecretCreated = (secretId: number) => {
		setRefreshKey((prev) => prev + 1);
	};

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
			<FormSectionHeader title="Cluster Details" />
			<FieldWrapper error={errors.name}>
				<Label htmlFor="name">
					Cluster Name <span className="text-destructive">*</span>
				</Label>
				<Controller
					name="name"
					control={control}
					render={({ field }) => <Input id="name" placeholder="Production Cluster" {...field} />}
				/>
			</FieldWrapper>
			<FieldWrapper error={errors.kubeconfigKey}>
				<Label>
					Kubeconfig Key <span className="text-destructive">*</span>
				</Label>
				<KubeconfigSelector key={refreshKey} control={control} onSecretCreated={handleSecretCreated} />
				<div className="mt-2">
					<AddSecretButton secretType="kubeconfig" onSecretCreated={handleSecretCreated}>
						<button type="button" className="text-sm text-primary hover:underline">
							+ Add new kubeconfig key
						</button>
					</AddSecretButton>
				</div>
			</FieldWrapper>

			<div className="flex justify-end gap-2 pt-4">
				<Button
					type="button"
					variant="ghost"
					onClick={onClose}
					className="shadow-sm active:scale-95 dark:border dark:border-white"
				>
					Cancel
				</Button>
				<Button type="submit">Add Provider</Button>
			</div>
		</form>
	);
};

const AWSForm = ({ onSubmit, onClose }: ProviderFormProps<AWSFormData>) => {
	const {
		control,
		handleSubmit,
		formState: { errors },
	} = useForm<AWSFormData>({
		resolver: zodResolver(awsSchema),
	});

	const awsRegions = [
		{ value: 'us-east-1', label: 'US East (N. Virginia)' },
		{ value: 'us-east-2', label: 'US East (Ohio)' },
		{ value: 'us-west-1', label: 'US West (N. California)' },
		{ value: 'us-west-2', label: 'US West (Oregon)' },
	];

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
			<FormSectionHeader title="Connection Details" />
			<FieldWrapper error={errors.name}>
				<Label htmlFor="name">
					Connection Name <span className="text-destructive">*</span>
				</Label>
				<Controller
					name="name"
					control={control}
					render={({ field }) => <Input id="name" placeholder="AWS Production" {...field} />}
				/>
			</FieldWrapper>
			<FieldWrapper error={errors.region}>
				<Label>AWS Region</Label>
				<Controller
					name="region"
					control={control}
					render={({ field }) => (
						<Select onValueChange={field.onChange} defaultValue={field.value}>
							<SelectTrigger>
								<SelectValue placeholder="Select a region" />
							</SelectTrigger>
							<SelectContent>
								{awsRegions.map((r) => (
									<SelectItem key={r.value} value={r.value}>
										{r.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				/>
			</FieldWrapper>

			<FormSectionHeader title="Credentials" />
			<FieldWrapper error={errors.accessKeyId}>
				<Label htmlFor="accessKeyId">
					Access Key ID <span className="text-destructive">*</span>
				</Label>
				<Controller
					name="accessKeyId"
					control={control}
					render={({ field }) => <Input id="accessKeyId" placeholder="AKIA..." {...field} />}
				/>
			</FieldWrapper>
			<FieldWrapper error={errors.secretAccessKey}>
				<Label htmlFor="secretAccessKey">
					Secret Access Key <span className="text-destructive">*</span>
				</Label>
				<Controller
					name="secretAccessKey"
					control={control}
					render={({ field }) => <Input id="secretAccessKey" type="password" {...field} />}
				/>
			</FieldWrapper>

			<div className="flex justify-end gap-2 pt-4">
				<Button
					type="button"
					variant="ghost"
					onClick={onClose}
					className="shadow-sm active:scale-95 dark:border dark:border-white"
				>
					Cancel
				</Button>
				<Button type="submit">Add Provider</Button>
			</div>
		</form>
	);
};

// --- MAIN SIDEBAR COMPONENT ---

interface ProviderSidebarProps {
	provider: {
		id: string;
		type: ClientProviderType;
		name: string;
		description: string;
		icon: React.ReactNode;
	};
	onClose: () => void;
}

export const ProviderSidebar = ({ provider, onClose }: ProviderSidebarProps) => {
	const { toast } = useToast();
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = useState<'manual' | 'import'>('manual');
	const [isImporting, setIsImporting] = useState(false);

	const handleFormSubmit: SubmitHandler<AnyFormData> = async (data) => {
		switch (provider.type) {
			case 'kubernetes': {
				try {
					const serverData = data as KubernetesFormData;

					const providerData = {
						name: serverData.name,
						secretId: parseInt(serverData.kubeconfigKey),
						providerType: 'K8S',
					};

					// Call the API to create a new provider
					const response = await providerApi.createProvider(providerData);

					if (response.success && response.data) {
						toast({
							title: 'Provider added',
							description: `Successfully added ${serverData.name} server provider`,
						});
						onClose();
						// Redirect to Providers page
						navigate('/providers');
					} else {
						throw new Error(response.error || 'Failed to create provider');
					}
				} catch (error) {
					logger.error('Error creating server provider:', error);
					toast({
						title: 'Error adding provider',
						description:
							error instanceof Error ? error.message : 'There was a problem creating your provider',
						variant: 'destructive',
					});
				}
				break;
			}
			case 'server': {
				try {
					// Map form data to API request format
					const serverData = data as ServerFormData;
					// Determine provider_type based on provider.type
					let providerType = 'VM'; // Default to VM

					// Map provider types to provider types
					// Using type assertion to handle the comparison
					if (provider.type.includes('kubernetes')) {
						providerType = 'K8S';
					}

					const providerData = {
						name: serverData.name,
						providerIP: serverData.hostname,
						username: serverData.username,
						secretId:
							serverData.authType === 'key' && serverData.sshKey
								? parseInt(serverData.sshKey)
								: undefined,
						password: serverData.authType === 'password' ? serverData.password : undefined,
						SSHPort: serverData.port,
						providerType: providerType,
					};

					// Call the API to create a new provider
					const response = await providerApi.createProvider(providerData);

					if (response.success && response.data) {
						toast({
							title: 'Provider added',
							description: `Successfully added ${serverData.name} server provider`,
						});
						onClose();
						// Redirect to Providers page
						navigate('/providers');
					} else {
						throw new Error(response.error || 'Failed to create provider');
					}
				} catch (error) {
					logger.error('Error creating server provider:', error);
					toast({
						title: 'Error adding provider',
						description:
							error instanceof Error ? error.message : 'There was a problem creating your provider',
						variant: 'destructive',
					});
				}
				break;
			}
			default: {
				alert('This provider type is not yet supported with the new form.');
			}
		}
	};

	const renderForm = () => {
		switch (provider.type) {
			case 'server':
				return <ServerForm onSubmit={handleFormSubmit as SubmitHandler<ServerFormData>} onClose={onClose} />;
			case 'kubernetes':
				return (
					<KubernetesForm
						onSubmit={handleFormSubmit as SubmitHandler<KubernetesFormData>}
						onClose={onClose}
					/>
				);
			case 'aws-ec2':
			case 'aws-eks':
				return <AWSForm onSubmit={handleFormSubmit as SubmitHandler<AWSFormData>} onClose={onClose} />;
			default:
				return <div className="py-4">This provider type is not yet supported with the new form.</div>;
		}
	};

	const handleFile = async (file: File) => {
		try {
			setIsImporting(true);
			const text = await file.text();
			const json = JSON.parse(text);
			if (!json || !Array.isArray(json.providers)) {
				throw new Error('Invalid JSON format. Expected an object with a providers array');
			}
			const allowedTypes = ['VM', 'K8S'];
			const providersPayload = json.providers as Array<{ name: string; providerType: string }>;
			const isValid = providersPayload.every(
				(p) => p && typeof p.name === 'string' && p.name.length > 0 && allowedTypes.includes(p.providerType)
			);
			if (!isValid) {
				throw new Error('Invalid file structure. Ensure each provider has name and providerType (VM | K8S)');
			}

			const resp = await providerApi.createProvidersBulk(providersPayload);
			if (resp.success) {
				toast({
					title: 'Providers imported',
					description: `Imported ${providersPayload.length} providers`,
				});
				onClose();
				navigate('/providers');
			} else {
				throw new Error((resp as { error?: string }).error || 'Failed to import providers');
			}
		} catch (e: unknown) {
			const message = (e as Error)?.message || 'Invalid file';
			toast({ title: 'Import failed', description: message, variant: 'destructive' });
		} finally {
			setIsImporting(false);
		}
	};

	const ImportTab = () => {
		return (
			<div className="space-y-4 py-2">
				<FileDropzone
					id="provider-import"
					accept="application/json,.json"
					placeholder={isImporting ? 'Importing...' : 'Click to select a JSON file or drag & drop here'}
					loading={isImporting}
					onFile={(file) => void handleFile(file)}
					multiple={false}
				/>
				<div className="text-sm text-muted-foreground space-y-2">
					<div className="font-medium text-foreground">JSON structure</div>
					<pre className="bg-muted rounded-md p-3 overflow-auto text-xs">
						{`{
  "providers": [
    {
      "name": "My Server",
      "providerIP": "192.168.1.10",
      "username": "root",
      "privateKeyFilename": "id_rsa",
      "password": "optional",
      "SSHPort": 22,
      "providerType": "VM"
    },
    {
      "name": "My Cluster",
      "secretId": 1,
      "providerType": "K8S"
    }
  ]
}`}
					</pre>
					<ul className="list-disc pl-5">
						<li>
							<span className="font-medium">providerType</span> must be either <code>VM</code> or{' '}
							<code>K8S</code>.
						</li>
						<li>
							<span className="font-medium">providerIP</span>,{' '}
							<span className="font-medium">username</span>, <span className="font-medium">password</span>
							, <span className="font-medium">privateKeyFilename</span>, and{' '}
							<span className="font-medium">SSHPort</span> are optional depending on the type.
						</li>
						<li>
							<span className="font-medium">secretId</span> should reference a secret ID for the
							kubeconfig file or SSH key.
						</li>
						<li>At least one provider is required.</li>
					</ul>
				</div>
			</div>
		);
	};

	return (
		<Sheet open={true} onOpenChange={() => onClose()}>
			<SheetContent className="w-full sm:max-w-md overflow-auto">
				<SheetHeader className="flex flex-row items-center justify-between">
					<div className="flex items-center gap-2">
						<div className="bg-primary/10 p-2 rounded-md">{provider.icon}</div>
						<div>
							<SheetTitle>{provider.name}</SheetTitle>
							<SheetDescription>{provider.description}</SheetDescription>
						</div>
					</div>
				</SheetHeader>
				<Separator className="my-4" />
				<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'manual' | 'import')}>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="manual">Manual</TabsTrigger>
						<TabsTrigger value="import">Import</TabsTrigger>
					</TabsList>
					<TabsContent value="manual" className="mt-2">
						{renderForm()}
					</TabsContent>
					<TabsContent value="import" className="mt-2">
						<ImportTab />
					</TabsContent>
				</Tabs>
			</SheetContent>
		</Sheet>
	);
};
