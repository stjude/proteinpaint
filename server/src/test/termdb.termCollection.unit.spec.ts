import tape from 'tape'
import { resolveTermCollectionFractions } from '../termdb.termCollection.ts'
import { getTwByIndex } from '../termdb.twFromRequest.ts'

function fractionTw(mode: 'continuous' | 'discrete' = 'continuous') {
	return {
		$id: 'collection',
		type: 'TermCollectionTWFraction',
		term: {
			type: 'termCollection',
			memberType: 'numeric',
			termlst: [
				{ id: 'a', type: 'float' },
				{ id: 'b', type: 'float' },
				{ id: 'c', type: 'float' }
			]
		},
		q: {
			mode,
			denominators: ['a', 'b', 'c'],
			numerators: ['a', 'b'],
			...(mode === 'discrete'
				? {
						type: 'custom-bin',
						lst: [
							{ startunbounded: true, stop: 0.5, label: 'low' },
							{ start: 0.5, stopunbounded: true, startinclusive: true, label: 'high' }
						]
				  }
				: {})
		}
	}
}

tape('resolveTermCollectionFractions() computes one scalar per sample', test => {
	const data: any = {
		samples: {
			s1: { collection: { value: { a: 2, b: 1, c: 3 } } },
			s2: { collection: { value: { a: 0, b: 0, c: 0 } } },
			s3: { collection: { value: { a: 1, c: 3 } } }
		},
		refs: { byTermId: {} }
	}
	resolveTermCollectionFractions(data, [fractionTw()])
	test.deepEqual(data.samples.s1.collection, { key: 0.5, value: 0.5 }, 'computes numerator sum / denominator sum')
	test.notOk(data.samples.s2.collection, 'removes a sample with a zero denominator')
	test.deepEqual(data.samples.s3.collection, { key: 0.25, value: 0.25 }, 'missing member values contribute zero')
	test.end()
})

tape('resolveTermCollectionFractions() bins a discrete fraction', test => {
	const data: any = {
		samples: { s1: { collection: { value: { a: 2, b: 1, c: 3 } } } },
		refs: { byTermId: {} }
	}
	const tw = fractionTw('discrete')
	resolveTermCollectionFractions(data, [tw])
	test.deepEqual(data.samples.s1.collection, { key: 'high', value: 0.5 }, 'uses the bin label as key')
	test.equal(data.refs.byTermId.collection.bins, tw.q.lst, 'exposes bins in term refs')
	test.end()
})

tape('resolveTermCollectionFractions() computes regular bins from fraction values', test => {
	const data: any = {
		samples: {
			s1: { collection: { value: { a: 1, b: 0, c: 3 } } },
			s2: { collection: { value: { a: 3, b: 0, c: 1 } } }
		},
		refs: { byTermId: {} }
	}
	const tw: any = fractionTw()
	tw.q = {
		mode: 'discrete',
		type: 'regular-bin',
		bin_size: 0.5,
		first_bin: { startunbounded: true, stop: 0.5 },
		denominators: ['a', 'b', 'c'],
		numerators: ['a', 'b']
	}
	resolveTermCollectionFractions(data, [tw])
	test.equal(data.samples.s1.collection.value, 0.25, 'retains the first fraction value')
	test.equal(data.samples.s2.collection.value, 0.75, 'retains the second fraction value')
	test.ok(data.refs.byTermId.collection.bins.length >= 2, 'publishes computed regular bins')
	test.end()
})

tape('a request reconstructs a fraction collection wrapper with its wrapper type', test => {
	const q: any = {
		term2: { type: 'termCollection', memberType: 'numeric', name: 'Isoforms' },
		term2_type: 'TermCollectionTWFraction',
		term2_$id: 'collection',
		term2_q: {
			mode: 'discrete',
			type: 'custom-bin',
			lst: [
				{ startunbounded: true, stop: 0.5 },
				{ start: 0.5, stopunbounded: true, startinclusive: true }
			],
			denominators: ['a', 'b'],
			numerators: ['a']
		}
	}
	const tw = getTwByIndex(q).get(2)
	test.equal(tw.type, 'TermCollectionTWFraction', 'preserves the type required by fraction resolution')
	test.equal(tw.$id, 'collection', 'preserves the data key used by getData and barchart')
	test.equal(tw.q.type, 'custom-bin', 'preserves the standard numeric bin configuration')
	test.end()
})
