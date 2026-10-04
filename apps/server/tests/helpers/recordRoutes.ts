import express from 'express';

// Express 5 routers don't keep their mount paths, so the registered route table can't be
// read back from a built app. Instead, record every get/post/…/use call while the app is
// being built, then walk the mounts from the app's root router.

export interface RecordedRoute {
	method: string;
	path: string;
}

interface RouteEntry {
	kind: 'route';
	method: string;
	path: string;
}

interface MountEntry {
	kind: 'mount';
	path: string;
	child: object;
}

type Entry = RouteEntry | MountEntry;

type RouterMethod = (this: object, ...args: unknown[]) => unknown;

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

const joinPaths = (prefix: string, path: string): string => {
	const joined = `${prefix}/${path}`.replace(/\/+/g, '/');
	return joined.length > 1 ? joined.replace(/\/$/, '') : joined;
};

export const startRecordingRoutes = () => {
	const entries = new WeakMap<object, Entry[]>();
	const proto = Object.getPrototypeOf(Object.getPrototypeOf(express.Router())) as Record<string, RouterMethod>;
	const originals = new Map<string, RouterMethod>();
	const add = (owner: object, entry: Entry): void => {
		const list = entries.get(owner) ?? [];
		list.push(entry);
		entries.set(owner, list);
	};

	for (const method of METHODS) {
		const original = proto[method];
		originals.set(method, original);
		proto[method] = function (this: object, ...args: unknown[]) {
			for (const path of [args[0]].flat()) {
				if (typeof path === 'string') add(this, { kind: 'route', method, path });
			}
			return original.apply(this, args);
		};
	}
	const originalUse = proto.use;
	originals.set('use', originalUse);
	proto.use = function (this: object, ...args: unknown[]) {
		const path = typeof args[0] === 'string' ? args[0] : '/';
		for (const handler of args.flat()) {
			if (typeof handler === 'function' && 'stack' in handler) add(this, { kind: 'mount', path, child: handler });
		}
		return originalUse.apply(this, args);
	};

	return {
		stop: (): void => {
			for (const [name, fn] of originals) proto[name] = fn;
		},
		// Every route reachable from the app, with its full path.
		routesOf: (app: express.Application): RecordedRoute[] => {
			const out: RecordedRoute[] = [];
			const walk = (owner: object, prefix: string): void => {
				for (const entry of entries.get(owner) ?? []) {
					if (entry.kind === 'route') out.push({ method: entry.method, path: joinPaths(prefix, entry.path) });
					else walk(entry.child, joinPaths(prefix, entry.path));
				}
			};
			walk((app as unknown as AppWithRouter).router, '');
			return out;
		},
	};
};

interface AppWithRouter {
	router: object;
}
