import { API_HOST } from '@/lib/api';
import { isPlaygroundMode } from '@/lib/playground';
import { CLIENT_VERSION, compareVersions, isReleaseVersion } from '@/lib/version';
import { AppVersionInfo } from '@OpsiMate/shared';
import { useQuery } from '@tanstack/react-query';

// The running SERVER's build (GET /version, unauthenticated). Cached for the session:
// it cannot change without a restart, and the sidebar mounts on every page.
export const useServerVersion = () =>
	useQuery({
		queryKey: ['appVersion', 'server'],
		queryFn: async (): Promise<AppVersionInfo> => {
			const res = await fetch(`${API_HOST}/version`);
			if (!res.ok) throw new Error(`version: HTTP ${res.status}`);
			const body = (await res.json()) as { data: AppVersionInfo };
			return body.data;
		},
		staleTime: Infinity,
		retry: 1,
		enabled: !isPlaygroundMode(),
	});

interface LatestRelease {
	version: string;
	url: string;
}

// The newest published release on GitHub — the "update available" signal. One
// unauthenticated GitHub API call, cached for a day, and only asked when this build
// is a real release (a dev build is never "behind"). Failures are silent: the badge
// simply doesn't show the dot.
export const useLatestRelease = (currentVersion: string) =>
	useQuery({
		queryKey: ['appVersion', 'latestRelease'],
		queryFn: async (): Promise<LatestRelease | null> => {
			const res = await fetch('https://api.github.com/repos/OpsiMate/OpsiMate/releases/latest', {
				headers: { Accept: 'application/vnd.github+json' },
			});
			if (!res.ok) return null;
			const body = (await res.json()) as { tag_name?: string; html_url?: string };
			const version = body.tag_name?.replace(/^v/, '') ?? '';
			return isReleaseVersion(version) && body.html_url ? { version, url: body.html_url } : null;
		},
		staleTime: 24 * 60 * 60 * 1000,
		retry: false,
		enabled: isReleaseVersion(currentVersion) && !isPlaygroundMode(),
	});

// Everything the version badge needs, resolved. The server's version is the source
// of truth for "what am I running" (it's what a support thread needs); the client's
// own build is surfaced when the two disagree, which is itself worth knowing.
export const useAppVersion = () => {
	const server = useServerVersion();
	const version = server.data?.version ?? CLIENT_VERSION;
	const latest = useLatestRelease(version);
	const cmp = latest.data ? compareVersions(version, latest.data.version) : null;
	return {
		version,
		commit: server.data?.commit ?? null,
		buildDate: server.data?.buildDate ?? null,
		clientVersion: CLIENT_VERSION,
		mismatch: server.data ? server.data.version !== CLIENT_VERSION : false,
		updateAvailable: cmp === -1 ? latest.data : null,
	};
};
