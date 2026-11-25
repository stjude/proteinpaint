import tape from 'tape'
import { getGvQLabel, isCustomizedGvQ, isGvRegionTerm, canQueryGvTermDt, canQueryGvGroupset } from '../geneVariant.ts'
import { dtsnvindel, dtcnv } from '#shared/common.js'

/* test sections

isCustomizedGvQ()
getGvQLabel()
isGvRegionTerm()
canQueryGvTermDt()
canQueryGvGroupset()
*/

const geneTerm = { type: 'geneVariant', genes: [{ kind: 'gene', gene: 'TP53' }] }
const regionTerm = { type: 'geneVariant', genes: [{ kind: 'coord', chr: 'chr17', start: 7661778, stop: 7687538 }] }
// gdc-like: snvindel takes a region, while gene-level cnv does not, see getGvQueryMethods() in the server
const gdcLikeVocabApi = {
	termdbConfig: { queries: { snvindel: { methods: ['gene', 'coord'] }, cnv: { methods: ['gene'] } } }
}

function getCustomGsQ(...groupNames: string[]) {
	return {
		type: 'custom-groupset',
		customset: { groups: groupNames.map(name => ({ name, type: 'filter', filter: {} })) }
	}
}

tape('\n', function (test) {
	test.comment('-***- tw/geneVariant helpers -***-')
	test.end()
})

tape('isCustomizedGvQ()', t => {
	t.equal(isCustomizedGvQ(getCustomGsQ('BCR-ABL1 fusion', 'Others')), true, 'a custom groupset is a user setting')
	t.equal(
		isCustomizedGvQ({ type: 'custom-groupset', customset: { groups: [] } }),
		false,
		'a custom groupset with no groups is not'
	)
	t.equal(
		isCustomizedGvQ({ type: 'predefined-groupset', predefined_groupset_idx: 1 }),
		false,
		'a predefined groupset is not, being what the gene search radio already selects'
	)
	t.equal(isCustomizedGvQ({ type: 'values' }), false, 'a plain values q is the default, not a setting')
	t.equal(
		isCustomizedGvQ({ type: 'values', variantFilter: { type: 'tvslst', lst: [] } }),
		false,
		'a variantFilter is left out until a UI authors one'
	)
	t.equal(isCustomizedGvQ(undefined), false, 'tolerates a missing q')
	t.end()
})

tape('getGvQLabel()', t => {
	const term = {
		type: 'geneVariant',
		name: 'BCR',
		groupsetting: { disabled: false, lst: [{ name: 'SNV/indel' }, { name: 'Fusion' }] }
	}
	t.equal(
		getGvQLabel(term, getCustomGsQ('BCR-ABL1 fusion', 'Others')),
		'BCR-ABL1 fusion / Others',
		'names a custom groupset by its groups, so two settings of one gene can be told apart'
	)
	t.equal(getGvQLabel(term, getCustomGsQ()), 'custom groups', 'falls back for a custom groupset with no groups')
	t.equal(
		getGvQLabel(term, { type: 'predefined-groupset', predefined_groupset_idx: 1 }),
		'Fusion',
		'names a predefined groupset by the selected groupset'
	)
	t.equal(
		getGvQLabel({ type: 'geneVariant', name: 'BCR' }, { type: 'predefined-groupset', predefined_groupset_idx: 1 }),
		'predefined groups',
		'falls back when the term carries no groupset listing, e.g. before it is filled'
	)
	t.equal(getGvQLabel(term, { type: 'values' }), 'any variant class', 'names a plain values q')
	t.end()
})

tape('isGvRegionTerm()', t => {
	t.equal(isGvRegionTerm(regionTerm), true, 'a term over a coordinate is a region term')
	t.equal(isGvRegionTerm(geneTerm), false, 'a term over a gene is not')
	t.equal(isGvRegionTerm({ type: 'geneVariant' }), false, 'tolerates a term without genes[]')
	t.end()
})

tape('canQueryGvTermDt()', t => {
	t.equal(canQueryGvTermDt(regionTerm, dtsnvindel, gdcLikeVocabApi), true, 'a region by a query that takes one')
	t.equal(canQueryGvTermDt(regionTerm, dtcnv, gdcLikeVocabApi), false, 'not a region by a query that takes none')
	t.equal(canQueryGvTermDt(geneTerm, dtcnv, gdcLikeVocabApi), true, 'a gene by any query')
	t.end()
})

tape('canQueryGvGroupset()', t => {
	t.equal(canQueryGvGroupset(regionTerm, { dt: dtsnvindel } as any, gdcLikeVocabApi), true, 'a region, one dt')
	t.equal(canQueryGvGroupset(regionTerm, { dt: dtcnv } as any, gdcLikeVocabApi), false, 'not a region, one dt')
	t.equal(
		canQueryGvGroupset(regionTerm, { dts: [dtsnvindel, dtcnv] } as any, gdcLikeVocabApi),
		false,
		'not a region when any dt of the groupset cannot take one, as for bi/mono-allelic'
	)
	t.equal(canQueryGvGroupset(geneTerm, { dt: dtcnv } as any, gdcLikeVocabApi), true, 'a gene, any groupset')
	t.end()
})
