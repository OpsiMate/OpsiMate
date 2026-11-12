import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ComponentProps } from 'react';

interface InputFieldProps extends ComponentProps<typeof Input> {
	id: string;
	label: string;
	as?: 'input';
}

interface TextareaFieldProps extends ComponentProps<typeof Textarea> {
	id: string;
	label: string;
	as: 'textarea';
}

// A union of the two shapes; `as` picks which one applies.
export type LabeledFieldProps = InputFieldProps | TextareaFieldProps;

const Field = (props: LabeledFieldProps) => {
	if (props.as === 'textarea') {
		const { as: _as, label: _label, ...rest } = props;
		return <Textarea {...rest} />;
	}
	const { as: _as, label: _label, ...rest } = props;
	return <Input {...rest} />;
};

export const LabeledField = (props: LabeledFieldProps) => (
	<div className="space-y-2">
		<Label htmlFor={props.id}>{props.label}</Label>
		<Field {...props} />
	</div>
);
