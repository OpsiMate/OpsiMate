export const CHIP_CLASS = 'max-w-full rounded-md px-1.5 py-0 text-[11px] leading-5 font-normal text-muted-foreground';
export const ID_CHIP_TITLE = 'Alert ID — click the value to select it';
export const LABELS_CHIPS_TEST_ID = 'alert-labels-chips';

export const labelsCountText = (count: number): string => (count === 1 ? '1 label' : `${count} labels`);
export const labelsTriggerAriaLabel = (count: number): string =>
	`Labels: ${labelsCountText(count)}. Opens the alert id and labels`;
