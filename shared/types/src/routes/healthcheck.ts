export type HealthCheckRequest = {
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
	/** host-specific image name from public/host-image.txt (e.g. "pp-irt:v2.204.0-92b3ab96");
	 * absent when the file is not present (e.g. a non-host-image container or local dev) */
	hostImage?: string
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
 * Counts of configured datasets by init status, to quickly detect a dataset that did not load.
 * total == done + nonblocking + retrying + failed
 */
export type DsSummary = {
	/** number of datasets configured in serverconfig genomes[].datasets[], minus skipped/filtered entries */
	total: number
	/** finished loading and ready to serve requests */
	done: number
	/** usable, still running non-blocking init steps */
	nonblocking: number
	/** failed with a recoverable error, with active init retries */
	retrying: number
	/** did not load, will not retry; the dataset does not serve requests */
	failed: number
}

/** init status of a single configured dataset, including one that failed to load */
export type DsInitStatus = {
	genome: string
	label: string
	/** healthcheck url for the dataset-specific getHealth(), if implemented by the dataset */
	url: string
	/** copy of the server-side ds.init, e.g. {status, error, fatalError, currentRetry, ignoredErrors} */
	init: {
		status?: string
		error?: any
		fatalError?: any
		[key: string]: any
	}
}

/**
 * Server status and data related to it's health
 */
export type HealthCheckResponse = {
	/**
	 * status of the server process itself, NOT of its datasets: a server that is up with a failed
	 * dataset still reports 'ok', since the k8s liveness and readiness probes request this route.
	 * Use dsSummary.failed and dsInitStatus[] to detect dataset failures.
	 */
	status: 'ok' | 'error'
	genomes: BuildByGenome
	versionInfo: VersionInfo
	byDataset?: {
		[dslabel: string]: any
	}
	auth?: {
		errors?: string[]
	}
	w?: number[]
	rs?: number
	dsSummary: DsSummary
	dsInitStatus: DsInitStatus[]
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
