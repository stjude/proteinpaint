import tape from 'tape'
import { mclass } from '#shared/common.js'
import { MAX_SLICES, OTHER_KEY, PieCounter, mclassScheme, termValuesScheme } from '../pieChartProcessing.ts'

/* test sections
	- Should list wildtype first and keep the mclass order
	- Should ignore classes that are not in mclass
	- Should count samples once per cell and every variant value
	- Should hide wildtype and not tested by default and keep every other class
	- Should follow the request term for uncomputable and hidden values
	- Should scale the radius so that area is proportional to n
	- Should leave a cell without values empty
	- Should pass labels and colors through from mclass unchanged
	- Should use the term color, then a shared fallback color, for a term with values
	- Should fold the smallest slices into one other slice
*/

tape('\n', test => {
	test.comment('-***- src/aggregateMatrix/pieChartProcessing -***-')
	test.end()
})

const ann = (...classes: string[]) => ({ key: 'TP53', values: classes.map(c => ({ class: c })) })
const gv = mclassScheme(mclass)

tape('Should list wildtype first and keep the mclass order', test => {
	const defs = gv.define(new Set(Object.keys(mclass)))
	test.equal(defs[0].key, 'WT', 'Should put WT first')
	test.deepEqual(
		defs.slice(1).map(d => d.key),
		Object.keys(mclass).filter(k => k != 'WT'),
		'Should keep the other classes in mclass order'
	)
	test.end()
})

tape('Should ignore classes that are not in mclass', test => {
	test.deepEqual(
		gv.keysOf(ann('__proto__', 'constructor', 'toString', 'nope', 'M')),
		['M'],
		'Should keep only known class keys'
	)
	test.deepEqual(
		gv.keysOf({ values: [{ class: 5 }, { class: null }, {}, null] }),
		[],
		'Should ignore non-string classes'
	)
	test.deepEqual(gv.keysOf(undefined), [], 'Should handle a missing annotation')
	test.deepEqual(gv.keysOf({ key: 'TP53' }), [], 'Should handle an annotation without values')

	const counter = new PieCounter()
	counter.add(0, ann('__proto__', 'hasOwnProperty'), gv)
	test.equal(counter.build().size, 0, 'Should not create a pie from unknown classes')
	test.end()
})

tape('Should count samples once per cell and every variant value', test => {
	const counter = new PieCounter()
	counter.add(3, ann('WT'), gv)
	counter.add(3, ann('M', 'M'), gv)
	counter.add(3, ann('M', 'F'), gv)
	const pie = counter.build().get(3)!
	test.equal(pie.n, 3, 'Should count each sample once')
	test.equal(pie.termType, 'geneVariant', 'Should tell the client the term type of the slices')
	const order = Object.keys(mclass)
	const counts = { M: 3, F: 1 }
	const expected = [['WT', 1], ...Object.entries(counts).sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))]
	test.deepEqual(
		pie.slices.map(s => [s.key, s.count]),
		expected,
		'Should count both values of a sample with two variants, in the fixed class order'
	)
	test.end()
})

tape('Should count wildtype and not tested once per sample', test => {
	test.deepEqual(
		gv.keysOf(ann('WT', 'M', 'WT', 'M', 'Blank', 'Blank')),
		['WT', 'M', 'M', 'Blank'],
		'Should keep one wildtype and one not tested, and every variant'
	)
	const counter = new PieCounter()
	counter.add(0, ann('WT', 'WT', 'WT', 'WT'), gv)
	counter.add(0, ann('WT', 'WT', 'M', 'M'), gv)
	counter.add(0, ann('Blank', 'Blank'), gv)
	const pie = counter.build().get(0)!
	test.equal(pie.n, 3, 'Should count each sample once')
	const count = (key: string) => pie.slices.find(s => s.key == key)?.count
	test.equal(count('WT'), 2, 'Should count wildtype once for each sample that has it')
	test.equal(count('Blank'), 1, 'Should count not tested once for each sample that has it')
	test.equal(count('M'), 2, 'Should still count every variant of a sample')
	test.end()
})

tape('Should count the samples with a variant', test => {
	const counter = new PieCounter()
	counter.add(0, ann('WT'), gv)
	counter.add(0, ann('M', 'M'), gv)
	counter.add(0, ann('M', 'F'), gv)
	counter.add(0, ann('Blank'), gv)
	test.equal(counter.build().get(0)!.variantSamples, 2, 'Should count a sample once however many variants it has')

	const generic = new PieCounter()
	generic.add(
		0,
		{ keys: ['a'] },
		{ keysOf: a => a.keys, define: o => [...o].map(key => ({ key, label: key, color: '#000' })) }
	)
	test.equal(generic.build().get(0)!.variantSamples, undefined, 'Should not count variants of a term without them')
	test.end()
})

tape('Should hide wildtype and not tested by default and keep every other class', test => {
	const counter = new PieCounter()
	counter.add(0, ann('Blank', 'M'), gv)
	counter.add(0, ann('WT'), gv)
	const pie = counter.build().get(0)!
	test.equal(pie.n, 2, 'Should count the samples, hidden classes included')
	test.deepEqual(
		pie.slices.map(s => [s.key, !!s.hidden]),
		[
			['WT', true],
			['M', false],
			['Blank', true]
		],
		'Should flag wildtype and not tested as hidden, and no other class'
	)
	test.end()
})

tape('Should follow the request term for uncomputable and hidden values', test => {
	const tw = {
		term: { values: { M: { uncomputable: true }, F: { label: 'Frameshift' } } },
		q: { hiddenValues: { F: 1, N: 1, S: 0 } }
	}
	const scheme = mclassScheme(mclass, tw)
	test.deepEqual(
		scheme.keysOf(ann('M', 'F', 'WT', 'N', 'S')),
		['F', 'WT', 'N', 'S'],
		'Should remove uncomputable values only'
	)
	test.deepEqual(
		scheme.define(new Set(['WT', 'F', 'N', 'S'])).map(d => [d.key, !!d.hidden]),
		[
			['WT', true],
			['N', true],
			['F', true],
			['S', false]
		].sort((a, b) =>
			a[0] == 'WT'
				? -1
				: b[0] == 'WT'
				? 1
				: Object.keys(mclass).indexOf(a[0] as string) - Object.keys(mclass).indexOf(b[0] as string)
		),
		'Should flag the values of q.hiddenValues as hidden, and not a value that is set to 0'
	)
	const counter = new PieCounter()
	counter.add(0, ann('M'), scheme)
	test.equal(counter.build().size, 0, 'Should not make a pie from samples that only have uncomputable values')
	test.deepEqual(
		mclassScheme(mclass, { term: { values: { __proto__: { M: { uncomputable: true } } } }, q: {} }).keysOf(ann('M')),
		['M'],
		'Should not read inherited values'
	)
	test.deepEqual(
		mclassScheme(mclass, undefined).keysOf(ann('M', 'Blank')),
		['M', 'Blank'],
		'Should handle a request without a term'
	)

	const generic = termValuesScheme({
		keysOf: a => a.keys,
		keyOrder: ['a', 'b', 'c'],
		labelOf: k => k,
		colorOf: () => undefined,
		isUncomputable: k => k == 'a',
		isHidden: k => k == 'b'
	})
	test.deepEqual(
		generic.keysOf({ keys: ['a', 'b', 'c'] }),
		['b', 'c'],
		'Should remove uncomputable values of any term type'
	)
	test.deepEqual(
		generic.define(new Set(['b', 'c'])).map(d => [d.key, !!d.hidden]),
		[
			['b', true],
			['c', false]
		],
		'Should flag hidden values of any term type'
	)
	test.end()
})

tape('Should scale the radius so that area is proportional to n', test => {
	const counter = new PieCounter()
	for (let i = 0; i < 100; i++) counter.add(0, ann('M'), gv)
	for (let i = 0; i < 25; i++) counter.add(1, ann('M'), gv)
	const pies = counter.build()
	test.equal(pies.get(0)!.radius, 1, 'Should give the largest pie a radius of 1')
	test.equal(pies.get(1)!.radius, 0.5, 'Should give a quarter of the samples half the radius')
	test.end()
})

tape('Should leave a cell without values empty', test => {
	const counter = new PieCounter()
	test.equal(counter.build().size, 0, 'Should build nothing from no input')
	counter.add(0, undefined, gv)
	counter.add(0, { values: [] }, gv)
	test.equal(counter.build().has(0), false, 'Should not make a pie for samples without a value')
	test.end()
})

tape('Should pass labels and colors through from mclass unchanged', test => {
	const counter = new PieCounter()
	counter.add(0, ann('WT'), gv)
	const slice = counter.build().get(0)!.slices[0]
	test.equal(slice.label, mclass.WT.label, 'Should use the mclass label')
	test.equal(slice.color, mclass.WT.color, 'Should use the mclass color')
	test.end()
})

tape('Should use the term color, then a shared fallback color, for a term with values', test => {
	const values: any = {
		a: { label: 'Alpha', color: '#ff0000' },
		b: { label: 'Beta' },
		c: { label: 'Gamma', color: 'javascript:1' }
	}
	const scheme = termValuesScheme({
		keysOf: a => (a?.values || []).map(v => String(v.key)),
		keyOrder: ['a', 'b', 'c'],
		labelOf: k => values[k]?.label ?? k,
		colorOf: k => values[k]?.color
	})
	const defs = scheme.define(new Set(['c', 'b', 'a', 'z']))
	test.deepEqual(
		defs.map(d => d.key),
		['a', 'b', 'c', 'z'],
		'Should follow the key order, then keys that were not listed'
	)
	test.equal(defs[0].color, '#ff0000', 'Should use the color of the term')
	test.equal(defs[0].label, 'Alpha', 'Should use the label of the term')
	for (const d of defs.slice(1))
		test.ok(
			/^#[0-9a-fA-F]{6}$/.test(d.color) || d.color.startsWith('rgb'),
			`Should give ${d.key} a usable fallback color`
		)
	test.notEqual(defs[2].color, 'javascript:1', 'Should reject a color that is not a hex color')
	test.deepEqual(
		scheme.define(new Set(['a', 'b', 'c', 'z'])).map(d => d.color),
		defs.map(d => d.color),
		'Should assign the same colors every time'
	)
	test.end()
})

tape('Should fold the smallest slices into one other slice', test => {
	const scheme = termValuesScheme({
		keysOf: a => a.keys,
		keyOrder: [],
		labelOf: k => k,
		colorOf: () => undefined
	})
	const counter = new PieCounter()
	const total = MAX_SLICES + 5
	for (let i = 0; i < total; i++) {
		// key i is seen i + 1 times, so the first keys are the smallest
		for (let j = 0; j <= i; j++) counter.add(0, { keys: [`k${i}`] }, scheme)
	}
	const pie = counter.build().get(0)!
	test.equal(pie.slices.length, MAX_SLICES, 'Should not exceed the slice cap')
	const other = pie.slices[pie.slices.length - 1]
	test.equal(other.key, OTHER_KEY, 'Should end with the other slice')
	test.equal(other.count, 1 + 2 + 3 + 4 + 5 + 6, 'Should fold the six smallest keys')
	test.end()
})
