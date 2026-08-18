import type {
	GvTerm,
	BaseGroupSet,
	GvValuesQ,
	GvCustomGsQ,
	GvPredefinedGsQ,
	RawGvValuesTW,
	GvValuesTW,
	RawGvCustomGsTW,
	GvCustomGsTW,
	RawGvPredefinedGsTW,
	GvPredefinedGsTW,
	RawGvTW,
	GvTW,
	RawGvTerm,
	GvGroupset,
	VocabApi,
	TermValues
} from '#types'
import { TwBase, type TwOpts } from './TwBase.ts'
import { copyMerge } from '#rx'
import { set_hiddenvalues } from '#termsetting'
import { getWrappedTvslst } from '#filter/filter'
import { getDtTermValues } from '#filter/tvs.dt'
import { getChildTerms, addParentTerm } from '../termdb/handlers/geneVariant'
import { getColors, dtcnv, dtsnvindel, mclass } from '#shared/common.js'
import { trimGvTermCopy, clearDtTermMnames, getDtsFromGroups, setGroupsetParentTerms } from '#shared/terms.js'
import { validateVariantFilter } from '#shared/geneVariantFilter.js'
import { rgb } from 'd3-color'

let colorScale = getColors(3)

export class GvBase extends TwBase {
	// type, isAtomic, $id are set in ancestor base classes
	term: GvTerm

	constructor(tw: GvTW, opts: TwOpts) {
		super(tw, opts)
		this.term = tw.term
	}

	/* a filled-in geneVariant term is mostly derived properties that no data
	request needs, see trimGvTermCopy() */
	getMinCopy(override: any = {}) {
		const copy = super.getMinCopy(override)
		trimGvTermCopy(copy.term, copy.q)
		return copy
	}

	/** tw.term must already be filled-in at this point */
	static async fill(tw: RawGvTW, opts: TwOpts = {}): Promise<GvTW> {
		if (!tw.term) throw `missing tw.term, must already be filled in`
		if (tw.term.type != 'geneVariant') throw `incorrect term.type='${tw.term?.type}', expecting 'geneVariant'`

		if (opts.defaultQ != null) {
			opts.defaultQ.isAtomic = true
			// merge defaultQ into tw.q
			copyMerge(tw.q, opts.defaultQ)
		}

		if (!tw.term.genes?.length) {
			// support legacy term structure that lacks term.genes[]
			const gene = structuredClone(tw.term)
			tw.term.genes = [gene]
		}

		for (const gene of tw.term.genes) {
			if (!gene.kind) {
				// support saved states that don't have term.kind, applied when rehydrating at runtime
				const term: any = gene
				if (term.gene || (term.name && !term.chr)) term.kind = 'gene'
				else if (term.chr) term.kind = 'coord'
				else throw 'unable to assign geneVariant term.kind'
			}

			if (gene.kind == 'gene') {
				if (!gene.gene) gene.gene = gene.name
				if (!gene.name) gene.name = gene.gene
				if (!gene.gene || !gene.name) throw 'missing gene/name'
			} else if (gene.kind == 'coord') {
				if (!gene.chr || !Number.isInteger(gene.start) || !Number.isInteger(gene.stop)) throw 'no position specified'
				if (!gene.name) {
					gene.name = `${gene.chr}:${gene.start + 1}-${gene.stop}`
				}
			} else {
				throw 'cannot recognize gene.kind'
			}

			if (!gene.id) gene.id = gene.name
		}

		if (!tw.term.name) tw.term.name = tw.term.genes.map(gene => gene.name).join(', ')

		if (!Object.keys(tw.q).includes('type')) tw.q.type = 'values'

		// fill term.groupsetting
		if (!tw.term.groupsetting) tw.term.groupsetting = { disabled: false }

		// fill child dt terms
		if (!tw.term.childTerms) getChildTerms(tw.term, opts.vocabApi)

		// add geneVariant term to each child dt term
		addParentTerm(tw.term)

		// apply optional ds-level configs for this specific term
		const cnv = opts.vocabApi.termdbConfig.queries.cnv
		if (cnv) {
			if ('cnvGainCutoff' in cnv || 'cnvLossCutoff' in cnv || 'cnvMaxLength' in cnv) {
				// continuous cnv data
				// assign cnv cutoffs to tw.q
				// priority of cnv cutoffs: tw.q > cnvCutoffsByGene > dsCnvCutoffs
				const dsCnvCutoffs: { [key: string]: number } = {}
				if ('cnvGainCutoff' in cnv) dsCnvCutoffs.cnvGainCutoff = cnv.cnvGainCutoff
				if ('cnvLossCutoff' in cnv) dsCnvCutoffs.cnvLossCutoff = cnv.cnvLossCutoff
				if ('cnvMaxLength' in cnv) dsCnvCutoffs.cnvMaxLength = cnv.cnvMaxLength
				const cnvCutoffsByGene = cnv.cnvCutoffsByGene?.[tw.term.name]
				const defaultCnvCutoffs = cnvCutoffsByGene || dsCnvCutoffs
				tw.q = Object.assign({}, defaultCnvCutoffs, tw.q)
			}
		}
		/* 
			Pre-fill the tw.type, since it's required for ROUTING to the
			correct fill() function. Tsc will be able to use tw.type as a 
			discriminant property for the RawGvTW union type, enabling 
			static type checks on the input raw tw.

			NOTE: tw.type is NOT required when calling a specialized fill() 
			function directly, outside of TwRouter.fill(). The input tw.type
			does not have to be discriminated in that case.
		*/
		tw.type =
			!tw.q.type || tw.q.type == 'values'
				? 'GvValuesTW'
				: tw.q.type == 'predefined-groupset'
				? 'GvPredefinedGsTW'
				: tw.q.type == 'custom-groupset'
				? 'GvCustomGsTW'
				: tw.type

		/*
			For each of fill() functions below:
			1. The `tw` argument must already have a tw.type string value, 
			   which corresponds to the RawGvTW* equivalent of the full GvTW* type 

			2. The fill() function must fill-in any expected missing values,
			   validate the tw.q shape at runtime, and throw on any error or mismatched expectation.
			   Runtime validation is required because the input raw tw can come from anywhere,
			   like term.bins.default, which is a runtime variable that is not possible to statically check.

			3. The filled-in tw, when returned, must be **coerced** to the full GvTW* type, 
			   in order to match the function signature's return type.
		*/
		switch (tw.type) {
			case 'GvValuesTW':
				return await GvValues.fill(tw)

			case 'GvPredefinedGsTW':
				return await GvPredefinedGS.fill(tw, opts)

			case 'GvCustomGsTW':
				return await GvCustomGS.fill(tw)

			default:
				throw `tw.type='${tw.type}' is not supported by GvBase.fill()`
		}
	}
}

export class GvValues extends GvBase {
	// term, type, isAtomic, $id are set in ancestor base classes
	q: GvValuesQ
	#tw: GvValuesTW

	// declare a constructor, to narrow the tw type
	constructor(tw: GvValuesTW, opts: TwOpts = {}) {
		super(tw, opts)
		//this.term = tw.term // already set in base class
		this.q = tw.q
		this.#tw = tw
	}

	getTw() {
		return this.#tw
	}

	// See the relevant comments in the GvBase.fill() function above
	static async fill(tw: RawGvValuesTW): Promise<GvValuesTW> {
		if (!tw.type) tw.type = 'GvValuesTW'
		else if (tw.type != 'GvValuesTW') throw `expecting tw.type='GvValuesTW', got '${tw.type}'`
		if (tw.term.type != 'geneVariant') throw `expecting tw.term.type='geneVariant', got '${tw.term.type}'`
		const { term, q } = tw
		if (!q.type) q.type = 'values'
		else if (q.type != 'values') throw `expecting tw.q.type='values', got ${tw.q.type}`
		// dtLst is only meaningful for a groupset, where it limits the dts queried
		// for the term. it must not survive on a values q, otherwise the term is
		// silently limited to the dts of a groupset that is no longer in use (see
		// getDtsToQuery() in server/src/mds3.init.js). deleted here rather than
		// only where a groupset is cleared, so that a tw of a session saved with
		// the stale property is also corrected
		delete (q as any).dtLst
		// throws on a filter that cannot be honored one variant at a time, so that
		// a bad filter fails here rather than quietly showing the wrong variants
		validateVariantFilter((q as any).variantFilter, term)
		set_hiddenvalues(q, term)
		return tw as GvValuesTW
	}
}

export class GvPredefinedGS extends GvBase {
	// term, type, isAtomic, $id are set in ancestor base classes
	q: GvPredefinedGsQ
	groupset!: BaseGroupSet
	#tw: GvPredefinedGsTW

	// declare a constructor, to narrow the tw type
	constructor(tw: GvPredefinedGsTW, opts: TwOpts = {}) {
		super(tw, opts)
		// this.term = tw.term // already set in base class
		this.q = tw.q
		this.#tw = tw
		Object.defineProperty(this, 'groupset', { value: this.#tw.term.groupsetting[this.#tw.q.predefined_groupset_idx] })
	}

	getTw() {
		return this.#tw
	}

	// See the relevant comments in the GvBase.fill() function above
	static async fill(tw: RawGvPredefinedGsTW, opts: TwOpts = {}): Promise<GvPredefinedGsTW> {
		if (!tw.type) tw.type = 'GvPredefinedGsTW'
		else if (tw.type != 'GvPredefinedGsTW') throw `expecting tw.type='GvPredefinedGsTW', got '${tw.type}'`

		if (tw.term.type != 'geneVariant') throw `expecting tw.term.type='geneVariant', got '${tw.term.type}'`
		if (tw.q.type != 'predefined-groupset') throw `expecting tw.q.type='predefined-groupset', got '${tw.q.type}'`
		/* an index that is already on the raw q is the selected groupset, while q.dtLst is
		derived from it below. tracked here, before the index is defaulted, so that the two
		can be told apart when resolving the selection */
		const hasIdx = Object.keys(tw.q).includes('predefined_groupset_idx')
		if (!hasIdx) tw.q.predefined_groupset_idx = 0
		if (!Number.isInteger(tw.q.predefined_groupset_idx)) throw 'invalid tw.q.predefined_groupset_idx'

		// list the predefined groupsets. only names and dts are filled in, which is all
		// that is needed to resolve the selected index below
		listPredefinedGroupsets(tw.term, opts.vocabApi)

		// a groupset filters through its own group filters, so a variantFilter is
		// only meaningful for a values q. it must not survive here, otherwise it
		// would silently come back into effect when the groupset is later cleared
		delete (tw.q as any).variantFilter

		const { term, q } = tw
		if (!term.groupsetting?.lst?.length) throw 'term.groupsetting.lst[] is empty'
		if (!hasIdx && q.dtLst?.length) {
			/* query dts specified without an index, by an entry point that knows a dt but not
			a groupset index (see launchGeneVariantPlot() in client/mass/search.ts). select the
			groupset that has the query dts.

			only done when no index was supplied: q.dtLst does not identify a groupset uniquely,
			since the somatic and germline SNV/indel groupsets both report dt=1, so resolving a
			filled-in tw this way would reselect the first groupset of the dt and silently turn
			a saved germline tw into a somatic one */
			const groupsetIdx = term.groupsetting.lst.findIndex(groupset => {
				const dts = getGroupsetDts(groupset)
				if (!dts?.length) return false
				if (dts.length != q.dtLst?.length) return false
				if (dts.some(dt => !q.dtLst?.includes(dt))) return false
				return true
			})
			if (groupsetIdx == -1) throw new Error('groupset with query dt(s) not found')
			q.predefined_groupset_idx = groupsetIdx
			q.dtLst = getGroupsetDts(term.groupsetting.lst[groupsetIdx])
		} else {
			/* the index is the selection, so always re-derive the query dts from it, rather
			than trusting a q.dtLst that may be left over from a previously selected groupset
			and would otherwise limit the dts queried (see getDtsToQuery() in mds3.init.js) */
			// TODO: remove these type assertions
			const idx = q.predefined_groupset_idx as number
			const lst = term.groupsetting.lst as any[]
			if (!lst[idx]) throw 'q.predefined_groupset_idx out of bound'
			q.dtLst = getGroupsetDts(lst[idx])
		}
		// only the selected groupset needs its groups[], see fillGroupsetGroups()
		await fillGroupsetGroups(term, q.predefined_groupset_idx as number, opts.vocabApi)
		set_hiddenvalues(q, term)
		return tw as GvPredefinedGsTW
	}

	getTitleText() {
		const gsname = this.term?.groupsetting?.lst?.[this.q.predefined_groupset_idx].name || ''
		return `${this.term.name} ${gsname}`
	}
}

export class GvCustomGS extends GvBase {
	// term, type, isAtomic, $id are set in ancestor base classes
	q: GvCustomGsQ
	groupset!: BaseGroupSet
	#tw: GvCustomGsTW

	// declare a constructor, to narrow the tw type
	constructor(tw: GvCustomGsTW, opts: TwOpts = {}) {
		super(tw, opts)
		// this.term = tw.term // already set in base class
		this.q = tw.q
		Object.defineProperty(this, 'groupset', { value: this.q.customset })
		this.#tw = tw
	}

	getTw() {
		return this.#tw
	}

	// See the relevant comments in the GvBase.fill() function above
	static async fill(tw: RawGvCustomGsTW): Promise<GvCustomGsTW> {
		if (!tw.type) tw.type = 'GvCustomGsTW'
		else if (tw.type != 'GvCustomGsTW') throw `expecting tw.type='GvCustomGsTW', got '${tw.type}'`

		if (tw.term.type != 'geneVariant') throw `expecting tw.term.type='geneVariant', got '${tw.term.type}'`
		if (tw.q.type != 'custom-groupset') throw `expecting tw.q.type='custom-groupset', got '${tw.q.type}'`

		// see the same deletion in GvPredefinedGS.fill()
		delete (tw.q as any).variantFilter

		const { term, q } = tw
		if (!q.customset) throw 'missing tw.q.customset'
		if (!q.customset.groups.length) throw 'customset.groups[] is empty'
		// an mname tally is only read by the variant config UI, which re-queries it, so it
		// must not survive on a customset, where it is stored once per tvs. cleared on fill
		// rather than only where a customset is built, so that a customset of a session
		// saved before mnames became opt-in is also corrected. a predefined groupset needs
		// no equivalent, since getPredefinedGroupsets() rebuilds it on every fill
		clearDtTermMnames(q.customset)
		/* the parent of every customset tvs is this term. re-attached rather than trusted,
		so that a customset built against another term cannot survive here, and validates
		that each tvs filters by a dt. also throws on a customset whose tvs terms are not
		dt terms, which the server would otherwise reject deep in filterByItem() */
		setGroupsetParentTerms(q.customset, term)
		/* always re-derived, never trusted: a dtLst that disagrees with the groups silently
		limits the dts queried for the term, dropping a group's data (see getDtsToQuery() in
		server/src/mds3.init.js). same reason GvPredefinedGS.fill() re-derives it from the
		selected index, and GvValues.fill() deletes it outright */
		q.dtLst = getDtsFromGroups(q.customset.groups)
		set_hiddenvalues(q, term)
		return tw as GvCustomGsTW
	}

	getTitleText() {
		return `${this.term.name} Custom Groups`
	}
}

const allelicGroupsetName = 'Bi-/mono-allelic'

/*
List the predefined groupsets of a geneVariant term, filling in only each groupset's
name and dt(s). The groups[] of the selected groupset are built separately, by
fillGroupsetGroups().

Keeping the two apart matters: building a groupset requires querying the mutation
classes of its dt term in the dataset, so building all of them cost one request per
child dt term on every fill (6 for a dataset with all dts), for groupsets that are
then never read. Only lst[q.predefined_groupset_idx] is consumed, by the client
legend/edit code and by get_active_groupset() on the server.
*/
function listPredefinedGroupsets(term: RawGvTerm, vocabApi: VocabApi) {
	if (!term.childTerms?.length) throw 'term.childTerms[] is missing'
	const lst: GvGroupset[] = term.childTerms.map((dtTerm: any) => {
		const groupset: GvGroupset = { name: dtTerm.name, dt: dtTerm.dt }
		if (dtTerm.origin) groupset.origin = dtTerm.origin
		return groupset
	})
	// this groupset spans two dts, so it declares them instead of carrying a single .dt
	if (isEligibleForAllelicGroupset(term, vocabApi)) {
		lst.push({ name: allelicGroupsetName, dts: [dtsnvindel, dtcnv] })
	}
	term.groupsetting = { disabled: false, lst }
}

/* the dts a groupset queries, resolvable from its listing entry alone, so that the
selected index can be matched to q.dtLst without building any groups[].
returns any[] rather than number[] to match q.dtLst, since getDtsFromGroups() is untyped */
function getGroupsetDts(groupset: GvGroupset): any[] {
	if (!groupset) throw 'groupset is missing'
	if (groupset.dts) return groupset.dts
	if (Number.isInteger(groupset.dt)) return [groupset.dt as number]
	// a groupset that declares neither must already be built, see GvGroupset
	if (!groupset.groups) throw 'groupset has neither dt(s) nor groups[]'
	return getDtsFromGroups(groupset.groups)
}

/* build the groups[] of one groupset, in place. requires querying the mutation classes
of the gene for the dt term(s) of that groupset, so it is only done for the groupset
that is actually in use. see listPredefinedGroupsets() */
export async function fillGroupsetGroups(term: RawGvTerm, idx: number, vocabApi: VocabApi) {
	const groupset: GvGroupset | undefined = term.groupsetting?.lst?.[idx]
	if (!groupset) throw 'q.predefined_groupset_idx out of bound'
	if (groupset.groups) return // already built
	if (!term.childTerms?.length) throw 'term.childTerms[] is missing'
	const filter = vocabApi.state.termfilter?.filter

	if (groupset.name == allelicGroupsetName) {
		await getAllelicGroupset(groupset)
	} else {
		const dtTerm: any = term.childTerms.find(
			(t: any) => t.dt == groupset.dt && (groupset.origin ? t.origin == groupset.origin : !t.origin)
		)
		if (!dtTerm) throw 'child dt term of the selected groupset not found'
		// fill dt term values with mutation classes of gene in dataset
		await getDtTermValues(dtTerm, filter, vocabApi)
		if (dtTerm.dt == dtcnv) getCnvGroupset(groupset, dtTerm, term.name, vocabApi)
		else getNonCnvGroupset(groupset, dtTerm, term.name)
	}

	// function to get cnv groupset
	// will route to appropriate function depending on mode of cnv data
	function getCnvGroupset(groupset, dtTerm, geneName, vocabApi) {
		const cnv = vocabApi.termdbConfig.queries?.cnv
		if (!cnv) throw 'cnv query is missing'
		const keys = Object.keys(cnv)
		const isContinuous = keys.includes('cnvGainCutoff') || keys.includes('cnvLossCutoff')
		if (isContinuous) getContCnvGroupset(groupset, dtTerm, geneName, cnv)
		else getCatCnvGroupset(groupset, dtTerm, geneName)
	}

	// function to get cnv groupset for continuous cnv data
	// will compare gain/loss/neutral
	function getContCnvGroupset(groupset, dtTerm, geneName, cnv) {
		const cnvDefault = cnv.cnvCutoffsByGene?.[dtTerm.parentTerm.name] || {
			cnvMaxLength: cnv.cnvMaxLength,
			cnvGainCutoff: cnv.cnvGainCutoff,
			cnvLossCutoff: cnv.cnvLossCutoff
		}
		// gain group
		const gainGroup = {
			name: `${geneName} ${dtTerm.name_noOrigin} ${dtTerm.origin ? `Gain (${dtTerm.origin})` : 'Gain'}`,
			type: 'filter',
			filter: getWrappedTvslst([
				{
					type: 'tvs',
					tvs: {
						term: dtTerm,
						values: [],
						continuousCnv: true,
						cnvGainCutoff: cnvDefault.cnvGainCutoff,
						cnvLossCutoff: -99, // set to very low number to get samples with gain events
						cnvMaxLength: cnvDefault.cnvMaxLength,
						fractionOverlap: 0.8,
						excludeGeneName: true
					}
				}
			])
		}
		// loss group
		const lossGroup = {
			name: `${geneName} ${dtTerm.name_noOrigin} ${dtTerm.origin ? `Loss (${dtTerm.origin})` : 'Loss'}`,
			type: 'filter',
			filter: getWrappedTvslst([
				{
					type: 'tvs',
					tvs: {
						term: dtTerm,
						values: [],
						continuousCnv: true,
						cnvGainCutoff: 99, // set to very high number to get samples with loss events
						cnvLossCutoff: cnvDefault.cnvLossCutoff,
						cnvMaxLength: cnvDefault.cnvMaxLength,
						fractionOverlap: 0.8,
						excludeGeneName: true
					}
				}
			])
		}
		// neutral group
		const wtGroup = {
			name: `${geneName} ${dtTerm.name_noOrigin} ${dtTerm.origin ? `Neutral (${dtTerm.origin})` : 'Neutral'}`,
			type: 'filter',
			filter: getWrappedTvslst([
				{
					type: 'tvs',
					tvs: {
						term: dtTerm,
						values: [],
						continuousCnv: true,
						cnvWT: true,
						cnvGainCutoff: cnvDefault.cnvGainCutoff,
						cnvLossCutoff: cnvDefault.cnvLossCutoff,
						cnvMaxLength: cnvDefault.cnvMaxLength,
						fractionOverlap: 0.8,
						excludeGeneName: true
					}
				}
			])
		}
		groupset.groups = [gainGroup, lossGroup, wtGroup]
		// set color scale based on number of groups
		colorScale = getColors(groupset.groups.length)
		// assign colors to each group
		for (const group of groupset.groups) {
			group.color = rgb(colorScale(group.name)).formatHex()
		}
	}

	// function to get cnv groupset for categorical cnv data
	// will compare cnv categories present in the data
	function getCatCnvGroupset(groupset, dtTerm, geneName) {
		groupset.groups = []
		// mutant values
		const values = dtTerm.values as TermValues
		for (const [k, v] of Object.entries(values)) {
			const filter = getWrappedTvslst([
				{
					type: 'tvs',
					tvs: {
						term: dtTerm,
						values: [{ key: k, label: v.label, value: k }],
						genotype: 'variant',
						mcount: 'any',
						excludeGeneName: true
					}
				}
			])
			const name = `${geneName} ${dtTerm.name_noOrigin} ${dtTerm.origin ? `${v.label} (${dtTerm.origin})` : v.label}`
			const color = typeof v.key === 'string' ? mclass[v.key].color : undefined
			groupset.groups.push({ name, type: 'filter', filter, color })
		}
		// wildtype value
		groupset.groups.push({
			name: `${geneName} ${dtTerm.name_noOrigin} ${dtTerm.origin ? `Wildtype (${dtTerm.origin})` : 'Wildtype'}`,
			type: 'filter',
			filter: getWrappedTvslst([
				{
					type: 'tvs',
					tvs: {
						term: dtTerm,
						values: [],
						genotype: 'wt',
						excludeGeneName: true
					}
				}
			]),
			color: mclass['WT'].color
		})
	}

	// function to get non-cnv (e.g. snv/indel, fusion, etc.) groupset
	// will compare mutant vs. wildtype
	function getNonCnvGroupset(groupset, dtTerm, geneName) {
		groupset.groups = []
		// group 1: mutant
		const grp1Name = `${geneName} ${dtTerm.name_noOrigin} ${dtTerm.origin ? `Mutated (${dtTerm.origin})` : 'Mutated'}`
		const values = dtTerm.values as TermValues
		const grp1Tvs: any = {
			term: dtTerm,
			values: Object.entries(values).map(([k, v]) => {
				return { key: k, label: v.label, value: k }
			}),
			genotype: 'variant',
			mcount: 'any',
			excludeGeneName: true
		}
		const mafFilter = vocabApi.termdbConfig.queries?.snvindel?.mafFilter
		if (dtTerm.dt == dtsnvindel && mafFilter) {
			grp1Tvs.mafFilter = mafFilter.filter
		}
		const grp1Filter = getWrappedTvslst([{ type: 'tvs', tvs: grp1Tvs }])
		groupset.groups.push({
			name: grp1Name,
			type: 'filter',
			filter: grp1Filter,
			color: '#e75480'
		})
		// group 2: wildtype
		const grp2Name = `${geneName} ${dtTerm.name_noOrigin} ${dtTerm.origin ? `Wildtype (${dtTerm.origin})` : 'Wildtype'}`
		const grp2Tvs = {
			term: dtTerm,
			values: [],
			genotype: 'wt',
			excludeGeneName: true
		}
		const grp2Filter = getWrappedTvslst([{ type: 'tvs', tvs: grp2Tvs }])
		groupset.groups.push({
			name: grp2Name,
			type: 'filter',
			filter: grp2Filter,
			color: mclass['WT'].color
		})
	}

	// build predefined groupset for biallelic vs. monoallelic alteration
	async function getAllelicGroupset(groupset) {
		// eligibility was already checked when the groupset was listed
		const snvIndelTerm: any = term.childTerms!.find((t: any) => t.dt == dtsnvindel)
		const cnvTerm: any = term.childTerms!.find((t: any) => t.dt == dtcnv)
		if (!snvIndelTerm || !cnvTerm) throw 'child dt terms of the allelic groupset not found'
		// the mutated groups are built from the snvindel mutation classes of the gene
		await getDtTermValues(snvIndelTerm, filter, vocabApi)
		await getDtTermValues(cnvTerm, filter, vocabApi)

		// homozygous deletion tvs
		const homoDel = {
			type: 'tvs',
			tvs: {
				term: cnvTerm,
				values: [],
				continuousCnv: true,
				cnvGainCutoff: 99, // set to very high number to get samples with loss events
				cnvLossCutoff: -1,
				cnvMaxLength: null,
				excludeGeneName: true
			}
		}
		// heterozygous deletion tvs
		const hetDel = {
			type: 'tvs',
			tvs: {
				term: cnvTerm,
				values: [],
				continuousCnv: true,
				cnvGainCutoff: 99, // set to very high number to get samples with loss events
				cnvLossCutoff: -0.3,
				cnvMaxLength: null,
				excludeGeneName: true
			}
		}
		// homozygous mutated tvs
		const mutatedValues = Object.entries(snvIndelTerm.values)
			.filter(([k, _v]) => k != 'Intron' && k != 'Utr3')
			.map(([k, v]: any) => {
				return { key: k, label: v.label, value: k }
			})
		const homoMut = {
			type: 'tvs',
			tvs: {
				term: snvIndelTerm,
				values: mutatedValues,
				genotype: 'variant',
				mcount: 'any',
				mafFilter: getMafFilter('homo', vocabApi),
				excludeGeneName: true
			}
		}
		// heterozygous mutated tvs
		const hetMut = {
			type: 'tvs',
			tvs: {
				term: snvIndelTerm,
				values: mutatedValues,
				genotype: 'variant',
				mcount: 'all',
				mafFilter: getMafFilter('het', vocabApi),
				excludeGeneName: true
			}
		}

		// build bi-allelic and mono-allelic groups
		const biallelicGroup: any = {
			name: 'Bi-allelic alteration',
			type: 'filter',
			filter: {
				type: 'tvslst',
				in: true,
				join: 'or',
				lst: [
					homoDel,
					{
						type: 'tvslst',
						in: true,
						join: 'and',
						lst: [hetDel, hetMut]
					},
					homoMut
				]
			},
			color: '#d10000'
		}
		const monoallelicGroup: any = {
			name: 'Mono-allelic alteration',
			type: 'filter',
			filter: {
				type: 'tvslst',
				in: true,
				join: 'or',
				lst: [hetDel, hetMut]
			},
			color: '#7489d2'
		}

		groupset.groups = [biallelicGroup, monoallelicGroup]
	}
}

// determine if term/dataset is eligible for building bi-allelic vs. mono-allelic groupset
export function isEligibleForAllelicGroupset(term: RawGvTerm, vocabApi: VocabApi): boolean {
	const queries = vocabApi.termdbConfig.queries
	if (!queries || !queries.snvindel || !queries.cnv) return false // dataset must have snvindel and cnv data
	if (!queries.snvindel?.mafFilter) return false // dataset must have a maf filter
	if (!('cnvGainCutoff' in queries.cnv) && !('cnvLossCutoff' in queries.cnv)) return false // cnv data must be continuous
	if (!term.childTerms) throw new Error('term.childTerms[] is missing')
	const snvIndelTerm = term.childTerms.find(t => t.dt == dtsnvindel)
	const cnvTerm = term.childTerms.find(t => t.dt == dtcnv)
	if (!snvIndelTerm || !cnvTerm) return false
	if (snvIndelTerm.origin || cnvTerm.origin) return false // different origins not supported (may support later)
	return true
}

/*
Whether a geneVariant q is a setting the user built, rather than one that picking the gene
again would produce anyway. Only these are remembered for reuse, see mayRememberGvQ() in
client/mass/store.ts.

A predefined groupset is deliberately excluded: it is what the mutation type radio of the
gene search UI already selects (see SearchHandler in client/termdb/handlers/geneVariant.ts),
so remembering it would fill the menu of every gene with a choice that is one click away,
and bury the settings that are not.
*/
export function isCustomizedGvQ(q: any): boolean {
	if (q?.type == 'custom-groupset') return !!q.customset?.groups?.length
	// a values q is the default, and is only a setting of its own once it filters variants
	if (!q?.type || q.type == 'values') return !!q?.variantFilter
	return false
}

/*
A short summary of what a geneVariant q does, to name it in a menu of remembered settings.

Deliberately more specific than the pill status in client/termsetting/handlers/geneVariant.ts,
which reports any custom groupset as "Divided into N groups": the whole point of the menu is
to tell two settings of the same gene apart, e.g. a BCR-ABL1 fusion grouping from a BCR-JAK2
one.
*/
export function getGvQLabel(term: any, q: any): string {
	if (q?.type == 'custom-groupset') {
		const names = q.customset?.groups?.map((group: any) => group.name).filter((name: any) => name)
		return names?.length ? names.join(' / ') : 'custom groups'
	}
	if (q?.type == 'predefined-groupset') {
		// a listing entry carries its name before any groups[] are built, see listPredefinedGroupsets()
		const groupset = term?.groupsetting?.lst?.[q.predefined_groupset_idx]
		return groupset?.name || 'predefined groups'
	}
	return q?.variantFilter ? 'filtered variants' : 'any variant class'
}

// build maf filter according to genotype (homozygous or heterozygous)
function getMafFilter(genotype: string, vocabApi: any) {
	const mafFilter = vocabApi.termdbConfig.queries.snvindel.mafFilter
	if (!mafFilter) throw new Error('mafFilter is missing')
	const mafTerm = mafFilter.terms.find(t => t.default)
	if (!mafTerm) throw new Error('no default mafTerm found')
	if (genotype != 'homo' && genotype != 'het') throw new Error('unexpected genotype value')

	const range =
		genotype == 'homo'
			? {
					start: 0.6,
					startinclusive: true,
					startunbounded: false,
					stopunbounded: true
			  }
			: {
					stop: 0.6,
					stopinclusive: false,
					startunbounded: true,
					stopunbounded: false
			  }

	return {
		type: 'tvslst',
		join: '',
		in: true,
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: mafTerm,
					ranges: [range]
				}
			}
		]
	}
}
