// How an LDAP connection is protected. Derived from the URL scheme and the StartTLS
// flag rather than stored on its own, so the URL and the choice can never disagree.
export type SecurityMode = 'ldaps' | 'starttls' | 'none';

export interface ConnectionFields {
	url: string;
	startTls: boolean;
}

export const isLdaps = (url: string): boolean => /^ldaps:\/\//i.test(url.trim());

// An empty URL counts as LDAPS: the recommended choice, and what picking it would write.
export const securityModeOf = ({ url, startTls }: ConnectionFields): SecurityMode =>
	url.trim() === '' || isLdaps(url) ? 'ldaps' : startTls ? 'starttls' : 'none';

// Rewrite the URL for the chosen mode: the scheme always, the port only when it is the
// standard one for the scheme being left (a custom port is kept as typed). The port
// sits before any path, so "ldap://host:389/dc=x" becomes "ldaps://host:636/dc=x".
export const withSecurityMode = <T extends ConnectionFields>(fields: T, mode: SecurityMode): T => {
	const ldaps = mode === 'ldaps';
	const scheme = ldaps ? 'ldaps://' : 'ldap://';
	let url = fields.url.trim();
	url = /^ldaps?:\/\//i.test(url) ? url.replace(/^ldaps?:\/\//i, scheme) : `${scheme}${url}`;
	url = url.replace(ldaps ? /:389(?=\/|$)/ : /:636(?=\/|$)/, ldaps ? ':636' : ':389');
	return { ...fields, url, startTls: mode === 'starttls' };
};
