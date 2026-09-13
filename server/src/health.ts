import serverconfig from './serverconfig.js'
import fs from 'fs'
import path from 'path'
//import pkg from '../package.json' with {type: "json"}
import type { VersionInfo, DsInitStatus, DsSummary } from '#types'
import { trackedDatasets } from './initGenomesDs.js'

const SERVER_PKG = '@sjcrh/proteinpaint-server'
const FRONT_PKG = '@sjcrh/proteinpaint-front'
const pkg = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../package.json'), { encoding: 'utf8' }))
const deps = getDeps()
const codedate = computeCodeDate(deps)

// versionInfo is created once at module load
export const versionInfo: VersionInfo = {
	pkgver: getPkgVer(codedate),
	codedate,
	hostImage: getHostImage(),
	deps,
	// launchdate captured at module load so it is the actual process start, outside of any function call
	launchdate: new Date().toString().split(' ').slice(0, 5).join(' ')
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

function getPkgVer(codedate) {
	const revFile = path.join(process.cwd(), 'public/rev.txt')
	const hash = fs.existsSync(revFile) && fs.readFileSync(revFile, { encoding: 'utf8' }).split(' ')[1]
	return pkg.version + '-' + (hash || codedate)
}

function getHostImage() {
	// host-specific image name, e.g. "pp-irt:v2.204.0-92b3ab96", from public/host-image.txt (written as
	// "<host>:<version> <date>" when a host image is built with a version); only such images carry it.
	const hostImageFile = path.join(process.cwd(), 'public/host-image.txt')
	const hostImage =
		(fs.existsSync(hostImageFile) && fs.readFileSync(hostImageFile, { encoding: 'utf8' }).trim().split(/\s+/)[0]) ||
		undefined
	return hostImage
}

// deps: the installed @sjcrh/* versions (from their package.json under binpath) plus the version
// ranges the embedding project declares for them (entry, from the cwd package.json dependencies).
function getDeps() {
	const deps: any = {}
	const serverPkgFile = path.join(serverconfig.binpath, 'package.json')
	if (fs.existsSync(serverPkgFile)) {
		deps[SERVER_PKG] = {
			installed: JSON.parse(fs.readFileSync(serverPkgFile, 'utf8')).version,
			mtime: fs.statSync(serverPkgFile).mtime
		}
	}
	const frontPkgFile = serverPkgFile.replace('server', 'front')
	if (fs.existsSync(frontPkgFile)) {
		deps[FRONT_PKG] = {
			installed: JSON.parse(fs.readFileSync(frontPkgFile, 'utf8')).version,
			mtime: fs.statSync(frontPkgFile).mtime
		}
	}

	const targetPkgFile = path.join(process.cwd(), 'package.json')
	if (fs.existsSync(targetPkgFile)) {
		const projectDeps = JSON.parse(fs.readFileSync(targetPkgFile, { encoding: 'utf8' })).dependencies || {}
		for (const name of [SERVER_PKG, FRONT_PKG] as const) {
			if (projectDeps[name]) deps[name].entry = projectDeps[name]
		}
	}
	return deps
}

function computeCodeDate(deps) {
	const date1 = deps[SERVER_PKG]?.mtime || new Date(0)
	const date2 = deps[FRONT_PKG]?.mtime || new Date(0)
	const date = date1 > date2 ? date1 : date2
	const year = date.getUTCFullYear()
	const month = (date.getUTCMonth() + 1).toString().padStart(2, '0') // months from 1-12
	const day = date.getUTCDate().toString().padStart(2, '0')
	const hours = date.getHours().toString().padStart(2, '0')
	const minutes = date.getMinutes().toString().padStart(2, '0')
	return `${year}${month}${day}.${hours}:${minutes}`
}
