import serverconfig from './serverconfig.js'
import fs from 'fs'
import path from 'path'
//import pkg from '../package.json' with {type: "json"}
import type { VersionInfo, GenomeBuildInfo, HealthCheckResponse, DsInitStatus, DsSummary } from '#types'
import { authApi } from './auth.js'
import { trackedDatasets } from './initGenomesDs.js'

const pkg = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../package.json'), { encoding: 'utf8' }))

export async function getStat(genomes) {
	if (!versionInfo.deps) setVersionInfoDeps() // set only once
	const auth = (await authApi.getHealth()) as undefined | { errors?: string[] }
	const health = {
		// NOTE: status describes the server process, not its datasets: a failed dataset must not
		// make an otherwise working server look down, since the k8s liveness and readiness probes
		// both request this route. Dataset failures are reported in dsSummary and dsInitStatus.
		status: auth?.errors?.length ? 'error' : 'ok',
		genomes: {},
		versionInfo,
		auth,
		...getDsInitStatus()
	} satisfies HealthCheckResponse

	setGenomeDbInfo(genomes, health)
	return health
}

/*
	report the init status of every configured dataset, using the tracked datasets from
	initGenomesDs() as the source of truth: a dataset that failed to load is deleted from
	genomes[].datasets{}, so it would otherwise be missing from this response and be
	indistinguishable from a dataset that was never configured
*/
export function getDsInitStatus(): { dsSummary: DsSummary; dsInitStatus: DsInitStatus[] } {
	const dsSummary: DsSummary = { total: 0, done: 0, nonblocking: 0, retrying: 0, failed: 0 }
	const dsInitStatus: DsInitStatus[] = []
	for (const ds of trackedDatasets) {
		dsSummary.total++
		if (ds.init?.status == 'done') dsSummary.done++
		else if (ds.init?.status == 'nonblocking') dsSummary.nonblocking++
		else if (ds.init?.status == 'recoverableError') dsSummary.retrying++
		else dsSummary.failed++

		dsInitStatus.push({
			genome: ds.genomename,
			label: ds.label,
			url: `/healthcheck?dslabel=${ds.label}`,
			// deep copy to not expose the mutable ds.init object, and to drop any function value
			// such as init.notReadyMessage(); tolerate a non-serializable value to not fail the route
			init: copyInit(ds)
		})
	}
	return { dsSummary, dsInitStatus }
}

function copyInit(ds) {
	try {
		const init = JSON.parse(JSON.stringify(ds.init || {}))
		init.ignoredErrors = ds._ignoredErrors || []
		return init
	} catch (e: any) {
		return { status: ds.init?.status, error: `cannot serialize ds.init: ${e.message || e}` }
	}
}

function setGenomeDbInfo(genomes, health) {
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
		health.genomes[gn] = genome.dbInfo
	}
}

const codedate = get_codedate()
const revFile = path.join(process.cwd(), 'public/rev.txt')
const hash = fs.existsSync(revFile) && fs.readFileSync(revFile, { encoding: 'utf8' }).split(' ')[1]

// host-specific image name, e.g. "pp-irt:v2.204.0-92b3ab96", stamped into public/host-image.txt
// (as "<host>:<version> <date>") at build time (sjpp/build/build.sh). Only host images built with a
// version carry this file, so it is reported optionally.
const hostImageFile = path.join(process.cwd(), 'public/host-image.txt')
const hostImage =
	fs.existsSync(hostImageFile) && fs.readFileSync(hostImageFile, { encoding: 'utf8' }).trim().split(/\s+/)[0]

export const versionInfo: VersionInfo = {
	pkgver: pkg.version + '-' + (hash || codedate),
	codedate, // still useful to know the package build/publish date in the response payload, even if it's not displayed
	launchdate: new Date(Date.now()).toString().split(' ').slice(0, 5).join(' '),
	...(hostImage ? { hostImage } : {}),
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
	const year = date.getUTCFullYear()
	const month = (date.getUTCMonth() + 1).toString().padStart(2, '0') // months from 1-12
	const day = date.getUTCDate().toString().padStart(2, '0')
	const hours = date.getHours().toString().padStart(2, '0')
	const minutes = date.getMinutes().toString().padStart(2, '0')
	return `${year}${month}${day}.${hours}:${minutes}`
}
