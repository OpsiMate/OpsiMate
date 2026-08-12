// Tag-key column helpers live in @OpsiMate/shared so the server can address the same
// tagKey:<key> filter/sort fields the client uses.
export { TAG_KEY_COLUMN_PREFIX, getTagKeyColumnId, isTagKeyColumn, extractTagKeyFromColumnId } from '@OpsiMate/shared';

export interface TagKeyInfo {
	key: string;
	label: string;
	values: string[];
}
