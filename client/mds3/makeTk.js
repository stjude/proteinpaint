import { Menu } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { initLegend, updateLegend } from './legend'
import { loadTk, rangequery_rglst } from './tk'
import urlmap from '#common/urlmap'
import { mclass, dtsnvindel, dtsv, dtfusionrna, dtcnv, getColors } from '#shared/common.js'
import { ssmIdFieldsSeparator } from '#shared/mds3tk.js'
import { getFilterName } from './filterName'
import { fillTermWrapper } from '#termsetting'
import { rehydrateFilter } from '../filter/rehydrateFilter.js'

/*
this script exports one function "makeTk()" that will be called just once
when the mds3 track object is initiating
makeTk will not be called for subsequent user interactions with mds3 track
it will initiate dataset object "tk.mds{}" for both official and custom data
and creates getter callbacks to abstract dataset details


********************** EXPORTED
makeTk
********************** INTERNAL
init_mclass
get_ds
	validateCustomVariants
		validateCustomSnvindel
		validateCustomSvfusion
	mayDeriveSkewerOccurrence4samples
mayInitTermdb
mayInitSkewer
	setSkewerMode
mayInitCnv
mayaddGetter_m2csq
mayInit_variant2samples
configPanel
_load


tk.subtk2height{ skewer: int, ... }


tk.skewer{}
	create if skewer data type is available for this mds
	if not equipped then tk.skewer is undefined and should not show skewer track

stratify labels will account for all tracks, e.g. skewer, cnv

********************************
* On highlighting skewer disks *
********************************
client can supply tk.hlssmid or tk.hlaachange, both are comma-joined list of names
upon init, both will be converted to tk.skewer.hlssmid (set)
hlaachange is converted when skewer data is returned from server
tk.skewer.hlssmid can be modified or deleted dynamically
highlighting is done by inserting <rect> into tk.skewer.hlBoxG
see mayHighlightDiskBySsmid()

********************************
* On skewer view modes         *
********************************
view modes applicable to current data are declared in tk.skewer.viewModes[]
each element is one mode, defines how to show snv/indel data points; will also control fusion
obj can offer flexibility on defining complex data source/method/arithmetics
viewModes[] is a merge from tk.skewerModes (custom) and tk.mds.skewerModes (official)
viewModes[] is dynamically modified in may_render_skewer, upon getting new data
later may add cnv.viewModes[] to control mode of other data types

********************************
* On tricky skewer data        *
********************************
when requesting skewer data at gmmode (not genomic) for the first time,
data is queried by isoform, and returned data is kept at tk.skewer.rawmlst
at subsequent panning/zooming, it won't re-request skewer data, as it's still using the same isoform
and will use cached data at rawmlst instead

********************************
* On skewer shapes             *
********************************
In both the numeric and skewer modes, one of eight shapes is defined for each data point. In 
skewer mode, shapes are mapped to the mutation and assigned to each skewer on render init. 
In numeric mode, the shape is defined individually via the custom_variants.shape[Triangle/Circle] arg. 
The default is the `filledCircle` for both modes. 
*/

// names of client-supplied optional callbacks attached to tk body, to centralize list and easy validation
const callbacknames = [
	'onClose', // this only takes effect if tk shows the "Close" handle, e.g. on subtk
	'click_snvindel',
	'callbackOnRender',
	'disc_mouseover',
	'disc_mouseout'
]

export async function makeTk(tk, block) {
	// run just once to initiate a track by adding in essential attributes to tk object

	/* some tk components will contribute to determination of total tk height
	declare all these components, default height for each to 0 for not rendered, so the values can be easily assessed
	when a component rendered, set actual height
	*/
	tk.subtk2height = {
		skewer: 0,
		leftlabels: 0,
		cnv: 0
	}

	tk.leftlabels = {
		g: tk.gleft.append('g'), // all labels are rendered here, except track label
		doms: {},
		// keys: label name, value: label dom
		// to avoid having to delete all labels upon tk rendering
		laby: 0, // cumulative height, 0 for no labels
		xoff: 0,
		maxwidth: 0 // set default 0 in case track runs into err, can still render tk
	}

	tk._finish = loadTk_finish_closure(tk, block)

	tk.cache = {}
	tk.itemtip = new Menu() // show contents on clicking an item
	tk.hovertip = new Menu() // show contents here on hovering an item and avoid reusing itemtip
	tk.menutip = new Menu({ padding: '' }) // to show menu options without margin

	tk.load = _load(tk, block) // shorthand

	tk.mnamegetter = m => {
		// may require m.dt=1
		if (tk.mds.queries?.snvindel?.vcfid4skewerName && m.vcf_id) return m.vcf_id
		const s = m.mname
		if (!s) return ''
		// trim too long names
		if (s.length > 25) {
			return s.substr(0, 20) + '...'
		}
		return s
	}

	await get_ds(tk, block)
	// tk.mds{} is created for both official and custom track
	// following procedures are only based on tk.mds

	// must init termdb first to get termdbconfig, and do all the rest (inform what queries are available, has vocabApi methods etc)
	await mayInitTermdb(tk, block)

	await mayInit_variant2samples(tk, block)
	mayaddGetter_m2csq(tk, block)

	mayInitSkewer(tk) // tk.skewer{} may be added

	mayInitCnv(tk)

	if (tk.filterObj) await Promise.all(rehydrateFilter(tk.filterObj, tk.mds.termdb.vocabApi))

	tk.tklabel.text(tk.mds.label || tk.name)

	tk.clear = () => {
		// called in loadTk, when uninitialized is true
		if (tk.skewer) tk.skewer.g.selectAll('*').remove()
	}

	// TODO <g> for other file types

	// config
	/*
	tk.config_handle = block.maketkconfighandle(tk).on('click', () => {
		configPanel(tk, block)
	})
	*/

	initLegend(tk, block)

	init_mclass(tk)

	tk.color4disc = m => {
		// figure out what color to use for a m point
		if (tk.mutationColorBy) {
			if (tk.mutationColorBy == 'hardcode') {
				if (m.color) return m.color
			}
		}

		if (tk.mds.queries?.ld?.mOverlay?.data) {
			const m0 = tk.mds.queries.ld.mOverlay.m
			if (m.chr == m0.chr && m.pos == m0.pos && m.ref == m0.ref && m.alt == m0.alt) {
				// the same variant as has been clicked for overlaying
				return tk.mds.queries.ld.overlay.color_1
			}
			// this variant is not the "index" one, find a matching variant from returned data
			for (const m1 of tk.mds.queries.ld.mOverlay.data) {
				if (m1.pos == m.pos && m1.alleles == m.ref + '.' + m.alt) {
					// found match
					return tk.mds.queries.ld.colorScale(m1.r2)
				}
			}
			// no match
			return tk.mds.queries.ld.overlay.color_0
		}

		if (tk.vcfinfofilter && tk.vcfinfofilter.setidx4mclass != undefined) {
			// TODO
			const mcset = tk.vcfinfofilter.lst[tk.vcfinfofilter.setidx4mclass]

			const [err, vlst] = getter_mcset_key(mcset, m)

			if (err || vlst == undefined) return 'black'

			for (const v of vlst) {
				// no choice but simply use first value to ever have a valid color
				if (mcset.categories[v]) {
					return mcset.categories[v].color
				} else {
					return 'black'
				}
			}
		}
		// mclass
		if (mclass[m.class]) {
			return mclass[m.class].color
		}
		return 'black'
	}

	parseUrl(tk)

	// do this after parsing url
	if (tk.hlssmid) {
		tk.skewer.hlssmid = new Set(tk.hlssmid.split(','))
		delete tk.hlssmid
	}

	try {
		validateSelectSamples(tk)
	} catch (e) {
		console.error(e)
	}

	tk.duplicateTk = filter => {
		// generate tkarg object by duplicating configration of current tk, to be used for block launch
		// provide optional filter obj to assign to tk
		const tkarg = {
			type: 'mds3',
			dslabel: tk.dslabel,
			filter0: tk.filter0,
			showCloseLeftlabel: true,
			filterObj: filter || structuredClone(tk.filterObj),
			allow2selectSamples: tk.allow2selectSamples,
			onClose: tk.onClose,
			hardcodeCnvOnly: tk.hardcodeCnvOnly,
			token: tk.token // for testing
		}
		if (tk.cnv?.presetMax) tkarg.cnv = { presetMax: tk.cnv.presetMax } // preset value is present, pass to subtk
		if (tk.legend.mclass?.hiddenvalues?.size) {
			tkarg.legend = { mclass: { hiddenvalues: new Set() } }
			for (const v of tk.legend.mclass.hiddenvalues) tkarg.legend.mclass.hiddenvalues.add(v)
		}
		return tkarg
	}

	for (const n of callbacknames) {
		if (tk[n] && typeof tk[n] != 'function') throw `.${n}() is not function`
	}
}

function loadTk_finish_closure(tk, block) {
	// call this when tk finish rendering
	return data => {
		// update legend name in case filter has changed
		// tk.legend{} is missing if tk is not initiated (wrong ds name)
		tk.legend?.headTd.text(tk.name + (tk.filterObj ? ' - ' + getFilterName(tk.filterObj) : ''))

		if (tk.cnv) {
			tk.cnv.g.transition().attr('transform', `translate(0,${tk.subtk2height.skewer})`)
		}

		if (data) {
			// centralized place on indicating if tk has error or simply no data
			// only do this when server return data is present. data may not be supplied e.g when switching skewer mode

			if (data.error) {
				// has error e.g. server snafu. set skewer height to show error msg later
				tk.subtk2height.skewer = 40
			} else {
				// no error. detect if has data or not
				let totalCount = 0
				if (data.skewer) totalCount = data.skewer.length
				if (data.cnv) totalCount += data.cnv.length
				if (data.cnvDensity) totalCount += data.cnvDensity.segmentCount
				if (totalCount == 0) {
					// show blank tk with msg
					let context = 'view range'
					if (block.usegm && block.gmmode != 'genomic') context = block.usegm.name || block.usegm.isoform
					tk.skewer.g
						.append('text')
						.text('No data in ' + context)
						.attr('y', 25)
						.attr('x', block.width / 2)
						.attr('text-anchor', 'middle')
						.attr('dominant-baseline', 'center')
					tk.subtk2height.skewer = 40
				}
			}
		}

		// derive tk height
		tk.height_main =
			Math.max(
				tk.subtk2height.leftlabels, // won't be added if tk crashed
				tk.subtk2height.skewer + tk.subtk2height.cnv
			) +
			tk.toppad +
			tk.bottompad

		if (data) {
			/*if (data.error) throw data.error // TODO: may need to handle data.error, can be propagated here? 
			else*/ updateLegend(data, tk, block)
		}

		tk.leftLabelMaxwidth = Math.max(
			tk.leftlabels.maxwidth + tk.leftlabels.xoff,
			// tk.skewer.maxwidth is undefined if makeTk had exception. must yield valid value for leftLabelMaxwidth for block to show properly with err msg in tk body
			Number.isFinite(tk.skewer?.maxwidth) ? tk.skewer.maxwidth : 0
		)

		block.tkcloakoff(tk, { error: data ? data.error : null })
		block.block_setheight()
		block.setllabel()

		tk.callbackOnRender?.(tk, block) // run if present
	}
}

function parseUrl(tk) {
	// parse url parameters applicable to this track
	// may inhibit this through some settings
	const urlp = urlmap()
	if (tk.skewer) {
		// process skewer-related params
		if (urlp.has('hlaachange')) {
			tk.hlaachange = urlp.get('hlaachange')
			// later convert to hlssmid, when skewer data is available
		}
		if (urlp.has('hlssmid')) {
			tk.hlssmid = urlp.get('hlssmid').split(',')
		}
	}
	// process additional params
}

function mayInitSkewer(tk) {
	if (!tk.mds.has_skewer) return
	tk.skewer = {
		// both skewer and numeric mode will render elements into tk.skewer.g
		// will also attach skewer.discKickSelection
		g: tk.glider.append('g'),
		// border color of a box over a highlighted data
		hlBoxColor: tk.mds.hlBoxColor || 'red',
		// default to show dot labels
		hideDotLabels: false,
		// true for pointing up
		pointup: true
	}
	setSkewerMode(tk) // adds skewer.viewModes[]
}

export function mayInitCnv(tk) {
	let cfg // the config object for rendering cnv
	if (tk.mds.termdbConfig?.queries?.cnv) {
		cfg = tk.mds.termdbConfig.queries.cnv // native ds config
	} else if (tk.custom_variants?.find(i => i.dt == dtcnv)) {
		// has custom cnv; require that all are same type (using value or using category)
		let useValue = false,
			useCat = false
		for (const m of tk.custom_variants) {
			if (m.dt == dtcnv) {
				if (Number.isFinite(m.value)) useValue = true
				else useCat = true
			}
		}
		if (useValue && useCat) throw 'custom cnv should be either using numeric value or not, but cannot be mixture'
		if (useValue) {
			cfg = {
				cnvGainCutoff: 0, // use 0 for not filtering and show all events
				cnvLossCutoff: 0
			}
		} else if (useCat) {
			cfg = {} // no need for flags
		} else {
			throw 'custom cnv is neither value or category, should not happen'
		}
	} else {
		return // no cnv from this tk
	}

	if (!tk.cnv) tk.cnv = {} // preserve existing setting
	tk.cnv.g = tk.glider.append('g')
	tk.cnv.cnvMaxLength = cfg.cnvMaxLength // if missing do not filter
	tk.cnv.cnvGainCutoff = cfg.cnvGainCutoff // if missing do not filter
	tk.cnv.cnvLossCutoff = cfg.cnvLossCutoff
	tk.cnv.absoluteValueRenderMax = cfg.absoluteValueRenderMax || 5
	tk.cnv.gainColor = cfg.gainColor || '#D6683C'
	tk.cnv.lossColor = cfg.lossColor || '#67a9cf'
	tk.cnv.density = {
		barheight: 60
	}
}

function setSkewerMode(tk) {
	tk.skewer.viewModes = tk.skewerModes
	delete tk.skewerModes
	if (!tk.skewer.viewModes) tk.skewer.viewModes = []
	const vm = tk.skewer.viewModes
	if (!Array.isArray(vm)) throw 'skewerModes[] is not array'
	if (tk.mds.skewerModes) {
		for (const n of tk.mds.skewerModes) vm.push(n)
	}
	if (!vm.find(n => n.type == 'skewer')) vm.push({ type: 'skewer' })
	for (const n of vm) {
		if (typeof n != 'object') throw 'one of skewerModes[] is not object'
		if (n.type == 'skewer') {
			// allowed type, no more configs
			if (!n.label) n.label = 'lollipops'
		} else if (n.type == 'numeric') {
			// data method
			if (n.byAttribute) {
				if (!n.label) n.label = n.byAttribute
			} else if (n.byInfo) {
			} else {
				// support info fields etc
				throw 'unknown data method for a type=numeric mode'
			}
		} else {
			throw 'unknown type from a skewerModes[]'
		}
	}
	if (!vm.find(n => n.inuse)) vm[0].inuse = true
}

function init_mclass(tk) {
	// hidden mclass is controled on the client side
	if (tk.mds.hiddenmclass) {
		// port over default hidden mclass
		for (const c of tk.mds.hiddenmclass) tk.legend.mclass.hiddenvalues.add(c)
	}
}

/*
to get the dataset object for this track, to be kept in client side

input:
	tk{}
	block{}
no output

effect: creates tk.mds{}


for official dataset, query ?getDataset to obtain a fresh copy
for custom dataset, generate an object from scratch
*/
async function get_ds(tk, block) {
	if (tk.dslabel) {
		// this tk loads from an official dataset
		const data = await dofetch3('getDataset', { body: { genome: block.genome.name, dsname: tk.dslabel } })
		if (data.error) throw 'Error: ' + data.error
		if (!data.ds) throw 'data.ds{} missing'
		if (!data.ds.isMds3) throw 'A legacy dataset cannot be loaded as a mds3 track'
		tk.mds = data.ds
		tk.name = data.ds.label
		return
	}

	// this tk loads as a custom track

	if (!tk.name) tk.name = 'Custom data'
	// create the dataset object
	tk.mds = {}
	// fill in details to tk.mds

	///////////// custom data sources
	if (tk.bcf) {
		if (!tk.bcf.file && !tk.bcf.url) throw 'file or url missing for tk.bcf{}'
		tk.mds.has_skewer = true // enable skewer tk
		await getbcfheader_customtk(tk, block.genome)
	} else if (tk.custom_variants) {
		validateCustomVariants(tk, block)
		mayDeriveSkewerOccurrence4samples(tk)
		mayAddInfoField(tk)
	} else {
		throw 'unknown data source for custom track'
	}

	mayProcessSampleAnnotation(tk)
}

function mayProcessSampleAnnotation(tk) {
	// temp function to process custom sample annotation
	if (!tk.sampleAnnotation) return
	// use this data to initiate tk.mds.termdb{}
	if (!Array.isArray(tk.sampleAnnotation.terms)) throw 'sampleAnnotation.terms is not array'
	if (!tk.mds.termdb) tk.mds.termdb = {}
	tk.mds.termdb.terms = tk.sampleAnnotation.terms
	tk.mds.termdb.annotations = tk.sampleAnnotation.annotations
}

async function mayInitTermdb(tk, block) {
	const tdb = tk.mds.termdb
	if (!tdb) return

	{
		const arg = {}
		if (tk.mds.label) {
			// official dataset
			arg.vocab = {
				genome: block.genome.name,
				dslabel: tk.mds.label
			}
		} else if (tdb.terms) {
			// custom dataset
			arg.vocab = {
				terms: tdb.terms,
				sampleannotation: tdb.annotations
			}
		} else {
			throw 'do not know how to init vocab'
		}
		const _ = await import('#termdb/vocabulary')
		tdb.vocabApi = _.vocabInit(arg)

		if (!tdb.vocabApi.app) {
			/**** Note!
			when tk is doing sample filtering (e.g. a subtk), vocabApi will be passed to filter UI code
			and filter UI will call termdb app with term type selector, which requires genome obj to be accessible
			via vocabApi.app.opts.genome for gene search to function
			here .app is missing, and since vocabApi is not frozen, this quick fix supplies it in entirely adhoc manner
			*/
			tdb.vocabApi.app = { opts: { genome: block.genome } }
		}
	}

	tk.mds.termdbConfig = await tdb.vocabApi.getTermdbConfig()

	if (tk.mds.termdb.allowCaseDetails) {
		tk.mds.termdb.allowCaseDetails.get = async acase => {}
	}
}

function mayaddGetter_m2csq(tk, block) {
	if (!tk.mds.queries?.snvindel?.m2csq) return
	tk.mds.queries.snvindel.m2csq.get = async m => {
		const body = { genome: block.genome.name, dslabel: tk.mds.label, m2csq: 1 }
		if (tk.mds.queries.snvindel.m2csq.by == 'ssm_id') {
			body.ssm_id = m.ssm_id
		} else {
			return { error: 'unknown query method' }
		}
		const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
		if (tk.token) headers['X-Auth-Token'] = tk.token
		return await dofetch3('mds3', { body, headers }, { serverData: tk.cache })
	}
}

/* to add tk.mds.variant2samples.get()
with different implementation for client/server-based data sources

note inconsistency in getSamples() for client/server
where server function queries v2s.get()
but client function does not do v2s.get() but should do the same to support sunburst and summary
*/
async function mayInit_variant2samples(tk, block) {
	if (!tk.mds.variant2samples) return

	if (tk.custom_variants) {
		addV2Sgetter_custom(tk, block)
	} else {
		addV2Sgetter_native(tk, block)
	}

	if (tk.mds.variant2samples.twLst) {
		if (!Array.isArray(tk.mds.variant2samples.twLst)) throw 'v2s.twLst[] not array'
		if (!tk.mds.termdb?.vocabApi) throw 'mds.termdb.vocabApi should be present for initiating v2s.twLst'
		for (const t of tk.mds.variant2samples.twLst) await fillTermWrapper(t, tk.mds.termdb.vocabApi)
	}
}

function addV2Sgetter_custom(tk, block) {
	// TODO auto generate variant2samples.twLst[] based on sample data

	/* getter implemented for custom data
	currently only provides list of samples
	TODO support summary and sunburst
	*/
	tk.mds.variant2samples.get = arg => {
		/*
		arg{}
		.mlst[]
		*/
		if (arg.querytype == tk.mds.variant2samples.type_samples) {
			const samples = []
			for (const m of arg.mlst) {
				if (!m.samples) continue
				for (const s of m.samples) {
					const s2 = JSON.parse(JSON.stringify(s))
					s2.ssm_id = m.ssm_id
					samples.push(s2)
				}
			}
			return { samples }
		}
		if (arg.querytype == tk.mds.variant2samples.type_summary) {
			throw 'todo: summary'
		}
		if (arg.querytype == tk.mds.variant2samples.type_sunburst) {
			throw 'todo: sunburst'
		}
		throw 'unknown querytype'
	}

	tk.mds.getSamples = () => {
		const id2sample = new Map()
		for (const m of tk.custom_variants) {
			if (!m.samples) continue
			for (const s of m.samples) {
				if (id2sample.has(s.sample_id)) {
					id2sample.get(s.sample_id).ssm_id_lst.push(m.ssm_id)
				} else {
					const s2 = JSON.parse(JSON.stringify(s))
					s2.ssm_id_lst = [m.ssm_id]
					id2sample.set(s.sample_id, s2)
				}
			}
		}
		return { samples: [...id2sample.values()] }
	}
}

function addV2Sgetter_native(tk, block) {
	/*
	works for both official and custom bcf

	call v2s.get() with querytype=?
	based on querytype, get() finds terms from appropriate places to retrieve attributes
	thus no need to directly supply list of terms to get()

	arg{}
	.querytype=sunburst/samples/summary
	.mlst
	.isoform 
	.rglst[] // requires one of (mlst, isoform, rglst)
	.tid2value{}
	*/
	tk.mds.variant2samples.get = async arg => {
		const par = {
			genome: block.genome.name,
			variant2samples: 1,
			get: arg.querytype,
			hardcodeCnvOnly: tk.hardcodeCnvOnly
		}

		if (tk.cnv) {
			// for querying cnv
			if (tk.cnv.cnvMaxLength) par.cnvMaxLength = tk.cnv.cnvMaxLength
			if (tk.cnv.cnvGainCutoff) par.cnvGainCutoff = tk.cnv.cnvGainCutoff
			if (tk.cnv.cnvLossCutoff) par.cnvLossCutoff = tk.cnv.cnvLossCutoff
		}

		if (tk.mds.label) {
			par.dslabel = tk.mds.label
		} else if (tk.bcf) {
			if (tk.bcf.file) par.bcffile = tk.bcf.file
			else if (tk.bcf.url) par.bcfurl = tk.bcf.url
			else throw 'tk.bcf{}: file/url missing'
		} else {
			throw 'no dslabel or tk.bcf'
		}

		if (arg.groupSsmBySample) {
			// from getSamples(), is a modifier of querytype=samples, to return .ssm_id_lst[] with each sample
			par.groupSsmBySample = 1
		}

		if (arg.mlst) {
			if (tk.mds.variant2samples.variantkey == 'ssm_id') {
				// TODO detect too long string length that will result url-too-long error
				// in such case, need alternative query method
				// call encodeURIComponent to pass plus strand from sv/fusion
				par.ssm_id_lst = arg.mlst.map(i => i.ssm_id).join(',')
			} else {
				throw 'unknown variantkey for variant2samples'
			}
		}
		if (arg.isoform) {
			par.isoform = arg.isoform
		}
		if (arg.rglst) {
			par.rglst = arg.rglst
		}

		const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
		if (tk.set_id) par.set_id = tk.set_id
		if (tk.token) headers['X-Auth-Token'] = tk.token
		if (tk.filter0) par.filter0 = tk.filter0
		if (tk.filterObj) par.filterObj = tk.filterObj
		if (arg.tid2value) par.tid2value = arg.tid2value

		// supply list of terms based on querytype
		if (arg.querytype == tk.mds.variant2samples.type_sunburst) {
			// TODO may change to vocabApi.getNestedChartSeriesData
			if (tk.mds.variant2samples.sunburst_twLst) {
				par.twLst = tk.mds.variant2samples.sunburst_twLst
			}
		} else if (arg.querytype == tk.mds.variant2samples.type_samples) {
			if (tk.mds.variant2samples.twLst) par.twLst = tk.mds.variant2samples.twLst
		} else if (arg.querytype == tk.mds.variant2samples.type_summary) {
			// TODO querytype=summary should be replaced by client barchar issuing its own query
			if (tk.mds.variant2samples.twLst) par.twLst = tk.mds.variant2samples.twLst
		} else {
			throw 'unknown querytype'
		}

		// add in parameters that will filter samples
		par.skewerRim = tk.mds.queries.snvindel?.skewerRim

		if (tk.legend.formatFilter) {
			// add format fields to filter samples
			const filter = {}
			for (const k in tk.legend.formatFilter) {
				if (tk.legend.formatFilter[k].hiddenvalues.size) {
					filter[k] = [...tk.legend.formatFilter[k].hiddenvalues]
				}
			}
			if (Object.keys(filter).length) {
				par.formatFilter = filter
			}
		}

		if (tk.legend.mclass?.hiddenvalues?.size) {
			// since hiddenvalues set contains mixture of mclass(str) and dt(int), pass json array instead of comma-joined string
			par.hiddenmclasslst = JSON.stringify([...tk.legend.mclass.hiddenvalues])
		}

		const data = await dofetch3('mds3', { body: par, headers }, { serverData: tk.cache })
		if (data.error) throw data.error
		const r = data.variant2samples
		if (!r) throw 'result error'
		if (arg.querytype == tk.mds.variant2samples.type_sunburst) {
			if (!Array.isArray(r.nodes)) throw 'nodes[] not array from return'
		} else if (arg.querytype == tk.mds.variant2samples.type_samples) {
			if (!Array.isArray(r.samples)) throw 'samples[] not array from return'
		} else if (arg.querytype == tk.mds.variant2samples.type_summary) {
			if (!Array.isArray(r.summary)) throw 'summary[] not array from return'
		} else {
			throw 'unknown querytype'
		}
		return r
	}

	/*
	this function is called for 2 uses in #cases menu
	arg{}
	.isSummary=true
		true: return summaries for v2s.twLst
		false: return list of samples
	.tid2value={}
		optional, to filter samples
	*/
	tk.mds.getSamples = async (arg = {}) => {
		if (arg.isSummary) {
			arg.querytype = tk.mds.variant2samples.type_summary
		} else {
			// must be calling from "List" option of #case menu
			arg.querytype = tk.mds.variant2samples.type_samples
			// supply this flag so server will group ssm by case
			arg.groupSsmBySample = 1
		}
		rangequery_rglst(tk, block, arg)
		return await tk.mds.variant2samples.get(arg)
	}
}

function configPanel(tk, block) {}

function _load(tk, block) {
	return async () => {
		return await loadTk(tk, block)
	}
}

function getter_mcset_key(mcset, m) {
	/*
	get the key from an item (m) given a mcset

	returns list!!!

	*/
	if (mcset.altalleleinfo) {
		if (!m.altinfo) return ['no .altinfo']

		const value = m.altinfo[mcset.altalleleinfo.key]
		if (value == undefined) {
			// no value

			if (mcset.numericfilter) {
				// for alleles without AF_ExAC e.g. not seem in that population, treat value as 0
				// FIXME: only work for population frequency, assumption won't hold for negative values
				return [null, [0]]
			}

			return [null, undefined]
		}

		let vlst = Array.isArray(value) ? value : [value]

		if (mcset.altalleleinfo.separator) {
			// hardcoded separator for string
			vlst = vlst[0].split(mcset.altalleleinfo.separator)
		}
		return [null, vlst]
	}

	if (mcset.locusinfo) {
		if (!m.info) return ['no .info']

		const value = m.info[mcset.locusinfo.key]
		if (value == undefined) {
			// no value
			if (mcset.numericfilter) {
				// hard fix: for alleles without AF_ExAC e.g. not seem in that population, treat value as 0
				return [null, [0]]
			}
			return [null, undefined]
		}

		let vlst = Array.isArray(value) ? value : [value]

		if (mcset.locusinfo.separator) {
			vlst = vlst[0].split(mcset.locusinfo.separator)
		}
		return [null, vlst]
	}

	return ['no trigger']
}

/*
to validate custom variants (snvindel and svfusion) already present in tk.custom_variants[]
create "ssm_id" for each variant inside array
create "pairlst[]" for sv/fusion
makes no return
*/
function validateCustomVariants(tk, block) {
	for (const m of tk.custom_variants) {
		// has_skewer is a convenient flag to indicate skewer will render based on multiple datatypes; a flag for cnv is not needed
		if (m.dt == dtsnvindel) {
			tk.mds.has_skewer = true // enable skewer tk
			validateCustomSnvindel(m)
			continue
		}
		if (m.dt == dtfusionrna || m.dt == dtsv) {
			tk.mds.has_skewer = true // enable skewer tk
			validateCustomSvfusion(m, block)
			continue
		}
		if (m.dt == dtcnv) {
			m.ssm_id = [m.chr, m.start, m.stop, m.class].join(ssmIdFieldsSeparator)
			continue
		}
		throw 'unknown dt for a custom variant'
	}
}

function validateCustomSnvindel(m) {
	// snvindel
	if (!m.chr) throw '.chr missing for custom snvindel'
	if (!Number.isInteger(m.pos)) throw '.pos not integer for custom snvindel'
	if (!m.ssm_id) {
		m.ssm_id = [m.chr, m.pos, m.ref && m.alt ? m.ref + ssmIdFieldsSeparator + m.alt : m.mname].join(
			ssmIdFieldsSeparator
		)
	}
}
function validateCustomSvfusion(m, block) {
	// sv or fusion
	if (m.pairlst) {
		// todo validate pairlst[]
	} else {
		// make pairlst[], requires chr1/pos1/chr2/pos2 etc
		if (!m.chr1) throw '.chr1 missing for custom sv/fusion'
		if (!Number.isInteger(m.pos1)) throw '.pos1 not integer for custom svfusion'
		if (m.strand1 != '+' && m.strand1 != '-') throw '.strand1 not +/- for custom svfusion'
		if (!m.chr2) throw '.chr1 missing for custom sv/fusion'
		if (!Number.isInteger(m.pos2)) throw '.pos1 not integer for custom svfusion'
		if (m.strand2 != '+' && m.strand2 != '-') throw '.strand1 not +/- for custom svfusion'
		m.pairlst = [
			{
				a: {
					chr: m.chr1,
					pos: m.pos1,
					strand: m.strand1,
					name: m.gene1 || ''
				},
				b: {
					chr: m.chr2,
					pos: m.pos2,
					strand: m.strand2,
					name: m.gene2 || ''
				}
			}
		]
		delete m.chr1
		delete m.pos1
		delete m.strand1
		delete m.gene1
		delete m.chr2
		delete m.pos2
		delete m.strand2
		delete m.gene2
	}

	// m.pairlst[] is ready

	// create ssm_id
	const fields = [m.dt] // fields to make ssm_id for svfusion

	// FIXME need pairlst[] index and a/b side
	// "2.chr22.23253797.+.1.ABL1" should be "2.chr22.23253797.+.0b.ABL1" instead
	// TODO loop through m.pairlst[]

	// seek [0].a{}
	const hits = block.seekcoord(m.pairlst[0].a.chr, m.pairlst[0].a.pos)
	if (hits.length && hits[0].x > 0 && hits[0].x < block.width) {
		// [0].a is within range
		fields.push(...[m.pairlst[0].a.chr, m.pairlst[0].a.pos, m.pairlst[0].a.strand, 0, m.pairlst[0].a.name])

		// since .a{} is in range, use .b.name as mname
		m.mname = m.pairlst[0].b.name || ''
		m.chr = m.pairlst[0].a.chr
		m.pos = m.pairlst[0].a.pos
		m.pairlstIdx = 0
	} else {
		// [0].a is not within range, seek [0].b{}
		const hits = block.seekcoord(m.pairlst[0].b.chr, m.pairlst[0].b.pos)
		if (hits.length && hits[0].x > 0 && hits[0].x < block.width) {
			// [0].b is in range
			fields.push(...[m.pairlst[0].b.chr, m.pairlst[0].b.pos, m.pairlst[0].b.strand, 1, m.pairlst[0].b.name])

			// since .b{} is in range, use .a.name as mname
			m.mname = m.pairlst[0].a.name || ''
			m.chr = m.pairlst[0].b.chr
			m.pos = m.pairlst[0].b.pos
			m.pairlstIdx = 1
		} else {
			// [0] a/b both are not in range. do not reject?
		}
	}
	m.ssm_id = fields.join(ssmIdFieldsSeparator)
}

/* wip
this works for receiving data from mass-matrix gene label-clicking
in custom_variants[] data points,
if "sample_id" is present but "occurrence" is missing, do below:
- dedup the list by merging m{} of same variant together. only apply to ssm!
- on unique m{}, create .samples[] to collect list of samples harboring that variant
- derive m.occurrence:int, as the samples[] array length
- enable tk.mds.variant2samples{}

may share code with server
*/
function mayDeriveSkewerOccurrence4samples(tk) {
	if (tk.custom_variants.find(i => i.occurrence != undefined)) {
		// at least one m{} has occurrence, presumably all m{} should have it. no need to group
		return
	}

	// sample_id is hardcoded, change "sample" to "sample_id"

	for (const i of tk.custom_variants) {
		if (i.sample) {
			i.sample_id = i.sample
			delete i.sample
		}
	}

	if (!tk.custom_variants.find(i => i.sample_id)) {
		// no m{} has sample, cannot derive occurrence
		// usecase: for displaying variant-only info, e.g. regression-snplocus, dbsnp, clinvar
		return
	}

	// has .sample_id but lacks .occurrence, do things

	// ungrouped events are stored here and combined to grouped ones.
	// FIXME group fusion.
	// lacks a way to group cnv
	const ungrouped = []

	const key2m = new Map()
	// k: mutation ssm_id, v: m{} after deduplication, with occurrence:int

	for (const m of tk.custom_variants) {
		if (m.dt != dtsnvindel) {
			m.occurrence = 1
			m.samples = [{ sample_id: m.sample_id }]
			delete m.sample_id
			ungrouped.push(m)
			continue
		}
		const key = [m.mname, m.chr, m.pos, m.ref, m.alt].join(ssmIdFieldsSeparator)
		const m2 = key2m.get(key)
		if (m2) {
			m2.occurrence++
			// TODO collect samples to array
			m2.samples.push({
				sample_id: m.sample_id
			})
		} else {
			m.occurrence = 1
			m.samples = [
				{
					sample_id: m.sample_id
				}
			]
			delete m.sample_id
			key2m.set(key, m)
		}
	}

	tk.custom_variants = ungrouped
	for (const m of key2m.values()) tk.custom_variants.push(m)
	// enable variant2samples
	if (!tk.mds.variant2samples) tk.mds.variant2samples = {}
	const v = tk.mds.variant2samples
	v.type_samples = 'samples'
	v.type_summary = 'summary'
	v.type_sunburst = 'sunburst'
}

/* wip
hardcode for Type="string", no auto detecting numeric values to set Type="Float"
*/
function mayAddInfoField(tk) {
	if (!tk.custom_variants.some(i => i.info)) return // no variant has info field
	const info = {} // replicate same structure as native tk
	for (const m of tk.custom_variants) {
		if (typeof m.info != 'object') continue
		for (const k in m.info) {
			const v = m.info[k]
			if (v == null || v == undefined) continue
			if (!info[k]) info[k] = { ID: k, Number: '.', Type: 'String', categories: {} }
			if (!info[k].categories[v]) info[k].categories[v] = {}
		}
	}
	for (const k in info) {
		const colors = getColors(Object.keys(info[k].categories).length)
		for (const c in info[k].categories) {
			info[k].categories[c].color = colors(c)
		}
	}
	tk.mds.bcf = { info }
}

/*
input:
	tk{}
	genome{}
		client-side genome object
*/
async function getbcfheader_customtk(tk, genome) {
	const arg = { genome: genome.name }
	if (tk.bcf.file) {
		arg.file = tk.bcf.file
	} else {
		arg.url = tk.bcf.url
		if (tk.bcf.indexURL) arg.indexURL = tk.bcf.indexURL
	}
	const data = await dofetch3('bcfheader', { body: arg })
	if (data.error) throw data.error
	const [info, format, samples, errs] = data.header
	if (errs) throw 'Error parsing VCF meta lines: ' + errs.join('; ')
	tk.mds.bcf = {
		info,
		format // can be null
	}
	if (samples?.length) {
		// bcf file has samples
		tk.mds.bcf.samples = samples
		// add v2s; later getter will be added
		tk.mds.variant2samples = {
			//twLst:[], // TODO should not be required
			type_samples: 'samples',
			variantkey: 'ssm_id'
		}
	}
	if (!tk.mds.queries) tk.mds.queries = {}
	tk.mds.queries.snvindel = { forTrack: true }
}

function validateSelectSamples(tk) {
	const a = tk.allow2selectSamples
	if (!a) return
	if (!a.buttonText) a.buttonText = 'Select samples'
	if (typeof a.buttonText != 'string') throw 'allow2selectSamples.buttonText value is not string'
	if (!a.attributes) a.attributes = [{ from: 'sample_id', to: 'sample_id' }]
	if (!Array.isArray(a.attributes)) throw 'allow2selectSamples.attributes[] is not array'
	if (a.attributes.length == 0) throw 'allow2selectSamples.attributes[] blank array'
	for (const i of a.attributes) {
		if (typeof i.from != 'string' || !i.from) throw 'allow2selectSamples.attributes.from is not string'
		if (typeof i.to != 'string' || !i.to) throw 'allow2selectSamples.attributes.to is not string'
	}
	if (typeof a.callback != 'function') throw 'allow2selectSamples.callback() is not function'
	a._cart = [] // array to hold samples selected so far (e.g. separately from multiple mutations), for submitting to a.callback()
}
