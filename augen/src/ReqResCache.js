import crypto from 'crypto'
import path from 'path'
import fs from 'fs'

export class ReqResCache {
	opts = { mode: '' }
	reqPath = ''
	// general expressjs routes that implement custom subrouting in plain nodejs
	generalRoutes = ['/termdb']
	// req.param key that triggers custom subrouting
	customSubroute = ''
	data = { req: null, res: null }

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
		if (this.opts.cacheDir) this.getLoc(this.opts.cacheDir)
	}

	getLoc(cacheDir) {
		if (this.loc) return this.loc

		let subdir = path.join(cacheDir, this.reqPath.slice(1).replaceAll('/', '.'))
		if (this.customSubroute) subdir += `~${this.customSubroute}`

		if (this.opts.mode != 'test' && !fs.existsSync(subdir)) {
			if (this.opts.mode == 'mkdir') fs.mkdirSync(subdir, { recursive: true })
			// else return {subdir} // throw `missing cacheSubdir='$subdir'`
		}

		const id = crypto.createHash('sha1').update(this.reqJson).digest('hex')

		const filepath = `${subdir}/${id.slice(0, 12)}`
		this.loc = { subdir, id, req: `${filepath}-req.json`, res: `${filepath}-res.json` }
		return this.loc
	}

	async write(resData = '') {
		try {
			if (this.reqJson) {
				await fs.promises.writeFile(this.loc.req, this.reqJson)
				delete this.reqJson
			}
			if (resData) {
				this.data.res = resData
				const content = typeof resData === 'string' ? resData : JSON.stringify(resData, null, '  ')
				await fs.promises.writeFile(this.loc.res, content)
			}
		} catch (e) {
			throw e
		}
	}

	async read(opts = { verbose: false }) {
		if (this.data.req) {
			if (opts.verbose) console.log('not overwriting this.data.req')
		} else {
			const d = await fs.promises.readFile(this.loc.req, { encoding: 'utf8' })
			this.data.req = JSON.parse(d)
		}

		if (this.data.res) {
			if (opts.verbose) console.log('not overwriting this.data.res')
		} else {
			const d = await fs.promises.readFile(this.loc.res, { encoding: 'utf8' })
			this.data.res = JSON.parse(d)
		}
		return
	}
}
