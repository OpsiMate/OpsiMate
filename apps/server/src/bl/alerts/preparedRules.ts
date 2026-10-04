import { Alert } from '@OpsiMate/shared';

// A rule set (enrichments, mute policies) loaded once and turned into a per-alert
// function, with a key that changes whenever the rules would produce different
// output. The alerts snapshot keeps each alert's result between rebuilds and reuses
// it while the key, the alert and its per-alert inputs are unchanged.
export interface PreparedRules {
	key: string;
	apply: (alert: Alert) => Alert;
}
