/**
 * for documentation only, to signify integer: not type-checked statically
 */
type int = number

/**
 * Information aboute the server build version and dates,
 * including the date when the server was last launched
 */
export type VersionInfo = {
	pkgver: string
	codedate: string
	launchdate: string
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
		[index: string]: int
	}
}

/**
 * The response data shape from the /healthcheck endpoint
 */
export type HealthCheckResponse = /*{ status: 'error'; error: string }
	|*/ {
	status: 'ok' | 'error'
	genomes: BuildByGenome
	versionInfo: VersionInfo
	w?: number[]
	rs?: number
}
