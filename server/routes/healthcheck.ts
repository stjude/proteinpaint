import { getStat } from '#src/health'

export const api = {
	endpoint: 'healthcheck',
	methods: {
		get: {
			init({ genomes }) {
				return async (req: any, res: any): Promise<void> => {
					try {
						const health = await getStat(genomes)
						res.send(health)
					} catch (e: any) {
						res.send({ status: 'error', error: e.message || e })
					}
				}
			},
			request: {
				typeId: 'null'
				//valid: default to type checker
			},
			response: {
				typeId: 'HealthCheckResponse'
				// will combine this with type checker
				//valid: (t) => {}
			},
			examples: [
				{
					request: {
						//header/body/params // fetch opts
					},
					response: {
						status: 200
					}
				},
				{
					request: {
						//header/body/params // fetch opts
					},
					response: {
						status: 400 // malformed request
					}
				}
			]
		}
	}
}

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
 * Server sttus and data related to it's health
 */
export type HealthCheckResponse = {
	status: 'ok' | 'error'
	genomes: BuildByGenome
	versionInfo: VersionInfo
	w?: number[]
	rs?: number
}
