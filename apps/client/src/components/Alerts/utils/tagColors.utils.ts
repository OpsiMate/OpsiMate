const STORAGE_KEY = 'tagKeyColors';

interface TagColorMap {
	[key: string]: {
		background: string;
		text: string;
	};
}

const PASTEL_HUES = [
	0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345,
];

const getContrastColor = (hslColor: string): string => {
	const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
	if (!match) return 'hsl(0, 0%, 20%)';

	const lightness = parseInt(match[3], 10);
	return lightness > 60 ? 'hsl(0, 0%, 20%)' : 'hsl(0, 0%, 98%)';
};

const getHueFromColor = (color: string): number | null => {
	const match = color.match(/hsl\((\d+),/);
	return match ? parseInt(match[1], 10) : null;
};

const generateColorFromString = (
	str: string,
	usedColors: Set<string> = new Set(),
	usedHues: Set<number> = new Set()
): { background: string; text: string } => {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	}

	const startIndex = Math.abs(hash) % PASTEL_HUES.length;
	let hueIndex = startIndex;
	let attempts = 0;
	const maxAttempts = PASTEL_HUES.length * 3;

	// Try to find a unique color combination
	while (attempts < maxAttempts) {
		// First try to find an unused hue
		if (attempts < PASTEL_HUES.length) {
			const index = (startIndex + attempts) % PASTEL_HUES.length;
			if (!usedHues.has(PASTEL_HUES[index])) {
				hueIndex = index;
			}
		}

		const hue = PASTEL_HUES[hueIndex];
		// Vary saturation and lightness more to ensure uniqueness
		const saturation = 35 + ((Math.abs(hash) + attempts) % 20);
		const lightness = 75 + ((Math.abs(hash * 7) + attempts * 3) % 15);

		const background = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

		// Check if this exact color is already used
		if (!usedColors.has(background)) {
			const text = getContrastColor(background);
			return { background, text };
		}

		attempts++;
		// Try next hue if we've exhausted saturation/lightness variations
		if (attempts % 3 === 0) {
			hueIndex = (hueIndex + 1) % PASTEL_HUES.length;
		}
	}

	// Fallback: use the hash-based color even if it might collide
	const hue = PASTEL_HUES[hueIndex];
	const saturation = 35 + (Math.abs(hash) % 20);
	const lightness = 75 + (Math.abs(hash * 7) % 15);
	const background = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
	const text = getContrastColor(background);

	return { background, text };
};

const migrateOldFormat = (data: unknown): TagColorMap => {
	if (!data || typeof data !== 'object') return {};
	const migrated: TagColorMap = {};
	for (const [key, value] of Object.entries(data)) {
		if (typeof value === 'string') {
			migrated[key] = {
				background: value,
				text: getContrastColor(value),
			};
		} else if (value && typeof value === 'object' && 'background' in value && 'text' in value) {
			migrated[key] = value as { background: string; text: string };
		}
	}
	return migrated;
};

const fixColorCollisions = (colors: TagColorMap): TagColorMap => {
	const colorToKeys = new Map<string, string[]>();
	const fixed: TagColorMap = { ...colors };

	// Find collisions
	Object.entries(colors).forEach(([key, colorData]) => {
		const bg = colorData.background;
		if (!colorToKeys.has(bg)) {
			colorToKeys.set(bg, []);
		}
		colorToKeys.get(bg)!.push(key);
	});

	// Fix collisions
	colorToKeys.forEach((keys, color) => {
		if (keys.length > 1) {
			// Multiple keys share the same color - regenerate for all but the first
			const usedColors = new Set<string>();
			const usedHues = new Set<number>();

			// Collect all existing colors (excluding the ones we're fixing)
			Object.entries(fixed).forEach(([key, colorData]) => {
				if (!keys.includes(key)) {
					usedColors.add(colorData.background);
					const h = getHueFromColor(colorData.background);
					if (h !== null) usedHues.add(h);
				}
			});

			// Keep first key's color, regenerate others
			for (let i = 1; i < keys.length; i++) {
				const key = keys[i];
				usedColors.add(fixed[key].background);
				fixed[key] = generateColorFromString(key, usedColors, usedHues);
				usedColors.add(fixed[key].background);
				const h = getHueFromColor(fixed[key].background);
				if (h !== null) usedHues.add(h);
			}
		}
	});

	return fixed;
};

const loadColorsFromStorage = (): TagColorMap => {
	if (typeof window === 'undefined') return {};
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return {};
		const parsed = JSON.parse(stored);
		const migrated = migrateOldFormat(parsed);
		const fixed = fixColorCollisions(migrated);
		if (JSON.stringify(fixed) !== JSON.stringify(migrated)) {
			saveColorsToStorage(fixed);
		}
		return fixed;
	} catch {
		return {};
	}
};

const saveColorsToStorage = (colors: TagColorMap): void => {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
	} catch {
		// Ignore storage errors
	}
};

export const getTagKeyColor = (tagKey: string): { background: string; text: string } => {
	const colors = loadColorsFromStorage();

	if (!colors[tagKey]) {
		const usedColors = new Set<string>();
		const usedHues = new Set<number>();

		// Collect all used colors and hues
		Object.entries(colors).forEach(([key, colorData]) => {
			if (key !== tagKey) {
				usedColors.add(colorData.background);
				const h = getHueFromColor(colorData.background);
				if (h !== null) usedHues.add(h);
			}
		});

		colors[tagKey] = generateColorFromString(tagKey, usedColors, usedHues);
		saveColorsToStorage(colors);
	}

	return colors[tagKey];
};

export const setTagKeyColor = (tagKey: string, background: string, text?: string): void => {
	const colors = loadColorsFromStorage();
	colors[tagKey] = {
		background,
		text: text || getContrastColor(background),
	};
	saveColorsToStorage(colors);
};

export const getAllTagKeyColors = (): TagColorMap => {
	return loadColorsFromStorage();
};
