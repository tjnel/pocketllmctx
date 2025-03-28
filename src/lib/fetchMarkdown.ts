import type { PresetConfig } from '$lib/presets'
import { dev } from '$app/environment'
import tarStream from 'tar-stream'
import { Readable } from 'stream'
import { createGunzip } from 'zlib'
import { minimatch } from 'minimatch'
import { fetchWebDocs } from './fetchWebDocs'

import type { MinimizeOptions } from './types'

// Main function to fetch and process markdown files
export async function fetchAndProcessMarkdown(preset: PresetConfig): Promise<string> {
	if (preset.type === 'github') {
		const files = await fetchMarkdownFiles(preset)
		if (dev) {
			console.log(`Fetched ${files.length} files for ${preset.title}`)
		}
		return files.join(' ')
	} else if (preset.type === 'web') {
		if (!preset.baseUrl) {
			throw new Error('baseUrl is required for web documentation')
		}
		const content = await fetchWebDocs({
			title: preset.title,
			baseUrl: preset.baseUrl,
			urlPatterns: preset.urlPatterns || [],
			minimize: preset.minimize
		})
		return content
	}
	throw new Error('Invalid preset type')
}

// Fetch markdown files using GitHub's tarball API
async function fetchMarkdownFiles(preset: PresetConfig): Promise<string[]> {
	const { owner, repo, glob, minimize } = preset
	if (!owner || !repo || !glob) {
		throw new Error('owner, repo, and glob are required for GitHub documentation')
	}
	// Construct the tarball URL
	const url = `https://api.github.com/repos/${owner}/${repo}/tarball`

	if (dev) {
		console.log(`Fetching tarball from: ${url}`)
	}

	// Fetch the tarball
	const response = await fetch(url, {
		headers: {
			Accept: 'application/vnd.github.v3.raw'
		}
	})

	if (!response.ok) {
		throw new Error(`Failed to fetch tarball: ${response.statusText}`)
	}

	const contents: string[] = []
	const extractStream = tarStream.extract()

	let processedFiles = 0
	let matchedFiles = 0

	// Process each file in the tarball
	extractStream.on('entry', (header, stream, next) => {
		processedFiles++
		const isAllowed = glob.some((pattern: string) => {
			const isNegated = pattern.startsWith('!')
			const matchPattern = isNegated ? pattern.slice(1) : pattern
			const matches = minimatch(header.name, matchPattern)
			return isNegated ? !matches : matches
		})

		if (dev) {
			if (isAllowed) {
				console.info(`Allowed file: ${header.name}`)
			}
		}

		if (header.type === 'file' && isAllowed) {
			matchedFiles++
			let content = ''
			stream.on('data', (chunk) => (content += chunk.toString()))
			stream.on('end', () => {
				contents.push(minimizeContent(content, minimize))
				if (dev) {
					console.log(`Processed file: ${header.name}`)
				}
				next()
			})
		} else {
			stream.resume()
			next()
		}
	})

	// Create a readable stream from the response body
	const tarballStream = Readable.from(Buffer.from(await response.arrayBuffer()))

	// Create a gunzip stream
	const gunzipStream = createGunzip()

	// Pipe the tarball stream through gunzip to the extract stream
	tarballStream.pipe(gunzipStream).pipe(extractStream)

	// Wait for the extraction to complete
	await new Promise<void>((resolve) => extractStream.on('finish', resolve))

	if (dev) {
		console.log(`Total files processed: ${processedFiles}`)
		console.log(`Files matching glob: ${matchedFiles}`)
	}

	return contents
}

interface MinimizeOptions {
	normalizeWhitespace: boolean
	removeCodeBlocks: boolean
	removeSquareBrackets: boolean
	removeParentheses: boolean
	trim: boolean
}

const defaultOptions: MinimizeOptions = {
	normalizeWhitespace: true,
	removeCodeBlocks: true,
	removeSquareBrackets: true,
	removeParentheses: true,
	trim: true
}

export function minimizeContent(content: string, options?: Partial<MinimizeOptions>): string {
	// Merge with defaults, but only for properties that are defined
	const settings: MinimizeOptions = options ? { ...defaultOptions, ...options } : defaultOptions

	let minimized = content

	if (settings.normalizeWhitespace) {
		console.log('Normalizing whitespace')
		minimized = minimized.replace(/\s+/g, ' ')
	}

	if (settings.removeCodeBlocks) {
		console.log('Removing code blocks')
		minimized = minimized.replace(/```[\s\S]*?```/g, '')
	}

	if (settings.removeSquareBrackets) {
		console.log('Removing square brackets')
		minimized = minimized.replace(/\[.*?\]/g, '')
	}

	if (settings.removeParentheses) {
		console.log('Removing parentheses')
		minimized = minimized.replace(/\(.*?\)/g, '')
	}

	if (settings.trim) {
		console.log('Trimming whitespace')
		minimized = minimized.trim()
	}

	if (dev) {
		console.log(`Original content length: ${content.length}`)
		console.log(`Minimized content length: ${minimized.length}`)
		console.log('Applied minimizations:', JSON.stringify(settings, null, 2))
	}

	return minimized
}
