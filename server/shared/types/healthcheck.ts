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
	termdbs?: TermdbsInfo
}

type DbInfo = {
	buildDate: string // "unknown" or a Date-convertible string
	tables?: GenomeDbTableInfo
}

type GenomeDbTableInfo = {
	[index: string]: int
}

type TermdbsInfo = {
	[index: string]: DbInfo
}

/**
 * @interface
 */
export type HealthCheckResponse = {
	status: 'ok' | 'error'
	error?: any
	genomes?: BuildByGenome
	versionInfo: VersionInfo
	w?: number[]
	rs?: number
}

export const api = {
	method: 'get',
	requestType: null,
	responseType: HealthCheckResponse
}
