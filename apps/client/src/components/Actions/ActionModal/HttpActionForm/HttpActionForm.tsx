import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import { ActionFormData } from '../ActionModal.types';

interface HeaderPair {
	key: string;
	value: string;
}

interface HttpActionFormProps {
	formData: ActionFormData;
	headersPairs: HeaderPair[];
	errors: {
		url?: string;
		method?: string;
		headers?: string;
	};
	onChange: (data: Partial<ActionFormData>) => void;
	onHeadersPairsChange: (pairs: HeaderPair[]) => void;
	onErrorChange: (errors: { url?: string; method?: string; headers?: string }) => void;
}

export const HttpActionForm = ({
	formData,
	headersPairs,
	errors,
	onChange,
	onHeadersPairsChange,
	onErrorChange,
}: HttpActionFormProps) => {
	const handleHeaderKeyChange = (index: number, key: string) => {
		const updated = [...headersPairs];
		updated[index] = { ...updated[index], key };
		onHeadersPairsChange(updated);
		updateHeadersFromPairs(updated);
	};

	const handleHeaderValueChange = (index: number, value: string) => {
		const updated = [...headersPairs];
		updated[index] = { ...updated[index], value };
		onHeadersPairsChange(updated);
		updateHeadersFromPairs(updated);
	};

	const handleAddHeader = () => {
		const updated = [...headersPairs, { key: '', value: '' }];
		onHeadersPairsChange(updated);
	};

	const handleRemoveHeader = (index: number) => {
		const updated = headersPairs.filter((_, i) => i !== index);
		onHeadersPairsChange(updated);
		updateHeadersFromPairs(updated);
	};

	const updateHeadersFromPairs = (pairs: HeaderPair[]) => {
		const headers: Record<string, string> = {};
		let hasError = false;

		for (const pair of pairs) {
			if (pair.key.trim() && pair.value.trim()) {
				headers[pair.key.trim()] = pair.value.trim();
			} else if (pair.key.trim() || pair.value.trim()) {
				hasError = true;
			}
		}

		if (hasError) {
			onErrorChange({ headers: 'Both key and value must be provided for each header' });
		} else {
			onErrorChange({ headers: undefined });
		}

		onChange({
			headers: Object.keys(headers).length > 0 ? headers : null,
		});
	};

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
				<div className="flex items-center justify-between">
					<Label htmlFor="headers">Headers</Label>
					<Button type="button" variant="outline" size="sm" onClick={handleAddHeader} className="gap-2">
						<Plus className="h-4 w-4" />
						Add Header
					</Button>
				</div>
				<div className="space-y-2">
					{headersPairs.map((pair, index) => (
						<div key={index} className="flex gap-2 items-start">
							<Input
								placeholder="Key"
								value={pair.key}
								onChange={(e) => handleHeaderKeyChange(index, e.target.value)}
								className="flex-1"
							/>
							<Input
								placeholder="Value"
								value={pair.value}
								onChange={(e) => handleHeaderValueChange(index, e.target.value)}
								className="flex-1"
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={() => handleRemoveHeader(index)}
								className="h-10 w-10 text-destructive hover:text-destructive"
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					))}
				</div>
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
