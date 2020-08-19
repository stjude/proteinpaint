import blockinit from './block.init'
import * as client from './client'
import { loadstudycohort } from './tp.init'
import { string2pos } from './coord'

/*
********************** EXPORTED
parse()
url2map()
get_tklst()

*/

export function url2map() {
	const urlp = new Map()
	for (const s of decodeURIComponent(location.search.substr(1)).split('&')) {
		const l = s.split('=')
		if (l.length == 2) {
			let key = l[0].toLowerCase()
			// replace obsolete keys
			if (key == 'p') {
				key = 'gene'
			}
			urlp.set(key, l[1])

			sessionStorage.setItem('urlp_' + key, l[1])
		}
	}
	return urlp
}

export function parse(arg) {
	/*
arg
	.jwt
	.genomes{}
	.hostURL
	.variantPageCall_snv
	.samplecart
	.holder
	.debugmode
*/
	const urlp = url2map()

	if (urlp.has('genome') && arg.selectgenome) {
		const n = urlp.get('genome')
		for (let i = 0; i < arg.selectgenome.node().childNodes.length; i++) {
			if (arg.selectgenome.node().childNodes[i].value == n) {
				arg.selectgenome.property('selectedIndex', i)
				break
			}
		}
	}

	if (urlp.has('singlecell')) {
		if (!urlp.has('genome')) return '"genome" is required for "singlecell"'
		const genomename = urlp.get('genome')
		const genomeobj = arg.genomes[genomename]
		if (!genomeobj) return 'invalid genome: ' + genomename

		client
			.add_scriptTag('/static/js/three.js')
			.then(() => {
				return client.add_scriptTag('/static/js/loaders/PCDLoader.js')
			})
			.then(() => {
				return client.add_scriptTag('/static/js/controls/TrackballControls.js')
			})
			.then(() => {
				return client.add_scriptTag('/static/js/WebGL.js')
			})
			.then(() => {
				return client.add_scriptTag('/static/js/libs/stats.min.js')
			})
			.then(() => {
				import('./singlecell').then(_ => {
					_.init(
						{
							genome: genomeobj,
							jsonfile: urlp.get('singlecell')
						},
						arg.holder
					)
				})
			})
		return
	}

	if (urlp.has('mavbfile')) {
		if (!urlp.has('genome')) return '"genome" is required for "mavb"'
		const genomename = urlp.get('genome')
		const genome = arg.genomes[genomename]
		if (!genome) return 'invalid genome: ' + genomename
		import('./mavb').then(p => {
			p.mavbparseinput(
				{
					genome,
					hostURL: arg.hostURL,
					file: urlp.get('mavbfile')
				},
				() => {},
				arg.holder,
				arg.jwt
			)
		})
		return
	}

	if (urlp.has('mavburl')) {
		if (!urlp.has('genome')) return '"genome" is required for "mavb"'
		const genomename = urlp.get('genome')
		const genome = arg.genomes[genomename]
		if (!genome) return 'invalid genome: ' + genomename
		import('./mavb').then(p => {
			p.mavbparseinput(
				{
					genome,
					hostURL: arg.hostURL,
					url: urlp.get('mavburl')
				},
				() => {},
				arg.holder,
				arg.jwt
			)
		})
		return
	}

	if (urlp.has('block')) {
		if (!urlp.has('genome')) {
			return 'missing genome for block'
		}
		const genomename = urlp.get('genome')
		const genomeobj = arg.genomes[genomename]
		if (!genomeobj) {
			return 'invalid genome: ' + genomename
		}

		const par = {
			nobox: 1,
			hostURL: arg.hostURL,
			jwt: arg.jwt,
			holder: arg.holder,
			genome: arg.genomes[genomename],
			dogtag: genomename,
			allowpopup: true,
			debugmode: arg.debugmode
		}

		let position = null
		let rglst = null
		if (urlp.has('position')) {
			const ll = urlp.get('position').split(/[:-]/)
			const chr = ll[0]
			const start = Number.parseInt(ll[1])
			const stop = Number.parseInt(ll[2])
			if (Number.isNaN(start) || Number.isNaN(stop)) {
				return 'Invalid start/stop value in position'
			}
			position = { chr: chr, start: start, stop: stop }
		}
		if (urlp.has('regions')) {
			// multi
			rglst = []
			for (const s of urlp.get('regions').split(',')) {
				const l = s.split(/[:-]/)
				const chr = l[0]
				const start = Number.parseInt(l[1])
				const stop = Number.parseInt(l[2])
				if (Number.isNaN(start) || Number.isNaN(stop)) {
					return 'Invalid start/stop value in regions'
				}
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

		if (urlp.has('mds')) {
			const tmp = urlp.get('mds').split(',')
			if (tmp[0] && tmp[1]) {
				par.datasetqueries = [{ dataset: tmp[0], querykey: tmp[1] }]
				if (urlp.has('sample')) {
					par.datasetqueries[0].singlesample = { name: urlp.get('sample') }
					// quick fix!!
					// tell  mds_load_query_bykey to load assay tracks in this context, but will not do so if launching sample view from main tk
					par.datasetqueries[0].getsampletrackquickfix = true
				}
			}
		}

		if (urlp.has('mdsjson')) {
			init_mdsjson(urlp, arg, par)
			return
		}

		par.tklst = get_tklst(urlp)

		client.first_genetrack_tolist(arg.genomes[genomename], par.tklst)
		import('./block').then(b => new b.Block(par))
		return
	}

	if (urlp.has('gene')) {
		const str = urlp.get('gene')
		if (str.length == 0) {
			return 'zero length query string'
		}
		let genomename
		for (let n in arg.genomes) {
			if (arg.genomes[n].isdefault) {
				genomename = n
				break
			}
		}
		if (urlp.has('genome')) {
			genomename = urlp.get('genome')
			if (!arg.genomes[genomename]) {
				return 'invalid genome: ' + genomename
			}
		}
		if (!genomename) {
			return 'No genome, and none set as default'
		}
		let ds = null
		if (urlp.has('dataset')) {
			ds = urlp.get('dataset').split(',')
		}
		let hlaa = null
		if (urlp.has('hlaachange')) {
			hlaa = new Map()
			for (const s of urlp.get('hlaachange').split(',')) {
				hlaa.set(s, false)
			}
		}
		blockinit({
			hostURL: arg.hostURL,
			query: str,
			genome: arg.genomes[genomename],
			tklst: get_tklst(urlp),
			holder: arg.holder,
			dataset: ds,
			hlaachange: hlaa,
			variantPageCall_snv: arg.variantPageCall_snv,
			samplecart: arg.samplecart,
			debugmode: arg.debugmode
		})
		return
	}

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
				arg.debugmode
			)
		}
	}
}

async function init_mdsjson(urlp, arg, par) {
	const json_file = urlp.get('mdsjson')
	const genomename = urlp.get('genome')
	const obj = await mdsjson_parse(json_file)
	validate_mdsjson(obj)
	par.tklst = get_json_tklst(obj)

	client.first_genetrack_tolist(arg.genomes[genomename], par.tklst)
	import('./block').then(b => new b.Block(par))
}

async function mdsjson_parse(json_file) {
	if (json_file == '') throw '.jsonfile missing'
	const tmp = await client.dofetch('textfile', { file: json_file })
	if (tmp.error) throw tmp.error
	return JSON.parse(tmp.text)
}

function validate_mdsjson(obj) {
	if (!obj.type) throw 'dataset type is missing'
	const svcnvfile = obj.svcnvfile || obj.svcnvurl
	const vcffile = obj.vcffile || obj.vcfurl
	if (!svcnvfile || !vcffile) throw 'vcf or cnv file/url is required'
	if (Object.keys(obj).filter(x => x.includes('expression')).length) {
		if (!obj.expressionfile && !obj.expressionurl) throw 'expression file/url is missing'
	}
	if (Object.keys(obj).filter(x => x.includes('rnabam')).length) {
		if (!obj.rnabamfile && !obj.rnabamurl) throw 'rnabam file/url is missing'
	}
	if (obj.sampleset) {
		for (const sample of obj.sampleset) {
			if (!sample.name) throw 'sampleset name is missing'
			if (!sample.samples) throw 'sampleset samples[] is missing'
		}
	}
	if (obj.sample2assaytrack) {
		for (const [sample, assaylst] of Object.entries(obj.sample2assaytrack)) {
			if (!assaylst.length) throw 'assay[] missing for ' + sample
			for (const assay of assaylst) {
				if (!assay.name) throw 'assay name is missing for ' + sample
				if (!assay.type) throw 'assay type is missing for ' + sample
			}
		}
	}
}

function get_json_tklst(tkobj) {
	const tklst = []
	const track = {
		type: tkobj.type,
		name: tkobj.name
	}

	//svcnv file
	if (tkobj.svcnvfile) track.file = tkobj.svcnvfile
	else if (tkobj.svcnvurl) track.url = tkobj.svcnvurl

	// expressionrank
	if (Object.keys(tkobj).filter(x => x.includes('expression')).length) {
		track.checkexpressionrank = {
			file: tkobj.expressionfile,
			url: tkobj.expressionurl
		}
	}

	// vcf
	if (Object.keys(tkobj).filter(x => x.includes('vcf')).length) {
		track.checkvcf = {
			file: tkobj.vcffile,
			url: tkobj.vcfurl
		}
	}

	// rna bam
	if (Object.keys(tkobj).filter(x => x.includes('rnabam')).length) {
		track.checkrnabam = {
			file: tkobj.rnabamfile,
			url: tkobj.rnabamurl
		}
	}

	// sampleset
	if (tkobj.sampleset) {
		track.sampleset = tkobj.sampleset
	}

	// SampleAssayTrack
	if (tkobj.sample2assaytrack) {
		track.sample2assaytrack = tkobj.sample2assaytrack
	}
	tklst.push(track)
	return tklst
}

export function get_tklst(urlp) {
	const tklst = []
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
			links = urlp
				.get('bampilelink')
				.split(',')
				.map(decodeURIComponent)
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
	for (const t of tklst) {
		t.iscustom = true
	}
	return tklst
}
