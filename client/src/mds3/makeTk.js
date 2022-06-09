import { select as d3select, event as d3event } from 'd3-selection'
import { Menu } from '../../dom/menu'
import { dofetch3 } from '../../common/dofetch'
import { initLegend, updateLegend } from './legend'
import { loadTk, rangequery_rglst } from './tk'
import urlmap from '../../common/urlmap'
import { mclass } from '../../shared/common'

/*
********************** EXPORTED
makeTk
********************** INTERNAL
init_mclass
get_ds
	validateCustomVariants
	mayDeriveSkewerOccurrence4samples
init_termdb
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
	// run just once to initiate a track

	tk.subtk2height = {}
	// keys: "skewer", "leftlabels"
	// value is #pixel in height for that component

	tk.leftlabels = {
		g: tk.gleft.append('g'), // all labels are rendered here, except track label
		doms: {},
		// keys: label name, value: label dom
		// to avoid having to delete all labels upon tk rendering
		laby: 0 // cumulative height, 0 for no labels
	}

	tk._finish = loadTk_finish_closure(tk, block)

	tk.cache = {}
	tk.itemtip = new Menu()
	tk.menutip = new Menu({ padding: '' }) // to show menu options without margin

	tk.load = _load(tk, block) // shorthand

	await get_ds(tk, block)
	// tk.mds{} is created for both official and custom track
	// following procedures are only based on tk.mds

	await init_termdb(tk, block)

	mayaddGetter_variant2samples(tk, block)
	mayaddGetter_m2csq(tk, block)

	mayInitSkewer(tk) // tk.skewer{} may be added

	tk.leftLabelMaxwidth = tk.tklabel
		.text(tk.mds.label || tk.name)
		.node()
		.getBBox().width

	tk.clear = () => {
		// called in loadTk, when uninitialized is true
		if (tk.skewer) tk.skewer.g.selectAll('*').remove()
	}

	// TODO <g> for other file types

	// config
	tk.config_handle = block.maketkconfighandle(tk).on('click', () => {
		configPanel(tk, block)
	})

	initLegend(tk, block)

	init_mclass(tk)

	tk.color4disc = m => {
		// figure out what color to use for a m point
		if (tk.mutationColorBy) {
			if (tk.mutationColorBy == 'hardcode') {
				if (m.color) return m.color
			}
			// support other choices, including vcfinfofilter
		}
		if (tk.vcfinfofilter && tk.vcfinfofilter.setidx4mclass != undefined) {
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

		block.tkcloakoff(tk, { error: data ? data.error : null })
		block.block_setheight()
		block.setllabel()
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

async function get_ds(tk, block) {
	if (tk.dslabel) {
		// official dataset
		const data = await dofetch3(`getDataset?genome=${block.genome.name}&dsname=${tk.dslabel}`)
		if (data.error) throw 'Error: ' + data.error
		if (!data.ds) throw 'data.ds{} missing'
		tk.mds = data.ds
		tk.name = data.ds.label
		return
	}
	// custom
	if (!tk.name) tk.name = 'Custom data'
	tk.mds = {}
	// fill in details to tk.mds
	///////////// custom data sources
	if (tk.vcf) {
		tk.mds.has_skewer = true // enable skewer tk
		console.log('to enable custom vcf')
		//await getvcfheader_customtk(tk.vcf, block.genome)
	} else if (tk.custom_variants) {
		tk.mds.has_skewer = true // enable skewer tk
		validateCustomVariants(tk)
		mayDeriveSkewerOccurrence4samples(tk)
	} else {
		throw 'unknown data source for custom track'
	}
	// if variant2samples is enabled for custom ds, it will also have the async get()
}

async function init_termdb(tk, block) {
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
			arg.terms = tdb.terms
		} else {
			throw 'do not know how to init vocab'
		}
		const _ = await import('../../termdb/vocabulary')
		tdb.vocabApi = _.vocabInit(arg)
	}

	if (tk.mds.termdb.allowCaseDetails) {
		tk.mds.termdb.allowCaseDetails.get = async acase => {}
	}
}

function mayaddGetter_m2csq(tk, block) {
	if (!tk.mds.queries || !tk.mds.queries.snvindel || !tk.mds.queries.snvindel.m2csq) return
	tk.mds.queries.snvindel.m2csq.get = async m => {
		const lst = ['genome=' + block.genome.name, 'dslabel=' + tk.mds.label, 'm2csq=1']
		if (tk.mds.queries.snvindel.m2csq.by == 'ssm_id') {
			lst.push('ssm_id=' + m.ssm_id)
		} else {
			return { error: 'unknown query method' }
		}
		const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
		if (tk.token) headers['X-Auth-Token'] = tk.token
		return await dofetch3('mds3?' + lst.join('&'), { headers }, { serverData: tk.cache })
	}
}

function mayaddGetter_variant2samples(tk, block) {
	if (!tk.mds.variant2samples) return

	// to add tk.mds.variant2samples.get()
	// with different implementation for client/server-based data sources

	if (tk.custom_variants) {
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

	// server-hosted official dataset
	tk.mds.variant2samples.get = async arg => {
		/* arg{}
		.querytype
		.mlst
		.tid2value{}
		*/
		const par = ['genome=' + block.genome.name, 'dslabel=' + tk.mds.label, 'variant2samples=1', 'get=' + arg.querytype]
		//if (arg.size) par.push('size=' + arg.size)
		//if (arg.from != undefined) par.push('from=' + arg.from)
		if (tk.mds.variant2samples.variantkey == 'ssm_id') {
			// TODO detect too long string length that will result url-too-long error
			// in such case, need alternative query method
			par.push('ssm_id_lst=' + arg.mlst.map(i => i.ssm_id).join(','))
		} else {
			throw 'unknown variantkey for variant2samples'
		}
		const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
		if (tk.set_id) par.push('set_id=' + tk.set_id)
		if (tk.token) headers['X-Auth-Token'] = tk.token
		if (tk.filter0) par.push('filter0=' + encodeURIComponent(JSON.stringify(tk.filter0)))
		if (arg.tid2value) par.push('tid2value=' + encodeURIComponent(JSON.stringify(arg.tid2value)))
		// pass all termidlst including new termid
		if (arg.querytype != tk.mds.variant2samples.type_sunburst && tk.mds.variant2samples.termidlst)
			par.push('termidlst=' + tk.mds.variant2samples.termidlst)
		const data = await dofetch3('mds3?' + par.join('&'), { headers }, { serverData: tk.cache })
		if (data.error) throw data.error
		if (!data.variant2samples) throw 'result error'
		return data.variant2samples
	}

	tk.mds.getSamples = async () => {
		const par = ['genome=' + block.genome.name, 'dslabel=' + tk.mds.label, 'getSamples=1']
		rangequery_rglst(tk, block, par)
		const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
		if (tk.token) headers['X-Auth-Token'] = tk.token
		// filters?
		// pass all termidlst including new termid
		if (tk.mds.variant2samples.termidlst) {
			par.push('termidlst=' + tk.mds.variant2samples.termidlst)
		}
		const data = await dofetch3('mds3?' + par.join('&'), { headers }, { serverData: tk.cache })
		if (data.error) throw data.error
		return data.samples
		/* each sample in the samples[] array:
		{ sample_id, ssm_id_lst:[], ...attributes... }
		*/
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

function validateCustomVariants(tk) {
	for (const m of tk.custom_variants) {
		if (!m.ssm_id) {
			m.ssm_id = m.chr + '.' + m.pos + '.' + (m.ref && m.alt ? m.ref + '.' + m.alt : m.mname)
		}
	}
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
