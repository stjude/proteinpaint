import type { RoutePayload } from './routeApi.js'

export type HealthcheckRequest = {
	dslabel?: string
}

/**
 * Information aboute the server build version and dates,
 * including the date when the server was last launched
 */
export type VersionInfo = {
	pkgver: string
	codedate: string
	launchdate: string
	deps: {
		[pkgName: string]: {
			/** the version as found in node_modules/[package]/package.json */
			installed?: string
			/** the version as entered in the project's package.dependencies */
			entry?: string
		}
	}
}

type BuildByGenome = {
	[index: string]: GenomeBuildInfo
}

export type GenomeBuildInfo = {
	genedb: DbInfo
	termdbs?: {
		[index: string]: DbInfo
	}
}

type DbInfo = {
	buildDate: string // "unknown" or a Date-convertible string
	tables?: {
		[index: string]: number
	}
}

/**
 * Server status and data related to it's health
 */
export type HealthCheckResponse = {
	status: 'ok' | 'error'
	genomes: BuildByGenome
	versionInfo: VersionInfo
	byDataset: {
		[dslabel: string]: any
	}
	auth?: {
		errors?: string[]
	}[]
	w?: number[]
	rs?: number
}

export const healthcheckPayload: RoutePayload = {
	request: {
		typeId: 'HealthCheckRequest'
	},
	response: {
		typeId: 'HealthCheckResponse'
	}
	// examples: []
}
