import { copyMerge } from '../rx'
import { getSortOptions } from './matrix.sort'
import { fillTermWrapper } from '#termsetting'

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
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: []
		},
		legendGrpFilter: {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: []
		},

		// rendering options
		settings: {
			controls: {
				isOpen: false // control panel is hidden by default
			},
			matrix: {
				svgCanvasSwitch: 1000, // the number of samples to trigger switching between svg and canvas
				useMinPixelWidth: true, // canvas may be hazy if false, but more accurately reflects column density
				cellEncoding: '', // can be oncoprint
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
				sortPriority: undefined,

				sampleNameFilter: '',
				sortSamplesBy: 'a',
				sortOptions: getSortOptions(app.vocabApi.termdbConfig, controlLabels),
				sortSampleGrpsBy: 'name', // 'hits' | 'name' | 'sampleCount'
				sortSamplesTieBreakers: [{ $id: 'sample', sortSamples: {} /*split: {char: '', index: 0}*/ }],
				sortTermsBy: 'sampleCount', // or 'as listed'
				samplecount4gene: 'abs', //true, // 'abs' (default, previously true), 'pct', ''  (previously false)
				geneVariantCountSamplesSkipMclass: [],
				cellbg: '#ececec',
				showGrid: '', // false | 'pattern' | 'rect'
				gridStroke: '#fff',
				outlineStroke: '#ccc',
				colw: 0,
				colwMin: 0.1 / window.devicePixelRatio,
				colwMax: 16,
				colspace: 1,
				colgspace: 8,
				colglabelpos: true,
				collabelpos: 'bottom',
				collabelmaxchars: 40,
				collabelvisible: true,
				collabelgap: 5,
				collabelpad: 1,
				collabelmaxchars: 32,
				rowh: 18,
				rowspace: 1,
				rowgspace: 8,
				rowlabelpos: 'left', // | 'right'
				rowlabelgap: 5,
				rowlabelvisible: true,
				rowlabelpad: 1,
				rowlabelmaxchars: 32,
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

				barh: 32 // default bar height for continuous terms
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
	// harcode these overrides for now
	m.duration = 0
	// force auto-dimensions for colw
	m.colw = 0
	// support deprecated sortSamplesBy value from a saved session
	if (!m.sortOptions?.[m.sortSamplesBy]) m.sortSamplesBy = 'a'
	else if (['selectedTerms', 'class', 'dt', 'hits'].includes(m.sortSamplesBy)) m.sortSamplesBy = 'a'
	if (m.samplecount4gene === true || m.samplecount4gene === 1) m.samplecount4gene = 'abs'
	// support overrides in localhost
	if (window.location.hostname == 'localhost') {
		if (window.location.hash == '#canvas') m.svgCanvasSwitch = 0
	}

	const promises = []
	for (const grp of config.termgroups) {
		for (const tw of grp.lst) {
			// force the saved session to request the most up-to-data dictionary term data from server
			if (tw.id) delete tw.term
			promises.push(fillTermWrapper(tw, app.vocabApi))
		}
	}
	if (config.divideBy) promises.push(fillTermWrapper(config.divideBy, app.vocabApi))
	await Promise.all(promises)
	return config
}
