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

export type BuildByGenome = {
	[index: string]: GenomeBuildInfo
}

export type GenomeBuildInfo = {
	genedb: DbInfo
	termdbs?: TermdbsInfo
}

export type DbInfo = {
	buildDate: string // "unknown" or a Date-convertible string
	tables?: GenomeDbTableInfo
}

export type GenomeDbTableInfo = {
	[index: string]: int
}

export type TermdbsInfo = {
	[index: string]: DbInfo
}

/**
 * The response data shape from the /healthcheck endpoint
 */
export type HealthCheckResponse =
	| { status: 'error'; message: string }
	| {
			status: 'ok'
			genomes?: BuildByGenome
			versionInfo: VersionInfo
			w?: number[]
			rs?: number
	  }
