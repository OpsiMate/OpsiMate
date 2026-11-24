// Minimal GitHub REST client for the repository automation scripts. No dependencies,
// so a script runs the same under plain `node` locally (with
// `GITHUB_TOKEN=$(gh auth token)`) and inside a workflow job.

const API = 'https://api.github.com';
const PER_PAGE = 100;

export function createClient(token) {
	if (!token) {
		throw new Error('GITHUB_TOKEN is not set');
	}

	async function request(path, { method = 'GET', body } = {}) {
		const response = await fetch(`${API}${path}`, {
			method,
			headers: {
				authorization: `Bearer ${token}`,
				accept: 'application/vnd.github+json',
				'x-github-api-version': '2022-11-28',
				...(body ? { 'content-type': 'application/json' } : {}),
			},
			body: body ? JSON.stringify(body) : undefined,
		});
		if (!response.ok) {
			throw new Error(`${method} ${path} failed: ${response.status} ${await response.text()}`);
		}
		return response.status === 204 ? null : response.json();
	}

	// Follows page numbers until a short page; every endpoint used here supports
	// per_page/page and returns a bare array.
	async function paginate(path) {
		const separator = path.includes('?') ? '&' : '?';
		const items = [];
		for (let page = 1; ; page += 1) {
			const batch = await request(`${path}${separator}per_page=${PER_PAGE}&page=${page}`);
			items.push(...batch);
			if (batch.length < PER_PAGE) {
				return items;
			}
		}
	}

	return { request, paginate };
}

// Appends a markdown block to the job summary when running in Actions, and always
// echoes it to stdout so a local run shows the same report.
export async function report(markdown) {
	console.log(markdown);
	if (process.env.GITHUB_STEP_SUMMARY) {
		const { appendFile } = await import('node:fs/promises');
		await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
	}
}
