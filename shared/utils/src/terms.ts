import type { Term } from '#types'
import {
	dtgeneexpression,
	dtssgsea,
	dtdnamethylation,
	dtmetaboliteintensity,
	dtproteomeabundance,
	TermTypeGroups,
	dtTerms
} from './common.js'
import {
	GENE_VARIANT,
	GENE_EXPRESSION,
	ISOFORM_EXPRESSION,
	SSGSEA,
	DNA_METHYLATION,
	CATEGORICAL,
	INTEGER,
	JUNCTION,
	FLOAT,
	SNP,
	SNP_LIST,
	SNP_LOCUS,
	CONDITION,
	SURVIVAL,
	SAMPLELST,
	METABOLITE_INTENSITY,
	PROTEOME_ABUNDANCE,
	PSEUDOBULK,
	SINGLECELL_CELLTYPE,
	SINGLECELL_GENE_EXPRESSION,
	SINGLECELL_NUMERIC_VALUE,
	MULTIVALUE,
	DATE,
	TERM_COLLECTION,
	COHORT
} from '#types'

// moved TermTypeGroups to `server/src/common.js`, so now has to re-export
export { TermTypeGroups } from './common.js'

/*
For datasets with multiple types of samples the ROOT_SAMPLE_TYPE is used to represent the root sample type, for example, 
the type patient, that has one or more samples associated to it. This should be the id used as sample_type, when generating the db to identify the root samples
in sampleidmap or the terms annotating root samples in the terms table.
The samples associated to a patient have annotations that are specific to a timepoint, for example, the age of the patient,
the doses of the drugs the patient was taking at the time of the data collection, etc. These annotations are associated to a sample.
*/
export const ROOT_SAMPLE_TYPE = 1

//For datasets with one sample type the DEFAULT_SAMPLE_TYPE is used to represent the sample type
export const DEFAULT_SAMPLE_TYPE = 2

export const NumericModes = {
	continuous: 'continuous',
	discrete: 'discrete'
}

// the dt term types are also declared in TermTypes, see the assertion in terms.unit.spec.ts
export const dtTermTypes: Set<string> = new Set(dtTerms.map((t: any) => t.type))

export const TermTypes2Dt = {
	[GENE_EXPRESSION]: dtgeneexpression,
	[SSGSEA]: dtssgsea,
	[DNA_METHYLATION]: dtdnamethylation,
	[METABOLITE_INTENSITY]: dtmetaboliteintensity,
	[PROTEOME_ABUNDANCE]: dtproteomeabundance
}

// maps term type to group (as is shown as toggles in search ui)
export const typeGroup = {
	[CATEGORICAL]: TermTypeGroups.DICTIONARY_VARIABLES,
	[CONDITION]: TermTypeGroups.DICTIONARY_VARIABLES,
	[FLOAT]: TermTypeGroups.DICTIONARY_VARIABLES,
	[INTEGER]: TermTypeGroups.DICTIONARY_VARIABLES,
	[SAMPLELST]: TermTypeGroups.DICTIONARY_VARIABLES,
	[SURVIVAL]: TermTypeGroups.DICTIONARY_VARIABLES,
	[DATE]: TermTypeGroups.DICTIONARY_VARIABLES,
	[MULTIVALUE]: TermTypeGroups.DICTIONARY_VARIABLES,
	[GENE_VARIANT]: TermTypeGroups.MUTATION_CNV_FUSION,
	[SNP]: TermTypeGroups.SNP,
	[SNP_LIST]: TermTypeGroups.SNP_LIST,
	[SNP_LOCUS]: TermTypeGroups.SNP_LOCUS,
	[GENE_EXPRESSION]: TermTypeGroups.GENE_EXPRESSION,
	[ISOFORM_EXPRESSION]: TermTypeGroups.ISOFORM_EXPRESSION,
	[JUNCTION]: TermTypeGroups.SPLICE_JUNCTION,
	[SSGSEA]: TermTypeGroups.SSGSEA,
	[DNA_METHYLATION]: TermTypeGroups.DNA_METHYLATION,
	[METABOLITE_INTENSITY]: TermTypeGroups.METABOLITE_INTENSITY,
	[PROTEOME_ABUNDANCE]: TermTypeGroups.PROTEOME_ABUNDANCE,
	[PSEUDOBULK]: TermTypeGroups.PSEUDOBULK,
	[TERM_COLLECTION]: TermTypeGroups.TERM_COLLECTION,
	[SINGLECELL_CELLTYPE]: TermTypeGroups.SINGLECELL_CELLTYPE,
	[SINGLECELL_GENE_EXPRESSION]: TermTypeGroups.SINGLECELL_GENE_EXPRESSION,
	[SINGLECELL_NUMERIC_VALUE]: TermTypeGroups.SINGLECELL_NUMERIC_VALUE,
	[COHORT]: TermTypeGroups.COHORT
}

const nonDictTypes = new Set([
	SNP,
	SNP_LIST,
	SNP_LOCUS,
	GENE_EXPRESSION,
	ISOFORM_EXPRESSION,
	JUNCTION,
	SSGSEA,
	DNA_METHYLATION,
	GENE_VARIANT,
	METABOLITE_INTENSITY,
	PROTEOME_ABUNDANCE,
	PSEUDOBULK,
	SINGLECELL_CELLTYPE,
	SINGLECELL_GENE_EXPRESSION,
	SINGLECELL_NUMERIC_VALUE,
	COHORT
])

for (const dtTermType of dtTermTypes) {
	nonDictTypes.add(dtTermType)
}

export const numericTypes = new Set([
	INTEGER,
	FLOAT,
	GENE_EXPRESSION,
	ISOFORM_EXPRESSION,
	JUNCTION,
	SSGSEA,
	DNA_METHYLATION,
	METABOLITE_INTENSITY,
	PROTEOME_ABUNDANCE,
	SINGLECELL_GENE_EXPRESSION,
	SINGLECELL_NUMERIC_VALUE,
	DATE,
	PSEUDOBULK
])

// dictionary numeric term types, exists in db tables, exclude non-dictionary term types
export const dictionaryNumericTypes = new Set([INTEGER, FLOAT, DATE])

const categoricalTypes = new Set([CATEGORICAL, SNP])

/** Note: Do not add pseudobulk here. These capture cell level terms. 
 * Pseudobulk terms are sample level terms. May in the future update
 * to isSCCellLevelTerms() and isSingleCellTerm() if the need arises
 */
const singleCellTerms = new Set([SINGLECELL_CELLTYPE, SINGLECELL_GENE_EXPRESSION, SINGLECELL_NUMERIC_VALUE /*PSEUDOBULK*/])

export function isSingleCellTerm(term: any) {
	if (!term) return false
	return singleCellTerms.has(term.type)
}
export function isNumericTerm(term: Term) {
	if (!term) return false
	return numericTypes.has(term.type)
}

/** True when a term wrapper resolves to one numeric value per sample.
 * A termCollection in values mode is intentionally excluded because it retains
 * one value per member term rather than resolving to a scalar. */
export function isNumericTw(tw: any) {
	if (!tw?.term) return false
	return (
		isNumericTerm(tw.term) ||
		(tw.term.type === TERM_COLLECTION && tw.term.memberType === 'numeric' && tw.type === 'TermCollectionTWFraction')
	)
}
export function isCategoricalTerm(term: Term) {
	if (!term) return false
	return categoricalTypes.has(term.type)
}

export function isDictionaryType(type: string) {
	return !isNonDictionaryType(type)
}

export function isNonDictionaryType(type: string) {
	if (!type) throw new Error('Type is not defined')
	return nonDictTypes.has(type)
}

export function isNumTermCollection(term: Term) {
	if (!term || !term.type) throw new Error('Term or term type is not defined')
	//Enable this check when memberType is added to term collection
	// return term.type === TERM_COLLECTION && term.memberType == 'numeric'
	return term.type === TERM_COLLECTION
}

export function equals(t1: any, t2: any) {
	if (!t1) throw new Error('First term is not defined ')
	if (!t2) throw new Error('Second term is not defined ')
	if (t1.type !== t2.type) return false //term types are different
	if (isDictionaryType(t1.type) && isDictionaryType(t2.type) && t1.type != SAMPLELST) return t1.id === t2.id
	switch (t1.type) {
		case GENE_EXPRESSION:
			return t1.gene == t2.gene
		case ISOFORM_EXPRESSION:
			return t1.isoform == t2.isoform
		case JUNCTION:
			return t1.chr == t2.chr && t1.start == t2.start && t1.stop == t2.stop && t1.strand == t2.strand
		case SSGSEA:
			return t1.id == t2.id
		case DNA_METHYLATION:
			return t1.chr == t2.chr && t1.start == t2.start && t1.stop == t2.stop
		case METABOLITE_INTENSITY:
		case PROTEOME_ABUNDANCE:
			return t1.name == t2.name
		case GENE_VARIANT:
			return t1.gene == t2.gene || (t1.chr == t2.chr && t1.start == t2.start && t1.stop == t2.stop)

		// TO DO: Add more cases
		// case SNP_LIST:
		// case SNP_LOCUS:
		// case SAMPLELST:

		default:
			return false
	}
}

/*
A filled-in geneVariant term carries derived properties that dominate its serialized
size: term.childTerms[], and for a predefined groupset, term.groupsetting.lst[] with
an embedded copy of a dt term (values, mnames, parentTerm) per tvs of every groupset.
None of it is needed to answer a data request:
- no server code reads term.childTerms[]; it is a client-side convenience that
  GvBase.fill() rebuilds from termdbConfig
- only the groupset at q.predefined_groupset_idx is read server-side, by
  get_active_groupset() in server/src/termdb.sql.js
- dtTerm.mnames[] (the amino acid change tally) is only read by the tvs edit UI,
  which re-queries it in fillMenu() before rendering

Trimming these shrinks a single-gene request payload by ~80%.

term{} and q{} are mutated in place, so only call this on a copy that is about to
be serialized into a request payload, never on a tw held in state.
*/
export function trimGvTermCopy(term: any, q: any) {
	if (term?.type != GENE_VARIANT) return term
	delete term.childTerms
	/* the parent of a groupset tvs is this very term, and the server reads it off the
	tw rather than off the tvs, see setGroupsetParentTerms() */
	if (q?.customset) clearGroupsetParentTerms(q.customset)
	const lst = term.groupsetting?.lst
	if (!lst?.length) return term
	if (q?.type == 'predefined-groupset') {
		// keep only the active groupset, but preserve the array indexes,
		// since the server reads groupsetting.lst[q.predefined_groupset_idx]
		const idx = q.predefined_groupset_idx
		term.groupsetting.lst = lst.map((groupset: any, i: number) => (i === idx ? groupset : null))
		clearDtTermMnames(term.groupsetting.lst[idx])
		clearGroupsetParentTerms(term.groupsetting.lst[idx])
	} else {
		// no predefined groupset is in use, so no entry of lst[] is read server-side
		delete term.groupsetting.lst
	}
	return term
}

/*
Call back on every geneVariant tw of an object, at any depth, so that a caller can accept a
whole state, a state.plots[], or one plot config without knowing where a plot keeps its tws
(term/term0/term2 of a chart, termgroups[].lst[] of a matrix, and so on).

A tw is identified by a term{} paired with a q{}, so that the dt term of a tvs of a mass
filter, which is a bare term, is never mistaken for one.

Descends into a matched tw as well, since a tw can nest one: the tvs of a custom groupset
carry a parentTerm, which is a copy and not a reference back to the term walked here, so no
cycle reaches this walk (see setGroupsetParentTerms()).
*/
export function forEachGvTw(obj: any, callback: (tw: any) => void) {
	if (!obj || typeof obj != 'object') return
	if (obj.q && obj.term?.type == GENE_VARIANT) callback(obj)
	// own values only, to not descend into inherited props/methods, as in StoreBase.deepFreeze()
	for (const value of Object.values(obj)) forEachGvTw(value, callback)
}

/*
Strip every derived property of a geneVariant term from a state that is about to be
serialized into a saved session, in place. Walks any object and trims the term of each
geneVariant tw it finds, so it accepts a whole state, a state.plots[], or one plot config.

This goes further than trimGvTermCopy() above, which shapes a request payload and so has
to keep whatever the server reads. Nothing here has to survive, because a saved session is
always re-filled before it is rendered:
- a session opened by url is filled by getPlotConfig() in init(), see client/mass/store.ts
- a session opened in a running app is filled by preprocessState(), see client/mass/sessionBtn.js
and GvBase.fill() rebuilds term.childTerms[] from termdbConfig, term.groupsetting from the
child terms, and each childTerm.parentTerm from the term itself.

Between them these are ~91% of a serialized single-gene tw, and the ratio climbs with the
gene count: term.genes[] is serialized once per childTerm.parentTerm and once per tvs of the
selected groupset, so a 200-gene tw carries ~9 copies of it.

Only the parentTerm of a customset tvs is trimmed out of q{}, which GvCustomGS.fill()
re-attaches; the rest of q.customset is user-authored and no fill() rebuilds it. The dt term
of a tvs of a mass filter does need its own parentTerm, and keeps it, since forEachGvTw()
only reaches a term paired with a q.
*/
export function trimGvTermsForSave(obj: any) {
	forEachGvTw(obj, tw => {
		delete tw.term.childTerms
		// deleting rather than emptying, since GvBase.fill() recreates it from scratch
		delete tw.term.groupsetting
		if (tw.q.customset) clearGroupsetParentTerms(tw.q.customset)
	})
	return obj
}

/*
The identity of the gene(s) a geneVariant term queries, which keys the settings remembered
for that term, see remember_gvq() in client/mass/store.ts.

Built from the gene entries rather than from term.id or term.name, which for a gene set are
a name the user typed: two gene sets over the same genes would key apart, while a gene set
someone named "BCR" would collide with the gene. Sorted, so that the same genes picked in a
different order are one key.

Each entry is keyed by what identifies it and not by its label:
- a gene entry by its symbol, never by its coordinates, which are annotated onto it only by
  a query that needs them (see mayMapGeneName2coord()), so keying by them would give one
  gene two keys depending on what had been queried
- a coord entry by its region, never by its name: GvBase.fill() only auto-names one that
  has no name, so a supplied label would key the same region twice, and two regions sharing
  a label would collide into one key -- which is worse, since a setting built for one region
  would be offered for the other

Returns '' for a term whose entries cannot all be identified, rather than a partial key that
two different terms could share.
*/
export function getGvGeneKey(term: any): string {
	// a term saved before term.genes[] existed describes its single gene at the top level,
	// and may reach here before GvBase.fill() normalizes it
	const genes = term?.genes?.length ? term.genes : term ? [term] : []
	const keys = genes
		.map((gene: any) => {
			if (getGvGeneKind(gene) == 'coord') {
				const region = getGvQueryRegion(gene)
				// the same string fill() would auto-name the entry, so an auto-named coord
				// entry keys identically whether or not it has been filled
				return region ? `${region.chr}:${region.start + 1}-${region.stop}` : undefined
			}
			return gene.gene || gene.name
		})
		.filter((key: any) => typeof key == 'string' && key)
	if (!keys.length || keys.length != genes.length) return ''
	return keys.sort().join(',')
}

/*
The key a remembered geneVariant setting is cached under, see remember_gvq() in
client/mass/store.ts. Returns '' for a term that getGvGeneKey() cannot key.

Prefixed because the cache is a plain object keyed by gene names a url or an embedder can
supply, and is serialized into every session saved from the state:

- an unprefixed gene named '__proto__' or 'constructor' would name an inherited property of
  the cache, so a read would resolve to Object.prototype or to a function instead of missing
- worse, such a key survives JSON.parse() as an own key that copyMerge() then walks when a
  session is reopened, resolving target['__proto__'] to Object.prototype through the getter
  and writing the cached list onto it, see copyMerge() in client/rx/src/StoreBase.ts

- an unprefixed integer-like gene name would also sort ahead of the rest in Object.keys(),
  which the least-recently-used eviction in remember_gvq() reads as insertion order

The prefix cannot itself be produced by getGvGeneKey(), since a gene symbol or a coord
region never starts with it, so prefixed keys stay one-to-one with the terms they key.
*/
export const gvQCacheKeyPrefix = 'gv:'
export function getGvQCacheKey(term: any): string {
	const key = getGvGeneKey(term)
	return key ? gvQCacheKeyPrefix + key : ''
}

/** the kind of a geneVariant gene entry, inferred exactly as GvBase.fill() infers it for an
 * entry that predates term.kind, so that a term keys the same before and after it is filled */
function getGvGeneKind(gene: any): string | undefined {
	if (gene?.kind) return gene.kind
	if (gene?.gene || (gene?.name && !gene.chr)) return 'gene'
	if (gene?.chr) return 'coord'
	return undefined
}

/*
A copy of a geneVariant q, reduced to what is worth remembering as a reusable setting, see
remember_gvq() in client/mass/store.ts.

Everything dropped is re-derived when a tw is filled with this q, so keeping it would only
bloat the app state and every session saved from it, and would make two equivalent settings
compare as different when de-duplicating:
- hiddenValues is refilled by set_hiddenvalues()
- dtLst is always re-derived from the groups rather than trusted, see GvCustomGS.fill()
- the mname tally and parent term of every customset tvs are re-attached on fill
*/
export function trimGvQForCache(q: any) {
	const copy = structuredClone(q)
	delete copy.isAtomic
	delete copy.hiddenValues
	delete copy.dtLst
	if (copy.customset) {
		clearDtTermMnames(copy.customset)
		clearGroupsetParentTerms(copy.customset)
	}
	return copy
}

/*
A geneVariant term is queried per entry of term.genes[], and every value it yields records
which entry it came from. That record used to be a single .gene holding the entry's NAME,
which for a kind='coord' entry is a coordinate string -- so consumers reading .gene as a
gene symbol got a region, e.g. a matrix export labelling a variant "chr1:47213991-47318918".

The two things are now separate: .gene is a gene symbol and is simply absent for a region,
while .region below is what was queried and is present either way. The helpers here are the
one place that knows the shape.
*/

/* the region a query entry covers, which every value found through it carries. Distinct
from the value's own .start/.stop, which are the event's -- a cnv segment is not the region
that found it.

Coordinates are annotated onto a gene entry by mayMapGeneName2coord() when a query needing
them runs, so this is undefined for a gene only queried by dts that never map coords. A
coord entry always carries them, since fill() requires them. */
export function getGvQueryRegion(gene: any) {
	if (!gene?.chr || !Number.isInteger(gene.start) || !Number.isInteger(gene.stop)) return
	return { chr: gene.chr, start: gene.start, stop: gene.stop }
}

/* identity of the query entry a value came from, for grouping and de-duplicating the values
of a term over several genes or regions. The gene symbol when there is one, else the region. */
export function getGvQueryKey(v: any) {
	if (v?.gene) return v.gene
	const r = v?.region
	return r ? `${r.chr}:${r.start}-${r.stop}` : ''
}

/*
The wire format for the query entry of a value, as the two halves that must stay inverse of
each other: get_matrix.js interns on the way out, TermdbVocab.js restores on the way in.

A term's values repeat their query entry endlessly -- one .region object per value, tens of
thousands of them in a matrix request -- so the distinct entries are collected once into
refs.byTermId[$id].queries[] and each value keeps only its index in .$q.

Both live here so the format has one definition and can be round-tripped in a test.
*/

/** replace a value's query entry with its index into queries[], interning it if new.
 * returns false for a value that records no query entry, which is left untouched */
export function internGvQueryEntry(v: any, queries: any[], idxByKey: Map<string, number>) {
	const key = getGvQueryKey(v)
	if (!key) return false
	let i = idxByKey.get(key)
	if (i === undefined) {
		i = queries.length
		const entry: any = {}
		if (v.gene) entry.gene = v.gene
		if (v.region) entry.region = v.region
		queries.push(entry)
		idxByKey.set(key, i)
	}
	v.$q = i
	delete v.gene
	delete v.region
	return true
}

/** the inverse: put the query entry back on a value. returns false when there is nothing
 * to restore, e.g. a term whose values carry no query entry */
export function restoreGvQueryEntry(v: any, queries: any[] | undefined) {
	if (!queries || v?.$q === undefined) return false
	Object.assign(v, queries[v.$q])
	delete v.$q
	return true
}

/*
Whether a values[] entry of a tvs, naming an amino acid change, is scoped to the query entry
a variant came from.

An entry may name a .gene, so that KRAS G12D of a gene-set term does not match NRAS G12D, or
a .region for the same reason over a term of several queried regions. Naming neither leaves
it unscoped, matching that change wherever it was found -- which is what a single-entry term
wants, and what the variant config emits for one.

Both matchers call this so a tvs means the same thing on either side: filterByItem() in
server/src/mds3.init.js and matchTvs() in geneVariantFilter.ts.
*/
export function matchesGvQueryEntry(entry: any, v: any) {
	if (entry.gene) return entry.gene == v.gene
	const r = entry.region
	if (r) return !!v.region && r.chr == v.region.chr && r.start == v.region.start && r.stop == v.region.stop
	return true
}

/*
The dt term of a tvs carries a parentTerm, but for two unrelated reasons:

- a tvs of a mass filter stands alone, so its parentTerm is the only record of which gene
  it is about. get_dtTerm() in server/src/termdb.filter.js reads it to run the query, and
  the tvs edit UI reads it to label the pill. it must be kept.
- a tvs of a groupset (q.customset, or term.groupsetting.lst[]) has no such need: its
  parent is by definition the term of the tw that holds the groupset. storing one there is
  a copy of term.genes[] per tvs that nothing keeps in sync with the term it was copied
  from, and a termsetting instance is reused across terms, so it does go stale (see
  makeGroupUI() in client/termsetting/handlers/geneVariant.ts).

So a groupset gets its parentTerms rebuilt on every fill() instead of storing them, which
lets both trims above drop them: a groupset tvs is evaluated against the tw that holds it,
and get_dtTerm() in server/src/termdb.filter.js is the only server-side reader of a
parentTerm, so nothing there misses the one a groupset does not store.

One snapshot is shared by reference across the tvs, as the child dt terms of a predefined
groupset already are. That is only safe because the trims drop it before it is ever
serialized, which would turn the one shared copy back into one copy per tvs.

Throws on a tvs whose term is not a dt term: the groups of a geneVariant groupset can only
filter by dt, and the server would otherwise fail deep in filterByItem().
*/
export function setGroupsetParentTerms(groupset: any, term: any) {
	if (term?.type != GENE_VARIANT) throw 'parent of a groupset tvs must be a geneVariant term'
	const parentTerm = structuredClone(term)
	// the parent of a dt term is the gene(s), not the derived properties of the term
	delete parentTerm.childTerms
	delete parentTerm.groupsetting
	walkTvs(groupset, (tvs: any) => {
		if (!dtTermTypes.has(tvs.term?.type)) throw `groupset tvs term is not a dt term`
		tvs.term.parentTerm = parentTerm
	})
	return groupset
}

/* drop what setGroupsetParentTerms() re-attaches. tolerates a malformed tvs, since a trim
must never be the thing that throws on the way into a request or a saved session */
function clearGroupsetParentTerms(groupset: any) {
	walkTvs(groupset, (tvs: any) => {
		if (tvs.term) delete tvs.term.parentTerm
	})
	return groupset
}

/* run fn on every tvs of a groupset, a group, or a filter.

A tvs is a leaf: a nested tvslst is a sibling of it in filter.lst[], never inside it. Not
descending matters, because a tvs can hold a filter of its own that is not part of the
groupset structure -- tvs.mafFilter wraps a maf term, which is a dictionary term rather
than a dt term (see getMafFilter() in client/tw/geneVariant.ts). getDtsFromFilter() above
reads a filter the same way. */
function walkTvs(obj: any, fn: (tvs: any) => void) {
	if (!obj || typeof obj != 'object') return
	if (obj.type == 'tvs' && obj.tvs) {
		fn(obj.tvs)
		return
	}
	for (const k in obj) walkTvs(obj[k], fn)
}

/* the dts queried by a set of groups, read off the dt term of each tvs of their filters */
export function getDtsFromGroups(groups: any[]): any[] {
	const dts = new Set<any>()
	for (const group of groups) {
		for (const dt of getDtsFromFilter(group.filter)) dts.add(dt)
	}
	return [...dts]
}

function getDtsFromFilter(filter: any): Set<any> {
	const dts = new Set<any>()
	for (const item of filter.lst) {
		if (item.type == 'tvslst') {
			for (const dt of getDtsFromFilter(item)) dts.add(dt)
		} else {
			dts.add(item.tvs.term.dt)
		}
	}
	return dts
}

/*
delete the amino acid change tally from every dt term nested in a groupset or filter.

Only the variant config UI reads mnames, and it re-queries them before rendering (see
getDtTermValues() in client/filter/tvs.dt.js), so a tally stored on a tvs is dead weight
that is re-serialized once per tvs. Walks any object, so it accepts a groupset, a group,
or a filter.
*/
export function clearDtTermMnames(obj: any) {
	walkTvs(obj, (tvs: any) => {
		if (tvs.term) delete tvs.term.mnames
	})
	return obj
}

export function getBin(lst: any[], value: number) {
	let bin = lst.findIndex(
		b => (b.startunbounded && value < b.stop) || (b.startunbounded && b.stopinclusive && value == b.stop)
	)
	if (bin == -1)
		bin = lst.findIndex(
			b => (b.stopunbounded && value > b.start) || (b.stopunbounded && b.startinclusive && value == b.start)
		)
	if (bin == -1)
		bin = lst.findIndex(
			b =>
				(value > b.start && value < b.stop) ||
				(b.startinclusive && value == b.start) ||
				(b.stopinclusive && value == b.stop)
		)
	return bin
}

// get sample types of termwrapper
export function getTwSampleTypes(tw: any, ds: any) {
	const term = tw?.term
	if (!term) return []
	if (term.sampleTypes) {
		return term.sampleTypes
	}
	if (ds.cohort.termdb.term2SampleType.has(term.id)) {
		return [ds.cohort.termdb.term2SampleType.get(term.id)]
	}
	if (term.type == 'samplelst') {
		const key = Object.keys(term.values)[0]
		const sampleId = term.values[key].list[0]?.sampleId
		if (sampleId) {
			const sampleType = ds.sampleId2Type.get(Number(sampleId) || sampleId)
			return sampleType != null ? [sampleType] : []
		} else return [DEFAULT_SAMPLE_TYPE]
	}
	if (dtTermTypes.has(term.type)) {
		if (term.parentTerm.sampleTypes) {
			return term.parentTerm.sampleTypes
		}
	}
	return [DEFAULT_SAMPLE_TYPE] //later own term needs to know what type annotates based on the samples
}

export function getParentType(types: Set<string>, ds: any) {
	if (Object.keys(ds.cohort.termdb.sampleTypes).length == 0) return null //dataset only has one type of sample
	const ids = Array.from(types)
	if (!ids || ids.length == 0) return null
	for (const id of ids) {
		const typeObj = ds.cohort.termdb.sampleTypes[id]
		if (!typeObj) continue
		if (typeObj.parent_id == null) return id //this is the root type
		//if my parent is in the list, then I am not the parent
		if (ids.includes(typeObj.parent_id)) continue
		else return typeObj.parent_id //my parent is not in the list, so I am the parent
	}
	return null //no parent found
}

// whether the term annotates parent samples
export function isParentType(term: any, ds: any) {
	if (!ds.cohort.termdb.hasSampleAncestry) return false
	const sampleType = getTwSampleTypes({ term }, ds)?.[0]
	if (!sampleType) throw 'sample type is not defined'
	const sampleTypeObj = ds.cohort.termdb.sampleTypes[sampleType]
	if (!sampleTypeObj) throw 'invalid sample type'
	if (Number.isInteger(sampleTypeObj.parent_id)) {
		// sample type has parent, so it is child sample type
		return false
	} else {
		// sample type does not have parent, so it is parent sample type
		return true
	}
}

//Returns human readable label for each term type; label is just for printing and not computing
const typeMap: { [key: string]: string } = {
	categorical: 'Categorical',
	condition: 'Condition',
	float: 'Numerical',
	integer: 'Numerical',
	date: 'Date',
	geneExpression: 'Gene Expression',
	isoformExpression: 'Isoform Expression',
	[JUNCTION]: 'Splice junction',
	ssGSEA: 'Geneset Expression',
	dnaMethylation: 'DNA Methylation',
	geneVariant: 'Gene Variant',
	metaboliteIntensity: 'Metabolite Intensity',
	proteomeAbundance: 'Proteome Abundance',
	proteomeDAP: 'Proteome DAP',
	multivalue: 'Multi Value',
	singleCellGeneExpression: 'Single Cell, Gene Expression',
	singleCellCellType: 'Single Cell, Cell Type',
	singleCellNumericValue: 'Single Cell, Numeric Value',
	snplocus: 'SNP Locus',
	snp: 'SNP',
	snplst: 'SNP List',
	termCollection: 'Term Collection'
}

// with a term obj, returns human readable item type name for a term.
// using a term obj rather than just term type gives more control (e.g. gene vs coord for genevariant term)
export function termItemType(t: Term): string {
	switch (t.type) {
		case JUNCTION:
			return 'Splice junction'
		case GENE_EXPRESSION:
		case SINGLECELL_GENE_EXPRESSION:
			return 'Gene'
		case ISOFORM_EXPRESSION:
			return 'Isoform'
		case SSGSEA:
			return 'Gene set'
		case METABOLITE_INTENSITY:
			return 'Metabolite'
		// keep adding here
		default:
			return 'Variable'
	}
}

export function termType2label(type: string) {
	const s = typeMap[type]
	if (s) return s
	throw new Error('termType2label(): unknown value')
}

export function getDateFromNumber(value: number) {
	const year = Math.floor(value)
	const january1st = new Date(year, 0, 1)
	const totalDays = getDaysInYear(year)
	const time = Math.round((value - year) * totalDays) * oneDayTime
	const date = new Date(january1st.getTime() + time)
	return date
}
/*
Value is a decimal year.
A decimal year is a way of expressing a date or time period as a year with a decimal part, where the decimal portion 
represents the fraction of the year that has elapsed. 
Example:
2025.0 represents the beginning of the year 2025. 
2025.5 represents the middle of the year 2025. 
 */
const oneDayTime = 24 * 60 * 60 * 1000

export function getDateStrFromNumber(value: number) {
	const date = getDateFromNumber(value)

	//Omit day to  deidentify the patients
	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long'
	})
}

//The value returned is a decimal year
//A decimal year is a way of expressing a date or time period as a year with a decimal part, where the decimal portion
//represents the fraction of the year that has elapsed.
export function getNumberFromDateStr(str: string) {
	const date = new Date(str)
	return getNumberFromDate(date)
}

export function getNumberFromDate(date: Date) {
	const year = date.getFullYear()
	const january1st: Date = new Date(year, 0, 1)
	const diffDays = (date.getTime() - january1st.getTime()) / oneDayTime
	const daysTotal = getDaysInYear(year)
	const decimal = diffDays / daysTotal
	return year + decimal
}

export function getDaysInYear(year: number) {
	const isLeap = new Date(year, 1, 29).getMonth() === 1
	const days = isLeap ? 366 : 365
	return days
}
