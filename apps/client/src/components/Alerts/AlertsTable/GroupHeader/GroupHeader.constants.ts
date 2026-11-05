// Accessible names for the group header's checkbox; the group's label ("Status: firing")
// tells headers apart for screen reader users moving between checkboxes.
export const GROUP_SELECTION_LABELS = (groupLabel: string): Record<'select' | 'unselect', string> => ({
	select: `Select the alerts of group ${groupLabel}`,
	unselect: `Unselect the alerts of group ${groupLabel}`,
});
