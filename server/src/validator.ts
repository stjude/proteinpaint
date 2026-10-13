import { type RouteApi } from '#types'
import * as checkers from './routes/common.ts'

export function setRouteLevelMiddleware(opts: { routes: { api: RouteApi }[] }) {
	for (const r of opts.routes) {
		if (!r.api) continue
		for (const handler of Object.values(r.api.methods)) {
			if (handler.middleware) continue
			const checker = handler.request.checker || defaultValidator
			handler.middleware = (req, res, next) => {
				try {
					// NOTE: a preceding middleware combines req.query with req.body in a POST request
					Object.assign(req.query, checker(req.query))
					// TODO: create and use a ReqQueryAddons() validator here
					next()
				} catch (e: any) {
					floodCatch(req, res, e.message || e)
				}
			}
		}
	}
}

function defaultValidator(query) {
	// NOTE: a preceding middleware combines req.query with req.body in a POST request
	for (const [key, val] of Object.entries(query)) {
		if (genericParams.includes(key)) query[key] = byReqKey[key](val)
	}
}

const byIpAddr = new Map()
const floodWindow = 30000
// sweep the tracker when it has more entries than this, at most once per floodWindow
const maxTrackedClients = 1000
let lastSweepTime = 0

// an entry is otherwise deleted only when the same client has another error after floodWindow,
// so delete the expired entries of clients that did not; returns the number of tracked clients
export function sweepFloodTracker(time = +new Date()) {
	for (const [key, entry] of byIpAddr) {
		if (time - entry.time > floodWindow) byIpAddr.delete(key)
	}
	lastSweepTime = time
	return byIpAddr.size
}

// use the client address from the cf-connecting-ip request header when present, otherwise req.ip
export function getFloodKey(req) {
	const cfIp = req.get?.('cf-connecting-ip')
	return (typeof cfIp == 'string' && cfIp.trim()) || req.ip
}

export function floodCatch(req, res, error) {
	const time = +new Date()
	if (byIpAddr.size > maxTrackedClients && time - lastSweepTime > floodWindow) sweepFloodTracker(time)
	const key = getFloodKey(req)
	let entry = byIpAddr.get(key)
	if (!entry) {
		entry = { time, count: 0 }
		byIpAddr.set(key, entry)
	}
	if (time - entry.time > floodWindow) {
		// purge this remote IP address from the tracker
		byIpAddr.delete(key)
	} else if (entry.count > 10) {
		res.send({ error: 'busy' })
		// no need to throw and clutter the err log
		return
	} else {
		entry.count++
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
