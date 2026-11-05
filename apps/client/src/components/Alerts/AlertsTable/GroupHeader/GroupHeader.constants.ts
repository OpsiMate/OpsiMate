// Indentation per nesting level, matching the group tree's.
export const INDENT_PER_LEVEL_PX = 24;

// Accessible names for the group header's checkbox; the group's label ("Status: firing")
// tells headers apart for screen reader users moving between checkboxes. When only some
// of the group's alerts are loaded, the names say so: the checkbox acts on those alone.
export const GROUP_SELECTION_LABELS = {
	select: (groupLabel: string) => `Select the alerts of group ${groupLabel}`,
	unselect: (groupLabel: string) => `Unselect the alerts of group ${groupLabel}`,
	selectLoaded: (groupLabel: string, loaded: number, total: number) =>
		`Select the ${loaded} loaded alerts of group ${groupLabel} (${total} in total)`,
	unselectLoaded: (groupLabel: string, loaded: number, total: number) =>
		`Unselect the ${loaded} loaded alerts of group ${groupLabel} (${total} in total)`,
	// Tooltip on a partially loaded group's checkbox.
	partialHint: (loaded: number, total: number) =>
		`Only ${loaded} of this group's ${total} alerts are loaded; the checkbox selects those.`,
};
