import { Menu } from '#dom/menu'
import { dofetch3 } from '#common/dofetch'
import { initLegend, updateLegend } from './legend'
import { loadTk, rangequery_rglst } from './tk'
import urlmap from '#common/urlmap'
import { mclass } from '#shared/common'
import { vcfparsemeta } from '#shared/vcf'

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
mayaddGetter_m2csq
mayaddGetter_variant2samples
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
*/

export async function makeTk(tk, block) {
	// run just once to initiate a track by adding in essential attributes to tk object

	tk.subtk2height = {}
	// keys: "skewer", "leftlabels"
	// value is #pixel in height for that component

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
	tk.itemtip = new Menu()
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

	await mayInitTermdb(tk, block)

	mayaddGetter_variant2samples(tk, block)
	mayaddGetter_m2csq(tk, block)

	mayInitSkewer(tk) // tk.skewer{} may be added

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
}

function loadTk_finish_closure(tk, block) {
	return data => {
		// derive tk height
		tk.height_main = 0
		for (const k in tk.subtk2height) {
			tk.height_main = Math.max(tk.height_main, tk.subtk2height[k])
		}
		tk.height_main += tk.toppad + tk.bottompad

		if (data) {
			updateLegend(data, tk, block)
		}

		tk.leftLabelMaxwidth = Math.max(tk.leftlabels.maxwidth + tk.leftlabels.xoff, tk.skewer ? tk.skewer.maxwidth : 0)

		block.tkcloakoff(tk, { error: data ? data.error : null })
		block.block_setheight()
		block.setllabel()

		if (typeof tk.callbackOnRender == 'function') {
			tk.callbackOnRender(tk, block)
		}
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
		hlBoxColor: tk.mds.hlBoxColor || 'red'
	}
	setSkewerMode(tk) // adds skewer.viewModes[]
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
		tk.mds.has_skewer = true // enable skewer tk
		validateCustomVariants(tk, block)
		mayDeriveSkewerOccurrence4samples(tk)
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
	}

	if (tk.mds.termdb.allowCaseDetails) {
		tk.mds.termdb.allowCaseDetails.get = async acase => {}
	}
}

function mayaddGetter_m2csq(tk, block) {
	if (!tk.mds.queries || !tk.mds.queries.snvindel || !tk.mds.queries.snvindel.m2csq) return
	tk.mds.queries.snvindel.m2csq.get = async m => {
		const lst = { genome: block.genome.name, dslabel: tk.mds.label, m2csq: 1 }
		if (tk.mds.queries.snvindel.m2csq.by == 'ssm_id') {
			lst.ssm_id = m.ssm_id
		} else {
			return { error: 'unknown query method' }
		}
		const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
		if (tk.token) headers['X-Auth-Token'] = tk.token
		return await dofetch3('mds3', { body: lst, headers }, { serverData: tk.cache })
	}
}

/* to add tk.mds.variant2samples.get()
with different implementation for client/server-based data sources

note inconsistency in getSamples() for client/server
where server function queries v2s.get()
but client function does not do v2s.get() but should do the same to support sunburst and summary
*/
function mayaddGetter_variant2samples(tk, block) {
	if (!tk.mds.variant2samples) return

	if (tk.custom_variants) {
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
				return samples
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
			return [...id2sample.values()]
		}
		return
	}

	// same getters implemented for server-hosted official dataset

	/*
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
			dslabel: tk.mds.label,
			variant2samples: 1,
			get: arg.querytype
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
			par.hiddenmclasslst = [...tk.legend.mclass.hiddenvalues].join(',')
		}

		const data = await dofetch3('mds3', { body: par, headers }, { serverData: tk.cache })
		if (data.error) throw data.error
		if (!data.variant2samples) throw 'result error'
		return data.variant2samples
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
		if (m.dt == 1) {
			validateCustomSnvindel(m)
			continue
		}
		if (m.dt == 2 || m.dt == 5) {
			validateCustomSvfusion(m, block)
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
		// TODO ssmIdFieldsSeparator
		m.ssm_id = m.chr + '.' + m.pos + '.' + (m.ref && m.alt ? m.ref + '.' + m.alt : m.mname)
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
	m.ssm_id = fields.join('.')
}

/*
work-in-progress
this works for receiving data from mass-matrix gene label-clicking

in custom_variants[] data points,
if "sample_id" is present but "occurrence" is missing, do below:
- dedup the list by merging m{} of same variant together
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
	const key2m = new Map()
	// k: string key, v: m{} after deduplication, with occurrence:int
	for (const m of tk.custom_variants) {
		const key = m.mname + '.' + m.chr + '.' + m.pos + '.' + m.ref + '.' + m.alt
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
	tk.custom_variants = []
	for (const m of key2m.values()) tk.custom_variants.push(m)
	// enable variant2samples
	if (!tk.mds.variant2samples) tk.mds.variant2samples = {}
	const v = tk.mds.variant2samples
	v.type_samples = 'samples'
	v.type_summary = 'summary'
	v.type_sunburst = 'sunburst'
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
	// FIXME if vcf and bcf files can both be used?
	const data = await dofetch3('vcfheader', { body: arg })
	if (data.error) throw data.error
	const [info, format, samples, errs] = vcfparsemeta(data.metastr.split('\n'))
	if (errs) throw 'Error parsing VCF meta lines: ' + errs.join('; ')
	tk.mds.bcf = {
		info,
		format,
		samples
	}
}

function validateSelectSamples(tk) {
	const a = tk.allow2selectSamples
	if (!a) return
	if (!a.buttonText) a.buttonText = 'Select samples'
	if (typeof a.buttonText != 'string') throw 'allow2selectSamples.buttonText value is not string'
	if (!a.attributes) a.attributes = ['sample_id']
	if (!Array.isArray(a.attributes)) throw 'allow2selectSamples.attributes[] is not array'
	if (a.attributes.length == 0) throw 'allow2selectSamples.attributes[] blank array'
	for (const i of a.attributes) {
		if (!i || typeof i != 'string') throw 'allow2selectSamples.attributes[] element is not non-empty string'
	}
	if (typeof a.callback != 'function') throw 'allow2selectSamples.callback() is not function'
	a._cart = [] // array to hold samples selected so far (e.g. separately from multiple mutations), for submitting to a.callback()
}
