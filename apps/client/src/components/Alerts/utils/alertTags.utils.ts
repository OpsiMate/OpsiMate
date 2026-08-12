// Tag presentation logic lives in @OpsiMate/shared so the server searches and facets
// with identical semantics (hidden keys included).
export {
	HIDDEN_TAG_KEYS,
	getAlertTagsArray,
	getAlertTagsString,
	getAlertPrimaryTag,
	hasAlertTags,
	alertMatchesTagFilter,
	getAlertTagEntries,
} from '@OpsiMate/shared';
