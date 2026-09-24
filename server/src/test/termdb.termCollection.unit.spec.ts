import tape from 'tape'
import {
	resolveTermCollectionFractions,
	expandCustomTermCollection,
	reconstituteCustomTermCollection,
	isReservedTermId,
	resolveTermId
} from '../termdb.termCollection.ts'
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

tape('resolveTermCollectionFractions() rejects an empty custom-bin q.lst', test => {
	const data: any = {
		samples: { s1: { collection: { value: { a: 2, b: 1, c: 3 } } } },
		refs: { byTermId: {} }
	}
	const tw = fractionTw('discrete')
	tw.q.lst = []
	test.throws(
		() => resolveTermCollectionFractions(data, [tw]),
		/non-empty q\.lst/,
		'throws instead of silently treating an empty bins list as "no bins configured"'
	)
	test.deepEqual(
		data.samples.s1.collection,
		{ value: { a: 2, b: 1, c: 3 } },
		'the sample is untouched since validation runs before any sample is processed'
	)
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

tape('isReservedTermId() rejects reserved and coercible $id values, but allows harmless non-strings', test => {
	test.ok(isReservedTermId('__proto__'), 'rejects __proto__')
	test.ok(isReservedTermId('constructor'), 'rejects constructor')
	test.ok(isReservedTermId('prototype'), 'rejects prototype')
	test.ok(isReservedTermId('toString'), 'rejects an inherited Object.prototype member name')
	test.ok(isReservedTermId(['__proto__']), 'rejects a non-string id that would coerce to a dangerous key')
	test.ok(
		isReservedTermId({ toString: () => '__proto__' }),
		'rejects an object whose string coercion is a dangerous key'
	)
	test.notOk(isReservedTermId('agedx'), 'allows an ordinary $id')
	test.notOk(isReservedTermId(undefined), 'allows a missing $id so callers can fall back to term.id/term.name')
	test.notOk(isReservedTermId(42), 'allows a numeric $id since it cannot coerce to a reserved key')
	test.end()
})

// Object string-coercion is not guaranteed pure: a custom toString()/valueOf()/Symbol.toPrimitive
// can return a different value on every call. isReservedTermId() alone protects a caller that both
// validates and later re-keys with the SAME unresolved object -- if $id is checked once (coercion
// call #1) and later re-coerced as an actual property key (coercion call #2), those two calls can
// disagree. resolveTermId() must coerce an object exactly once and freeze that single result.
function makeStatefulId(firstResult: string, laterResults: string) {
	let calls = 0
	return {
		toString() {
			calls++
			return calls === 1 ? firstResult : laterResults
		}
	}
}

tape('resolveTermId() coerces an object exactly once and freezes the result', test => {
	const id = makeStatefulId('safe123', '__proto__')
	const resolved = resolveTermId(id)
	test.equal(resolved, 'safe123', "returns the FIRST call's result, matching what was validated")
	test.equal(typeof resolved, 'string', 'resolves an object $id to a string')
	// simulate later re-use as a property key on a plain, non-null-prototype object (e.g. byTermId{})
	const byTermId: any = {}
	byTermId[resolved] = { bins: [1, 2, 3] }
	test.ok(Object.hasOwn(byTermId, 'safe123'), 'the frozen string is used consistently as the actual key')
	test.notOk(
		({} as any).bins,
		'a later re-coercion of the original object never happens, so it cannot pollute Object.prototype'
	)
	test.end()
})

tape('resolveTermId() throws when an object resolves to a reserved name on its one authoritative call', test => {
	const id = { toString: () => '__proto__' }
	test.throws(() => resolveTermId(id), /invalid \$id/, 'rejects immediately, matching isReservedTermId')
	test.end()
})

tape('resolveTermId() leaves primitives unchanged, since their coercion is always pure', test => {
	test.equal(resolveTermId(42), 42, 'a numeric $id stays a number, not a stringified copy')
	test.equal(typeof resolveTermId(42), 'number')
	test.equal(resolveTermId('agedx'), 'agedx', 'an ordinary string $id is returned as-is')
	test.equal(resolveTermId(undefined), undefined, 'a missing $id is returned as-is so callers can fall back')
	test.throws(() => resolveTermId('__proto__'), /invalid \$id/, 'still rejects a reserved string $id')
	test.end()
})

tape('resolveTermId() rejects an array $id (coerces via the default, stateless Array.prototype.toString)', test => {
	test.throws(() => resolveTermId(['__proto__']), /invalid \$id/)
	test.end()
})

tape('resolveTermCollectionFractions() rejects a fraction tw with a reserved $id', test => {
	const data: any = { samples: { s1: { collection: { value: { a: 1, b: 1 } } } }, refs: { byTermId: {} } }
	const tw = fractionTw()
	tw.$id = '__proto__'
	test.throws(() => resolveTermCollectionFractions(data, [tw]), /invalid \$id/, 'throws instead of writing through $id')
	test.notOk((data.refs.byTermId as any).bins, 'does not pollute Object.prototype')
	test.end()
})

tape('expandCustomTermCollection() rejects a custom termCollection with a reserved $id', test => {
	const tw = {
		$id: '__proto__',
		term: { type: 'termCollection', isCustom: true, termlst: [{ id: 'a' }, { id: 'b' }] },
		q: {}
	}
	test.throws(() => expandCustomTermCollection([tw]), /invalid \$id/, 'throws before any member expansion happens')
	test.end()
})

tape(
	'reconstituteCustomTermCollection() stores a member named __proto__ as real data, not a prototype reassignment',
	test => {
		const tw = {
			$id: 'collection',
			term: { type: 'termCollection', isCustom: true, termlst: [{ id: '__proto__' }, { id: 'b' }] },
			q: {}
		}
		const { tcMappings } = expandCustomTermCollection([tw])
		const data: any = {
			samples: {
				s1: {
					__collection____proto__: { key: 5, value: 5 },
					__collection__b: { key: 7, value: 7 }
				}
			}
		}
		reconstituteCustomTermCollection(data, tcMappings)
		test.deepEqual(
			Object.keys(data.samples.s1.collection.value).sort(),
			['__proto__', 'b'],
			'both members are stored as real own properties'
		)
		test.equal(data.samples.s1.collection.value['__proto__'], 5, 'the __proto__-named member keeps its own value')
		test.equal(
			Object.getPrototypeOf(data.samples.s1),
			Object.prototype,
			"the sample object's own prototype is untouched"
		)
		test.end()
	}
)

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
