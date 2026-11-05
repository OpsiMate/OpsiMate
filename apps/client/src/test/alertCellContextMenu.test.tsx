import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Alert } from '@OpsiMate/shared';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { AlertCellContextMenu } from '@/components/Alerts/AlertsTable/AlertRow/AlertCellContextMenu';
import { copyValueOf, previewValue } from '@/components/Alerts/AlertsTable/AlertRow/AlertRow.utils';

// Right-click copy on alert rows: a selection-free way to copy a cell now that dragging
// across its text drags the row.

describe('copyValueOf', () => {
	const cellFor = (html: string) => {
		const table = document.createElement('table');
		table.innerHTML = `<tbody><tr>${html}</tr></tbody>`;
		document.body.appendChild(table);
		return table.querySelector('td')!;
	};

	test("prefers the cell's full value over its (truncated) text", () => {
		const td = cellFor('<td data-copy-value="2026-11-04T10:44:48.000Z"><span>10:44:48</span></td>');
		expect(copyValueOf(td.firstElementChild)).toBe('2026-11-04T10:44:48.000Z');
	});

	test('falls back to the text, and gives nothing for empty, checkbox or non-cell targets', () => {
		expect(copyValueOf(cellFor('<td>  Idan QA </td>'))).toBe('Idan QA');
		expect(copyValueOf(cellFor('<td><button aria-label="x"></button></td>'))).toBeNull();
		expect(copyValueOf(cellFor('<td data-select-cell>x</td>'))).toBeNull();
		// A placeholder cell ("-") declares it has nothing to copy.
		expect(copyValueOf(cellFor('<td data-copy-value="">-</td>'))).toBeNull();
		expect(copyValueOf(document.body)).toBeNull();
		expect(copyValueOf(null)).toBeNull();
	});
});

describe('previewValue', () => {
	test('collapses whitespace and truncates with an ellipsis', () => {
		expect(previewValue('  a\n  b  ', 40)).toBe('a b');
		expect(previewValue('x'.repeat(50), 10)).toBe('xxxxxxxxx…');
	});
});

describe('AlertCellContextMenu', () => {
	const writeText = vi.fn().mockResolvedValue(undefined);
	beforeEach(() => {
		writeText.mockClear();
		Object.assign(navigator, { clipboard: { writeText } });
	});
	const alert = { id: 'a', alertName: 'Disk almost full', summary: '  <b>/dev/sda1</b> at 97%  ' } as Alert;
	const open = (cellValue: string | null) => {
		render(
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<div>row</div>
				</ContextMenuTrigger>
				<AlertCellContextMenu alert={alert} cellValue={cellValue} />
			</ContextMenu>
		);
		fireEvent.contextMenu(screen.getByText('row'));
	};

	test('offers the clicked value (with a preview), the alert name and the summary', async () => {
		open('playground alert 1');
		expect(await screen.findByText('Copy value')).toBeInTheDocument();
		expect(screen.getByText('playground alert 1')).toBeInTheDocument();
		fireEvent.click(screen.getByText('Copy alert name'));
		await waitFor(() => expect(writeText).toHaveBeenCalledWith('Disk almost full'));
	});

	test('copies the summary as plain text, trimmed; no "Copy value" when the click was not on a cell', async () => {
		open(null);
		expect(await screen.findByText('Copy alert name')).toBeInTheDocument();
		expect(screen.queryByText('Copy value')).toBeNull();
		fireEvent.click(screen.getByText('Copy summary'));
		await waitFor(() => expect(writeText).toHaveBeenCalledWith('/dev/sda1 at 97%'));
	});
});
