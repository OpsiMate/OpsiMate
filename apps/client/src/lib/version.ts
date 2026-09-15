// What THIS client build is. Vite inlines VITE_APP_* at build time; the release
// workflow sets them from the git tag (see Dockerfile.client), and a local `pnpm dev`
// or an unlabelled build reports "dev" — the honest answer, never a release number
// the build isn't.
export const CLIENT_VERSION: string = import.meta.env.VITE_APP_VERSION?.trim() || 'dev';
export const CLIENT_COMMIT: string | null = import.meta.env.VITE_APP_COMMIT?.trim() || null;
export const CLIENT_BUILD_DATE: string | null = import.meta.env.VITE_APP_BUILD_DATE?.trim() || null;

export const isReleaseVersion = (version: string): boolean => /^\d+\.\d+\.\d+$/.test(version);

// "v0.0.110" for releases, "dev" / "dev · a1b2c3d" otherwise.
export const formatVersion = (version: string, commit: string | null = null): string => {
	if (isReleaseVersion(version)) return `v${version}`;
	return commit ? `${version} · ${commit.slice(0, 7)}` : version;
};

export const releaseNotesUrl = (version: string): string =>
	isReleaseVersion(version)
		? `https://github.com/OpsiMate/OpsiMate/releases/tag/v${version}`
		: 'https://github.com/OpsiMate/OpsiMate/releases';

// Numeric semver compare on the "a.b.c" form only; anything else is "unknown"
// (null) rather than a guess — a dev build is never "behind" a release.
export const compareVersions = (a: string, b: string): number | null => {
	if (!isReleaseVersion(a) || !isReleaseVersion(b)) return null;
	const pa = a.split('.').map(Number);
	const pb = b.split('.').map(Number);
	for (let i = 0; i < 3; i++) {
		if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
	}
	return 0;
};
