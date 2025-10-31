import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ActionFormData } from '../ActionModal.types';

interface HttpActionFormProps {
	formData: ActionFormData;
	headersText: string;
	errors: {
		url?: string;
		method?: string;
		headers?: string;
	};
	onChange: (data: Partial<ActionFormData>) => void;
	onHeadersTextChange: (value: string) => void;
	onErrorChange: (errors: { url?: string; method?: string; headers?: string }) => void;
}

export const HttpActionForm = ({
	formData,
	headersText,
	errors,
	onChange,
	onHeadersTextChange,
	onErrorChange,
}: HttpActionFormProps) => {
	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="url">URL</Label>
				<Input
					id="url"
					value={formData.url ?? ''}
					onChange={(e) => {
						onChange({ url: e.target.value });
						if (errors.url) onErrorChange({ url: undefined });
					}}
					placeholder="https://api.example.com/endpoint"
					className={errors.url ? 'border-destructive' : ''}
				/>
				{errors.url && <p className="text-sm text-destructive">{errors.url}</p>}
			</div>
			<div className="space-y-2">
				<Label htmlFor="method">Method</Label>
				<Select
					value={formData.method ?? 'GET'}
					onValueChange={(value) => {
						onChange({
							method: value as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
						});
						if (errors.method) onErrorChange({ method: undefined });
					}}
				>
					<SelectTrigger id="method" className={errors.method ? 'border-destructive' : ''}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="GET">GET</SelectItem>
						<SelectItem value="POST">POST</SelectItem>
						<SelectItem value="PUT">PUT</SelectItem>
						<SelectItem value="DELETE">DELETE</SelectItem>
						<SelectItem value="PATCH">PATCH</SelectItem>
					</SelectContent>
				</Select>
				{errors.method && <p className="text-sm text-destructive">{errors.method}</p>}
			</div>
			<div className="space-y-2">
				<Label htmlFor="headers">Headers (JSON)</Label>
				<Textarea
					id="headers"
					value={headersText}
					onChange={(e) => onHeadersTextChange(e.target.value)}
					placeholder='{"Content-Type": "application/json"}'
					rows={4}
					className={`font-mono text-sm ${errors.headers ? 'border-destructive' : ''}`}
				/>
				{errors.headers && <p className="text-sm text-destructive">{errors.headers}</p>}
			</div>
			{(formData.method === 'POST' || formData.method === 'PUT' || formData.method === 'PATCH') && (
				<div className="space-y-2">
					<Label htmlFor="body">Body</Label>
					<Textarea
						id="body"
						value={formData.body ?? ''}
						onChange={(e) => onChange({ body: e.target.value || null })}
						placeholder="Request body"
						rows={6}
						className="font-mono text-sm"
					/>
				</div>
			)}
		</div>
	);
};
