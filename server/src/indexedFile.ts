import fs from 'fs'
import path from 'path'
import { LocalFile, RemoteFile } from 'generic-filehandle2'
import type { Fetcher, GenericFilehandle } from 'generic-filehandle2'
import serverconfig from './serverconfig.js'
import { cache_index, download_index, illegalUrlHost, test_url } from './utils.js'

/*
Locates the indexed files that are read in the server process, such as by tabix.ts and bamFile.ts. The files that
they have opened are kept by OpenFiles of utils/openFiles.ts.

A file is a path under tp or cachedir, where a relative path is under tp, or an http or https url when
serverconfig.features.ALLOW_remotefilefromurl is true. The index of a local file is next to it. The index of a url
file is kept in the cache dir of the url, from cache_index() in utils.js, as htslib keeps the index that it
downloads in its working dir: it is downloaded from the url with an index extension if it is not there yet.
*/

/** the index files of a file format */
export type IndexKind = {
	/** the name of the format in an error, such as "tabix" */
	name: string
	/** the paths of the index of a local file, in the order that they are looked for */
	localPaths: (file: string) => string[]
	/** the extensions of the index of a url file, in the order that they are looked for */
	exts: string[]
}
export type Index = { path: string; isCsi: boolean; stamp: string }
/** a checked file, with the stamp of its data file if it is local, and the function that opens a handle of the file */
export type LocatedData = { location: string; stamp: string; open: () => GenericFilehandle }
/** a checked file, with its index */
export type Located = LocatedData & { index: Index }

/** the redirects of a url that are followed, as in download_index() of utils.js */
const maxRedirects = 5
/** the time limit of each request of a url file, with its redirects and body, in ms; a test may change it */
export const urlRequest = { timeoutMs: 60_000 }

// a module-local copy, since serverconfig.cachedir is deleted before the server starts listening
const cachedir = serverconfig.cachedir

/** returns a file with its index; a url never reaches the reads of a local file, as they are separate functions */
export async function locateIndexedFile(file: unknown, dir: unknown, kind: IndexKind): Promise<Located> {
	if (typeof file == 'string' && file.includes('://')) {
		const location = checkUrl(file)
		const cacheDir = optionalCacheDir(dir)
		return { ...openUrl(location), index: await getUrlIndex(location, cacheDir, kind) }
	}
	const location = checkFile(file)
	optionalCacheDir(dir)
	const data = await statLocal(location, kind)
	return { ...openLocal(location, data), index: await getLocalIndex(location, data, kind) }
}

/** returns a file without its index, such as to read the whole file */
export async function locateDataFile(file: unknown, dir: unknown, kind: IndexKind): Promise<LocatedData> {
	if (typeof file == 'string' && file.includes('://')) {
		const location = checkUrl(file)
		optionalCacheDir(dir)
		return openUrl(location)
	}
	const location = checkFile(file)
	optionalCacheDir(dir)
	return openLocal(location, await statLocal(location, kind))
}

function openLocal(location: string, data: fs.Stats): LocatedData {
	return { location, stamp: stamp(data), open: () => new LocalFile(location) }
}

function openUrl(location: string): LocatedData {
	return { location, stamp: '', open: () => new RemoteFile(location, { fetch: checkedFetch }) }
}

async function statLocal(file: string, kind: IndexKind): Promise<fs.Stats> {
	try {
		return await fs.promises.stat(file)
	} catch (_) {
		throw `cannot open the ${kind.name} file`
	}
}

/** returns the index of a local file, by the order of kind.localPaths(), as htslib finds it */
async function getLocalIndex(file: string, data: fs.Stats, kind: IndexKind): Promise<Index> {
	for (const p of kind.localPaths(file)) {
		const s = await fs.promises.stat(p).catch(() => null)
		if (!s) continue
		// htslib warns about such an index, by the mtime in seconds, and its read was rejected for the warning
		if (Math.floor(s.mtimeMs / 1000) < Math.floor(data.mtimeMs / 1000))
			throw 'the index file is older than the data file'
		return { path: p, isCsi: p.endsWith('.csi'), stamp: `${stamp(s)} ${stamp(data)}` }
	}
	throw `cannot find the index of the ${kind.name} file`
}

/*
returns the index of a url file in its cache dir, which is downloaded there from the url with an extension of
kind.exts if it is not there yet. The index has the name that htslib gives the index it downloads, the url file name
with the extension, or else is any file in the dir with the extension, such as from an index url given to
cache_index(). A url file without a cache dir has the cache dir of the url.
*/
async function getUrlIndex(url: string, dir: string | null, kind: IndexKind): Promise<Index> {
	if (!dir) dir = (await cache_index(url)) as string
	const name = path.basename(new URL(url).pathname)
	if (!name) throw 'url must end with a file name'
	const found = async (file: string): Promise<Index | undefined> => {
		const s = await fs.promises.stat(file).catch(() => null)
		if (s?.isFile()) return { path: file, isCsi: file.endsWith('.csi'), stamp: stamp(s) }
	}
	for (const ext of kind.exts) {
		const index = await found(path.join(dir, name + ext))
		if (index) return index
	}
	const entries = await fs.promises.readdir(dir).catch(() => [] as string[])
	for (const ext of kind.exts) {
		for (const e of entries.filter(e => e.endsWith(ext)).sort()) {
			const index = await found(path.join(dir, e))
			if (index) return index
		}
	}
	for (const ext of kind.exts) {
		const u = new URL(url)
		u.pathname += ext
		const file = path.join(dir, name + ext)
		try {
			await download_index(u.href, file)
		} catch (_) {
			continue
		}
		const index = await found(file)
		if (index) return index
	}
	throw 'cannot download the index of the url file'
}

function stamp(s: fs.Stats) {
	return `${s.mtimeMs}:${s.size}:${s.ino}`
}

/** returns the absolute path of a local file under tp or cachedir, where a relative path is under tp, or throws */
function checkFile(file: unknown): string {
	// eslint-disable-next-line no-control-regex
	if (typeof file != 'string' || !file || /[\x00-\x1f\x7f]/.test(file)) throw 'invalid file'
	// a ".." segment could leave the root
	if (file.split('/').includes('..')) throw 'invalid file'
	const roots = path.isAbsolute(file) ? [serverconfig.tpmasterdir, cachedir] : [serverconfig.tpmasterdir]
	for (const r of roots) {
		if (!r) continue
		const root = path.resolve(r)
		const f = path.resolve(root, file)
		if (f.startsWith(root + path.sep)) return f
	}
	throw 'invalid file'
}

/** returns the url of a url file, or throws; an ftp url, which htslib reads, is not supported by fetch() */
function checkUrl(url: string): string {
	if (!serverconfig.features?.ALLOW_remotefilefromurl) throw 'invalid file'
	let protocol: string
	try {
		protocol = new URL(url).protocol
	} catch (_) {
		throw 'invalid file'
	}
	if (protocol == 'ftp:') throw 'ftp url is not supported for this file'
	if (protocol != 'http:' && protocol != 'https:') throw 'invalid file'
	const [e] = test_url(url)
	if (e) throw 'invalid file'
	if (illegalUrlHost(url)) throw 'invalid file'
	return url
}

/** returns the cache dir of a dir argument, or null for none: a caller of a local file may give an empty string, such
 * as mds.svcnv.js, so that any value that is not true is none, as the reads did before they were in process */
function optionalCacheDir(dir: unknown): string | null {
	return dir ? checkCacheDir(dir) : null
}

/** returns the absolute path of a cache dir under cachedir, or throws, as checkCacheDir() of tools/index.ts */
function checkCacheDir(dir: unknown): string {
	// eslint-disable-next-line no-control-regex
	if (typeof dir != 'string' || /[\x00-\x1f\x7f]/.test(dir)) throw 'invalid dir'
	if (!path.isAbsolute(dir) || dir.split('/').includes('..')) throw 'invalid dir'
	const root = path.resolve(cachedir)
	const d = path.resolve(dir)
	if (!d.startsWith(root + path.sep)) throw 'invalid dir'
	return d
}

/*
fetch() of a url file, which follows a redirect only to a url that is allowed, as download_index() of utils.js does:
fetch() would otherwise follow a redirect from an allowed url to an internal host
*/
const checkedFetch: Fetcher = async (input, init) => {
	let url = typeof input == 'string' ? input : input.url
	// the signal of a request also aborts the read of its body, after the response is returned
	const timeout = AbortSignal.timeout(urlRequest.timeoutMs)
	const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout
	for (let redirects = 0; ; redirects++) {
		const res = await fetch(url, { ...init, signal, redirect: 'manual' })
		if (res.status < 300 || res.status > 399) return res
		const location = res.headers.get('location')
		await res.body?.cancel()
		if (!location) throw 'url redirect has no location'
		if (redirects >= maxRedirects) throw 'url has too many redirects'
		url = new URL(location, url).href
		const [e] = test_url(url)
		if (e) throw 'url redirect error: ' + e
		const hostErr = illegalUrlHost(url)
		if (hostErr) throw 'url redirect error: ' + hostErr
	}
}
