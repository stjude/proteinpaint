import tape from 'tape'
import { validateVariantFilter, filterVariantValues, variantFilterLabel } from '../geneVariantFilter.ts'
import { dtsnvindel, dtcnv } from '../common.js'

/*************************
 reusable helper functions
**************************/

// a variant filter over one dt, as the variant config ui emits it for a groupset group
function getFilter(values: any[], dt = dtsnvindel, tvsProps: any = {}) {
	return {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: Object.assign({ term: { dt, type: 'dtsnvindel' }, values, genotype: 'variant' }, tvsProps)
			}
		]
	}
}

const G12D = { dt: dtsnvindel, class: 'M', mname: 'G12D', gene: 'KRAS' }
const G12V = { dt: dtsnvindel, class: 'M', mname: 'G12V', gene: 'KRAS' }
const truncating = { dt: dtsnvindel, class: 'F', mname: 'Q22fs', gene: 'KRAS' }
const cnvGain = { dt: dtcnv, class: 'CNV_amp', gene: 'KRAS', value: 0.5 }

const term = { name: 'KRAS', childTerms: [{ dt: dtsnvindel }, { dt: dtcnv }] }

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- shared/geneVariantFilter -***-')
	test.end()
})

tape('filterVariantValues() selects by amino acid change', test => {
	const filter = getFilter([{ key: 'M', mname: 'G12D' }])

	test.deepEqual(
		filterVariantValues([G12D, G12V], filter).map(v => v.mname),
		['G12D'],
		'keeps only the requested variant when the sample carries both'
	)

	const g12vOnly = filterVariantValues([G12V], filter)
	test.deepEqual(
		g12vOnly.map(v => v.class),
		['WT'],
		'annotates a sample tested for the dt but carrying another variant as wildtype'
	)
	test.equal(g12vOnly[0].gene, 'KRAS', 'carries the gene over to the substituted wildtype value')

	test.deepEqual(
		filterVariantValues([G12D], getFilter([{ key: 'M', mname: 'G12V' }])).map(v => v.class),
		['WT'],
		'is symmetric for the sibling row of the same gene'
	)
	test.end()
})

tape('filterVariantValues() preserves testing status', test => {
	const filter = getFilter([{ key: 'M', mname: 'G12D' }])
	const wt = { dt: dtsnvindel, class: 'WT', gene: 'KRAS' }
	const blank = { dt: dtsnvindel, class: 'Blank', gene: 'KRAS' }

	test.deepEqual(filterVariantValues([wt], filter), [wt], 'keeps a wildtype value as-is')
	test.deepEqual(filterVariantValues([blank], filter), [blank], 'keeps a not-tested value as-is')
	test.deepEqual(
		filterVariantValues([G12V, blank], filter),
		[blank],
		'does not substitute a wildtype when the dt already carries a status value'
	)
	test.end()
})

tape('filterVariantValues() covers only the dts named by the filter', test => {
	const filter = getFilter([{ key: 'M', mname: 'G12D' }])

	test.deepEqual(
		filterVariantValues([G12D, cnvGain], filter).map(v => v.class),
		['M'],
		'drops a value of a dt the filter does not name, without substituting a wildtype for it'
	)

	const twoDts = {
		type: 'tvslst',
		in: true,
		join: 'or',
		lst: [
			{ type: 'tvs', tvs: { term: { dt: dtsnvindel }, values: [{ key: 'M', mname: 'G12D' }] } },
			{ type: 'tvs', tvs: { term: { dt: dtcnv }, values: [{ key: 'CNV_amp' }] } }
		]
	}
	test.deepEqual(
		filterVariantValues([G12D, cnvGain], twoDts).map(v => v.class),
		['M', 'CNV_amp'],
		'keeps values of every dt an "or" filter names'
	)
	test.end()
})

tape('filterVariantValues() matches classes, origins and negation', test => {
	test.deepEqual(
		filterVariantValues([G12D, G12V, truncating], getFilter([{ key: 'M' }])).map(v => v.mname),
		['G12D', 'G12V'],
		'an entry without .mname matches any variant of its class'
	)

	test.deepEqual(
		filterVariantValues([G12D, G12V], getFilter([{ key: 'M', mname: 'G12D' }], dtsnvindel, { isnot: true })).map(
			v => v.mname
		),
		['G12V'],
		'isnot excludes the named variant and keeps the rest'
	)

	const germline = { ...G12D, origin: 'germline' }
	const somatic = { ...G12D, origin: 'somatic' }
	const byOrigin = getFilter([{ key: 'M', mname: 'G12D' }], dtsnvindel, {
		term: { dt: dtsnvindel, origin: 'germline' }
	})
	test.deepEqual(
		filterVariantValues([germline, somatic], byOrigin).map(v => v.origin),
		['germline'],
		'an origin-specific filter covers only that origin, leaving the other origin unrendered'
	)

	test.deepEqual(
		filterVariantValues([G12D, G12V], getFilter([{ key: 'M', mname: 'G12D', gene: 'NRAS' }])).map(v => v.class),
		['WT'],
		'.gene further restricts a variant selection'
	)
	test.end()
})

tape('filterVariantValues() does not mutate its input', test => {
	const values = [G12D, G12V, cnvGain]
	const copy = structuredClone(values)
	filterVariantValues(values, getFilter([{ key: 'M', mname: 'G12D' }]))
	test.deepEqual(values, copy, 'leaves the annotation values untouched')

	test.deepEqual(filterVariantValues(values, undefined), values, 'returns the values as-is without a filter')
	test.end()
})

tape('validateVariantFilter() rejects what it cannot honor per variant', test => {
	const ok = getFilter([{ key: 'M', mname: 'G12D' }])
	test.doesNotThrow(() => validateVariantFilter(ok, term), 'accepts a filter over a child dt term')
	test.doesNotThrow(() => validateVariantFilter(undefined, term), 'accepts a missing filter')

	const throws = (filter: any, msg: string) => test.throws(() => validateVariantFilter(filter, term), /./, msg)
	throws({ type: 'tvs' }, 'rejects a filter that is not a tvslst')
	throws({ type: 'tvslst', lst: [] }, 'rejects an empty lst[]')
	throws(getFilter([{ key: 'M' }], 2), 'rejects a dt that the term has no child term for')
	throws(getFilter([{ mname: 'G12D' }]), 'rejects a values[] entry without .key')
	throws(getFilter([{ key: 'WT' }]), 'rejects selecting a testing status class')
	throws(getFilter([{ key: 'M' }], dtsnvindel, { mcount: 'multiple' }), 'rejects a sample-level mcount')
	throws(getFilter([{ key: 'M' }], dtsnvindel, { genotype: 'wt' }), 'rejects a non-variant genotype')
	throws(getFilter([{ key: 'M' }], dtsnvindel, { mafFilter: {} }), 'rejects a maf filter')
	throws(getFilter([{ key: 'CNV_amp' }], dtcnv, { continuousCnv: true }), 'rejects continuous cnv cutoffs')
	test.end()
})

tape('variantFilterLabel() names what a row selects', test => {
	test.equal(variantFilterLabel(getFilter([{ key: 'M', mname: 'G12D' }])), 'G12D', 'uses the amino acid change')
	test.equal(
		variantFilterLabel(
			getFilter([
				{ key: 'M', mname: 'G12D' },
				{ key: 'M', mname: 'G12V' }
			])
		),
		'G12D/G12V',
		'joins multiple variants'
	)
	test.equal(variantFilterLabel(getFilter([{ key: 'M' }])), 'MISSENSE', 'falls back to the mutation class label')
	test.equal(
		variantFilterLabel(getFilter([{ key: 'M' }]), { M: { label: 'Missense' } }),
		'Missense',
		'uses a dataset mclass override when given'
	)
	// naming the G12D entry by its class would claim the row shows every missense
	test.equal(
		variantFilterLabel(getFilter([{ key: 'M', mname: 'G12D' }, { key: 'F' }])),
		'G12D/FRAMESHIFT',
		'resolves each entry on its own when a specific variant is mixed with a class'
	)
	test.equal(
		variantFilterLabel(getFilter([{ key: 'M', mname: 'G12D' }], dtsnvindel, { isnot: true })),
		'',
		'names nothing when every entry is negated'
	)
	test.equal(variantFilterLabel(undefined), '', 'tolerates a missing filter')
	test.end()
})

/* the list-level negation that matchFilter() applies must reach the label too, or
a row rendering the complement of a variant would be named after that variant */
tape('variantFilterLabel() propagates the negation of enclosing lists', test => {
	const excluded = getFilter([{ key: 'M', mname: 'G12D' }])
	excluded.in = false
	test.equal(variantFilterLabel(excluded), '', 'names nothing for a list that renders the complement of its entries')

	const doubleNegated = getFilter([{ key: 'M', mname: 'G12D' }], dtsnvindel, { isnot: true })
	doubleNegated.in = false
	test.equal(variantFilterLabel(doubleNegated), 'G12D', 'a negated entry of an excluding list is selected again')

	const nested: any = {
		type: 'tvslst',
		in: false,
		join: '',
		lst: [{ type: 'tvslst', in: false, join: '', lst: getFilter([{ key: 'M', mname: 'G12D' }]).lst }]
	}
	test.equal(variantFilterLabel(nested), 'G12D', 'nesting flips the sense again')
	test.end()
})
