import serverconfig from './serverconfig.js'
import fs from 'fs'
import path from 'path'
//import pkg from '../package.json' with {type: "json"}
import type { VersionInfo, GenomeBuildInfo, HealthCheckResponse } from '#types'
import { authApi } from './auth.js'

const pkg = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../package.json'), { encoding: 'utf8' }))

export async function getStat(genomes) {
	if (!versionInfo.deps) setVersionInfoDeps() // set only once
	const auth = (await authApi.getHealth()) as undefined | { errors?: string[] }
	const health = {
		status: auth?.errors?.length ? 'error' : 'ok',
		genomes: {},
		versionInfo,
		auth
	} satisfies HealthCheckResponse

	setGenomeDbInfo(genomes, health)
	return health
}

function setGenomeDbInfo(genomes, health) {
	// report status of every genome
	for (const gn in genomes) {
		const genome = genomes[gn]
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
		health.genomes[gn] = genome.dbInfo
	}
}

const codedate = get_codedate()
const revFile = path.join(process.cwd(), 'public/rev.txt')
const hash = fs.existsSync(revFile) && fs.readFileSync(revFile, { encoding: 'utf8' }).split(' ')[1]

export const versionInfo: VersionInfo = {
	pkgver: pkg.version + '-' + (hash || codedate),
	codedate, // still useful to know the package build/publish date in the response payload, even if it's not displayed
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
	const year = date.getUTCFullYear()
	const month = (date.getUTCMonth() + 1).toString().padStart(2, '0') // months from 1-12
	const day = date.getUTCDate().toString().padStart(2, '0')
	const hours = date.getHours().toString().padStart(2, '0')
	const minutes = date.getMinutes().toString().padStart(2, '0')
	return `${year}${month}${day}.${hours}:${minutes}`
}
