import crypto from 'crypto'
import path from 'path'
import fs from 'fs'

const writeTriggered = new Set()

export class ReqResCache {
	opts = { mode: '' }
	reqPath = ''
	// general expressjs routes that implement custom subrouting in plain nodejs
	generalRoutes = ['/termdb']
	// req.param key that triggers custom subrouting
	customSubroute = ''
	data = { req: null, res: null }
	//loc = {}

	constructor(req, opts = {}) {
		Object.assign(this.opts, opts)
		this.reqPath = req.path
		this.data.req = Object.assign({}, req.query || {}, req.body || {})
		this.reqJson = JSON.stringify(this.data.req)
		if (this.generalRoutes.includes(req.path)) {
			for (const [k, v] of Object.entries(this.data.req)) {
				if (k.startsWith('get') && v === 1) this.customSubroute = k
				else if (k === 'for') this.customSubroute = k
			}
		}
		if (this.opts.cachedir) this.getLoc(this.opts.cachedir)
	}

	getLoc(cachedir) {
		if (this.loc) return this.loc

		let subdir = path.join(cachedir, this.reqPath.slice(1).replaceAll('/', '.'))
		if (this.customSubroute) subdir += `~${this.customSubroute}`

		if (this.opts.mode != 'test' && !fs.existsSync(subdir)) {
			if (this.opts.mode == 'mkdir') fs.mkdirSync(subdir, { recursive: true })
			// else return {subdir} // throw `missing cacheSubdir='$subdir'`
		}

		const id = crypto.createHash('sha1').update(this.reqJson).digest('hex')

		const filepath = `${subdir}/${id.slice(0, 20)}`
		this.loc = { route: this.reqPath, subdir, id, file: `${filepath}.json` }
		return this.loc
	}

	async write(resData = {}) {
		if (writeTriggered.has(this.loc.id)) return
		writeTriggered.add(this.loc.id)
		try {
			this.data.res = typeof resData == 'string' ? JSON.parse(resData) : resData
			await fs.promises.writeFile(this.loc.file, JSON.stringify(this.data, null, '  '))
			delete this.reqJson
		} catch (e) {
			throw e
		}
	}

	async read(opts = { verbose: false }) {
		if (this.data.req && this.data.res) {
			if (opts.verbose) console.log('not overwriting this.data')
		} else if (!fs.existsSync(this.loc.file)) {
			return {
				header: { status: 404 },
				body: { error: `missing cache dir or file='${this.loc.file}'` }
			}
		} else {
			const d = await fs.promises.readFile(this.loc.file, { encoding: 'utf8' })
			this.data = JSON.parse(d)
			return this.data
		}
	}
}
