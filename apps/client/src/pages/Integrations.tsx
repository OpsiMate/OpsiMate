import { DashboardLayout } from '@/components/DashboardLayout';
import { GCPSetupModal } from '@/components/Integrations/GCPSetupModal';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { ValidationFeedback, validationRules } from '@/components/ValidationFeedback';
import { integrationApi } from '@/lib/api';
import { canDelete, canManageIntegrations } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { Logger, Integration as SharedIntegration } from '@OpsiMate/shared';
import {
	Activity,
	AlertCircle,
	BarChart3,
	Bell,
	CheckCircle2,
	Cloud,
	Database,
	ExternalLink,
	Eye,
	FileText,
	Info,
	LineChart,
	Loader2,
	Plus,
	Search,
	Server,
	Settings,
	X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const logger = new Logger('Integrations');
// Define IntegrationType locally until shared package export is fixed
enum IntegrationType {
	Grafana = 'Grafana',
	Kibana = 'Kibana',
	Datadog = 'Datadog',
}

interface Integration {
	id: string;
	supported: boolean;
	name: string;
	description: string;
	logo: string;
	tags: string[];
	documentationUrl?: string;
	configFields: {
		name: string;
		label: string;
		type: 'text' | 'password' | 'select';
		placeholder?: string;
		options?: string[];
		required: boolean;
	}[];
}

const INTEGRATIONS: Integration[] = [
	{
		id: 'grafana',
		supported: true,
		name: 'Grafana',
		description: 'Open source analytics & monitoring solution for every database.',
		logo: 'https://grafana.com/static/img/menu/grafana2.svg',
		tags: ['Monitoring', 'Visualization', 'Alerts'],
		documentationUrl: 'https://opsimate.vercel.app/docs/integrations/grafana',
		configFields: [
			{
				name: 'url',
				label: 'Grafana URL',
				type: 'text',
				placeholder: 'https://your-grafana-instance.com',
				required: true,
			},
			{ name: 'apiKey', label: 'API Key', type: 'password', required: true },
		],
	},
	{
		id: 'kibana',
		supported: true,
		name: 'Kibana',
		description: 'Visualize and explore data from Elasticsearch.',
		logo: 'https://static-www.elastic.co/v3/assets/bltefdd0b53724fa2ce/blt8781708f8f37ed16/5c11ec2edf09df047814db23/logo-elastic-kibana-lt.svg',
		tags: ['Monitoring', 'Visualization', 'Elasticsearch'],
		documentationUrl: 'https://opsimate.vercel.app/docs/integrations/kibana',
		configFields: [
			{
				name: 'url',
				label: 'Kibana URL',
				type: 'text',
				placeholder: 'https://your-kibana-instance.com',
				required: true,
			},
			{ name: 'apiKey', label: 'API Key', type: 'password', required: true },
		],
	},
	{
		id: 'datadog',
		supported: true,
		name: 'Datadog',
		description: 'Cloud monitoring and analytics platform for infrastructure, applications, and logs.',
		logo: 'https://imgix.datadoghq.com/img/dd_logo_n_70x75.png',
		tags: ['Monitoring', 'APM', 'Logs', 'Metrics'],
		documentationUrl: 'https://opsimate.vercel.app/docs/integrations/datadog',
		configFields: [
			{
				name: 'url',
				label: 'Datadog URL',
				type: 'text',
				placeholder: 'https://api.datadoghq.com',
				required: true,
			},
			{ name: 'apiKey', label: 'API Key', type: 'password', required: true },
			{ name: 'appKey', label: 'Application Key', type: 'password', required: true },
		],
	},
	{
		id: 'gcp',
		supported: true,
		name: 'Google Cloud Platform',
		description: 'Receive monitoring alerts from Google Cloud Platform via webhook.',
		logo: 'https://www.gstatic.com/images/branding/product/2x/google_cloud_48dp.png',
		tags: ['Monitoring', 'Alerts', 'Cloud'],
		documentationUrl: 'https://cloud.google.com/monitoring/support/notification-options',
		configFields: [],
	},
	{
		id: 'prometheus',
		supported: false,
		name: 'Prometheus',
		description: 'Open-source systems monitoring and alerting toolkit.',
		logo: 'https://icon.icepanel.io/Technology/svg/Prometheus.svg',
		tags: ['Monitoring', 'Metrics', 'Alerts'],
		documentationUrl: 'https://opsimate.vercel.app/docs/integrations/overview',
		configFields: [
			{
				name: 'url',
				label: 'Prometheus URL',
				type: 'text',
				placeholder: 'http://prometheus:9090',
				required: true,
			},
		],
	},
	{
		id: 'coralogix',
		supported: false,
		name: 'Coralogix',
		description: 'Log analytics platform powered by machine learning.',
		logo: 'https://cdn.brandfetch.io/idCh7aU0wN/theme/dark/logo.svg?c=1bxid64Mup7aczewSAYMX&t=1667744703603',
		tags: ['Logging', 'Analytics', 'Monitoring'],
		documentationUrl: 'https://opsimate.vercel.app/docs/integrations/overview',
		configFields: [
			{ name: 'apiKey', label: 'API Key', type: 'password', required: true },
			{ name: 'applicationName', label: 'Application Name', type: 'text', required: true },
			{ name: 'subsystemName', label: 'Subsystem Name', type: 'text', required: true },
		],
	},
	{
		id: 'loki',
		supported: false,
		name: 'Loki',
		description: 'Horizontally-scalable, highly-available log aggregation system.',
		logo: 'https://grafana.com/static/img/logos/logo-loki.svg',
		tags: ['Logging', 'Monitoring'],
		documentationUrl: 'https://opsimate.vercel.app/docs/integrations/overview',
		configFields: [
			{
				name: 'url',
				label: 'Loki URL',
				type: 'text',
				placeholder: 'http://loki:3100',
				required: true,
			},
		],
	},
	{
		id: 'victoriaMetrics',
		supported: false,
		name: 'VictoriaMetrics',
		description: 'Fast, cost-effective and scalable time series database.',
		logo: 'https://upload.wikimedia.org/wikipedia/commons/c/c6/VictoriaMetrics_logo.svg',
		tags: ['Metrics', 'Monitoring', 'Storage'],
		documentationUrl: 'https://opsimate.vercel.app/docs/integrations/overview',
		configFields: [
			{
				name: 'url',
				label: 'VictoriaMetrics URL',
				type: 'text',
				placeholder: 'http://victoria-metrics:8428',
				required: true,
			},
		],
	},
	{
		id: 'cloudwatch',
		supported: false,
		name: 'AWS CloudWatch',
		description: 'Monitoring and observability service for AWS resources.',
		logo: 'https://icon.icepanel.io/AWS/svg/Management-Governance/CloudWatch.svg',
		tags: ['Monitoring', 'Metrics', 'Logs', 'AWS'],
		documentationUrl: 'https://opsimate.vercel.app/docs/integrations/overview',
		configFields: [
			{ name: 'accessKeyId', label: 'AWS Access Key ID', type: 'text', required: true },
			{ name: 'secretAccessKey', label: 'AWS Secret Access Key', type: 'password', required: true },
			{
				name: 'region',
				label: 'AWS Region',
				type: 'select',
				options: [
					'us-east-1',
					'us-east-2',
					'us-west-1',
					'us-west-2',
					'eu-west-1',
					'eu-central-1',
					'ap-northeast-1',
				],
				required: true,
			},
		],
	},
	// Removed duplicate datadog entry
	{
		id: 'newrelic',
		supported: false,
		name: 'New Relic',
		description: 'Observability platform built to help engineers create perfect software.',
		logo: 'https://newrelic.com/themes/custom/erno/assets/mediakit/new_relic_logo_vertical.svg',
		tags: ['Monitoring', 'APM', 'Observability'],
		documentationUrl: 'https://opsimate.vercel.app/docs/integrations/overview',
		configFields: [
			{ name: 'accountId', label: 'Account ID', type: 'text', required: true },
			{ name: 'apiKey', label: 'API Key', type: 'password', required: true },
		],
	},
];

const ALL_TAGS = Array.from(new Set(INTEGRATIONS.flatMap((integration) => integration.tags)));

// Tag color mapping
const TAG_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
	Monitoring: {
		bg: 'bg-blue-100 dark:bg-blue-900/40',
		text: 'text-blue-700 dark:text-blue-300',
		icon: <Activity className="h-3 w-3 mr-1" />,
	},
	Visualization: {
		bg: 'bg-purple-100 dark:bg-purple-900/40',
		text: 'text-purple-700 dark:text-purple-300',
		icon: <BarChart3 className="h-3 w-3 mr-1" />,
	},
	Alerts: {
		bg: 'bg-red-100 dark:bg-red-900/40',
		text: 'text-red-700 dark:text-red-300',
		icon: <Bell className="h-3 w-3 mr-1" />,
	},
	Metrics: {
		bg: 'bg-green-100 dark:bg-green-900/40',
		text: 'text-green-700 dark:text-green-300',
		icon: <LineChart className="h-3 w-3 mr-1" />,
	},
	Logging: {
		bg: 'bg-yellow-100 dark:bg-yellow-900/40',
		text: 'text-yellow-700 dark:text-yellow-300',
		icon: <FileText className="h-3 w-3 mr-1" />,
	},
	Analytics: {
		bg: 'bg-indigo-100 dark:bg-indigo-900/40',
		text: 'text-indigo-700 dark:text-indigo-300',
		icon: <Eye className="h-3 w-3 mr-1" />,
	},
	Storage: {
		bg: 'bg-pink-100 dark:bg-pink-900/40',
		text: 'text-pink-700 dark:text-pink-300',
		icon: <Database className="h-3 w-3 mr-1" />,
	},
	AWS: {
		bg: 'bg-orange-100 dark:bg-orange-900/40',
		text: 'text-orange-700 dark:text-orange-300',
		icon: <Cloud className="h-3 w-3 mr-1" />,
	},
	APM: {
		bg: 'bg-cyan-100 dark:bg-cyan-900/40',
		text: 'text-cyan-700 dark:text-cyan-300',
		icon: <Activity className="h-3 w-3 mr-1" />,
	},
	Logs: {
		bg: 'bg-amber-100 dark:bg-amber-900/40',
		text: 'text-amber-700 dark:text-amber-300',
		icon: <FileText className="h-3 w-3 mr-1" />,
	},
	Observability: {
		bg: 'bg-teal-100 dark:bg-teal-900/40',
		text: 'text-teal-700 dark:text-teal-300',
		icon: <Eye className="h-3 w-3 mr-1" />,
	},
};

const Integrations = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
	const [hoveredCard, setHoveredCard] = useState<string | null>(null);
	const [configuredInstances, setConfiguredInstances] = useState<Record<string, number>>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formData, setFormData] = useState<Record<string, string>>({});
	const [savedIntegrations, setSavedIntegrations] = useState<SharedIntegration[]>([]);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [integrationToDelete, setIntegrationToDelete] = useState<SharedIntegration | null>(null);
	const [showGCPSetupModal, setShowGCPSetupModal] = useState(false);
	const { toast } = useToast();

	// Handle URL-based category filtering
	useEffect(() => {
		const categoryParam = searchParams.get('category');
		if (categoryParam) {
			// Support multiple categories separated by commas
			const categoryValues = categoryParam.split(',').map((c) => c.trim().toLowerCase());
			// Find canonical tags by case-insensitive lookup
			const canonicalTags = ALL_TAGS.filter((tag) => categoryValues.includes(tag.toLowerCase()));
			if (canonicalTags.length > 0) {
				setSelectedTags(canonicalTags);
			}
		}
	}, [searchParams]);

	// Fetch saved integrations on component mount
	useEffect(() => {
		const fetchIntegrations = async () => {
			try {
				const response = await integrationApi.getIntegrations();
				if (response.success && response.data?.integrations) {
					setSavedIntegrations(response.data.integrations);

					// Update configured instances based on saved integrations
					const instances: Record<string, number> = {};
					response.data.integrations.forEach((integration) => {
						// Use the integration ID from INTEGRATIONS array that matches this type
						const matchingIntegrationType = Object.values(IntegrationType).find(
							(type) => type === integration.type
						);
						if (matchingIntegrationType) {
							const id = matchingIntegrationType.toLowerCase();
							instances[id] = (instances[id] || 0) + 1;
						}
					});
					setConfiguredInstances(instances);
				}
			} catch (error) {
				logger.error('Failed to fetch integrations:', error);
			}
		};

		fetchIntegrations();
	}, []);

	const filteredIntegrations = useMemo(() => {
		return INTEGRATIONS.filter((integration) => {
			const matchesSearch =
				integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				integration.description.toLowerCase().includes(searchQuery.toLowerCase());

			const matchesTags =
				selectedTags.length === 0 || selectedTags.every((tag) => integration.tags.includes(tag));

			return matchesSearch && matchesTags;
		});
	}, [searchQuery, selectedTags]);

	const handleTagToggle = (tag: string) => {
		setSelectedTags((prev) => {
			const newTags = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag];
			// Update URL to reflect all selected tags
			if (newTags.length > 0) {
				const categoryValue = newTags.map((t) => t.toLowerCase()).join(',');
				setSearchParams({ category: categoryValue });
			} else {
				setSearchParams({});
			}
			return newTags;
		});
	};

	const handleIntegrationButtonClick = () => {
		window.open('https://github.com/OpsiMate/OpsiMate/issues', '_blank');
	};

	return (
		<>
			<DashboardLayout>
				<div className="flex flex-col h-full p-6 gap-6 max-w-7xl mx-auto">
					<div className="flex justify-between items-center">
						<div>
							<h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
							<p className="text-muted-foreground mt-1">Connect your favorite tools and services</p>
						</div>
						<Button className="gap-2" onClick={handleIntegrationButtonClick}>
							<Plus className="h-4 w-4" />
							<span>Request Integration via GitHub</span>
						</Button>
					</div>

					<div className="bg-card rounded-lg border shadow-sm p-6">
						<div className="flex flex-col gap-5">
							<div className="flex gap-4 items-center">
								<div className="relative flex-1">
									<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
									<Input
										placeholder="Search integrations..."
										className="pl-10"
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
									/>
								</div>
							</div>

							<Separator />

							<div>
								<h3 className="text-sm font-medium mb-3">Filter by category</h3>
								<div className="flex flex-wrap gap-2">
									{ALL_TAGS.map((tag) => (
										<Badge
											key={tag}
											variant={selectedTags.includes(tag) ? 'default' : 'outline'}
											className={cn(
												'cursor-pointer transition-all hover:shadow-sm',
												selectedTags.includes(tag)
													? 'hover:bg-primary/90'
													: 'hover:bg-primary hover:text-primary-foreground hover:border-primary'
											)}
											onClick={() => handleTagToggle(tag)}
										>
											{tag}
										</Badge>
									))}
									{selectedTags.length > 0 && (
										<Badge
											variant="outline"
											className="cursor-pointer flex items-center gap-1 hover:bg-accent transition-all"
											onClick={() => setSelectedTags([])}
										>
											Clear all <X className="h-3 w-3" />
										</Badge>
									)}
								</div>
							</div>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{filteredIntegrations.map((integration) => {
							const hasConfiguredInstances = configuredInstances[integration.id] > 0;
							return (
								<Card
									key={integration.id}
									className={cn(
										'transition-all duration-200 overflow-hidden',
										hoveredCard === integration.id && hasConfiguredInstances
											? 'border-primary shadow-md'
											: '',
										hasConfiguredInstances
											? 'border-muted/60 hover:shadow-md'
											: 'border-muted/20 bg-gray-100 dark:bg-gray-800/40'
									)}
									onMouseEnter={() => setHoveredCard(integration.id)}
									onMouseLeave={() => setHoveredCard(null)}
								>
									{!integration.supported ? (
										<div className="text-center bg-yellow-100 text-yellow-800 text-xs font-medium  border-b border-yellow-300">
											🚧 Coming Soon
										</div>
									) : (
										<div className="h-[16.8px]"></div>
									)}
									<CardHeader className={cn('pb-2', hasConfiguredInstances ? '' : 'opacity-75')}>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3">
												<div
													className={cn(
														'h-10 w-10 rounded-md overflow-hidden border flex items-center justify-center',
														hasConfiguredInstances
															? 'bg-background'
															: 'bg-gray-200 dark:bg-gray-700'
													)}
												>
													<img
														src={integration.logo}
														alt={`${integration.name} logo`}
														className={cn(
															'h-8 w-8 object-contain',
															hasConfiguredInstances ? '' : 'opacity-50 grayscale'
														)}
													/>
												</div>
												<CardTitle className="text-base">{integration.name}</CardTitle>
											</div>
											<Button
												variant="ghost"
												size="icon"
												className="rounded-full h-8 w-8"
												onClick={() => window.open(integration.documentationUrl, '_blank')}
											>
												<ExternalLink className="h-4 w-4" />
											</Button>
										</div>
									</CardHeader>
									<CardContent className={cn('pb-2', hasConfiguredInstances ? '' : 'opacity-75')}>
										<CardDescription className="text-sm h-16 sm:h-14 md:h-12 lg:h-10 line-clamp-2 overflow-hidden">
											{integration.description}
										</CardDescription>
										<div className="md:h-[52px] mt-3">
											<div className="flex flex-wrap gap-1.5 mt-3">
												{integration.tags.map((tag) => (
													<Badge
														key={tag}
														variant="outline"
														className={cn(
															'text-xs px-2 py-0.5 flex items-center',
															hasConfiguredInstances
																? TAG_COLORS[tag]?.bg || 'bg-gray-100 dark:bg-gray-800'
																: 'bg-gray-200 dark:bg-gray-700',
															hasConfiguredInstances
																? TAG_COLORS[tag]?.text ||
																		'text-gray-700 dark:text-gray-300'
																: 'text-gray-500 dark:text-gray-400'
														)}
													>
														{TAG_COLORS[tag]?.icon}
														{tag}
													</Badge>
												))}
											</div>
										</div>
									</CardContent>
									<CardFooter className="pt-2 flex gap-2">
										<Button
											disabled={!integration.supported}
											className={cn(
												'w-full transition-all',
												hoveredCard === integration.id && hasConfiguredInstances
													? 'ring-2 ring-primary-foreground/20'
													: '',
												!integration.supported
													? 'border-dashed bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
													: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95'
											)}
											onClick={() => {
												// Special handling for GCP - show webhook setup modal
												if (integration.id === 'gcp') {
													setShowGCPSetupModal(true);
													return;
												}

												// Find existing integration of this type if it exists
												const existingIntegration = savedIntegrations.find(
													(integration2) =>
														integration2.type ===
														integration.id.charAt(0).toUpperCase() + integration.id.slice(1)
												);

												// If integration exists, pre-fill form data
												if (existingIntegration) {
													// Handle different credential formats based on integration type
													if (integration.id === 'datadog') {
														setFormData({
															url: existingIntegration.externalUrl || '',
															apiKey: existingIntegration.credentials?.apiKey || '',
															appKey: existingIntegration.credentials?.appKey || '',
														});
													} else {
														// Default for other integrations like Grafana and Kibana
														setFormData({
															url: existingIntegration.externalUrl || '',
															apiKey: existingIntegration.credentials?.apiKey || '',
														});
													}
												} else {
													// Clear form data for new integration
													setFormData({});
												}

												setSelectedIntegration(integration);
											}}
											title={
												hasConfiguredInstances
													? `Configure ${integration.name} integration`
													: `Add ${integration.name} integration`
											}
										>
											<Settings className="mr-2 h-4 w-4" />
											{hasConfiguredInstances ? 'Configure' : 'Add Integration'}
										</Button>
									</CardFooter>
									{hasConfiguredInstances ? (
										<div className="px-6 pb-3 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
											<Server className="h-3 w-3" />
											<span>
												{configuredInstances[integration.id]}{' '}
												{configuredInstances[integration.id] === 1 ? 'instance' : 'instances'}{' '}
												configured
											</span>
										</div>
									) : (
										<div className="px-6 pb-3 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
											<AlertCircle className="h-3 w-3" />
											<span>Not configured</span>
										</div>
									)}
								</Card>
							);
						})}

						{filteredIntegrations.length === 0 && (
							<div className="col-span-full flex flex-col items-center justify-center p-8 text-center">
								<p className="text-muted-foreground">No integrations found matching your criteria.</p>
								<Button
									variant="link"
									onClick={() => {
										setSearchQuery('');
										setSelectedTags([]);
									}}
								>
									Clear filters
								</Button>
							</div>
						)}
					</div>
				</div>

				<Sheet open={!!selectedIntegration} onOpenChange={(open) => !open && setSelectedIntegration(null)}>
					<SheetContent className="w-full sm:max-w-md overflow-y-auto">
						{selectedIntegration && (
							<>
								<SheetHeader className="pb-6">
									<div className="flex items-center gap-4">
										<div className="h-16 w-16 overflow-hidden flex items-center justify-center bg-muted rounded-lg p-2 border">
											<img
												src={selectedIntegration.logo}
												alt={`${selectedIntegration.name} logo`}
												className="max-h-12 max-w-12 object-contain"
											/>
										</div>
										<div>
											<SheetTitle>
												{configuredInstances[selectedIntegration.id] &&
												configuredInstances[selectedIntegration.id] > 0
													? `Configure ${selectedIntegration.name} Integration`
													: `Add ${selectedIntegration.name} Integration`}
											</SheetTitle>
											<div className="flex items-center gap-1 mt-1">
												<Badge
													variant="outline"
													className="text-xs bg-primary/10 text-primary border-primary/20"
												>
													Official
												</Badge>
												<Badge
													variant="outline"
													className="text-xs bg-green-500/10 text-green-600 border-green-500/20"
												>
													Verified
												</Badge>
											</div>
										</div>
									</div>
									<SheetDescription className="mt-4">
										{configuredInstances[selectedIntegration.id] &&
										configuredInstances[selectedIntegration.id] > 0
											? `Update your ${selectedIntegration.name} integration settings or remove the integration.`
											: selectedIntegration.description}
									</SheetDescription>
								</SheetHeader>

								<Tabs defaultValue="configuration" className="w-full">
									<TabsList className="grid w-full grid-cols-2 mb-4">
										<TabsTrigger value="configuration" className="flex items-center gap-2">
											<Settings className="h-4 w-4" />
											Configuration
										</TabsTrigger>
										<TabsTrigger value="about" className="flex items-center gap-2">
											<Info className="h-4 w-4" />
											About
										</TabsTrigger>
									</TabsList>

									<TabsContent value="configuration" className="space-y-6 py-4">
										<div className="bg-muted/50 rounded-lg p-4 border border-muted">
											<div className="flex items-start gap-3">
												<Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
												<div>
													<h4 className="font-medium text-sm">Integration Information</h4>
													<p className="text-xs text-muted-foreground mt-1">
														Configure your {selectedIntegration.name} integration by
														providing the required credentials below.
													</p>
												</div>
											</div>
										</div>

										<form
											className="space-y-5"
											onSubmit={async (e) => {
												e.preventDefault();
												if (!selectedIntegration) return;

												setIsSubmitting(true);
												try {
													// Check if an integration of this type already exists
													const existingIntegration = savedIntegrations.find(
														(integration) =>
															integration.type ===
															selectedIntegration.id.charAt(0).toUpperCase() +
																selectedIntegration.id.slice(1)
													);

													// Map integration id to the correct IntegrationType
													const typeMapping = {
														grafana: IntegrationType.Grafana,
														kibana: IntegrationType.Kibana,
														datadog: IntegrationType.Datadog,
														// Add other integration types as needed
													};

													// Prepare the integration data
													let credentials = {};

													// Handle different credential formats based on integration type
													if (selectedIntegration.id === 'datadog') {
														credentials = {
															apiKey: formData.apiKey || '',
															appKey: formData.appKey || '',
														};
													} else {
														// Default for other integrations like Grafana and Kibana
														credentials = {
															apiKey: formData.apiKey || '',
														};
													}

													const integrationData = {
														name: selectedIntegration.name,
														type:
															typeMapping[
																selectedIntegration.id as keyof typeof typeMapping
															] || IntegrationType.Grafana,
														externalUrl: formData.url || '',
														credentials,
													};

													let response;

													if (existingIntegration) {
														// Update existing integration
														response = await integrationApi.updateIntegration(
															existingIntegration.id,
															integrationData
														);

														if (response.success) {
															toast({
																title: 'Integration updated',
																description: `${selectedIntegration.name} integration has been successfully updated.`,
															});
														} else {
															toast({
																title: 'Error',
																description:
																	response.error || 'Failed to update integration',
																variant: 'destructive',
															});
														}
													} else {
														// Create new integration
														response =
															await integrationApi.createIntegration(integrationData);

														if (response.success) {
															toast({
																title: 'Integration created',
																description: `${selectedIntegration.name} integration has been successfully created.`,
															});

															// Update configured instances
															setConfiguredInstances((prev) => ({
																...prev,
																[selectedIntegration.id]:
																	(prev[selectedIntegration.id] || 0) + 1,
															}));
														} else {
															toast({
																title: 'Error',
																description:
																	response.error || 'Failed to create integration',
																variant: 'destructive',
															});
														}
													}

													if (response.success) {
														// Fetch updated integrations
														const updatedIntegrations =
															await integrationApi.getIntegrations();
														if (
															updatedIntegrations.success &&
															updatedIntegrations.data?.integrations
														) {
															setSavedIntegrations(updatedIntegrations.data.integrations);
														}

														// Close the sheet
														setSelectedIntegration(null);
													}
												} catch (error) {
													logger.error('Error managing integration:', error);
													toast({
														title: 'Error',
														description: 'An unexpected error occurred',
														variant: 'destructive',
													});
												} finally {
													setIsSubmitting(false);
												}
											}}
										>
											{selectedIntegration.configFields.map((field) => (
												<div key={field.name} className="space-y-2">
													<label
														htmlFor={`${selectedIntegration.id}-${field.name}`}
														className="text-sm font-medium"
													>
														{field.label}{' '}
														{field.required && <span className="text-destructive">*</span>}
													</label>
													{field.type === 'select' ? (
														<select
															id={`${selectedIntegration.id}-${field.name}`}
															name={field.name}
															className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
															required={field.required}
															value={formData[field.name] || ''}
															onChange={(e) =>
																setFormData((prev) => ({
																	...prev,
																	[field.name]: e.target.value,
																}))
															}
															disabled={isSubmitting || !canManageIntegrations()}
															autoComplete="off"
														>
															<option value="">Select {field.label}</option>
															{field.options?.map((option) => (
																<option key={option} value={option}>
																	{option}
																</option>
															))}
														</select>
													) : (
														<>
															<Input
																id={`${selectedIntegration.id}-${field.name}`}
																name={field.name}
																type={field.type}
																placeholder={field.placeholder}
																required={field.required}
																value={formData[field.name] || ''}
																onChange={(e) =>
																	setFormData((prev) => ({
																		...prev,
																		[field.name]: e.target.value,
																	}))
																}
																disabled={isSubmitting || !canManageIntegrations()}
																autoComplete={
																	field.type === 'password' ? 'new-password' : 'off'
																}
															/>
															{(field.name === 'apiKey' || field.name === 'appKey') &&
																formData[field.name] && (
																	<ValidationFeedback
																		value={formData[field.name] || ''}
																		rules={
																			field.name === 'apiKey'
																				? validationRules.apiKey
																				: validationRules.appKey
																		}
																		showValid={false}
																	/>
																)}
														</>
													)}
												</div>
											))}

											<div className="pt-4 space-y-3">
												<div className="flex justify-between mt-6">
													{/* Delete button - only show for existing integrations */}
													{canDelete() &&
														savedIntegrations.find(
															(integration) =>
																integration.type ===
																selectedIntegration.id.charAt(0).toUpperCase() +
																	selectedIntegration.id.slice(1)
														) && (
															<Button
																type="button"
																variant="destructive"
																disabled={isSubmitting}
																onClick={() => {
																	const existingIntegration = savedIntegrations.find(
																		(integration) =>
																			integration.type ===
																			selectedIntegration.id
																				.charAt(0)
																				.toUpperCase() +
																				selectedIntegration.id.slice(1)
																	);

																	if (!existingIntegration) {
																		toast({
																			title: 'Error',
																			description: 'Integration not found',
																			variant: 'destructive',
																		});
																		return;
																	}

																	setIntegrationToDelete(existingIntegration);
																	setDeleteDialogOpen(true);
																}}
															>
																{isSubmitting ? (
																	<>
																		<Loader2 className="mr-2 h-4 w-4 animate-spin" />
																		Deleting...
																	</>
																) : (
																	'Delete Integration'
																)}
															</Button>
														)}

													{canManageIntegrations() ? (
														<Button type="submit" disabled={isSubmitting}>
															{isSubmitting ? (
																<>
																	<Loader2 className="mr-2 h-4 w-4 animate-spin" />
																	Saving...
																</>
															) : (
																'Save Integration'
															)}
														</Button>
													) : (
														<Button type="button" variant="outline" disabled>
															View Only - No Permission to Save
														</Button>
													)}
												</div>
												<p className="text-xs text-center text-muted-foreground">
													You can configure multiple instances of the same integration
												</p>
											</div>
										</form>
									</TabsContent>

									<TabsContent value="about" className="space-y-6 py-4">
										<div className="space-y-5">
											<div>
												<h3 className="text-lg font-medium">
													About {selectedIntegration.name}
												</h3>
												<p className="text-muted-foreground mt-2">
													{selectedIntegration.description}
												</p>
											</div>

											<Separator />

											<div>
												<h4 className="text-sm font-medium mb-3">Features</h4>
												<div className="grid grid-cols-2 gap-3">
													{selectedIntegration.tags.map((tag) => (
														<div
															key={tag}
															className={cn(
																'flex items-center gap-2 p-2 rounded-md border',
																TAG_COLORS[tag]?.bg || 'bg-muted/50',
																TAG_COLORS[tag]?.text || 'text-foreground'
															)}
														>
															{TAG_COLORS[tag]?.icon || (
																<CheckCircle2 className="h-4 w-4" />
															)}
															<span className="text-sm">{tag}</span>
														</div>
													))}
												</div>
											</div>

											<Separator />

											<div>
												<h4 className="text-sm font-medium mb-3">Documentation</h4>
												<Button
													variant="outline"
													className="w-full justify-start gap-2"
													onClick={() =>
														window.open(selectedIntegration.documentationUrl, '_blank')
													}
												>
													<ExternalLink className="h-4 w-4" />
													View {selectedIntegration.name} Documentation
												</Button>
											</div>
										</div>
									</TabsContent>
								</Tabs>
							</>
						)}
					</SheetContent>
				</Sheet>
			</DashboardLayout>

			{/* Delete confirmation dialog */}
			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete the {integrationToDelete?.type} integration. This action cannot
							be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={async () => {
								if (!integrationToDelete) return;

								setIsSubmitting(true);
								try {
									const response = await integrationApi.deleteIntegration(integrationToDelete.id);

									if (response.success) {
										toast({
											title: 'Integration deleted',
											description: `${integrationToDelete.type} integration has been successfully deleted.`,
										});

										// Update configured instances
										const integrationType = integrationToDelete.type.toLowerCase();
										setConfiguredInstances((prev) => ({
											...prev,
											[integrationType]: 0,
										}));

										// Fetch updated integrations
										const updatedIntegrations = await integrationApi.getIntegrations();
										if (updatedIntegrations.success && updatedIntegrations.data?.integrations) {
											setSavedIntegrations(updatedIntegrations.data.integrations);
										}

										// Close the sheet
										setSelectedIntegration(null);
									} else {
										toast({
											title: 'Error',
											description: response.error || 'Failed to delete integration',
											variant: 'destructive',
										});
									}
								} catch (error) {
									logger.error('Error deleting integration:', error);
									toast({
										title: 'Error',
										description: 'An unexpected error occurred',
										variant: 'destructive',
									});
								} finally {
									setIsSubmitting(false);
									setDeleteDialogOpen(false);
								}
							}}
							className="bg-red-600 hover:bg-red-700"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<GCPSetupModal open={showGCPSetupModal} onOpenChange={setShowGCPSetupModal} />
		</>
	);
};

export default Integrations;
