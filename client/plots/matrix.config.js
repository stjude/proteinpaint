import { copyMerge } from '../rx'
import { getSortOptions } from './matrix.sort'
import { fillTermWrapper } from '#termsetting'

export async function getPlotConfig(opts, app) {
	const config = {
		// data configuration
		termgroups: [],
		samplegroups: [],
		divideBy: null,

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
				truncatePriority: undefined,

				sampleNameFilter: '',
				sortSamplesBy: 'class',
				sortOptions: getSortOptions(app.vocabApi.termdbConfig),
				sortSamplesTieBreakers: [{ $id: 'sample', sortSamples: {} /*split: {char: '', index: 0}*/ }],
				sortTermsBy: 'sampleCount', // or 'as listed'
				samplecount4gene: 'abs', //true, // 'abs' (default, previously true), 'pct', ''  (previously false)
				cellbg: '#ececec',
				showGrid: '', // false | 'pattern' | 'rect'
				gridStroke: '#fff',
				outlineStroke: '#ccc',
				colw: 0,
				colwMin: 0.1 / window.devicePixelRatio,
				colwMax: 16,
				colspace: 1,
				colgspace: 8,
				collabelpos: 'bottom',
				collabelvisible: true,
				colglabelpos: true,
				collabelgap: 5,
				collabelpad: 1,
				rowh: 18,
				rowspace: 1,
				rowgspace: 8,
				rowlabelpos: 'left', // | 'right'
				rowlabelgap: 5,
				rowlabelvisible: true,
				rowlabelpad: 1,
				grpLabelFontSize: 12,
				minLabelFontSize: 6,
				maxLabelFontSize: 14,
				transpose: false,
				sampleLabelOffset: 120,
				sampleGrpLabelOffset: 120,
				termLabelOffset: 80,
				termGrpLabelOffset: 80,
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
				controlLabels: {
					samples: 'Samples',
					sample: 'Sample',
					terms: 'Variables'
				},
				cnvUnit: 'log2ratio',

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

	// may apply term-specific changes to the default object
	copyMerge(config, opts)

	const m = config.settings.matrix
	// harcode these overrides for now
	m.duration = 0
	// force auto-dimensions for colw
	m.colw = 0
	// support deprecated sortSamplesBy value from a saved session
	if (['selectedTerms', 'class', 'dt', 'hits'].includes(m.sortSamplesBy)) m.sortSamplesBy = 'custom'
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
