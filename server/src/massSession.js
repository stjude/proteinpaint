const app = require('./app'),
	serverconfig = require('./serverconfig'),
	path = require('path'),
	fs = require('fs'),
	utils = require('./utils')

// where temp session files are saved
const sessionDir = path.join(serverconfig.cachedir, 'massSession')

export async function save(req, res) {
	// POST

	try {
		try {
			await fs.promises.stat(sessionDir)
		} catch (e) {
			if (e.code == 'ENOENT') {
				try {
					await fs.promises.mkdir(sessionDir)
				} catch (e) {
					throw 'cannot make dir'
				}
			} else {
				throw 'stating session dir: ' + e.code
			}
		}

		// dir is valid

		const sessionID = makeID()
		// not checking duplicating id

		// req.body is some string data, save it to file named by the session id
		const content = JSON.stringify(req.body)
		await utils.write_file(path.join(sessionDir, sessionID), content)

		res.send({ id: sessionID })
	} catch (e) {
		res.send({ error: e.message || e })
	}
}

export async function get(req, res) {
	// GET

	try {
		if (!req.query.id) throw 'session id missing'
		const file = path.join(sessionDir, req.query.id)
		try {
			await fs.promises.stat(file)
		} catch (e) {
			throw 'invalid session'
		}
		const state = await utils.read_file(file)
		res.send({ state: JSON.parse(state) })
	} catch (e) {
		res.send({ error: e.message || e })
	}
}

function makeID() {
	/*
	to come up with a character in the session string, get an integer in the following range and convert to char
	decimal to char range:
		48-57: 0-9
		65-90: A-Z
		97-122: a-z
	*/
	const lst = []
	while (lst.length < 15) {
		const i = 46 + Math.floor(80 * Math.random())
		if ((i >= 48 && i <= 57) || (i >= 65 && i <= 90) || (i >= 97 && i <= 122)) {
			lst.push(String.fromCharCode(i))
		}
	}
	return lst.join('')
}
