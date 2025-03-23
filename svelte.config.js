import adapter from '@sveltejs/adapter-vercel'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

// Default bypass token - this is only used during local development
// In production, this should be set as a secure environment variable
const DEFAULT_BYPASS_TOKEN = 'c6a07c8e9ad8b8f0e6a5c5f4d3b2a1e0d9c8b7a6d5e4f3c2b1a0p1o2i3u4y5t6r7e8w9q0';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			// Specify Node.js 18 as the runtime
			runtime: 'nodejs18.x',
			// Use environment variable if available, otherwise use default
			bypassToken: process.env.PRERENDER_BYPASS_TOKEN || DEFAULT_BYPASS_TOKEN
		})
	}
}

export default config
