/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_PLAYGROUND_MODE?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
