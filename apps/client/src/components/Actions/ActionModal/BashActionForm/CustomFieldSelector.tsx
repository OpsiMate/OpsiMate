import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCustomFields } from '@/hooks/queries/custom-fields';

interface CustomFieldSelectorProps {
	onFieldSelect: (fieldName: string) => void;
}

export const CustomFieldSelector = ({ onFieldSelect }: CustomFieldSelectorProps) => {
	const { data: customFields, isLoading } = useCustomFields();

	return (
		<div className="flex items-center gap-2">
			<Label className="text-xs text-muted-foreground">Insert Custom Field:</Label>
			<Select onValueChange={onFieldSelect} value="">
				<SelectTrigger className="w-[200px] h-8 text-xs">
					<SelectValue placeholder="Select field..." />
				</SelectTrigger>
				<SelectContent>
					{isLoading ? (
						<SelectItem value="loading" disabled>
							Loading...
						</SelectItem>
					) : customFields && customFields.length > 0 ? (
						customFields.map((field) => (
							<SelectItem key={field.id} value={field.name}>
								{field.name}
							</SelectItem>
						))
					) : (
						<SelectItem value="no-fields" disabled>
							No custom fields available
						</SelectItem>
					)}
				</SelectContent>
			</Select>
		</div>
	);
};
