import tape from 'tape'
import {
	resolveElementEntryForTerms,
	resolveElementEntryForTerm,
	testedElementValues,
	toReturnedUnit
} from '../mds3.init.js'

/*
Which element matrix answers dnaMethylation TERM queries on a dataset with no CpG-level
.file. Worth pinning down because every failure here is SILENT: picking the wrong matrix
still returns numbers, just for a different set of genomic features than the user meant.
The mmrf case below is the one that motivated the explicit config -- declaration order puts
eqtm_block (55k specialised blocks) ahead of allccre (267k, every cCRE class).
*/

tape('resolveElementEntryForTerms() - explicit elementForTerms wins over declaration order', t => {
	const q = {
		elementForTerms: 'allccre',
		promoter: { file: '/p.h5' },
		elements: {
			eqtm_block: { file: '/e.h5' },
			allccre: { file: '/a.h5' }
		}
	}
	t.equal(resolveElementEntryForTerms(q)?.file, '/a.h5', 'named entry is chosen, not the first declared')
	t.end()
})

tape('resolveElementEntryForTerms() - mmrf shape without the explicit key falls to eqtm_block', t => {
	// Documents WHY mmrf sets elementForTerms: without it the default picks the first
	// non-promoter entry, which is the narrower matrix.
	const q = {
		promoter: { file: '/p.h5' },
		elements: {
			eqtm_block: { file: '/e.h5' },
			allccre: { file: '/a.h5' }
		}
	}
	t.equal(resolveElementEntryForTerms(q)?.file, '/e.h5', 'first non-promoter entry by declaration order')
	t.end()
})

tape('resolveElementEntryForTerms() - promoter-only dataset still resolves', t => {
	t.equal(resolveElementEntryForTerms({ promoter: { file: '/p.h5' } })?.file, '/p.h5', 'legacy .promoter key')
	t.equal(
		resolveElementEntryForTerms({ elements: { promoter: { file: '/p2.h5' } } })?.file,
		'/p2.h5',
		'promoter declared inside .elements'
	)
	t.end()
})

tape('resolveElementEntryForTerms() - nothing configured yields undefined, not a throw', t => {
	// The caller uses undefined to leave q.get unset, which keeps the term type unavailable.
	// Throwing here would take down dataset init instead.
	t.equal(resolveElementEntryForTerms({}), undefined, 'empty query object')
	t.equal(resolveElementEntryForTerms({ elements: {} }), undefined, 'empty elements map')
	t.equal(resolveElementEntryForTerms({ elements: { x: {} } }), undefined, 'entry without a file is not usable')
	t.end()
})

tape('resolveElementEntryForTerms() - elementForTerms naming an unconfigured entry throws', t => {
	// Loud on purpose: a typo here would otherwise silently fall through to a different
	// matrix and every methylation term would quietly report the wrong features.
	t.throws(
		() => resolveElementEntryForTerms({ elementForTerms: 'nope', elements: { allccre: { file: '/a.h5' } } }),
		/elementForTerms/,
		'unknown key is rejected'
	)
	t.end()
})

tape('resolveElementEntryForTerm() - a term naming its element type reads that matrix', t => {
	// The discover/mmrf shape: DM tests promoters in .promoter, terms are nominated to allccre.
	const q = {
		elementForTerms: 'allccre',
		promoter: { file: '/p.h5' },
		elements: { enhancer_distal: { file: '/a.h5', element_class: 'enhancer_distal' }, allccre: { file: '/a.h5' } }
	}
	const nominated = resolveElementEntryForTerms(q)
	t.equal(resolveElementEntryForTerm(q, { elementType: 'promoter' }, nominated).file, '/p.h5', 'legacy .promoter key')
	t.equal(
		resolveElementEntryForTerm(q, { elementType: 'enhancer_distal' }, nominated).element_class,
		'enhancer_distal',
		'class-restricted entry, not the unrestricted one sharing its file'
	)
	t.equal(resolveElementEntryForTerm(q, {}, nominated), nominated, 'no type named: the nominated matrix')
	t.end()
})

tape('resolveElementEntryForTerm() - an element type the dataset lacks throws', t => {
	// Same reasoning as an unknown elementForTerms: falling back would plot another matrix's numbers.
	const q = { promoter: { file: '/p.h5' }, elements: { allccre: { file: '/a.h5' } } }
	for (const key of ['nope', 'dmr_scan', '__proto__', 'constructor']) {
		t.throws(() => resolveElementEntryForTerm(q, { elementType: key }, q.elements.allccre), /element type/, key)
	}
	t.throws(
		() => resolveElementEntryForTerm({ elements: { allccre: { file: '/a.h5' } } }, { elementType: 'promoter' }, {}),
		/element type/,
		'promoter on a dataset that declares none'
	)
	t.end()
})

tape('testedElementValues() - a term naming its element type reads that one row', t => {
	// Two TSS windows that overlap, as neighbouring promoters do; the term is the second.
	const out = {
		rows: [
			{ start: 100, stop: 2100 },
			{ start: 1500, stop: 3500 }
		],
		values: [
			[1, 2],
			[3, 4]
		]
	}
	const term = { start: 1500, stop: 3500 }
	t.deepEqual(
		testedElementValues({ ...term, elementType: 'promoter' }, out),
		[[3, 4]],
		'the row with the term coordinates'
	)
	t.deepEqual(testedElementValues(term, out), out.values, 'no type named: a span, every overlapping row')
	t.deepEqual(
		testedElementValues({ start: 1, stop: 9, elementType: 'promoter' }, out),
		out.values,
		'no row has these exact coordinates: every overlapping row, not nothing'
	)
	t.end()
})

tape('toReturnedUnit() - converts a value only when its matrix stores another unit', t => {
	t.equal(toReturnedUnit(0.5, true, true), 0.5, 'beta stays beta')
	t.equal(toReturnedUnit(-2, false, false), -2, 'M-value stays M-value')
	t.equal(toReturnedUnit(0.5, true, false), 0, 'beta 0.5 is M-value 0')
	t.equal(toReturnedUnit(0, false, true), 0.5, 'M-value 0 is beta 0.5')
	t.ok(Math.abs(toReturnedUnit(toReturnedUnit(0.2, true, false), false, true) - 0.2) < 1e-12, 'there and back')
	t.ok(
		Number.isFinite(toReturnedUnit(0, true, false)) && Number.isFinite(toReturnedUnit(1, true, false)),
		'beta 0 and 1 give finite M-values'
	)
	t.end()
})
