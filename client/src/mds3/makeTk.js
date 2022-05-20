import { select as d3select, event as d3event } from 'd3-selection'
import { Menu } from '../../dom/menu'
import { dofetch3 } from '../../common/dofetch'
import { initLegend } from './legend'
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
mayaddGetter_m2csq
mayaddGetter_variant2samples
mayaddGetter_sampleSummaries2
parse_client_config
configPanel
_load


common structure of tk.mds between official and custom

tk.skewer{}
	create if skewer data type is available for this mds
	if not equipped then tk.skewer is undefined and should not show skewer track

stratify labels will account for all tracks, e.g. skewer, cnv
*/

export async function makeTk(tk, block) {
	// run just once to initiate a track

	tk.cache = {}
	tk.itemtip = new Menu()
	tk.menutip = new Menu({ padding: '' }) // to show menu options without margin
	tk.samplefiltertemp = {}
	// switch to .samplefilter with a filter.js object

	tk.load = _load(tk, block) // shorthand

	await get_ds(tk, block)
	// tk.mds{} is created for both official and custom track
	// following procedures are only based on tk.mds

	await init_termdb(tk, block)

	mayaddGetter_sampleSummaries2(tk, block)
	mayaddGetter_variant2samples(tk, block)
	mayaddGetter_m2csq(tk, block)

	if (tk.mds.has_skewer) {
		tk.skewer = {
			g: tk.glider.append('g'),
			// skewer.mode defines how to show snv/indel; may also control fusion
			// later may add new attributes e.g. "cnvMode" to control mode of other data types
			mode: 'skewer' // default mode, can be overwritten later
		}
		// both skewer and numeric mode will render elements into tk.skewer.g
		// will also attach skewer.discKickSelection

		if (tk.skewerMode) {
			// override
			tk.skewer.mode = tk.skewerMode
			delete tk.skewerMode
		}
		if (tk.skewer.mode == 'skewer') {
		} else if (tk.skewer.mode == 'numeric') {
			if (!tk.numericmode) throw '.numericmode{} missing when skewer.mode=numeric'
		} else {
			throw 'unknown skewerMode'
		}
	}

	tk.leftLabelMaxwidth = tk.tklabel
		.text(tk.mds.label || tk.name)
		.node()
		.getBBox().width

	tk.leftlabelg = tk.gleft.append('g')

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

	if (tk.hlaachange) {
		// comma-separated names
		tk.hlaachange = new Set(tk.hlaachange.split(','))
	}
	if (tk.hlssmid) {
		tk.hlssmid = new Set(tk.hlssmid.split(','))
	}

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

	// parse url parameters applicable to this track
	// may inhibit this through some settings
	{
		const urlp = urlmap()
		if (urlp.has('hlaachange')) {
			tk.hlaachange = new Set(urlp.get('hlaachange').split(','))
		}
		if (urlp.has('hlssmid')) {
			tk.hlssmid = new Set(urlp.get('hlssmid').split(','))
		}
	}
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

function mayaddGetter_sampleSummaries2(tk, block) {
	if (!tk.mds.sampleSummaries2) return
	if (tk.mds.sampleSummaries2.get) return
	tk.mds.sampleSummaries2.get = async level => {
		// level is one of sampleSummaries2.lst[]
		const lst = [
			'genome=' + block.genome.name,
			'dslabel=' + tk.mds.label,
			'samplesummary2_mclassdetail=' + encodeURIComponent(JSON.stringify(level))
		]
		rangequery_rglst(tk, block, lst)
		const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
		if (tk.set_id) lst.push('set_id=' + tk.set_id)
		if (tk.token) headers['X-Auth-Token'] = tk.token
		if (tk.filter0) lst.push('filter0=' + encodeURIComponent(JSON.stringify(tk.filter0)))
		return await dofetch3('mds3?' + lst.join('&'), { headers }, { serverData: tk.cache })
	}
}

function mayaddGetter_variant2samples(tk, block) {
	if (!tk.mds.variant2samples) return
	if (tk.mds.variant2samples.get) return // track from the same mds has already been intialized

	// getter are implemented differently based on data sources
	if (tk.custom_variants) {
		tk.mds.variant2samples.get = arg => {
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
				return [samples, samples.length]
			}
			if (arg.querytype == tk.mds.variant2samples.type_summary) {
				throw 'todo: summary'
			}
			if (arg.querytype == tk.mds.variant2samples.type_sunburst) {
				throw 'todo: sunburst'
			}
			throw 'unknown querytype'
		}
		return
	}

	// server-hosted official dataset
	tk.mds.variant2samples.get = async arg => {
		/* arg{}
		.tk1
		.querytype
		.mlst
		.tid2value{}

		TODO support alternative data sources
		where all data are hosted on client
		*/
		// hardcode to getsummary and using fixed levels
		const par = ['genome=' + block.genome.name, 'dslabel=' + tk.mds.label, 'variant2samples=1', 'get=' + arg.querytype]
		if (arg.tk1) par.push('samplefiltertemp=' + JSON.stringify(arg.tk1.samplefiltertemp)) // must use tk1 but not tk for this one
		if (arg.size) par.push('size=' + arg.size)
		if (arg.from != undefined) par.push('from=' + arg.from)
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
}

function parse_client_config(tk) {
	/* for both official and custom
configurations and their location are not stable
*/
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
