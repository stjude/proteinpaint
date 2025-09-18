import { copyMerge } from '#rx'
import { getSortOptions } from './matrix.sort'
import { fillTermWrapper } from '#termsetting'
import {
	mclass,
	dtcnv,
	proteinChangingMutations,
	truncatingMutations,
	synonymousMutations,
	mutationClasses,
	CNVClasses
} from '#shared/common.js'
import { isDictionaryType } from '#shared/terms.js'

export async function getPlotConfig(opts = {}, app) {
	const controlLabels = {
		Samples: 'Samples',
		samples: 'samples',
		Sample: 'Sample',
		sample: 'sample',
		Terms: 'Variables',
		terms: 'variables',
		Term: 'Variable',
		term: 'Variable',
		Mutations: 'Mutations'
	}

	const config = {
		// data configuration
		termgroups: [],
		samplegroups: [],
		divideBy: null,
		legendValueFilter: {
			isAtomic: true,
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: []
		},
		legendGrpFilter: {
			isAtomic: true,
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: []
		},
		localFilter: {
			isAtomic: true,
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: []
		},
		cnvCutoffs: {},

		// rendering options
		settings: {
			matrix: {
				svgCanvasSwitch: 1000, // the number of samples to trigger switching between svg and canvas
				useMinPixelWidth: true, // canvas may be hazy if false, but more accurately reflects column density
				cellEncoding: '', // can be "oncoprint" | "stacked" | "single"
				margin: {
					top: 10,
					right: 5,
					bottom: 20,
					left: 50
				},
				// set any dataset-defined sample limits and sort priority, otherwise undefined
				// put in settings, so that later may be overridden by a user
				maxGenes: opts.settings?.maxGenes || 50,
				maxSample: opts.settings?.maxSample || 1000,

				sampleNameFilter: '',
				sortSamplesBy: 'a',
				sortPriority: undefined, // will be filled-in
				// sortByMutation: 'consequence', computed
				// sortByCNV: true, computed
				//sortOptions: getSortOptions(app.vocabApi.termdbConfig, controlLabels),
				sortSampleGrpsBy: 'name', // 'hits' | 'name' | 'sampleCount'
				sortSamplesTieBreakers: [{ $id: 'sample', sortSamples: {} /*split: {char: '', index: 0}*/ }],
				sortTermsBy: 'sampleCount', // or 'as listed'
				// do not show number of samples at hiercluster gene row labels
				samplecount4gene: opts.chartType == 'hierCluster' ? '' : 'abs', //true, // 'abs' (default, previously true), 'pct', ''  (previously false)
				geneVariantCountSamplesSkipMclass: [],
				cellbg: '#ececec',
				showGrid: '', // false | 'pattern' | 'rect'
				// whether to show these controls buttons
				addMutationCNVButtons: false,
				truncatingMutations,
				proteinChangingMutations,
				synonymousMutations,
				mutationClasses,
				CNVClasses,
				gridStroke: '#fff',
				outlineStroke: '#ccc',
				beamStroke: '#f00',
				colw: 0,
				colwMin: 0.1 / window.devicePixelRatio,
				colwMax: 16,
				colspace: 1,
				colgspace: 8,
				colglabelpos: true,
				collabelpos: 'bottom',
				collabelvisible: true,
				collabelgap: 5,
				collabelpad: 1,
				collabelmaxchars: 32,
				rowh: 18, //use 0 to auto-compute row height, previous default=18,
				rowhMin: 1,
				rowhMax: 20,
				rowspace: 1,
				rowgspace: 8,
				rowlabelpos: 'left', // | 'right'
				rowlabelgap: 5,
				rowlabelvisible: true,
				rowlabelpad: 1,
				rowlabelmaxchars: 32,
				legendGrpLabelMaxChars: 26,
				grpLabelFontSize: 12,
				minLabelFontSize: 6,
				maxLabelFontSize: 14,
				transpose: false,
				sampleLabelOffset: 120,
				sampleGrpLabelOffset: 120,
				sampleGrpLabelMaxChars: 32,
				termLabelOffset: 80,
				termGrpLabelOffset: 80,
				termGrpLabelMaxChars: 32,
				duration: 0,
				zoomLevel: 1,
				zoomCenterPct: 0,
				zoomIndex: 0,
				zoomGrpIndex: 0,
				zoomMin: 0.5,
				zoomIncrement: 0.1,
				zoomStep: 1,
				// renderedWMax should not be exposed as a user-input
				// 60000 pixels is based on laptop and external monitor tests,
				// when a canvas dataURL image in a zoomed-in matrix svg stops rendering
				imgWMax: 60000 / window.devicePixelRatio,
				scrollHeight: 12,
				controlLabels,
				cnvUnit: 'log2ratio',
				ignoreCnvValues: false, //will ignore numeric CNV values if true

				barh: 32, // default bar height for continuous terms,

				// possible string entries:
				// - "genesetEdit", for gene-centric embedders only like GDC OncoMatrix
				// - may add other optional hints later
				showHints: [],
				// settings for a specific tw
				twSpecificSettings: {},
				oncoPrintSNVindelCellBorder: false // whether to show white cell border for SNVindel in oncoPrint mode
			}
		}
	}

	const s = config.settings
	const fontsize = Math.max(s.matrix.rowh + s.matrix.rowspace - 3 * s.matrix.rowlabelpad, 12)

	s.legend = {
		ontop: false,
		lineh: 25,
		padx: 5,
		padleft: 0, //150,
		padright: 20,
		padbtm: 30,
		fontsize,
		iconh: fontsize - 2,
		iconw: fontsize - 2,
		hangleft: 1,
		linesep: false
	}

	const overrides = app.vocabApi.termdbConfig.matrix || {}
	copyMerge(config.settings.matrix, overrides.settings)
	if (overrides.legendGrpFilter) config.legendGrpFilter = overrides.legendGrpFilter
	if (overrides.legendValueFilter) config.legendValueFilter = overrides.legendValueFilter
	if (overrides.localFilter) config.localFilter = overrides.localFilter

	if (opts.name) {
		// name should be identifier of a premade plot from the datase; load data of the premade plot and override into config{}
		const data = await app.vocabApi.getMatrixByName(opts.name)
		if (!data) throw 'error from getMatrixByName()'
		if (data.error) throw data.error
		copyMerge(config, data)
	}

	const os = opts?.settings?.matrix
	if (os) {
		if (
			(os.sortSamplesBy == 'custom' || os.sortSamplesBy == 'asListed') &&
			os.sortOptions?.custom.label == 'against alteration type'
		) {
			os.sortSamplesBy = 'a'
		}
		if (os.sortOptions) {
			delete os.sortOptions.custom
			delete os.sortOptions.asListed
		}
	}

	// may apply term-specific changes to the default object
	copyMerge(config, opts)
	const m = config.settings.matrix
	m.sortOptions = getSortOptions(app.vocabApi.termdbConfig, controlLabels, m)
	// harcode these overrides for now
	m.duration = 0
	// force auto-dimensions for colw
	m.colw = 0
	// support deprecated sortSamplesBy value from a saved session
	if (m.sortSamplesBy != 'asListed' && !m.sortOptions?.[m.sortSamplesBy]) m.sortSamplesBy = 'a'
	else if (['selectedTerms', 'class', 'dt', 'hits'].includes(m.sortSamplesBy)) m.sortSamplesBy = 'a'
	if (m.samplecount4gene === true || m.samplecount4gene === 1) m.samplecount4gene = 'abs'
	// support overrides in localhost
	if (window.location.hostname == 'localhost') {
		if (window.location.hash == '#canvas') m.svgCanvasSwitch = 0
	}

	const promises = []
	for (const grp of config.termgroups) {
		grp.lst = JSON.parse(JSON.stringify(grp.lst))
		for (const tw of grp.lst) {
			// may force the saved session to request the most up-to-data dictionary term data from server
			// TODO: should skip samplelst term here
			if (!tw.term?.type || isDictionaryType(tw.term.type)) {
				if (!tw.id && tw.term.type != 'samplelst') {
					if (!tw.term.id) throw `missing tw.id and tw.term.id`
					tw.id = tw.term.id // tw.id will be used to rehydrate tw with new term data from server. tw.id will be deleted following rehydration.
				}
				if (tw.term?.type != 'samplelst') delete tw.term
			}
			promises.push(fillTermWrapper(tw, app.vocabApi))
		}
	}
	if (config.divideBy) promises.push(fillTermWrapper(config.divideBy, app.vocabApi))
	await Promise.all(promises)
	return config
}

// config: a hydrated matrix config object
export function setComputedConfig(config) {
	const s = config.settings.matrix
	const allClasses = [...s.mutationClasses, ...s.CNVClasses]

	s.filterByClass = { isAtomic: true }
	for (const f of config.legendGrpFilter.lst) {
		if (!f.dt) continue
		allClasses
			.filter(m => f.dt.includes(mclass[m].dt))
			.forEach(key => {
				s.filterByClass[key] = 'value'
			})
	}
	for (const f of config.legendValueFilter.lst) {
		if (!f.legendGrpName || f.tvs?.term?.type !== 'geneVariant') continue
		if (f.tvs.values?.[0].mclasslst)
			f.tvs.values[0].mclasslst.forEach(key => {
				s.filterByClass[key] = f.legendFilterType?.endsWith('_hard') ? 'case' : 'value'
			})
		else if (f.tvs.values)
			f.tvs.values.forEach(v => {
				//hiddenVariants.add(v.key)
				s.filterByClass[key] = 'value'
			})
		else throw `unhandled tvs from legendValueFilter`
	}
	s.hiddenVariants = Object.keys(s.filterByClass).filter(c => c !== 'isAtomic')

	const hiddenCNVs = new Set(s.hiddenVariants.filter(key => mclass[key]?.dt === dtcnv))
	s.hiddenCNVs = [...hiddenCNVs]

	s.showMatrixCNV = !hiddenCNVs.size ? 'all' : hiddenCNVs.size == s.CNVClasses.length ? 'none' : 'bySelection'
	s.allMatrixCNVHidden = hiddenCNVs.size == s.CNVClasses.length

	const hiddenMutations = new Set(s.hiddenVariants.filter(key => s.mutationClasses.find(k => k === key)))
	s.hiddenMutations = [...hiddenMutations]
	const PCset = new Set(s.proteinChangingMutations)
	const TMset = new Set(s.truncatingMutations)

	s.showMatrixMutation = !hiddenMutations.size
		? 'all'
		: hiddenMutations.size == s.mutationClasses.length
		? 'none'
		: hiddenMutations.size === s.mutationClasses.length - PCset.size && [...hiddenMutations].every(m => !PCset.has(m))
		? 'onlyPC'
		: hiddenMutations.size === s.mutationClasses.length - TMset.size && [...hiddenMutations].every(m => !TMset.has(m))
		? 'onlyTruncating'
		: 'bySelection'
	s.allMatrixMutationHidden = hiddenMutations.size == s.mutationClasses.length

	const tiebreakers =
		s.sortOptions.a?.sortPriority.find(sp => sp.types.length == 1 && sp.types[0] == 'geneVariant')?.tiebreakers || []

	//Backwards compatibility fix for old saved sessions missing .isOrdered and/or .disabled
	s.sortByMutation = tiebreakers.find(tb => tb.filter?.values[0]?.dt === 1)?.isOrdered ? 'consequence' : 'presence'

	s.sortByCNV = tiebreakers.find(tb => tb.filter?.values[0]?.dt === 4)?.disabled !== true
}
