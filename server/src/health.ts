import serverconfig from './serverconfig'
import fs from 'fs'
import path from 'path'
import child_process from 'child_process'
import util from 'util'
import pkg from '../package.json'
import { VersionInfo, GenomeBuildInfo, HealthCheckResponse } from '../shared/types/routes/healthcheck.js'

const execPromise = util.promisify(child_process.exec)

export async function getStat(genomes) {
	if (!versionInfo.deps) setVersionInfoDeps()

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

export const versionInfo: VersionInfo = {
	pkgver: pkg.version,
	codedate: get_codedate(),
	launchdate: new Date(Date.now()).toString().split(' ').slice(0, 5).join(' ')
}

async function setVersionInfoDeps() {
	// this assumes that the package.json in the process.cwd() is the embedder package
	// that may have >=1 @sjcrh packages as dependencies
	const targetPkgJson = `${process.cwd()}/package.json`
	try {
		if (!fs.existsSync(targetPkgJson)) versionInfo.deps = {}
		else {
			const targetPkgContent = fs.readFileSync(targetPkgJson, { encoding: 'utf8' })
			const targetPkg = JSON.parse(targetPkgContent)
			versionInfo.deps = {
				'@sjcrh/proteinpaint-server': targetPkg?.dependencies['@sjcrh/proteinpaint-server'],
				'@sjcrh/proteinpaint-client': targetPkg?.dependencies['@sjcrh/proteinpaint-client']
			}
		}
	} catch (e) {
		console.log(e)
		// avoid repeated errors related to reading the target package.json
		versionInfo.deps = {}
	}
}

function get_codedate() {
	const date1 =
		(fs.existsSync(serverconfig.binpath + '/server.js') && fs.statSync(serverconfig.binpath + '/server.js').mtime) ||
		new Date(0)
	const date2 =
		(fs.existsSync('public/bin/proteinpaint.js') && fs.statSync('public/bin/proteinpaint.js').mtime) || new Date(0)
	const date = date1 > date2 ? date1 : date2
	return date.toDateString()
}
