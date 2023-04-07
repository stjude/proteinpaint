import { copyMerge } from '../rx'
import { fillTermWrapper } from '../termsetting/termsetting'

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
				useCanvas: window.location.hash?.slice(1) == 'canvas',
				cellEncoding: '', // can be oncoprint
				margin: {
					top: 10,
					right: 5,
					bottom: 20,
					left: 50
				},
				// set any dataset-defined sample limits and sort priority, otherwise undefined
				// put in settings, so that later may be overridden by a user
				maxSample: 0,
				sortPriority: undefined,
				truncatePriority: undefined,

				sampleNameFilter: '',
				sortSamplesBy: 'selectedTerms',
				sortSamplesTieBreakers: [{ $id: 'sample', sortSamples: {} /*split: {char: '', index: 0}*/ }],
				sortTermsBy: 'sampleCount', // or 'as listed'
				samplecount4gene: true,
				cellbg: '#ececec',
				colw: 0,
				colwMin: 0.5,
				colwMax: 24,
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
				maxLabelFontSize: 16,
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
				zoomIncrement: 0.5,
				zoomStep: 10,
				scrollHeight: 12,
				controlLabels: {
					samples: 'Samples',
					terms: 'Variables'
				}
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

	// harcode these overrides for now
	config.settings.matrix.duration = 0
	config.settings.matrix.colw = 0

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
