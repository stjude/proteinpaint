import blockinit from './block.init'
import * as client from './client'
import { loadstudycohort } from './tp.init'
import { string2pos } from './coord'
import * as mdsjson from './app.mdsjson'
import urlmap from '#common/urlmap'
import { first_genetrack_tolist } from '#common/1stGenetk'
import { corsMessage } from '#common/embedder-helpers'
import { sayerror } from '../dom/sayerror'
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
		const re = await client.dofetch2('/cards/index.json')
		arg.app.drawer.opts.genomes = arg.genomes
		arg.app.drawer.opts.fromApp = true
		//Quick fix to launch the sandbox within the current openSandbox code
		arg.app.drawer.opts.app = {
			cardsPath: 'cards'
		}
		const element = re.elements.findIndex(t => t.sandboxJson == cardJsonFile || t.sandboxHtml == cardJsonFile)
		if (element <= 0) {
			const nestedCards = [...re.elements.filter(e => e.type == 'nestedCard')]
			let element, c
			nestedCards.findIndex(t => {
				for (const [i, child] of t.children.entries()) {
					if (child.sandboxJson == cardJsonFile || child.sandboxHtml == cardJsonFile) {
						element = t
						c = i
					}
				}
			})
			ad.openSandbox(element.children[c], arg.app.drawer.opts)
		} else {
			ad.openSandbox(re.elements[element], arg.app.drawer.opts)
		}
		return
	}

	if (urlp.has('gdcbamslice')) {
		const _ = await import('../gdc/bam.js')
		_.bamsliceui({
			genomes: arg.genomes,
			holder: arg.holder,
			debugmode: arg.debugmode,
			stream2download: urlp.has('stream2download') // for testing only, launch the app in "download mode", will not visualize
		})
		return
	}

	if (urlp.has('gdcmaf')) {
		const _ = await import('../gdc/maf.js')
		_.gdcMAFui({
			holder: arg.holder,
			debugmode: arg.debugmode
		})
		return
	}
	if (urlp.has('gdcsinglecell')) {
		const _ = await import('../gdc/singlecell.js')
		_.gdcSinglecellUi({
			holder: arg.holder,
			debugmode: arg.debugmode
		})
		return
	}

	if (urlp.has('termdb')) {
		const value = urlp.get('termdb')
		const state = typeof value === 'string' ? JSON.parse(value) : value
		const opts = {
			holder: arg.holder,
			state
		}
		const _ = await import('../termdb/app')
		_.appInit(opts)
		return
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
			state: {
				genome: genomename,
				dslabel
			}
		}
		if (!opts.genome) throw 'invalid genome'
		const _ = await import('../mass/app')
		_.appInit(opts)
		return
	}

	if (urlp.has('mass')) {
		const value = urlp.get('mass')
		const state = typeof value === 'string' ? JSON.parse(value) : value
		const opts = {
			holder: arg.holder,
			state
		}
		if (state.genome) {
			opts.genome = arg.genomes[state.genome]
		} else if (state?.vocab?.genome) {
			opts.genome = arg.genomes[state.vocab.genome]
		}
		const _ = await import('../mass/app')
		_.appInit(opts)
		return
	}

	if (urlp.has('mass-session-file') || urlp.has('mass-session-url')) {
		let opts
		if (urlp.has('mass-session-file')) {
			const file = urlp.get('mass-session-file')
			const jsonFile = await client.dofetch3(`/textfile`, {
				method: 'POST',
				body: JSON.stringify({ file })
			})
			const state = JSON.parse(jsonFile.text)
			opts = {
				holder: arg.holder,
				state,
				genome: arg.genomes[state.vocab.genome]
			}
		}
		if (urlp.has('mass-session-url')) {
			const url = urlp.get('mass-session-url')
			const jsonURL = await client.dofetch3('/urltextfile', {
				method: 'POST',
				body: JSON.stringify({ url })
			})
			const state = JSON.parse(jsonURL.text)
			opts = {
				holder: arg.holder,
				state,
				genome: arg.genomes[state.vocab.genome]
			}
		}
		const _ = await import('../mass/app')
		_.appInit(opts)
		return
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

				const jwtByDsRouteStr = localStorage.getItem('jwtByDsRoute') || `{}`
				this.jwtByDsRoute = JSON.parse(jwtByDsRouteStr)
				const jwt = this.jwtByDsRoute[dslabel][route]
				fetchOpts.headers.authorization = `Bearer ${btoa(jwt)}`
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
			holder: arg.holder,
			state: res.state,
			genome: arg.genomes[res.state.vocab.genome],
			sessionDaysLeft: res.sessionDaysLeft,
			sessionId: id
		}
		const _ = await import('../mass/app')
		_.appInit(opts)
		return
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

	if (urlp.has('mds3')) {
		// official mds3 dataset; value is comma-joined dslabels
		const lst = urlp.get('mds3').split(',')
		for (const n of lst) {
			const tk = {
				type: client.tkt.mds3,
				dslabel: n
			}
			if (urlp.has('token')) tk.token = urlp.get('token') // temporary
			if (urlp.has('filterobj')) tk.filterObj = urlp.get('filterobj')
			tklst.push(tk)
		}
	}

	if (urlp.has('mds3bcffile')) {
		// "name,path" pairs to server-side vcf files
		const [tkname, bcffile] = urlp.get('mds3bcffile').split(',')
		if (tkname && bcffile) {
			tklst.push({
				type: client.tkt.mds3,
				name: tkname,
				bcf: { file: bcffile }
			})
		}
	}
	if (urlp.has('mds3bcfurl')) {
		// "name,url,indexURL" to remote file. indexURL is optional when the index file is not co-locating with the bcf file
		const [tkname, url, indexURL] = urlp.get('mds3bcfurl').split(',')
		if (tkname && url) {
			tklst.push({
				type: client.tkt.mds3,
				name: tkname,
				bcf: { url, indexURL }
			})
		}
	}

	if (urlp.has('arcfile')) {
		const lst = urlp.get('arcfile').split(',')
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tklst.push({
					type: client.tkt.hicstraw,
					name: lst[i],
					bedfile: lst[i + 1],
					mode_hm: false,
					mode_arc: true
				})
			}
		}
	}

	if (urlp.has('mdsjson') || urlp.has('mdsjsonurl')) {
		const url_str = urlp.get('mdsjsonurl')
		const file_str = urlp.get('mdsjson')
		const tks = await mdsjson.init_mdsjson(file_str, url_str)
		tklst.push(...tks)
	}

	if (urlp.has('tkjsonfile')) {
		const re = await client.dofetch('textfile', { file: urlp.get('tkjsonfile') })
		if (re.error) throw re.error
		if (!re.text) throw '.text missing'
		const lst = JSON.parse(re.text)
		const tracks = []
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
				tklst.push(i)
			}
		}
	}

	if (urlp.has('bamfile')) {
		const lst = urlp.get('bamfile').split(',')
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tklst.push({
					type: client.tkt.bam,
					name: lst[i],
					file: lst[i + 1]
				})
			}
		}
	}
	if (urlp.has('bamurl')) {
		const lst = urlp.get('bamurl').split(',')
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tklst.push({
					type: client.tkt.bam,
					name: lst[i],
					url: lst[i + 1]
				})
			}
		}
	}
	if (urlp.has('bedjfile')) {
		const lst = urlp.get('bedjfile').split(',')
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tklst.push({
					type: client.tkt.bedj,
					name: lst[i],
					file: lst[i + 1]
				})
			}
		}
	}
	if (urlp.has('bedjurl')) {
		const lst = urlp.get('bedjurl').split(',')
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tklst.push({
					type: client.tkt.bedj,
					name: lst[i],
					url: lst[i + 1]
				})
			}
		}
	}
	if (urlp.has('hictkfile') || urlp.has('hictkurl')) {
		// name,enzyme,file/url
		const isfile = urlp.has('hictkfile')
		const lst = urlp.get(isfile ? 'hictkfile' : 'hictkurl').split(',')
		const norm = urlp.has('hictknorm') ? urlp.get('hictknorm').split(',') : null
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
				tklst.push(t)
			}
		}
	}
	if (urlp.has('ldfile')) {
		const lst = urlp.get('ldfile').split(',')
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tklst.push({
					type: client.tkt.ld,
					name: lst[i],
					file: lst[i + 1]
				})
			}
		}
	}
	if (urlp.has('bigwigfile')) {
		const lst = urlp.get('bigwigfile').split(',')
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tklst.push({
					type: client.tkt.bigwig,
					name: lst[i],
					file: lst[i + 1],
					scale: { auto: 1 }
				})
			}
		}
	}
	if (urlp.has('bigwigurl')) {
		const lst = urlp.get('bigwigurl').split(',')
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tklst.push({
					type: client.tkt.bigwig,
					name: lst[i],
					url: lst[i + 1],
					scale: { auto: 1 }
				})
			}
		}
	}
	if (urlp.has('junctionfile')) {
		// legacy
		const lst = urlp.get('junctionfile').split(',')
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tklst.push({
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
	}
	if (urlp.has('junctionurl')) {
		const lst = urlp.get('junctionurl').split(',')
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tklst.push({
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
	}
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
	if (urlp.has('aicheckfile')) {
		const lst = urlp.get('aicheckfile').split(',')
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tklst.push({
					type: 'aicheck',
					name: lst[i],
					file: lst[i + 1]
				})
			}
		}
	}
	if (urlp.has('bampilefile')) {
		const lst = urlp.get('bampilefile').split(',')
		let links = null
		if (urlp.has('bampilelink')) {
			links = urlp.get('bampilelink').split(',').map(decodeURIComponent)
		}
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
				tklst.push(tk)
			}
		}
	}
	if (urlp.has('svcnvfpkmurl')) {
		const lst = urlp.get('svcnvfpkmurl').split(',')
		// defines a single track, all members using url
		const name = lst[0]
		const type2url = {}
		for (let i = 1; i < lst.length; i += 2) {
			type2url[lst[i]] = lst[i + 1]
		}
		if (type2url.svcnv || type2url.vcf) {
			const tk = {
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
			tklst.push(tk)
		}
	}
	if (urlp.has('svcnvfpkmfile')) {
		const lst = urlp.get('svcnvfpkmfile').split(',')
		// defines a single track, all members using file
		const name = lst[0]
		const type2file = {}
		for (let i = 1; i < lst.length; i += 2) {
			type2file[lst[i]] = lst[i + 1]
		}
		if (type2file.svcnv || type2file.vcf) {
			const tk = {
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
			tklst.push(tk)
		}
	}
	if (urlp.has('mdsjunctionfile')) {
		const lst = urlp.get('mdsjunctionfile').split(',')
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tklst.push({
					type: 'mdsjunction',
					name: lst[i],
					file: lst[i + 1]
				})
			}
		}
	}
	if (urlp.has('junctionmatrix')) {
		const lst = urlp.get('junctionmatrix').split(',')
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tklst.push({
					type: 'mdsjunction',
					name: lst[i],
					file2: lst[i + 1] // quick fix to support new file type
				})
			}
		}
	}

	if (urlp.has('junctionrnapeg')) {
		const lst = urlp.get('junctionrnapeg').split(',')
		for (let i = 0; i < lst.length; i += 2) {
			if (lst[i] && lst[i + 1]) {
				tklst.push({
					type: client.tkt.junction,
					name: lst[i],
					tracks: [{ rnapegfile: lst[i + 1] }]
				})
			}
		}
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
