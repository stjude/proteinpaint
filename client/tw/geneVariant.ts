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
import { getDtsFromGroups } from '../termsetting/handlers/geneVariant'
import { rgb } from 'd3-color'

let colorScale = getColors(3)

export class GvBase extends TwBase {
	// type, isAtomic, $id are set in ancestor base classes
	term: GvTerm

	constructor(tw: GvTW, opts: TwOpts) {
		super(tw, opts)
		this.term = tw.term
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

		{
			// apply optional ds-level configs for this specific term
			const c = opts.vocabApi.termdbConfig.queries.cnv
			if (c && tw.term.name) {
				//if (c) valid js code but `&& tw.term.name` required to avoid type error
				// order of overide: 1) do not override existing settings in tw.q{} 2) c.cnvCutoffsByGene[thisGene] 3) default cutoffs in c
				const { cnvMaxLength, cnvGainCutoff, cnvLossCutoff } = c
				const defaultCnvCutoff =
					cnvMaxLength || cnvGainCutoff || cnvLossCutoff ? { cnvMaxLength, cnvGainCutoff, cnvLossCutoff } : {}
				Object.assign(tw.q, defaultCnvCutoff, c.cnvCutoffsByGene?.[tw.term.name] || {}, tw.q)
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
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: GvValuesTW, opts: TwOpts = {}) {
		super(tw, opts)
		//this.term = tw.term // already set in base class
		this.q = tw.q
		this.#tw = tw
		this.#opts = opts
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
		set_hiddenvalues(q, term)
		return tw as GvValuesTW
	}
}

export class GvPredefinedGS extends GvBase {
	// term, type, isAtomic, $id are set in ancestor base classes
	q: GvPredefinedGsQ
	groupset!: BaseGroupSet
	#tw: GvPredefinedGsTW
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: GvPredefinedGsTW, opts: TwOpts = {}) {
		super(tw, opts)
		// this.term = tw.term // already set in base class
		this.q = tw.q
		this.#tw = tw
		Object.defineProperty(this, 'groupset', { value: this.#tw.term.groupsetting[this.#tw.q.predefined_groupset_idx] })
		this.#opts = opts
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
		if (!Object.keys(tw.q).includes('predefined_groupset_idx')) tw.q.predefined_groupset_idx = 0
		if (!Number.isInteger(tw.q.predefined_groupset_idx)) throw 'invalid tw.q.predefined_groupset_idx'

		// get predefined groupsets
		await getPredefinedGroupsets(tw.term, opts.vocabApi)

		const { term, q } = tw
		if (!term.groupsetting?.lst?.length) throw 'term.groupsetting.lst[] is empty'
		if (!q.dtLst?.length) q.dtLst = [term.groupsetting.lst[q.predefined_groupset_idx].dt]
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
	#opts: TwOpts

	// declare a constructor, to narrow the tw type
	constructor(tw: GvCustomGsTW, opts: TwOpts = {}) {
		super(tw, opts)
		// this.term = tw.term // already set in base class
		this.q = tw.q
		Object.defineProperty(this, 'groupset', { value: this.q.customset })
		this.#tw = tw
		this.#opts = opts
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

		const { term, q } = tw
		if (!q.customset) throw 'missing tw.q.customset'
		if (!q.customset.groups.length) throw 'customset.groups[] is empty'
		if (!q.dtLst?.length) q.dtLst = getDtsFromGroups(q.customset.groups)
		set_hiddenvalues(q, term)
		return tw as GvCustomGsTW
	}

	getTitleText() {
		return `${this.term.name} Custom Groups`
	}
}

async function getPredefinedGroupsets(term: RawGvTerm, vocabApi: VocabApi) {
	if (!term.childTerms?.length) throw 'term.childTerms[] is missing'
	// build predefined groupsets based on child dt terms
	term.groupsetting = { disabled: false }
	term.groupsetting.lst = []
	for (const dtTerm of term.childTerms) {
		// fill dt term values with mutation classes of gene in dataset
		await getDtTermValues(dtTerm, vocabApi.state.termfilter?.filter, vocabApi)
		const groupset: any = { name: dtTerm.name, dt: dtTerm.dt }
		if (dtTerm.origin) groupset.origin = dtTerm.origin
		if (dtTerm.dt == dtcnv) getCnvGroupset(groupset, dtTerm, term.name, vocabApi)
		else getNonCnvGroupset(groupset, dtTerm, term.name)
		term.groupsetting.lst.push(groupset)
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
			const color = mclass[v.key].color
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
}
