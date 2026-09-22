/********************************************
Unit tests for the gene/isoform validation middleware (server/src/geneRefValidation.ts)

Hardcodes the minimal gene db the lookups read, as the name maps initGeneDbLookups()
builds (see genedbLookups.ts). Values follow the real hg38-test genedb: TP53 with an NM_
and an ENST isoform, 'p53' as an alias, and an ENSG accession. The stub also carries a
sqlite connection that throws, so that a lookup reaching for sql fails the test rather
than silently blocking the event loop in production.

Covered: the term types and contexts the middleware reports, the gene db lookups
(symbol/isoform/alias/ENSG/version suffix, case insensitivity), and the middleware's
skips (no name maps, skipped route, dataset opt-out).

Run with:
  cd proteinpaint/server && npx tsx --conditions=sjpp/dev src/test/geneRefValidation.unit.spec.ts
or run the whole unit suite (as CI does):
  cd proteinpaint/server && npm run test:unit
*********************************************/
import tape from 'tape'
import { mayValidateRequestGeneRefs, collectGeneRefs, isKnownGeneName, isKnownIsoform } from '../geneRefValidation.ts'

/** the maps initGeneDbLookups() builds, keyed uppercase, for: TP53 (NM_000546, ENST00000269305),
 * AKT1, the gene-named accession ENSG00000258430, the aliases p53 and ENSG00000141510, and an ENSG
 * known only to gene2canonicalisoform */
function makeGenome() {
	const genome: any = {
		genomicNameRegexp: /[^a-zA-Z0-9.:_-]/, // default from initGenomesDs.js
		genedb: {
			// any lookup that reaches for sqlite blocks the event loop, and must not happen here
			db: {
				prepare: () => {
					throw new Error('the name lookups must not query sqlite')
				}
			},
			mapByName: new Map([
				['TP53', 'TP53'],
				['AKT1', 'AKT1'],
				['ENSG00000258430', 'ENSG00000258430']
			]),
			mapByIsoform: new Map([
				['NM_000546', 'TP53'],
				['ENST00000269305', 'TP53']
			]),
			mapByAlias: new Map([
				['P53', ['TP53']],
				['ENSG00000141510', ['TP53']]
			]),
			mapAliasesByName: new Map([['TP53', ['p53', 'ENSG00000141510']]]),
			mapCanonicalIsoformByEnsg: new Map([['ENSG00000012048', 'ENST00000357654']])
		}
	}
	return genome
}

const req = (query: any, path = '/termdb/matrix') => ({ path, query })

// tw/tvs payload builders, shaped as the client sends them
const gvTerm = (gene: string) => ({
	type: 'geneVariant',
	kind: 'gene',
	id: gene,
	gene,
	name: gene,
	genes: [{ type: 'geneVariant', kind: 'gene', id: gene, gene, name: gene }]
})
const geTerm = (gene: string) => ({ type: 'geneExpression', id: gene, gene, name: `${gene} FPKM` })
const filterOf = (tvs: any) => ({ type: 'tvslst', in: true, join: '', lst: [{ type: 'tvs', tvs }] })

tape('\n', test => {
	test.comment('-***- geneRefValidation -***-')
	test.end()
})

tape('gene db lookups', test => {
	const genome = makeGenome()
	test.equal(isKnownGeneName(genome, 'TP53'), true, 'symbol')
	test.equal(isKnownGeneName(genome, 'tp53'), true, 'symbol in another case, as collate nocase matched')
	test.equal(isKnownGeneName(genome, 'NM_000546'), true, 'isoform accession as a gene name')
	test.equal(isKnownGeneName(genome, 'p53'), true, 'alias')
	test.equal(isKnownGeneName(genome, 'ensg00000141510'), true, 'alias in another case')
	test.equal(isKnownGeneName(genome, 'ENSG00000258430'), true, 'ENSG that is a gene name')
	test.equal(isKnownGeneName(genome, 'ENSG00000012048'), true, 'ENSG known only to gene2canonicalisoform')
	test.equal(isKnownGeneName(genome, 'ENSG00000141510.16'), true, 'ENSG with a version suffix')
	test.equal(isKnownGeneName(genome, 'xxx'), false, 'unknown name')
	test.equal(isKnownGeneName(genome, "TP53' or 1=1"), false, 'name with characters the server never queries with')

	test.equal(isKnownIsoform(genome, 'NM_000546'), true, 'refseq accession')
	test.equal(isKnownIsoform(genome, 'NM_000546.6'), true, 'refseq accession with a version suffix')
	test.equal(isKnownIsoform(genome, 'ENST00000269305'), true, 'ensembl accession')
	test.equal(isKnownIsoform(genome, 'TP53'), false, 'a gene symbol is not an isoform')
	test.equal(isKnownIsoform(genome, 'NM_999999'), false, 'unknown accession')
	test.end()
})

tape('a genome without name maps is not validated', test => {
	const genome = makeGenome()
	delete genome.genedb.mapByName
	test.equal(
		mayValidateRequestGeneRefs(req({ terms: [{ term: gvTerm('xxx') }] }), genome, { cohort: { termdb: {} } }),
		undefined,
		'nothing to validate against, so the request is left alone'
	)
	test.end()
})

tape('collectGeneRefs() finds a term wherever it sits', test => {
	const inTw = collectGeneRefs({ terms: [{ $id: 'a', term: gvTerm('xxx'), q: {} }] })
	test.deepEqual(
		inTw.map(r => [r.kind, r.value, r.context]),
		[['gene', 'xxx', 'geneVariant TW']],
		'geneVariant term wrapper'
	)

	const inTvs = collectGeneRefs({ filter: filterOf({ term: gvTerm('xxx'), values: [] }) })
	test.deepEqual(
		inTvs.map(r => r.context),
		['geneVariant tvs'],
		'geneVariant filter tvs'
	)

	const dtTvs = collectGeneRefs({
		filter: filterOf({
			term: { id: 'xxx_snvindel', type: 'dtsnvindel', dt: 1, name: 'SNV/indel', parentTerm: gvTerm('xxx') },
			values: [{ key: 'M' }]
		})
	})
	test.deepEqual(
		dtTvs.map(r => r.context),
		['dtTerm tvs'],
		'a dt term tvs is reported as the dt term, not its parent'
	)

	const groupset = collectGeneRefs({
		terms: [
			{
				$id: 'a',
				term: { ...gvTerm('xxx'), groupsetting: { lst: [] } },
				q: {
					type: 'custom-groupset',
					customset: {
						groups: [
							{
								type: 'filter',
								filter: filterOf({
									term: { type: 'dtcnv', dt: 4, parentTerm: gvTerm('yyy') },
									values: []
								})
							}
						]
					}
				}
			}
		]
	})
	test.deepEqual(
		groupset.map(r => [r.value, r.context]).sort(),
		[
			['xxx', 'geneVariant TW'],
			['yyy', 'dtTerm tvs']
		],
		'a gene named only inside a groupset group filter is found too'
	)

	const expression = collectGeneRefs({
		terms: [
			{ term: geTerm('xxx') },
			{ term: { type: 'isoformExpression', isoform: 'NM_999999' } },
			{ term: { type: 'pseudobulk', gene: 'yyy' } },
			{ term: { type: 'singleCellGeneExpression', gene: 'zzz', sample: { sID: 's1' } } }
		]
	})
	test.deepEqual(
		expression.map(r => [r.kind, r.value, r.context]),
		[
			['gene', 'xxx', 'geneExpression TW'],
			['isoform', 'NM_999999', 'isoformExpression TW'],
			['gene', 'yyy', 'pseudobulk TW'],
			['gene', 'zzz', 'singleCellGeneExpression TW']
		],
		'every covered expression term type, by its own label'
	)

	test.deepEqual(
		collectGeneRefs({ terms: [{ term: { type: 'proteomeAbundance', gene: 'custom protein' } }] }),
		[],
		'proteomeAbundance is deliberately not validated'
	)
	test.deepEqual(
		collectGeneRefs({ terms: [{ term: geTerm('xxx') }] }, new Set(['geneExpression'])),
		[],
		'a term type the dataset opted out of is not collected'
	)
	test.end()
})

tape('collectGeneRefs() reads a geneVariant term of any shape', test => {
	test.deepEqual(
		collectGeneRefs({ tw: { term: { type: 'geneVariant', gene: 'xxx' } } }).map(r => r.value),
		['xxx'],
		'a raw term off a url, with no genes[]'
	)
	test.deepEqual(
		collectGeneRefs({
			tw: {
				term: {
					type: 'geneVariant',
					name: 'xxx, yyy',
					genes: [
						{ kind: 'gene', gene: 'xxx' },
						{ kind: 'gene', name: 'yyy' }
					]
				}
			}
		}).map(r => r.value),
		['xxx', 'yyy'],
		'every entry of genes[], by gene or by name'
	)
	test.deepEqual(
		collectGeneRefs({
			tw: {
				term: {
					type: 'geneVariant',
					genes: [
						{ kind: 'coord', name: 'chr17:7668421-7675244', chr: 'chr17', start: 7668420, stop: 7675244 },
						{ name: 'chr17:7668421-7675244', chr: 'chr17', start: 7668420, stop: 7675244 }
					]
				}
			}
		}),
		[],
		'a coord entry names a region, not a gene, with or without kind'
	)
	test.deepEqual(
		collectGeneRefs({
			tw: { term: { ...gvTerm('TP53'), childTerms: [{ type: 'dtsnvindel', dt: 1, parentTerm: gvTerm('TP53') }] } }
		}).map(r => r.context),
		['geneVariant TW'],
		'childTerms[] does not report the same gene a second time'
	)
	test.end()
})

tape('mayValidateRequestGeneRefs()', test => {
	const genome = makeGenome()
	const ds: any = { cohort: { termdb: {} } }

	test.equal(
		mayValidateRequestGeneRefs(req({ terms: [{ term: gvTerm('TP53') }] }), genome, ds),
		undefined,
		'a known gene passes'
	)
	test.equal(
		mayValidateRequestGeneRefs(req({ terms: [{ term: gvTerm('xxx') }] }), genome, ds),
		'invalid gene/isoform for [geneVariant TW]',
		'an unknown gene is rejected, without naming it'
	)
	test.equal(
		mayValidateRequestGeneRefs(
			req({ terms: [{ term: geTerm('xxx') }], filter: filterOf({ term: gvTerm('yyy'), values: [] }) }),
			genome,
			ds
		),
		'invalid gene/isoform for [geneExpression TW, geneVariant tvs]',
		'every context with an unknown name is reported, sorted'
	)
	test.equal(
		mayValidateRequestGeneRefs(
			req({ terms: [{ term: geTerm('TP53') }], filter: filterOf({ term: gvTerm('yyy'), values: [] }) }),
			genome,
			ds
		),
		'invalid gene/isoform for [geneVariant tvs]',
		'only the context that is actually invalid is reported'
	)
	test.equal(
		mayValidateRequestGeneRefs(req({ terms: [{ term: gvTerm('xxx') }] }, '/massSession'), genome, ds),
		undefined,
		'a saved session is not a data query, and is skipped'
	)
	test.equal(
		mayValidateRequestGeneRefs(req({ terms: [{ term: gvTerm('xxx') }] }, '/pp/massSession'), genome, ds),
		undefined,
		'a skipped endpoint is recognized under a serverconfig.basepath'
	)
	test.equal(
		mayValidateRequestGeneRefs(
			req({ terms: [{ term: { type: 'singleCellGeneExpression', gene: 'panelGene1' } }] }),
			genome,
			{ cohort: { termdb: { skipGeneNameValidation: ['singleCellGeneExpression'] } } }
		),
		undefined,
		'a dataset can opt a term type out, e.g. a panel-based single cell store'
	)
	test.equal(
		mayValidateRequestGeneRefs(req({ terms: [{ term: gvTerm('xxx') }] }), genome, {
			cohort: { termdb: { skipGeneNameValidation: true } }
		}),
		undefined,
		'a dataset can opt out entirely'
	)
	test.equal(
		mayValidateRequestGeneRefs(req({ terms: [{ term: gvTerm('xxx') }] }), genome, {
			cohort: { termdb: { skipGeneNameValidation: 'yes' } }
		}),
		undefined,
		'a malformed opt-out fails open rather than breaking the request'
	)
	test.end()
})
