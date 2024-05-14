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

export function middleware(req, res, next) {
	try {
		// NOTE: a preceding middleware combines req.query with req.body in a POST request
		const q = req.query
		for (const key in q) {
			if (key in byReqKey) q[key] = byReqKey[key](q[key])
		}
		// TODO log out request here to eliminate repeating log(req) in handlers; may skip the bundle-loading lines?
		next()
	} catch (e) {
		floodCatch(req, res, e.message || e)
	}
}

// consolidate validation functions here
// for server request parameters that are
// shared across different route handlers

export const byReqKey = {
	genome(value) {
		if (typeof value != 'string') throw 'genome should be a non-empty string'
		if (/\s+/.test(value)) throw 'invalid genome character'
		return value
	},
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
