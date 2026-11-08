// Focus that owns Cmd/Ctrl+C itself: the browser copies from these, we stay out.
export const EDITABLE_TARGET_SELECTOR = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
// What the "Copied!" toast says after the shortcut.
export const CELL_COPIED_DESCRIPTION = (preview: string): string => `${preview} copied`;
