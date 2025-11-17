import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSecretsFromServer } from '@/lib/sslKeys';
import { Logger, Provider, SecretMetadata } from '@OpsiMate/shared';
import { Container, Server } from 'lucide-react';
import { useEffect, useState } from 'react';

const logger = new Logger('EditProviderDialog');

interface EditProviderDialogProps {
	provider: Provider | null;
	open: boolean;
	onClose: () => void;
	onSave: (provider: Provider) => Promise<void>;
}

export const EditProviderDialog = ({ provider, open, onClose, onSave }: EditProviderDialogProps) => {
	const [formData, setFormData] = useState({
		name: '',
		providerIP: '',
		username: '',
		secretId: undefined as number | undefined,
		password: '',
		SSHPort: 22,
		providerType: 'VM',
	});
	const [authMethod, setAuthMethod] = useState<'password' | 'key'>('key');
	const [isLoading, setIsLoading] = useState(false);
	const [secrets, setSecrets] = useState<SecretMetadata[]>([]);
	const [secretsLoading, setSecretsLoading] = useState(false);
	const [passwordError, setPasswordError] = useState<string>('');
	const [usernameError, setUsernameError] = useState<string>('');

	// Load secrets when dialog opens
	useEffect(() => {
		if (open) {
			loadSecrets();
		}
	}, [open]);

	const loadSecrets = async () => {
		setSecretsLoading(true);
		try {
			const secretsData = await getSecretsFromServer();
			setSecrets(secretsData);
		} catch (error) {
			logger.error('Error loading secrets:', error);
		} finally {
			setSecretsLoading(false);
		}
	};

	// Update form data when provider changes or dialog opens
	useEffect(() => {
		if (provider && open) {
			// For existing providers, find the secret ID that matches the privateKeyFilename
			let secretId: number | undefined;
			if (provider.privateKeyFilename && secrets.length > 0) {
				const matchingSecret = secrets.find((secret) => secret.fileName === provider.privateKeyFilename);
				secretId = matchingSecret?.id;
			}

			// Determine auth method based on existing provider
			const hasKey = !!provider.privateKeyFilename;
			setAuthMethod(hasKey ? 'key' : 'password');

			setFormData({
				name: provider.name,
				providerIP: provider.providerIP || '',
				username: provider.username || '',
				secretId: secretId,
				password: '',
				SSHPort: provider.SSHPort || 22,
				providerType: provider.providerType || 'VM',
			});
		}
	}, [provider, open, secrets]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;

		if (name === 'password') {
			if (/\s/.test(value)) {
				setPasswordError('Password cannot contain whitespace');
			} else {
				setPasswordError('');
			}
		}
		if (name === 'username') {
			if (/\s/.test(value)) {
				setUsernameError('Username cannot contain whitespace');
			} else {
				setUsernameError('');
			}
		}

		setFormData((prev) => ({
			...prev,
			[name]: name === 'SSHPort' ? parseInt(value) || 22 : value,
		}));
	};

	const handleSelectChange = (value: string) => {
		setFormData((prev) => ({
			...prev,
			providerType: value,
		}));
	};

	const handleSecretChange = (value: string) => {
		setFormData((prev) => ({
			...prev,
			secretId: value ? parseInt(value) : undefined,
		}));
	};

	const handleAuthMethodChange = (value: string) => {
		setAuthMethod(value as 'password' | 'key');
		// Clear the other field when switching auth methods
		if (value === 'password') {
			setFormData((prev) => ({ ...prev, secretId: undefined }));
		} else {
			setFormData((prev) => ({ ...prev, password: '' }));
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!provider) return;

		if (authMethod === 'password' && formData.password && /\s/.test(formData.password)) {
			setPasswordError('Password cannot contain whitespace');
		}
		if (!isKubernetes && /\s/.test(formData.username)) {
			setUsernameError('Username cannot contain whitespace');
			return;
		}

		setIsLoading(true);
		try {
			const updatedProvider: Provider = {
				...provider,
				name: formData.name,
				providerIP: formData.providerIP,
				username: formData.username,
				SSHPort: formData.SSHPort,
				providerType: formData.providerType as Provider['providerType'],
				...(authMethod === 'password' && formData.password && { password: formData.password }),
				...(authMethod === 'key' && formData.secretId && { secretId: formData.secretId }),
			};

			await onSave(updatedProvider);
			onClose();
		} catch (error) {
			logger.error('Error updating provider:', error);
		} finally {
			setIsLoading(false);
		}
	};

	const isKubernetes = provider?.providerType === 'K8S' || formData.providerType === 'K8S';

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>
						<div className="flex items-center gap-2">
							{isKubernetes ? (
								<Container className="h-5 w-5 text-blue-500" />
							) : (
								<Server className="h-5 w-5 text-purple-500" />
							)}
							Edit {isKubernetes ? 'Kubernetes Cluster' : 'Server'}
						</div>
					</DialogTitle>
					<DialogDescription>
						Update the details for this {isKubernetes ? 'Kubernetes cluster' : 'server'}. Click save when
						you're done.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit}>
					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-4 items-center gap-4">
							<Label htmlFor="name" className="text-right">
								Name
							</Label>
							<Input
								id="name"
								name="name"
								value={formData.name}
								onChange={handleInputChange}
								className="col-span-3"
								required
							/>
						</div>

						<div className="grid grid-cols-4 items-center gap-4">
							<Label htmlFor="providerType" className="text-right">
								Type
							</Label>
							<Select
								value={formData.providerType}
								onValueChange={handleSelectChange}
								disabled={!!provider} // Disable changing type for existing providers
							>
								<SelectTrigger className="col-span-3">
									<SelectValue placeholder="Select provider type" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="VM">Server (VM)</SelectItem>
									<SelectItem value="K8S">Kubernetes</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{isKubernetes ? (
							// Kubernetes-specific fields
							<>
								<div className="grid grid-cols-4 items-center gap-4">
									<Label htmlFor="providerIP" className="text-right">
										API Server
									</Label>
									<Input
										id="providerIP"
										name="providerIP"
										value={formData.providerIP}
										onChange={handleInputChange}
										className="col-span-3"
										placeholder="e.g., https://kubernetes.default.svc"
										required
									/>
								</div>
								<div className="grid grid-cols-4 items-center gap-4">
									<Label htmlFor="secretId" className="text-right">
										Kubeconfig
									</Label>
									<Select
										value={formData.secretId?.toString() || ''}
										onValueChange={handleSecretChange}
										disabled={secretsLoading}
									>
										<SelectTrigger className="col-span-3">
											<SelectValue
												placeholder={secretsLoading ? 'Loading...' : 'Select a kubeconfig'}
											/>
										</SelectTrigger>
										<SelectContent>
											{secrets
												.filter((secret) => secret.type === 'kubeconfig')
												.map((secret) => (
													<SelectItem key={secret.id} value={secret.id.toString()}>
														{secret.name}
													</SelectItem>
												))}
										</SelectContent>
									</Select>
								</div>
							</>
						) : (
							// Server-specific fields
							<>
								<div className="grid grid-cols-4 items-center gap-4">
									<Label htmlFor="providerIP" className="text-right">
										Hostname/IP
									</Label>
									<Input
										id="providerIP"
										name="providerIP"
										value={formData.providerIP}
										onChange={handleInputChange}
										className="col-span-3"
										required
									/>
								</div>
								<div className="grid grid-cols-4 items-center gap-4">
									<Label htmlFor="username" className="text-right">
										Username
									</Label>
									<div className="col-span-3 space-y-1">
										<Input
											id="username"
											name="username"
											value={formData.username}
											onChange={handleInputChange}
											className={usernameError ? 'border-red-500' : ''}
											required
										/>
										{usernameError && <p className="text-sm text-red-500">{usernameError}</p>}
									</div>
								</div>
								<div className="grid grid-cols-4 items-center gap-4">
									<Label htmlFor="SSHPort" className="text-right">
										SSH Port
									</Label>
									<Input
										id="SSHPort"
										name="SSHPort"
										type="number"
										value={formData.SSHPort}
										onChange={handleInputChange}
										className="col-span-3"
										required
									/>
								</div>

								<div className="grid grid-cols-4 items-center gap-4">
									<Label htmlFor="authMethod" className="text-right">
										Auth Method
									</Label>
									<Select value={authMethod} onValueChange={handleAuthMethodChange}>
										<SelectTrigger className="col-span-3">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="key">SSH Key</SelectItem>
											<SelectItem value="password">Password</SelectItem>
										</SelectContent>
									</Select>
								</div>

								{authMethod === 'key' ? (
									<div className="grid grid-cols-4 items-center gap-4">
										<Label htmlFor="secretId" className="text-right">
											SSH Key
										</Label>
										<Select
											value={formData.secretId?.toString() || ''}
											onValueChange={handleSecretChange}
											disabled={secretsLoading}
										>
											<SelectTrigger className="col-span-3">
												<SelectValue
													placeholder={secretsLoading ? 'Loading...' : 'Select an SSH key'}
												/>
											</SelectTrigger>
											<SelectContent>
												{secrets
													.filter((secret) => secret.type === 'ssh')
													.map((secret) => (
														<SelectItem key={secret.id} value={secret.id.toString()}>
															{secret.name}
														</SelectItem>
													))}
											</SelectContent>
										</Select>
									</div>
								) : (
									<div className="grid grid-cols-4 items-center gap-4">
										<Label htmlFor="password" className="text-right">
											Password
										</Label>
										<div className="col-span-3 space-y-1">
											<Input
												id="password"
												name="password"
												type="password"
												value={formData.password}
												onChange={handleInputChange}
												className={passwordError ? 'border-red-500' : ''}
												placeholder="Enter SSH password"
												required
											/>
											{passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
										</div>
									</div>
								)}
							</>
						)}
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit" disabled={isLoading}>
							{isLoading ? 'Saving...' : 'Save changes'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
