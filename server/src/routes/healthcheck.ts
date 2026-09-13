import { versionInfo, getDsInitStatus } from '#src/health.ts'
import type { HealthCheckRequest, HealthCheckResponse, RouteApi, GenomeBuildInfo } from '#types'
import { authApi } from '../auth.js'

export const api: RouteApi = {
	endpoint: 'healthcheck', // responds with more details than /live, to help with troubleshooting
	methods: {
		// Support GET method only, since the URL is expected to be short.
		// There is no need for a fallback to use POST method + body for large payloads that,
		// when encode and added as query paramters, exceed common URL string length limit .
		get: {
			init,
			request: { typeId: 'HealthCheckRequest' /*, checkers: TODO write validator */ },
			response: { typeId: 'HealthCheckResponse' }
		}
	}
}

export function init(arg) {
	const genomes: any = arg.genomes
	const genomeDbInfo = getGenomeDbInfo(genomes)

	// these will be set during a /healthcheck request handler call below
	let auth: undefined | { errors?: string[] }
	let status: 'ok' | 'error' | undefined

	return async (req, res): Promise<void> => {
		try {
			if (status === undefined) {
				// authApi is set on first call of getAuthApi() by src/app.ts, setting inside this function call
				// since it may not be available at module load time or during route handler init; the presence
				// of auth credentials gates need to be checked only once, it may require HTTP requests that exercise
				// expected credentials check
				auth = await authApi.getHealth()
				// NOTE: status describes the server process, not its datasets: a failed dataset must not
				// make an otherwise working server look down, since the k8s liveness and readiness probes
				// both request this route. Dataset failures are reported in dsSummary and dsInitStatus.
				status = auth?.errors?.length ? 'error' : 'ok'
			}
			const q: HealthCheckRequest = req.query
			//const result = validHealthCheckRequest(q)
			//if (!result.success) throw result.errors
			const health: HealthCheckResponse = {
				status,
				versionInfo,
				auth,
				...(await getDsInitStatus()),
				genomes: genomeDbInfo
			}
			if (q.dslabel) {
				for (const gn in genomes) {
					const ds = genomes[gn]?.datasets?.[q.dslabel]
					if (!ds?.getHealth) continue
					if (!health.byDataset) health.byDataset = {}
					if (!health.byDataset[q.dslabel]) health.byDataset[q.dslabel] = {}
					health.byDataset[q.dslabel][gn] = ds.getHealth(ds)
				}
			}
			res.send(health)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

// compute genome db info once. It is expected for the server route endpoints and handlers
// to be set after the genome and dataset validation are done
function getGenomeDbInfo(genomes) {
	const dbInfoByGenome = {}
	// report status of every genome
	for (const [gn, genome] of Object.entries(genomes as { [name: string]: any })) {
		if (!('dbInfo' in genome)) {
			// set only once and track using the genome object
			const dbInfo = {} as GenomeBuildInfo // object to store status of this genome
			if (genome.genedb) {
				// genedb status
				dbInfo.genedb = {
					buildDate: genome.genedb.get_buildDate?.get().date || 'unknown',
					tables: genome.genedb.tableSize
				}
			}
			if (genome.termdbs) {
				// genome-level termdb status e.g. msigdb
				dbInfo.termdbs = {}
				for (const key in genome.termdbs) {
					const db = genome.termdbs[key]
					dbInfo.termdbs[key] = {
						buildDate: db.cohort.termdb.q.get_buildDate?.get().date || 'unknown'
					}
				}
			}
			genome.dbInfo = Object.keys(dbInfo).length ? dbInfo : undefined
		}
		// NOTE: dataset init status is reported from the tracked datasets, see getDsInitStatus()
		dbInfoByGenome[gn] = genome.dbInfo
	}
	return dbInfoByGenome
}
