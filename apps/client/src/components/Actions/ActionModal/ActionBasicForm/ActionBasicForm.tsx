import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ActionTarget, ActionType } from '@OpsiMate/custom-actions';
import { ACTION_TYPE_ICONS } from '../../actions.constants';
import { ActionFormData } from '../ActionModal.types';

interface ActionBasicFormProps {
	formData: ActionFormData;
	errors: {
		name?: string;
		description?: string;
	};
	onChange: (data: Partial<ActionFormData>) => void;
	onErrorChange: (errors: { name?: string; description?: string }) => void;
}

export const ActionBasicForm = ({ formData, errors, onChange, onErrorChange }: ActionBasicFormProps) => {
	const BashIcon = ACTION_TYPE_ICONS.bash;
	const HttpIcon = ACTION_TYPE_ICONS.http;

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="name">Name</Label>
				<Input
					id="name"
					value={formData.name}
					onChange={(e) => {
						onChange({ name: e.target.value });
						if (errors.name) onErrorChange({ name: undefined });
					}}
					placeholder="Action name"
					className={errors.name ? 'border-destructive' : ''}
				/>
				{errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
			</div>
			<div className="space-y-2">
				<Label htmlFor="description">Description</Label>
				<Textarea
					id="description"
					value={formData.description}
					onChange={(e) => {
						onChange({ description: e.target.value });
						if (errors.description) onErrorChange({ description: undefined });
					}}
					placeholder="Action description"
					rows={3}
					className={errors.description ? 'border-destructive' : ''}
				/>
				{errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
			</div>
			<div className="space-y-2">
				<Label htmlFor="target">Target</Label>
				<Select
					value={formData.target ?? 'service'}
					onValueChange={(value) =>
						onChange({
							target: value as Exclude<ActionTarget, null>,
						})
					}
				>
					<SelectTrigger id="target">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="service">Service</SelectItem>
						<SelectItem value="provider">Provider</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<div className="space-y-2">
				<Label htmlFor="type">Type</Label>
				<Tabs
					value={formData.type}
					onValueChange={(value) => {
						const newType = value as ActionType;
						onChange({
							type: newType,
							method: newType === 'http' && !formData.method ? 'GET' : formData.method,
						});
					}}
				>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="bash" className="gap-2">
							<BashIcon className="h-4 w-4" />
							Bash
						</TabsTrigger>
						<TabsTrigger value="http" className="gap-2">
							<HttpIcon className="h-4 w-4" />
							HTTP
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>
		</div>
	);
};
