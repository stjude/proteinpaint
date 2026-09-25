import tape from 'tape'
import { load_driver, mayUpdatePairlst } from '../mds3.load.js'
import { dtsv, dtfusionrna, dtsnvindel } from '#shared/common.js'

/* test sections

load_driver()
mayUpdatePairlst()
*/

tape('\n', function (test) {
	test.comment('-***- mds3 unit tests -***-')
	test.end()
})

tape('load_driver()', async function (test) {
	// t.throws() cannot handle async function
	try {
		await load_driver({}, {})
	} catch (e) {
		test.equal(e, 'do not know what client wants', 'should throw')
	}

	const q = { forTrack: 1, skewer: 1, rglst: [{ chr: '1', start: 1, stop: 10 }] }

	// allows cnv to coshow with skewer data
	{
		// should return both skewer and cnv
		const r = await load_driver(q, ds)
		test.equal(r.skewer.length, 1, 'r.skewer.length=1')
		test.equal(r.cnv.cnvs.length, 1, 'r.cnv.length=1')
	}

	test.end()
})

tape('mayUpdatePairlst()', test => {
	const self = { chr: 'chr14', pos: 104779348, strand: '-', name: 'AKT1' }
	const tp53 = (pos, strand = '-') => ({ chr: 'chr17', pos, strand, name: 'TP53' })
	// event with the queried gene AKT1 on the b side, so the partner TP53 is on the a side
	const makeM = (samples, overrides = {}) =>
		Object.assign(
			{
				dt: dtsv,
				pairlstIdx: 1,
				pairlst: samples[0]._pairlst, // as the getter does: the event's pairlst is that of its first sample
				samples
			},
			overrides
		)
	const makeSample = (id, partner) => ({ sample_id: id, _pairlst: [{ a: partner, b: self }] })

	{
		const m = makeM([makeSample(1, tp53(7674289)), makeSample(2, tp53(7674289))])
		mayUpdatePairlst(m)
		test.equal(m.pairlst[0].a.pos, 7674289, 'single partner breakpoint: pairlst is left as is')
		test.notOk(m.pairlst[0].a.breakpoints, 'single partner breakpoint: no breakpoints[]')
	}

	{
		const samples = [
			makeSample(1, tp53(7674289)),
			makeSample(2, tp53(7674915)),
			makeSample(3, tp53(7674915)),
			makeSample(2, tp53(7674915)), // 2nd event of sample 2, counted again
			makeSample(4, tp53(7674915, '+')), // same pos, other strand: a distinct breakpoint
			makeSample(5, { chr: 'chr17', strand: '-', name: 'TP53' }) // no coordinate, skipped
		]
		const m = makeM(samples)
		mayUpdatePairlst(m)
		const a = m.pairlst[0].a
		test.deepEqual(
			a,
			{
				chr: 'chr17',
				name: 'TP53',
				breakpoints: [
					{ chr: 'chr17', pos: 7674915, strand: '-', samplecount: 3 },
					{ chr: 'chr17', pos: 7674289, strand: '-', samplecount: 1 },
					{ chr: 'chr17', pos: 7674915, strand: '+', samplecount: 1 }
				]
			},
			'multiple partner breakpoints: partner point has breakpoints[] by count, and no pos/strand'
		)
		test.deepEqual(m.pairlst[0].b, self, 'the point on the queried gene is unchanged')
		test.equal(samples[0]._pairlst[0].a.pos, 7674289, 'the first sample keeps its own breakpoint')
	}

	{
		// queried gene on the a side: the partner is b
		const m = {
			dt: dtfusionrna,
			pairlstIdx: 0,
			pairlst: [{ a: self, b: tp53(1) }],
			samples: [
				{ sample_id: 1, _pairlst: [{ a: self, b: tp53(1) }] },
				{ sample_id: 2, _pairlst: [{ a: self, b: tp53(2) }] }
			]
		}
		mayUpdatePairlst(m)
		test.equal(m.pairlst[0].b.breakpoints?.length, 2, 'pairlstIdx=0: breakpoints[] is built on the b side')
		test.deepEqual(m.pairlst[0].a, self, 'pairlstIdx=0: a side is unchanged')
	}

	{
		const samples = [makeSample(1, tp53(1)), makeSample(2, tp53(2))]
		for (const overrides of [
			{ dt: dtsnvindel },
			{ pairlstIdx: undefined },
			{ pairlst: undefined },
			{
				pairlst: [
					{ a: self, b: tp53(1) },
					{ a: tp53(1), b: self }
				]
			},
			{ samples: undefined }
		]) {
			const m = makeM(samples, overrides)
			const before = JSON.stringify(m.pairlst)
			mayUpdatePairlst(m)
			test.equal(JSON.stringify(m.pairlst), before, 'left as is with ' + JSON.stringify(Object.keys(overrides)))
		}
	}

	test.end()
})

///////////////////// constants

const ds = {
	queries: {
		snvindel: {
			byrange: {
				get: () => {
					return [{ chr: '1', pos: 5 }]
				}
			}
		},
		cnv: {
			get: () => {
				return { cnvs: [{}] }
			}
		}
	}
}
