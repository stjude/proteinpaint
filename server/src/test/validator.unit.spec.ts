/********************************************
Unit tests for the per-client error tracking in server/src/validator.ts

Run with:
  cd proteinpaint/server && npx tsx --conditions=sjpp/dev src/test/validator.unit.spec.ts
or run the whole unit suite (as CI does):
  cd proteinpaint/server && npm run test:unit
*********************************************/
import tape from 'tape'
import { floodCatch, getFloodKey, sweepFloodTracker, getFloodTrackerSize, maxTrackedClients } from '../validator.ts'

function getReq(ip: string, headers: { [k: string]: string } = {}) {
	return { ip, get: (name: string) => headers[name.toLowerCase()] }
}

function getRes() {
	const res: any = { sent: [] }
	res.send = body => res.sent.push(body)
	return res
}

tape('\n', test => {
	test.comment('-***- server/src/validator -***-')
	test.end()
})

tape('getFloodKey()', test => {
	test.equal(getFloodKey(getReq('192.0.2.10')), '192.0.2.10', 'should use req.ip without a cf-connecting-ip header')
	test.equal(
		getFloodKey(getReq('192.0.2.10', { 'cf-connecting-ip': '198.51.100.6' })),
		'198.51.100.6',
		'should use the cf-connecting-ip header when present'
	)
	test.equal(
		getFloodKey(getReq('192.0.2.10', { 'cf-connecting-ip': ' ' })),
		'192.0.2.10',
		'should use req.ip when the cf-connecting-ip header is blank'
	)
	test.end()
})

tape('floodCatch() tracks each cf-connecting-ip separately', test => {
	const directIp = '192.0.2.11'
	const cfHeaders = { 'cf-connecting-ip': '198.51.100.7' }
	// the first 11 errors from a client are thrown, after which the client gets 'busy'
	for (let i = 0; i < 11; i++) {
		try {
			floodCatch(getReq(directIp, cfHeaders), getRes(), 'invalid')
		} catch (_) {
			// expected
		}
	}
	const busyRes = getRes()
	floodCatch(getReq(directIp, cfHeaders), busyRes, 'invalid')
	test.deepEqual(busyRes.sent, [{ error: 'busy' }], 'should send busy after repeated errors from the same client')

	const otherRes = getRes()
	test.throws(
		() => floodCatch(getReq(directIp, { 'cf-connecting-ip': '198.51.100.8' }), otherRes, 'invalid'),
		/invalid/,
		'should still throw for another client with the same req.ip'
	)
	test.deepEqual(otherRes.sent, [{ error: 'invalid' }], 'should send the error to another client with the same req.ip')
	test.end()
})

tape('sweepFloodTracker()', test => {
	const now = +new Date()
	const before = sweepFloodTracker(now)
	try {
		floodCatch(getReq('192.0.2.12', { 'cf-connecting-ip': '198.51.100.9' }), getRes(), 'invalid')
	} catch (_) {
		// expected
	}
	test.equal(sweepFloodTracker(now), before + 1, 'should keep an entry that has not expired')
	test.equal(sweepFloodTracker(now + 31000), 0, 'should delete the entries that have expired')
	test.end()
})

tape('floodCatch() does not track more than maxTrackedClients', test => {
	for (let i = 0; i < maxTrackedClients + 100; i++) {
		try {
			floodCatch(getReq('192.0.2.13', { 'cf-connecting-ip': `client-${i}` }), getRes(), 'invalid')
		} catch (_) {
			// expected
		}
	}
	test.equal(sweepFloodTracker(0), maxTrackedClients, 'should not add a new client when the tracker is full')
	test.end()
})

tape('floodCatch() sweeps a full tracker at most once per window', test => {
	const realNow = Date.now
	// start after any entry from the tests above has expired
	const start = realNow() + 60000
	let time = start
	Date.now = () => time
	const addClients = (prefix: string, n: number) => {
		for (let i = 0; i < n; i++) {
			try {
				floodCatch(getReq('192.0.2.14', { 'cf-connecting-ip': `${prefix}-${i}` }), getRes(), 'invalid')
			} catch (_) {
				// expected
			}
		}
	}
	try {
		test.equal(sweepFloodTracker(start), 0, 'should start with an empty tracker')
		addClients('a', maxTrackedClients)
		test.equal(getFloodTrackerSize(), maxTrackedClients, 'should fill the tracker')

		// the entries have expired, but the last sweep was within the window
		sweepFloodTracker(start + 20000)
		time = start + 31000
		addClients('b', 1)
		test.equal(getFloodTrackerSize(), maxTrackedClients, 'should not sweep again within the window')

		// the last sweep was more than a window ago
		time = start + 51000
		addClients('c', 1)
		test.equal(getFloodTrackerSize(), 1, 'should delete the expired entries and track the new client')
	} finally {
		Date.now = realNow
	}
	sweepFloodTracker(start + 120000)
	test.end()
})
