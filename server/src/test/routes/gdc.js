/* these routes are for testing only */

import fs from 'fs'
import path from 'path'
import serverconfig from '../../serverconfig.js'

// simulate GDC sessionid to token mapping
// sessionid will be the index of the entry in the array
const sessions = [0]

export default async function setRoutes(app, basepath) {
	app.use(basepath + '/mds3', (req, res, next) => {
		if (req.cookies.gdcsessionid) {
			req.headers['X-Auth-Token'] = sessions[+req.cookies.gdcsessionid]
		}
		next()
	})

	// app.use() from other route setters must be called before app.get|post|all
	// so delay setting these optional routes (this is done in server/src/auth.js also)
	await sleep(0)

	app.get('/auth', logIn)
	app.post('/auth', logIn)

	app.get('/auth/user', getAuth)
	app.post('/auth/user', getAuth)

	app.get('/auth/logout', logOut)
	app.post('/auth/logout', logOut)

	app.post('/gdc/ssid', async (req, res) => {
		const q = req.body
		const i = sessions.indexOf(q.token)
		if (q.action == 'delete') {
			if (i != -1) {
				sessions.splice(i, 1)
				res.cookie('gdcsessionid', 0, { expires: new Date(Date.now() - 30000), 'max-age': 0 }).send({ status: 'ok' })
			}
		} else {
			if (i == -1) {
				sessions.push(q.token)
				res.cookie('gdcsessionid', sessions.length - 1, { 'max-age': 60000 }).send({ status: 'ok' })
			} else {
				res.cookie('gdcsessionid', i).send({ status: 'ok' })
			}
		}
	})
	app.get(basepath + '/genes/bin/:bundle', async (req, res) => {
		const file = path.join(process.cwd(), `./public/bin/${req.params.bundle}`)
		res.header('Content-Type', 'application/js')
		res.send(await fs.readFileSync(file))
	})
	app.get(basepath + '/genes/:gene', async (req, res) => {
		const file = path.join(process.cwd(), './public/example.gdc.react.html')
		res.header('Content-Type', 'text/html')
		res.send(await fs.readFileSync(file))
	})
	app.get(basepath + '/wrappers/test/:filename', async (req, res) => {
		const file = path.join(serverconfig.binpath, `../client/src/wrappers/test/${req.params.filename}`)
		res.cookie('gdcsessionid', 0, { expires: new Date(Date.now() - 30000), 'max-age': 0 })
		res.header('Content-Type', 'application/javascript')
		res.header('Cache-control', `immutable,max-age=3`)
		const content = await fs.readFileSync(file, { encoding: 'utf8' })
		const lines = content.split('\n')
		let str = ''
		// remove import lines
		for (const line of lines) {
			let l = line.trim()
			if (l.startsWith('import')) {
				if (l.includes('PpLolliplot')) {
					str += `const PpLolliplot = runproteinpaint.wrappers.PpLolliplot` + '\n'
				}
			} else {
				if (l.startsWith('export')) {
					str += l.substr(l.search(' ')) + '\n'
				} else {
					str += l + '\n'
				}
			}
		}
		res.send(str)
	})
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

const pastExpiration =
	'sessionid=; Domain=.gdc.cancer.gov; expires=Sat, 01 Jan 2000 12:00:00 GMT; GMT; HttpOnly; Max-Age=1800; Path=/;HttpOnly; SameSite=Lax; Secure'
let loggedIn = false,
	numTries = 0

function logIn(req, res) {
	numTries++
	if (numTries === 1) {
		res.header('Set-Cookie', pastExpiration)
		return // skip the initial page load
	}
	loggedIn = true
	getAuth(req, res)
}

function logOut(req, res) {
	loggedIn = false
	// must be in the past
	res.header('Set-Cookie', pastExpiration)
	res.send({ status: 'ok' })
}

function getAuth(req, res) {
	// res.header(
	// 	'Access-Control-Allow-Origin',
	// 	req.get('origin') || req.get('referrer') || req.protocol + '://' + req.get('host').split(':')[0] || '*'
	// )
	if (!loggedIn) {
		res.status(401)
		res.header('Set-Cookie', pastExpiration)
		res.end()
		return
	}
	// this cookie is copied from the response header after logging in to portal.gdc.cancer.gov
	res.header('Set-Cookie', '')
	res.send({})
}
