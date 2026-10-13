/********************************************
Unit tests for the per-client error tracking in server/src/validator.ts

Run with:
  cd proteinpaint/server && npx tsx --conditions=sjpp/dev src/test/validator.unit.spec.ts
or run the whole unit suite (as CI does):
  cd proteinpaint/server && npm run test:unit
*********************************************/
import tape from 'tape'
import { floodCatch, getFloodKey, sweepFloodTracker } from '../validator.ts'

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
