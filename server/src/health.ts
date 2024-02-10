import serverconfig from './serverconfig'
import fs from 'fs'
import path from 'path'
import pkg from '../package.json'
import { VersionInfo, GenomeBuildInfo, HealthCheckResponse } from '../shared/types/routes/healthcheck.js'

export async function getStat(genomes) {
	if (!versionInfo.deps) setVersionInfoDeps()

	const health = {
		status: 'ok',
		genomes: {},
		versionInfo
	} as HealthCheckResponse

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
	launchdate: new Date(Date.now()).toString().split(' ').slice(0, 5).join(' '),
	deps: {}
}

// not  `${process.cwd()}/node_modules/@sjcrh/proteinpaint`
const sjcrhServer = serverconfig.binpath
const serverPkg = `${sjcrhServer}/package.json`
if (fs.existsSync(serverPkg)) {
	const pkg = JSON.parse(fs.readFileSync(serverPkg, { encoding: 'utf8' }))
	versionInfo.deps['@sjcrh/proteinpaint-server'] = {
		installed: pkg.version
	}
}

const clientPkg = serverPkg.replace('server', 'client')
if (fs.existsSync(clientPkg)) {
	const pkg = JSON.parse(fs.readFileSync(clientPkg, { encoding: 'utf8' }))
	versionInfo.deps['@sjcrh/proteinpaint-client'] = {
		installed: pkg.version
	}
}

async function setVersionInfoDeps() {
	// this assumes that the package.json in the process.cwd() is the embedder package
	// that may have >=1 @sjcrh packages as dependencies
	const targetPkgJson = `${process.cwd()}/package.json`
	try {
		if (!fs.existsSync(targetPkgJson)) return
		else {
			const targetPkgContent = fs.readFileSync(targetPkgJson, { encoding: 'utf8' })
			const targetPkg = JSON.parse(targetPkgContent)
			const serverEntry = targetPkg?.dependencies['@sjcrh/proteinpaint-server']
			if (serverEntry) versionInfo.deps['@sjcrh/proteinpaint-server'].entry = serverEntry
			const clientEntry = targetPkg?.dependencies['@sjcrh/proteinpaint-client']
			if (clientEntry) {
				if (!versionInfo.deps.entry['@sjcrh/proteinpaint-client']) {
					versionInfo.deps['@sjcrh/proteinpaint-client'] = {}
				}
				versionInfo.deps['@sjcrh/proteinpaint-client'] = clientEntry
			}
		}
	} catch (e) {
		console.log(e)
		// avoid repeated errors related to reading the target package.json
		// versionInfo.deps = {}
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
