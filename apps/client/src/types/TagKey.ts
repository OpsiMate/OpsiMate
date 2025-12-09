export interface TagKeyInfo {
	key: string;
	label: string;
	values: string[];
}

export const TAG_KEY_COLUMN_PREFIX = 'tagKey:';

export const getTagKeyColumnId = (tagKey: string): string => `${TAG_KEY_COLUMN_PREFIX}${tagKey}`;

export const isTagKeyColumn = (columnId: string): boolean => columnId.startsWith(TAG_KEY_COLUMN_PREFIX);

export const extractTagKeyFromColumnId = (columnId: string): string | null => {
	if (!isTagKeyColumn(columnId)) return null;
	return columnId.slice(TAG_KEY_COLUMN_PREFIX.length);
};
