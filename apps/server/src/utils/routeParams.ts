import { Request } from 'express';

/**
 * Express 5 types a route parameter as `string | string[]`, because one path can bind the
 * same name twice. Every OpsiMate route binds each name once, so this returns that single
 * value; a parameter the route did not produce reads back as an empty string, which the
 * existing `if (!id)` guards already answer with a 400.
 */
export const routeParam = (req: Request, name: string): string => {
	const value = req.params[name];
	if (typeof value === 'string') return value;
	if (Array.isArray(value)) return value[0] ?? '';
	return '';
};
