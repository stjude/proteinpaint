import tape from 'tape'
import serverconfig from '../serverconfig.js'
import * as common from '#shared/common.js'
import * as utils from '../utils.js'
import { setRoutes } from '../app.unorg.js'

/*
Specs for the custom track file paths of the mds routes.

A custom track file is relative to serverconfig.tpmasterdir. Each route below is driven twice:
- with a legal file, the request must not be rejected for its file path
- with a file that has ".." segments, the request must be rejected for its file path

test sections:
- checkTrackFile()
- one section per route, see routeCases[]
*/

const legalFile = 'files/hg38/TermdbTest/TermdbTest_ITD.gz'
const dotdotFile = '../'.repeat(10) + 'x/t.gz'
const rglst = () => [{ chr: 'chr1', start: 1, stop: 100, width: 100 }]
let routes

// resolves with the first res.send() payload, since some handlers do not return their promise
function send(handler, query) {
	return new Promise(resolve => {
		const timer = setTimeout(() => resolve({ timeout: true }), 10000)
		const done = x => {
			clearTimeout(timer)
			resolve(x)
		}
		const req = { query, get: () => undefined }
		const res = { send: done, status: () => res, header: () => {}, set: () => {}, end: done }
		Promise.resolve(handler(req, res)).catch(e => done({ error: String(e) }))
	})
}

/*
	name: for the test message
	route: path in the route table
	query(file): request query
*/
const routeCases = [
	{
		name: 'mdsjunction file',
		route: '/mdsjunction',
		query: file => ({ genome: 'hg38', iscustom: 1, file, rglst: rglst() })
	},
	{
		name: 'mdsjunction file2',
		route: '/mdsjunction',
		query: file2 => ({ genome: 'hg38', iscustom: 1, file2, rglst: rglst() })
	},
	{
		name: 'mdsexpressionrank',
		route: '/mdsexpressionrank',
		query: file => ({ genome: 'hg38', iscustom: 1, sample: 's1', file, rglst: rglst() })
	},
	{
		name: 'mdsgeneboxplot',
		route: '/mdsgeneboxplot',
		query: file => ({ genome: 'hg38', iscustom: 1, file, gene: 'TP53', chr: 'chr1', start: 1, stop: 2 })
	},
	{
		name: 'mdsgeneboxplot svcnv',
		route: '/mdsgeneboxplot',
		query: file => ({
			genome: 'hg38',
			iscustom: 1,
			file: legalFile,
			svcnv: { file },
			gene: 'TP53',
			chr: 'chr1',
			start: 1,
			stop: 2
		})
	},
	{
		name: 'mdsgenevalueonesample',
		route: '/mdsgenevalueonesample',
		query: file => ({
			genome: 'hg38',
			iscustom: 1,
			sample: 's1',
			genes: [{ gene: 'TP53', chr: 'chr1', start: 1, stop: 2 }],
			file
		})
	},
	...[common.tkt.mdsvcf, common.tkt.mdssvcnv, common.tkt.mdsexpressionrank].map(type => ({
		name: 'samplematrix ' + type,
		route: '/samplematrix',
		query: file => ({
			genome: 'hg38',
			iscustom: 1,
			querykey2tracks: { k: { type, file } },
			features: [{ querykey: 'k', issvcnv: true, chr: 'chr1', start: 1, stop: 100 }]
		})
	}))
]

tape('\n', function (test) {
	test.comment('-***- track file specs -***-')
	routes = {}
	const record = (p, h) => (routes[p] = h)
	const genomes = {
		hg38: {
			name: 'hg38',
			genomefile: 'NA',
			chrlookup: { CHR1: { name: 'chr1', len: 248956422 } },
			// legacy mds routes are only mounted when there is at least one mds dataset
			datasets: { FakeMds: { isMds: true } }
		}
	}
	setRoutes({ get: record, post: record, all: record, put: record, delete: record, use: () => {} }, genomes, {})
	test.end()
})

tape('checkTrackFile()', test => {
	for (const f of [undefined, null, '', legalFile]) {
		test.doesNotThrow(() => utils.checkTrackFile(f), `should allow file=${JSON.stringify(f)}`)
	}
	for (const f of [dotdotFile, 'files/../../x.gz', '/x/t.gz', ['files/x.gz'], { a: 1 }, 1]) {
		test.throws(() => utils.checkTrackFile(f), /illegal file path/, `should not allow file=${JSON.stringify(f)}`)
	}
	test.end()
})

for (const c of routeCases) {
	tape(`${c.route}, ${c.name}`, async test => {
		const handler = routes[c.route]
		test.equal(typeof handler, 'function', 'should be a mounted route')
		const r1 = await send(handler, c.query(legalFile))
		test.notOk(r1?.timeout, 'should respond to a legal file')
		test.notEqual(r1?.error, 'illegal file path', 'should not reject a legal file for its path')
		const r2 = await send(handler, c.query(dotdotFile))
		test.equal(r2?.error, 'illegal file path', 'should reject a file with ".." segments')
		test.end()
	})
}
