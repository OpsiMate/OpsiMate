declare module 'sshpk' {
	export interface Key {
		type: string;
		size: number;
		comment?: string;
		source?: string;
	}
	export function parseKey(data: string | Buffer, format?: string, name?: string): Key;
}
