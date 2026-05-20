import * as checkers from '#types/checkers'

const checkerMap: Map<string, (payload: any) => any> = new Map()
for (const [key, val] of Object.entries(checkers)) {
	if (key.endsWith('Payload') && typeof val === 'object') checkerMap.set(key, val.request?.checker)
}

export function middleware(req, res, next) {
	try {
		// NOTE: a preceding middleware combines req.query with req.body in a POST request
		const q = req.query

		const payloadName = req.path.slice(1).replaceAll('/', '') + 'Payload'
		const checker = checkerMap.get(payloadName)
		if (typeof checker == 'function') Object.assign(req.query, checker(q))
		else {
			for (const [key, val] of Object.entries(q)) {
				if (genericParams.includes(key)) q[key] = byReqKey[key](val)
			}
			// TODO log out request here to eliminate repeating log(req) in handlers; may skip the bundle-loading lines?
		}
		next()
	} catch (e: any) {
		floodCatch(req, res, e.message || e)
	}
}

const byIpAddr = {}

export function floodCatch(req, res, error) {
	const time = +new Date()
	if (!(req.ip in byIpAddr)) {
		byIpAddr[req.ip] = { time, count: 0 }
	}
	if (time - byIpAddr[req.ip].time > 30000) {
		// purge this remote IP address from the tracker
		delete byIpAddr[req.ip]
	} else if (byIpAddr[req.ip].count > 10) {
		res.send({ error: 'busy' })
		// no need to throw and clutter the err log
		return
	} else {
		byIpAddr[req.ip].count++
	}

	res.send({ error })
	throw new Date() + ' ' + error
}

// below are generic validation functions for request payloads
// that do not have dedicated payload validators as coded in server/checkers

export const byReqKey = {
	genome: checkers.validGenome,
	dslabel: checkers.validDslabel,
	chr(value) {
		if (typeof value != 'string') throw 'chr should be a string'
		if (/\s+/.test(value)) throw 'invalid chr character'
		return value
	},
	start(value) {
		// do some test on value
		const v = Number(value)
		// more tests?
		return v
	}
}

const genericParams = Object.keys(byReqKey)

export const byExpectedVal = {
	alphaNumeric(key, value, res) {
		try {
			if (!value) throw `empty ${key} value`
			if (typeof value != 'string') throw `${key} should be a non-empty alphanumeric string`
			if (/\s+/.test(value)) throw `invalid ${key} character`
			return value
		} catch (error) {
			res.send({ error })
			throw error
		}
	}
}
