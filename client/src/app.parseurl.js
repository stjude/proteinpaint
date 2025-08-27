import blockinit from './block.init'
import * as client from './client'
import { loadstudycohort } from './tp.init'
import { string2pos } from './coord'
import * as mdsjson from './app.mdsjson'
import { getSavedToken } from '#common/dofetch'
import urlmap from '#common/urlmap'
import { first_genetrack_tolist } from '#common/1stGenetk'
import { parentCorsMessage, childCorsMessage } from '#common/embedder-helpers'
import { sayerror } from '#dom'
import { copyMerge } from '#rx'
import { mayLaunchGdcPlotFromUrlparam } from '../gdc/launch.ts'
/*
********************** EXPORTED
parse()
get_tklst()
*/

export async function parse(arg) {
	/*
arg
	.jwt
	.genomes{}
	.hostURL
	.variantPageCall_snv
	.samplecart
	.holder
	.debugmode

upon error, throw err message as a string
*/
	const urlp = urlmap()

	if (urlp.has('appcard')) {
		const ad = await import('../appdrawer/adSandbox')
		const cardJsonFile = urlp.get('appcard')
		const example = urlp.get('example')
		const re = await client.dofetch2('/cards/index.json')
		arg.app.drawer.opts.genomes = arg.genomes
		arg.app.drawer.opts.fromApp = true
		//Quick fix to launch the sandbox within the current openSandbox code
		arg.app.drawer.opts.app = {
			cardsPath: 'cards'
		}
		const element = re.elements.findIndex(
			t =>
				t.sandboxJson == cardJsonFile ||
				t.sandboxHtml == cardJsonFile ||
				t.name.toUpperCase().includes(cardJsonFile.toUpperCase())
		)

		//Check if track/app can be shown on this server
		//If not show error message
		if (re.elements[element]?.configFeature) {
			const features = JSON.parse(sessionStorage.getItem('optionalFeatures'))
			if (!features[re.elements[element].configFeature]) {
				sayerror(arg.holder, `This track or app is not enabled on this site.`)
				return
			}
		}

		if (example) {
			arg.app.drawer.opts.example = example
		}

		if (element <= 0) {
			const nestedCards = [...re.elements.filter(e => e.type == 'nestedCard')]
			let element, c
			nestedCards.findIndex(t => {
				for (const [i, child] of t.children.entries()) {
					if (
						child.sandboxJson == cardJsonFile ||
						child.sandboxHtml == cardJsonFile ||
						child.name.toUpperCase().includes(cardJsonFile.toUpperCase())
					) {
						element = t
						c = i
					}
				}
			})
			if (!element) {
				sayerror(arg.holder, `Invalid app card.`)
				return
			}
			ad.openSandbox(element.children[c], arg.app.drawer.opts)
		} else {
			ad.openSandbox(re.elements[element], arg.app.drawer.opts)
		}
		return
	}

	if (await mayLaunchGdcPlotFromUrlparam(urlp, arg)) return // gdc plot launched

	if (urlp.has('termdb')) {
		const value = urlp.get('termdb')
		const state = typeof value === 'string' ? JSON.parse(value) : value
		const opts = {
			holder: arg.holder,
			state: copyMerge(state, arg.state || {})
		}
		const _ = await import('../termdb/app')
		const subapp = _.appInit(opts)
		return subapp
	}

	if (urlp.has('massnative')) {
		/* ?massnative=hg38-test,TermdbTest
		alternative url for mass={"genome":"hg38-test","dslabel":"TermdbTest"}
		tidier to include in manuscript
		no customization supported, though later additional fields may be appended to customize something
		it is intended that the dataset should carry essential customizations so the link opens mass ui with expected customizations
		*/
		const value = urlp.get('massnative')
		const [genomename, dslabel] = value.split(',')
		if (!genomename || !dslabel) throw 'value is not "genome,dslabel"'
		const opts = {
			holder: arg.holder,
			genome: arg.genomes[genomename],
			state: copyMerge(
				{
					genome: genomename,
					dslabel
				},
				arg.state || {}
			),
			pkgver: arg.app.pkgver,
			launchDate: arg.app.launchDate
		}
		if (!opts.genome) throw 'invalid genome'
		childCorsMessage(opts)

		const _ = await import('../mass/app')
		const subapp = await _.appInit(opts)
		return subapp
	}

	if (urlp.has('mass')) {
		const value = urlp.get('mass')
		const state = typeof value === 'string' ? JSON.parse(value) : value
		const opts = {
			debug: arg.app.debugmode,
			holder: arg.holder,
			state: copyMerge(state, arg.state || {}),
			pkgver: arg.app.pkgver,
			launchDate: arg.app.launchDate
		}
		if (state.genome) {
			opts.genome = arg.genomes[state.genome]
		} else if (state?.vocab?.genome) {
			opts.genome = arg.genomes[state.vocab.genome]
		}
		childCorsMessage(opts)

		const _ = await import('../mass/app')
		const subapp = await _.appInit(opts)
		return subapp
	}

	if (urlp.has('mass-session-file') || urlp.has('mass-session-url')) {
		let opts
		if (urlp.has('mass-session-file')) {
			const file = urlp.get('mass-session-file')
			const d = await client.dofetch3(`/textfile`, {
				method: 'POST',
				body: JSON.stringify({ file })
			})
			if (typeof d != 'object') throw 'data not object'
			if (d.error) throw d.error
			if (!d.text) throw 'data.text missing'
			const state = JSON.parse(d.text)
			if (state.embedder?.origin != window.location.origin) {
				parentCorsMessage({ state })
				return
			}

			opts = {
				debug: arg.app.debugmode,
				holder: arg.holder,
				state,
				genome: arg.genomes[state.vocab.genome],
				pkgver: arg.app.pkgver,
				launchDate: arg.app.launchDate
			}
		} else if (urlp.has('mass-session-url')) {
			const url = urlp.get('mass-session-url')
			const d = await client.dofetch3('/urltextfile', {
				method: 'POST',
				body: JSON.stringify({ url })
			})
			if (typeof d != 'object') throw 'data not object'
			if (d.error) throw d.error
			if (!d.text) throw 'data.text missing'
			const state = JSON.parse(d.text)

			if (state.embedder && state.embedder.origin != window.location.origin) {
				corsMessage({ state })
				return
			}

			opts = {
				debug: arg.app.debugmode,
				holder: arg.holder,
				state: copyMerge(state, arg.state || {}),
				genome: arg.genomes[state.vocab.genome],
				pkgver: arg.app.pkgver,
				launchDate: arg.app.launchDate
			}
		}
		const _ = await import('../mass/app')
		const subapp = _.appInit(opts)
		return subapp
	}

	if (urlp.has('mass-session-id')) {
		const id = urlp.get('mass-session-id')
		const src = urlp.get('src')
		let res
		if (src == 'browser') {
			const json = localStorage.getItem('savedMassSessions')
			const savedSessions = JSON.parse(json)
			res = { state: savedSessions[id] }
		} else {
			const fetchOpts = { headers: {}, body: { id } }
			if (src == 'cred') {
				const dslabel = urlp.get('dslabel')
				const route = urlp.get('route')
				fetchOpts.body.dslabel = dslabel
				fetchOpts.body.route = route
				fetchOpts.body.route = route
				const jwt = getSavedToken(dslabel, route)
				if (jwt) fetchOpts.headers.authorization = `Bearer ${btoa(jwt)}`
			}
			res = await client.dofetch3(`/massSession`, fetchOpts)
			if (res.error) throw res.error
		}
		const embedder = res.state?.embedder
		if (embedder && embedder.origin != window.location.origin) {
			corsMessage(res)
			return
		}
		const opts = {
			debug: arg.app.debugmode,
			holder: arg.holder,
			state: copyMerge(res.state, arg.state || {}),
			genome: arg.genomes[res.state.vocab.genome],
			sessionDaysLeft: res.sessionDaysLeft,
			sessionId: id,
			pkgver: arg.app.pkgver,
			launchDate: arg.app.launchDate
		}
		const _ = await import('../mass/app')
		const subapp = _.appInit(opts)
		return subapp
	}

	if (urlp.has('genome') && arg.selectgenome) {
		const n = urlp.get('genome')
		const genome_options = [...arg.selectgenome.node().childNodes]
		const selectedIndex = genome_options.findIndex(d => d.value == n)
		if (selectedIndex == -1) {
			sayerror(
				arg.holder,
				`Invalid genome: ${n}. Please provide an available genome from this list: ${genome_options
					.map(d => d.value)
					.join(', ')
					.replace(/,(?=[^,]*$)/, ', or')}`
			)
			return
		}
		arg.selectgenome.node().selectedIndex = selectedIndex
		arg.selectgenome.node().dispatchEvent(new Event('change'))
	}

	if (urlp.has('hicfile') || urlp.has('hicurl')) {
		// whole-genome view
		let file, url, name
		if (urlp.has('hicfile')) {
			file = urlp.get('hicfile')
			name = file.split('/').pop()
		} else {
			url = urlp.get('hicurl')
			name = url.split('/').pop()
		}
		const gn = urlp.get('genome')
		if (!gn) throw 'genome is required for hic'
		const genome = arg.genomes[gn]
		if (!genome) throw 'invalid genome'
		const hic = {
			genome,
			file,
			url,
			name, //.basename(file || url),
			hostURL: arg.hostURL,
			enzyme: urlp.get('enzyme'),
			holder: arg.holder
		}
		const _ = await import('../tracks/hic/HicApp')
		await _.hicInit(hic)
		return
	}

	//////////// legacy, may be replaced by sampleScatter, kept for existing views on vizcom
	if (urlp.has('singlecell')) {
		if (!urlp.has('genome')) throw '"genome" is required for "singlecell"'
		const genomename = urlp.get('genome')
		const genomeobj = arg.genomes[genomename]
		if (!genomeobj) throw 'invalid genome: ' + genomename

		const _ = await import('./singlecell')
		_.init(
			{
				genome: genomeobj,
				jsonfile: urlp.get('singlecell')
			},
			arg.holder
		)
		return
	}

	if (urlp.has('mavbfile')) {
		if (!urlp.has('genome')) throw '"genome" is required for "mavb"'
		const genomename = urlp.get('genome')
		const genome = arg.genomes[genomename]
		if (!genome) throw 'invalid genome: ' + genomename
		const _ = await import('./mavb')
		_.mavbparseinput(
			{
				genome,
				hostURL: arg.hostURL,
				file: urlp.get('mavbfile')
			},
			() => {},
			arg.holder,
			arg.jwt
		)
		return
	}

	if (urlp.has('mavburl')) {
		if (!urlp.has('genome')) throw '"genome" is required for "mavb"'
		const genomename = urlp.get('genome')
		const genome = arg.genomes[genomename]
		if (!genome) throw 'invalid genome: ' + genomename
		const _ = await import('./mavb')
		_.mavbparseinput(
			{
				genome,
				hostURL: arg.hostURL,
				url: urlp.get('mavburl')
			},
			() => {},
			arg.holder,
			arg.jwt
		)
		return
	}

	//////////// legacy, replaced by sampleScatter (just need to support adhoc data), kept for existing views on vizcom
	if (urlp.has('scatterplot')) {
		if (!urlp.has('genome')) throw '"genome" is required for "scatterplot"'
		const genomename = urlp.get('genome')
		const genome = arg.genomes[genomename]
		if (!genome) throw 'invalid genome: ' + genomename

		let plot_data
		if (urlp.has('mdsjson') || urlp.has('mdsjsonurl')) {
			const url_str = urlp.get('mdsjsonurl')
			const file_str = urlp.get('mdsjson')
			plot_data = await mdsjson.get_scatterplot_data(file_str, url_str)
		}
		if (urlp.has('tsnejson')) {
			const file_str = urlp.get('tsnejson')
			const data = await client.dofetch('textfile', { file: file_str })
			if (data.error) throw data.error
			else if (data.text) {
				plot_data = {
					mdssamplescatterplot: {
						analysisdata: JSON.parse(data.text)
					}
				}
			}
		}

		// if genome is defined in url, pass it to samplescatterplot
		plot_data.mdssamplescatterplot.genome = genome
		const _ = await import('./mds.samplescatterplot')
		_.init(plot_data.mdssamplescatterplot, arg.holder, false)
		return
	}

	if (urlp.has('block')) {
		if (!urlp.has('genome')) throw 'missing genome for block'
		const genomename = urlp.get('genome')
		const genomeobj = arg.genomes[genomename]
		if (!genomeobj) throw 'invalid genome: ' + genomename

		const par = {
			nobox: 1,
			hostURL: arg.hostURL,
			jwt: arg.jwt,
			holder: arg.holder,
			genome: genomeobj,
			dogtag: genomename,
			debugmode: arg.debugmode
		}

		let position = null
		let rglst = null

		if (urlp.has('position')) {
			// can be multiple regions joined by ;
			// first region is main panel, rest of regions are subpanels

			const lst = urlp.get('position').split(';')
			if (lst[0]) {
				// if first region is blank, do not parse; it will be assigned with defaultcoord
				const tmp = lst[0].split(/[:-]/)
				const chr = tmp[0]
				const start = Number.parseInt(tmp[1])
				const stop = Number.parseInt(tmp[2])
				if (!chr) throw 'chr missing'
				if (Number.isNaN(start) || Number.isNaN(stop)) throw 'Invalid start/stop value in position'
				// valid position
				position = { chr, start, stop }
			}

			const subpanels = [] // collect rest of regions into this array
			for (let i = 1; i < lst.length; i++) {
				if (!lst[i]) continue // skip blank string
				const tmp = lst[i].split(/[:-]/)
				const chr = tmp[0]
				const start = Number.parseInt(tmp[1])
				const stop = Number.parseInt(tmp[2])
				if (!chr) throw 'subpanel chr missing'
				if (Number.isNaN(start) || Number.isNaN(stop)) throw 'Invalid start/stop value in subpanel position'
				// valid pos
				subpanels.push({
					chr,
					start,
					stop,
					width: 600,
					leftborder: 'rgba(200,0,0,.1)',
					leftpad: 5
				})
			}
			if (subpanels.length) {
				// has valid subpanels
				par.subpanels = subpanels
			}
		}

		if (urlp.has('regions')) {
			// for a different purpose than "position="
			// all regions here are shown in one view and scroll together, as in gmmode. it does not introduce subpanels
			rglst = []
			for (const s of urlp.get('regions').split(',')) {
				const l = s.split(/[:-]/)
				const chr = l[0]
				const start = Number.parseInt(l[1])
				const stop = Number.parseInt(l[2])
				if (Number.isNaN(start) || Number.isNaN(stop)) throw 'Invalid start/stop value in regions'
				rglst.push({ chr: l[0], start: start, stop: stop })
			}
		}

		if (!position && !rglst) {
			// no position given, use default
			if (genomeobj.defaultcoord) {
				position = {
					chr: genomeobj.defaultcoord.chr,
					start: genomeobj.defaultcoord.start,
					stop: genomeobj.defaultcoord.stop
				}
			}
		}

		if (position) {
			par.chr = position.chr
			par.start = position.start
			par.stop = position.stop
		} else if (rglst) {
			par.rglst = rglst
		}

		if (urlp.has('hlregion')) {
			const lst = []
			for (const t of urlp.get('hlregion').split(',')) {
				const pos = string2pos(t, genomeobj, true)
				if (pos) lst.push(pos)
			}
			if (lst.length) par.hlregions = lst
		}

		par.datasetqueries = may_get_officialmds(urlp)

		par.tklst = await get_tklst(urlp, genomeobj)

		first_genetrack_tolist(arg.genomes[genomename], par.tklst)

		mayAddBedjfilterbyname(urlp, par.tklst)
		const b = await import('./block')
		new b.Block(par)
		return
	}

	if (urlp.has('gene')) {
		const str = urlp.get('gene')
		if (str.length == 0) throw 'zero length query string'
		const par = {
			hostURL: arg.hostURL,
			query: str,
			holder: arg.holder,
			variantPageCall_snv: arg.variantPageCall_snv,
			samplecart: arg.samplecart,
			debugmode: arg.debugmode
		}
		{
			let genomename
			for (let n in arg.genomes) {
				if (arg.genomes[n].isdefault) {
					genomename = n
					break
				}
			}
			if (urlp.has('genome')) {
				genomename = urlp.get('genome')
			}
			if (!genomename) throw 'No genome, and none set as default'
			par.genome = arg.genomes[genomename]
			if (!par.genome) throw 'invalid genome: ' + genomename
		}
		let ds = null
		if (urlp.has('dataset')) {
			par.dataset = urlp.get('dataset').split(',')
		}
		if (urlp.has('hlaachange')) {
			par.hlaachange = new Map()
			for (const s of urlp.get('hlaachange').split(',')) {
				par.hlaachange.set(s, false)
			}
		}
		if (urlp.has('hlregion')) {
			const lst = []
			for (const t of urlp.get('hlregion').split(',')) {
				const pos = string2pos(t, par.genome, true)
				if (pos) lst.push(pos)
			}
			if (lst.length) par.hlregions = lst
		}

		par.tklst = await get_tklst(urlp, par.genome)

		mayAddBedjfilterbyname(urlp, par.tklst)

		par.datasetqueries = may_get_officialmds(urlp)
		await blockinit(par)
		return
	}

	if (urlp.has('disco')) {
		// a direct link to make manual testing easy
		const genomeName = urlp.get('genome')
		const genome = arg.genomes[genomeName]
		if (!genome) throw 'genome missing'
		const dslabel = urlp.get('dslabel')
		if (!dslabel) throw 'dslabel missing'
		const sample_id = urlp.get('sample')
		if (!sample_id) throw 'sample_id missing'
		const vocabApi = (await import('#termdb/vocabulary')).vocabInit({ state: { genome: genomeName, dslabel } })
		const termdbConfig = await vocabApi.getTermdbConfig()
		await (await import('#plots/plot.disco.js')).default(termdbConfig, dslabel, { sample_id }, arg.holder, genome)
		return
	}

	///////////// legacy, totally replaced by mass. kept for some views on vizcom
	if (urlp.has('study')) {
		const v = urlp.get('study')
		if (v != '') {
			loadstudycohort(
				arg.genomes,
				v,
				arg.holder,
				arg.hostURL,
				undefined, // jwt
				false, // no show
				arg.app || {
					debugmode: arg.debugmode,
					instanceTracker: arg.instanceTracker || {},
					callbacks: arg.callbacks || {}
				}
			)
		}
	}
}

function may_get_officialmds(urlp) {
	if (!urlp.has('mds')) return
	const tmp = urlp.get('mds').split(',')
	if (tmp[0] && tmp[1]) {
		const dataset = { dataset: tmp[0], querykey: tmp[1] }
		if (urlp.has('sample')) {
			dataset.singlesample = { name: urlp.get('sample') }
			// quick fix!!
			// tell  mds_load_query_bykey to load assay tracks in this context, but will not do so if launching sample view from main tk
			dataset.getsampletrackquickfix = true
		}
		return [dataset]
	}
	return
}

export async function get_tklst(urlp, genomeobj) {
	const tklst = []

	for (const [key, value] of urlp) {
		const tks = await mayGetTkobj(key, value, urlp, genomeobj)
		if (!tks) continue // no tkobj derived, parameter doesn't match with anything
		if (Array.isArray(tks)) tklst.push(...tks)
		else tklst.push(tks)
	}

	for (const t of tklst) {
		// uncertain reason why all tk are labeled as custom
		// the mds3 tk has "dslabel" and should be official, do not label as custom, so in block.tk.menu won't show the delete button
		if (t.type == 'mds3' && t.dslabel) continue
		t.iscustom = true
	}

	// quick fix to modify behaviors of mds tracks collected through parameters
	// if isdense=1, turn to dense
	// if sample=..., change to a single sample track
	if (urlp.has('isdense')) {
		tklst
			.filter(t => t.type == client.tkt.mdssvcnv)
			.forEach(t => {
				t.isdense = true
				t.isfull = false
			})
	}
	if (urlp.has('sample')) {
		tklst
			.filter(t => t.type == client.tkt.mdssvcnv)
			.forEach(t => {
				t.singlesample = { name: urlp.get('sample') }
				t.getsampletrackquickfix = true
				// XXX this doesn't work to load assay tracks for a custom mds, can only load for official mds
				// for both custom and official, the expression rank track is not loaded.
			})
	}
	return tklst
}

/*
returns:
- object for one successfully parsed track
- array for multiple track objects, could be empty!
- null for no tracks
*/
export async function mayGetTkobj(key, value, urlp, genomeobj) {
	if (key == 'mds3') {
		// official mds3 dataset; value is comma-joined dslabels
		const lst = value.split(',')
		const tks = []
		for (const n of lst) {
			const tk = {
				type: client.tkt.mds3,
				dslabel: n
			}
			if (urlp.has('token')) tk.token = urlp.get('token') // temporary
			if (urlp.has('filterobj')) tk.filterObj = urlp.get('filterobj')
			if (urlp.has('cnvonly')) tk.hardcodeCnvOnly = true // quick fix for testing cnv-only mode via url param; in actual use this flag should be set in runpp()
			tks.push(tk)
		}
		return tks
	}

	if (key == 'mds3bcffile') {
		// "name,path" pairs to server-side vcf files
		const [tkname, bcffile] = value.split(',')
		let tk
		if (tkname && bcffile) {
			tk = {
				type: client.tkt.mds3,
				name: tkname,
				bcf: { file: bcffile }
			}
		}
		return tk
	}
	if (key == 'mds3bcfurl') {
		// "name,url,indexURL" to remote file. indexURL is optional when the index file is not co-locating with the bcf file
		const [tkname, url, indexURL] = value.split(',')
		let tk
		if (tkname && url) {
			tk = {
				type: client.tkt.mds3,
				name: tkname,
				bcf: { url, indexURL }
			}
		}
		return tk
	}

	if (key == 'arcfile') {
		const lst = value.split(',')
		const tks = []
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tks.push({
					type: client.tkt.hicstraw,
					name: lst[i],
					bedfile: lst[i + 1],
					mode_hm: false,
					mode_arc: true
				})
			}
		}
		return tks
	}

	if (key == 'mdsjson' || key == 'mdsjsonurl') {
		let url_str, file_str
		if (key == 'mdsjson') file_str = value
		else url_str = value
		return await mdsjson.init_mdsjson(file_str, url_str)
	}

	if (key == 'tkjsonfile') {
		const re = await client.dofetch('textfile', { file: value })
		if (re.error) throw re.error
		if (!re.text) throw '.text missing'
		const lst = JSON.parse(re.text)
		const tks = []
		for (const i of lst) {
			if (i.isfacet) {
				if (!genomeobj.tkset) genomeobj.tkset = []
				if (!i.tracks) throw '.tracks[] missing from a facet table'
				if (!Array.isArray(i.tracks)) throw '.tracks[] not an array from a facet table'
				i.tklst = i.tracks
				delete i.tracks
				for (const t of i.tklst) {
					if (!t.assay) throw '.assay missing from a facet track'
					if (!t.sample) throw '.sample missing from a facet track'
					// must assign tkid otherwise the tk buttons from facet table won't work
					t.tkid = Math.random().toString()
				}
				genomeobj.tkset.push(i)
			} else {
				// must be a track
				tks.push(i)
			}
		}
		return tks
	}

	if (key == 'bamfile') {
		const lst = value.split(',')
		const tks = []
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tks.push({
					type: client.tkt.bam,
					name: lst[i],
					file: lst[i + 1]
				})
			}
		}
		return tks
	}
	if (key == 'bamurl') {
		const lst = value.split(',')
		const tks = []
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tks.push({
					type: client.tkt.bam,
					name: lst[i],
					url: lst[i + 1]
				})
			}
		}
		return tks
	}
	if (key == 'bedjfile') {
		const lst = value.split(',')
		const tks = []
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tks.push({
					type: client.tkt.bedj,
					name: lst[i],
					file: lst[i + 1]
				})
			}
		}
		return tks
	}
	if (key == 'bedjurl') {
		const lst = value.split(',')
		const tks = []
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tks.push({
					type: client.tkt.bedj,
					name: lst[i],
					url: lst[i + 1]
				})
			}
		}
		return tks
	}
	if (key == 'hictkfile' || key == 'hictkurl') {
		// name,enzyme,file/url
		const isfile = key == 'hictkfile'
		const lst = value.split(',')
		const norm = urlp.has('hictknorm') ? urlp.get('hictknorm').split(',') : null
		const tks = []
		for (let i = 0; i < lst.length; i += 3) {
			if (lst[i] && lst[i + 1] && lst[i + 2]) {
				const t = {
					type: client.tkt.hicstraw,
					name: lst[i],
					enzyme: lst[i + 1],
					normalizationmethod: norm ? norm[i / 3] : null
				}
				if (isfile) {
					t.file = lst[i + 2]
				} else {
					t.url = lst[i + 2]
				}
				tks.push(t)
			}
		}
		return tks
	}
	if (key == 'ldfile') {
		const lst = value.split(',')
		const tks = []
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tks.push({
					type: client.tkt.ld,
					name: lst[i],
					file: lst[i + 1]
				})
			}
		}
		return tks
	}
	if (key == 'bigwigfile') {
		const lst = value.split(',')
		const tks = []
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tks.push({
					type: client.tkt.bigwig,
					name: lst[i],
					file: lst[i + 1],
					scale: { auto: 1 }
				})
			}
		}
		return tks
	}
	if (key == 'bigwigurl') {
		const lst = value.split(',')
		const tks = []
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tks.push({
					type: client.tkt.bigwig,
					name: lst[i],
					url: lst[i + 1],
					scale: { auto: 1 }
				})
			}
		}
		return tks
	}
	if (key == 'junctionfile') {
		// legacy
		const lst = value.split(',')
		const tks = []
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tks.push({
					type: client.tkt.junction,
					name: lst[i],
					tracks: [
						{
							file: lst[i + 1]
						}
					]
				})
			}
		}
		return tks
	}
	if (key == 'junctionurl') {
		const lst = value.split(',')
		const tks = []
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tks.push({
					type: client.tkt.junction,
					name: lst[i],
					tracks: [
						{
							url: lst[i + 1]
						}
					]
				})
			}
		}
		return tks
	}
	/*
	if (urlp.has('vcffile')) {
		const lst = urlp.get('vcffile').split(',')
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tklst.push({
					type: 'vcf',
					name: lst[i],
					file: lst[i + 1]
				})
			}
		}
	}
	if (urlp.has('vcfurl')) {
		const lst = urlp.get('vcfurl').split(',')
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tklst.push({
					type: 'vcf',
					name: lst[i],
					url: lst[i + 1]
				})
			}
		}
	}
	*/
	if (key == 'aicheckfile') {
		const lst = value.split(',')
		const tks = []
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tks.push({
					type: 'aicheck',
					name: lst[i],
					file: lst[i + 1]
				})
			}
		}
		return tks
	}
	if (key == 'bampilefile') {
		const lst = value.split(',')
		let links = null
		if (urlp.has('bampilelink')) {
			links = urlp.get('bampilelink').split(',').map(decodeURIComponent)
		}
		const tks = []
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				const tk = {
					type: client.tkt.bampile,
					name: lst[i],
					file: lst[i + 1]
				}
				if (links && links[i / 2]) {
					tk.link = links[i / 2]
				}
				tks.push(tk)
			}
		}
		return tks
	}
	if (key == 'svcnvfpkmurl') {
		const lst = value.split(',')
		// defines a single track, all members using url
		const name = lst[0]
		const type2url = {}
		for (let i = 1; i < lst.length; i += 2) {
			type2url[lst[i]] = lst[i + 1]
		}
		let tk
		if (type2url.svcnv || type2url.vcf) {
			tk = {
				type: client.tkt.mdssvcnv,
				name: name
			}
			if (type2url.svcnv) {
				tk.url = type2url.svcnv
			}
			if (type2url.vcf) {
				tk.checkvcf = {
					url: type2url.vcf,
					indexURL: type2url.vcfindex
				}
			}
			if (type2url.fpkm) {
				tk.checkexpressionrank = {
					datatype: 'FPKM',
					url: type2url.fpkm,
					indexURL: type2url.fpkmindex
				}
			}
		}
		return tk
	}
	if (key == 'svcnvfpkmfile') {
		const lst = value.split(',')
		// defines a single track, all members using file
		const name = lst[0]
		const type2file = {}
		for (let i = 1; i < lst.length; i += 2) {
			type2file[lst[i]] = lst[i + 1]
		}
		let tk
		if (type2file.svcnv || type2file.vcf) {
			tk = {
				type: client.tkt.mdssvcnv,
				name: name
			}
			if (type2file.svcnv) {
				tk.file = type2file.svcnv
			}
			if (type2file.vcf) {
				tk.checkvcf = {
					file: type2file.vcf
				}
			}
			if (type2file.fpkm) {
				tk.checkexpressionrank = {
					datatype: 'FPKM',
					file: type2file.fpkm
				}
			}
		}
		return tk
	}
	if (key == 'mdsjunctionfile') {
		const lst = value.split(',')
		const tks = []
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tks.push({
					type: 'mdsjunction',
					name: lst[i],
					file: lst[i + 1]
				})
			}
		}
		return tks
	}
	if (key == 'junctionmatrix') {
		const lst = value.split(',')
		const tks = []
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tks.push({
					type: 'mdsjunction',
					name: lst[i],
					file2: lst[i + 1] // quick fix to support new file type
				})
			}
		}
		return tks
	}

	if (key == 'junctionrnapeg') {
		const lst = value.split(',')
		const tks = []
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tks.push({
					type: client.tkt.junction,
					name: lst[i],
					tracks: [{ rnapegfile: lst[i + 1] }]
				})
			}
		}
		return tks
	}
}

function mayAddBedjfilterbyname(urlp, tklst) {
	/* !! a quick fix !!
	the filter string will be applied to all bedj tracks,
	rather than specific for a track
	may mess up with other bedj tracks shown at the same time
	*/
	if (urlp.has('bedjfilterbyname')) {
		for (const t of tklst) {
			if (t.type == 'bedj') t.filterByName = urlp.get('bedjfilterbyname')
		}
	}
}
