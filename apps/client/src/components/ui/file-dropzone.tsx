import React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

type FileDropzoneProps = {
	id: string;
	accept?: string;
	onFile: (file: File) => void;
	placeholder?: string;
	loading?: boolean;
	className?: string;
	multiple?: boolean;
};

export const FileDropzone = ({
	id,
	accept,
	onFile,
	placeholder = 'Click to select a file or drag & drop here',
	loading = false,
	className,
	multiple = false,
}: FileDropzoneProps) => {
	const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		const files = Array.from(e.dataTransfer.files);
		if (multiple) {
			files.forEach(file => onFile(file));
		} else {
			const file = files[0];
			if (file) onFile(file);
		}
	};

	const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || []);
		if (multiple) {
			files.forEach(file => onFile(file));
		} else {
			const file = files[0];
			if (file) onFile(file);
		}
	};

	return (
		<div
			onDragOver={e => e.preventDefault()}
			onDrop={onDrop}
			className={cn(
				'relative group flex flex-col items-center justify-center border-2 border-dashed rounded-md p-6 py-12 text-center hover:bg-accent',
				className
			)}
		>
			<input id={id} type="file" accept={accept} multiple={multiple} onChange={onSelect} className="hidden" />
			<Label
				htmlFor={id}
				className="absolute inset-0 flex items-center justify-center cursor-pointer transition-colors group-hover:text-white"
			>
				{loading ? 'Uploading...' : placeholder}
			</Label>
		</div>
	);
};
