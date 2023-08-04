const serverconfig = require('./serverconfig')
const fs = require('fs')
const path = require('path')
const child_process = require('child_process')
const util = require('util')
const execPromise = util.promisify(child_process.exec)
const pkg = require('../package.json')
const docs = require('../shared/doc')

export function handle_healthcheck_closure(genomes: any) {
	return async (req, res): Promise<void> => {
		try {
			const health = await getStat(genomes)
			res.send(health)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

async function getStat(genomes: any): Promise<HealthCheckResponse> {
	const health = {
		status: 'ok',
		genomes: {},
		versionInfo
	} as HealthCheckResponse

	const keys = serverconfig.features.healthcheck_keys || []

	if (keys.includes('w')) {
		const { stdout, stderr } = await execPromise('w | head -n1')
		if (stderr) throw stderr
		health.w = stdout
			.toString()
			.trim()
			.split(' ')
			.slice(-3)
			.map(d => (d.endsWith(',') ? +d.slice(0, -1) : +d))
	}

	if (keys.includes('rs')) {
		const { stdout, stderr } = await execPromise('ps aux | grep rsync -w')
		if (stderr) throw stderr
		health.rs = stdout.toString().trim().split('\n').length - 1
	}

	// report status of every genome
	for (const gn in genomes) {
		const genome = genomes[gn] //; console.log(genome.genedb)
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

		if (Object.keys(dbInfo).length && health.genomes) health.genomes[gn] = dbInfo
	}

	return health
}

/**
 * for documentation only, to signify integer: not type-checked statically
 */
export type int = number

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

export const versionInfo: VersionInfo = {
	pkgver: pkg.version,
	codedate: get_codedate(),
	launchdate: new Date(Date.now()).toString().split(' ').slice(0, 5).join(' ')
}

function get_codedate() {
	const date1 = fs.statSync(serverconfig.binpath + '/server.js').mtime
	const date2 = (fs.existsSync('public/bin/proteinpaint.js') && fs.statSync('public/bin/proteinpaint.js').mtime) || 0
	const date = date1 > date2 ? date1 : date2
	return date.toDateString()
}
