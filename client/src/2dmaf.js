import { select as d3select } from 'd3-selection'
import * as client from './client'
import { scaleLinear } from 'd3-scale'
import { axisLeft, axisTop, axisBottom } from 'd3-axis'
import { format as d3format } from 'd3-format'
import {
	symbol,
	symbolCircle,
	symbolCross,
	symbolDiamond,
	symbolSquare,
	symbolStar,
	symbolTriangle,
	symbolWye
} from 'd3-shape'
import * as common from '#shared/common.js'
import Anchors from './2dmaf.anchors'
import { renderSandboxFormDiv } from '../dom/sandbox.ts'

/*
input file/data is 2dmaf format of 1 pair or multiple pairs

make a 2dmaf plot for each pair

*/

const color1 = '#f9766c'
const color2 = '#609cff'
const colorshare = '#01b937'
const symbols = {
	circle: symbolCircle,
	cross: symbolCross,
	diamond: symbolDiamond,
	square: symbolSquare,
	star: symbolStar,
	triangle: symbolTriangle,
	wye: symbolWye
}
// for selecting what tagName to use when appending
// needed for now until the issue with selection.append([function]) is figured out
const symbolFilters = {
	path: d => d.symbol,
	circle: d => !d.symbol
}
const sharedFilters = {
	path: d => d.symbol,
	ellipse: d => !d.symbol
}

export function d2mafui(genomes, holder) {
	let pane, inputdiv, gselect, filediv, saydiv, visualdiv
	if (holder !== undefined) [inputdiv, gselect, filediv, saydiv, visualdiv] = renderSandboxFormDiv(holder, genomes)
	else {
		;[pane, inputdiv, gselect, filediv, saydiv, visualdiv] = client.newpane3(100, 100, genomes)
		pane.header.text('2DMAF: mutant allele fraction plot between a pair of samples')
		pane.body.style('margin', '10px')
	}
	inputdiv
		.append('div')
		.style('margin-top', '20px')
		.html(
			'<ul>' +
				'<li><a href="https://docs.google.com/document/d/1anyEDMcW1lTSf8399Li2G9r57V-Fqp2591WvoODY7n4/edit#heading=h.mne2ecmp9m13" target=_blank>File format</a></li>' +
				'<li>To define samples differently than "Diagnosis/Relapse", <a href=https://plus.google.com/+XinZhou_s/posts/WqBVvmd3wYR target=_blank>see how</a>.</li>' +
				'</ul>'
		)
	inputdiv
		.append('p')
		.html('<a href=https://proteinpaint.stjude.org/ppdemo/hg19/2dmaf/2dmaf.txt target=_blank>Example file</a>')
	function cmt(t, red) {
		saydiv.style('color', red ? 'red' : 'black').html(t)
	}
	const fileui = () => {
		filediv.selectAll('*').remove()
		const input = filediv
			.append('input')
			.attr('type', 'file')
			.on('change', event => {
				const file = event.target.files[0]
				if (!file) {
					fileui()
					return
				}
				if (!file.size) {
					cmt('Invalid file ' + file.name)
					fileui()
					return
				}
				const reader = new FileReader()
				reader.onload = event => {
					const usegenome = gselect.options[gselect.selectedIndex].innerHTML
					const err = parseraw(event.target.result.trim().split(/\r?\n/), genomes[usegenome], file.name, visualdiv)
					if (err) {
						cmt(err, 1)
						fileui()
						return
					}
					// success
					inputdiv.remove()
					filediv.remove()
					saydiv.remove()
				}
				reader.onerror = function () {
					cmt('Error reading file ' + file.name, 1)
					fileui()
					return
				}
				reader.readAsText(file, 'utf8')
			})

		setTimeout(() => input.node().focus(), 1100)
	}
	fileui()
}

export function d2mafparseinput(obj, holder) {
	/*
	obj
	.genome
	.hostURL
	.datasetname
	.input TEXt
	*/
	if (!obj.genome) {
		client.sayerror(holder, '.genome missing for 2dmaf')
		return
	}
	if (!obj.input) {
		client.sayerror(holder, '.input missing for 2dmaf')
		return
	}
	const err = parseraw(obj.input.trim().split(/\r?\n/), obj.genome, obj.datasetname || 'unnamed dataset', holder)
	if (err) {
		client.sayerror(holder, '2DMAF data error: ' + err)
	}
}

function parseraw(lines, genome, filename, holder) {
	const [headererror, header, headerattrlst] = parseheader(lines[0].trim())
	if (headererror) {
		return headererror
	}

	const pairs = {}
	// key: pair name, val: {}

	const g2mlst = {} // for dataset

	const peoplehash = {}

	const genehash = {}

	const flag = {
		good: 0,
		purity1set: false,
		purity2set: false,
		pairsetname: {}
	}
	const badlines = []

	const mclasslabel2key = {}
	for (const k in common.mclass) {
		mclasslabel2key[common.mclass[k].label.toUpperCase()] = k
	}

	for (let i = 1; i < lines.length; i++) {
		if (lines[i] == '') continue
		if (lines[i][0] == '#') {
			if (lines[i].startsWith('##samplename')) {
				const l = lines[i].trim().split(/[\s\t]+/)
				if (l.length == 4) {
					flag.pairsetname[l[1]] = { 1: l[2], 2: l[3] }
				} else {
					return 'Line ' + (i + 1) + ': invalid samplename line: must be "##samplename [patient] [sample1] [sample2]"'
				}
			}
			continue
		}
		const lst = lines[i].trim().split('\t')
		const m = {}
		for (let j = 0; j < header.length; j++) {
			if (lst[j] != undefined && lst[j] != '') {
				m[header[j]] = lst[j]
			}
		}
		if (!m.sample) {
			return 'Line ' + (i + 1) + ': missing sample'
		}
		if (m.chr) {
			if (m.chr.indexOf('chr') != 0) {
				m.chr = 'chr' + m.chr
			}
		}
		if (m.chrstart) {
			m.chrstart = Number.parseInt(m.chrstart)
			if (Number.isNaN(m.chrstart)) {
				return 'Line ' + (i + 1) + ': invalid chromosome position'
			}
		}
		if (m.Dcnvloh) {
			m.Dcnvlohraw = m.Dcnvloh
			const s = m.Dcnvloh.toLowerCase()
			if (s == 'yes' || (s != 'diploid' && s != 'haploid')) {
				m.Dcnvloh = true
			} else {
				m.Dcnvloh = false
			}
		}
		if (m.Rcnvloh) {
			m.Rcnvlohraw = m.Rcnvloh
			const s = m.Rcnvloh.toLowerCase()
			if (s == 'yes' || (s != 'diploid' && s != 'haploid')) {
				m.Rcnvloh = true
			} else {
				m.Rcnvloh = false
			}
		}
		// set
		if (!m.call_d) {
			badlines.push([i, 'missing call_d', lst])
			continue
		}
		if (m.call_d != 'somatic' && m.call_d != 'wildtype') {
			badlines.push([i, 'call_d is neither somatic nor wildtype', lst])
			continue
		}
		if (!m.call_r) {
			badlines.push([i, 'missing call_r', lst])
			continue
		}
		if (m.call_r != 'somatic' && m.call_r != 'wildtype') {
			badlines.push([i, 'call_r is neither somatic nor wildtype', lst])
			continue
		}
		if (m.call_d == 'somatic') {
			if (m.call_r == 'somatic') {
				m.set_share = true
			} else {
				m.set_1 = true
			}
		} else {
			if (m.call_r == 'somatic') {
				m.set_2 = true
			}
		}
		// type
		if (!m.type) {
			badlines.push([i, 'missing type', lst])
			continue
		}
		const s = m.type.toLowerCase()
		if (s == 'snv' || s == 'snp' || s == 'mnv' || s == 'complex') {
			m.issnv = true
		} else if (s == 'indel' || s == 'ins' || s == 'del') {
			m.isindel = true
		} else {
			badlines.push([i, 'type must be either SNV or INDEL', lst])
			continue
		}
		// numbers

		// required: MinD.D TinD.D
		let key = 'MinD.D'
		let a = Number.parseInt(m[key])
		if (Number.isNaN(a) || a < 0) {
			badlines.push([i, 'invalid ' + key + ' value', lst])
			continue
		}
		m[key] = a

		key = 'TinD.D'
		a = Number.parseInt(m[key])
		if (Number.isNaN(a) || a < 0) {
			badlines.push([i, 'invalid ' + key + ' value', lst])
			continue
		}
		m[key] = a

		if (m['TinD.D'] < m['MinD.D']) {
			badlines.push([i, 'TinD.D value lower than MinD.D', lst])
			continue
		}

		// optional
		key = 'MinN.D'
		if (key in m) {
			a = Number.parseInt(m[key])
			if (Number.isNaN(a) || a < 0) {
				delete m[key]
			} else {
				m[key] = a
			}
		}
		key = 'TinN.D'
		if (key in m) {
			a = Number.parseInt(m[key])
			if (Number.isNaN(a) || a < 0) {
				delete m[key]
			} else {
				m[key] = a
			}
		}

		// required: MinD.R, TinD.R
		key = 'MinD.R'
		a = Number.parseInt(m[key])
		if (Number.isNaN(a) || a < 0) {
			badlines.push([i, 'invalid ' + key + ' value', lst])
			continue
		}
		m[key] = a
		key = 'TinD.R'
		a = Number.parseInt(m[key])
		if (Number.isNaN(a) || a < 0) {
			badlines.push([i, 'invalid ' + key + ' value', lst])
			continue
		}
		m[key] = a

		if (m['TinD.R'] < m['MinD.R']) {
			badlines.push([i, 'TinD.R value lower than MinD.R', lst])
			continue
		}

		// optional
		key = 'MinN.R'
		if (key in m) {
			a = Number.parseInt(m[key])
			if (Number.isNaN(a) || a < 0) {
				delete m[key]
			} else {
				m[key] = a
			}
		}
		key = 'TinN.R'
		if (key in m) {
			a = Number.parseInt(m[key])
			if (Number.isNaN(a) || a < 0) {
				delete m[key]
			} else {
				m[key] = a
			}
		}

		if (m.symbol) {
			if (!symbols[m.symbol]) {
				badlines.push([i, "Invalid symbol value='" + m.symbol + "'", lst])
				continue
			}
		}

		if (m.class) {
			const s = m.class.toUpperCase()
			if (s in mclasslabel2key) {
				m.class = mclasslabel2key[s]
			} else {
				badlines.push([i, 'invalid mutation class ' + m.class, lst])
				continue
			}
		}
		// style
		m.style = {
			fill: m.issnv ? 'white' : 'black',
			fillhl: m.class ? common.mclass[m.class].color : '#ccc',
			stroke: m.chr == 'chrX' ? 'black' : m.issnv ? 'black' : 'none',
			strokehl: m.class ? common.mclass[m.class].color : 'black',
			fillopacity: m.issnv ? 0 : 0.2,
			strokeopacity: 0.2
		}

		if (m['TinD.D'] > 0) {
			m.maf1 = m['MinD.D'] / m['TinD.D']
		}
		if (m['TinD.R'] > 0) {
			m.maf2 = m['MinD.R'] / m['TinD.R']
		}

		// good mutation

		peoplehash[m.sample] = 1
		if (m.gene) {
			genehash[m.gene] = 1
		}
		if (!(m.sample in pairs)) {
			pairs[m.sample] = {
				name: m.sample,
				shown: false,
				header: header,
				mlst: []
			}
		}

		const v = pairs[m.sample]
		v.mlst.push(m)

		// tumor purity may be present in every line, need to be consistant across entire sample
		if (m.purity1) {
			let p = Number.parseFloat(m.purity1)
			if (Number.isNaN(p)) {
				badlines.push([i, 'diagnosis tumor purity should be a number'])
				p = 0
			} else {
				if (p > 1) {
					p /= 100
				}
			}
			if (p > 0) {
				// valid purity
				if (v.purity1 == undefined) {
					v.purity1 = p
					flag.purity1set = true
				} else if (v.purity1 != p) {
					badlines.push([
						i,
						'diagnosis tumor purity value ' + p + ' is different from existing value ' + v.purity1 + ' in ' + m.sample,
						lst
					])
				}
			}
		}
		if (m.purity2) {
			let p = Number.parseFloat(m.purity2)
			if (Number.isNaN(p)) {
				badlines.push([i, 'relapse tumor purity should be a number'])
				p = 0
			} else {
				if (p > 1) {
					p /= 100
				}
			}
			if (p > 0) {
				// valid purity
				if (v.purity2 == undefined) {
					v.purity2 = p
					flag.purity2set = true
				} else if (v.purity2 != p) {
					badlines.push([
						i,
						'relapse tumor purity value ' + p + ' is different from existing value ' + v.purity2 + ' in ' + m.sample,
						lst
					])
				}
			}
		}

		flag.good++

		/*
		if(m.gene) {
			// bulkdata register
			var _gn=m.gene.toUpperCase()
			if(!(_gn in g2mlst)) {
				g2mlst[_gn]=[]
			}
			if(m.call_d=='somatic') {
				var m2={}
				for(var k in m) {
					m2[k]=m[k]
				}
				m2.sample=m.sample+'.D'
				m2.origin='S'
				m2.dt=sja.dtsnvindel
				m2.maf_diagnosis={v1:m['MinD.D'],v2:m['TinD.D'],f:m.maf1}
				if('MinN.D' in m) {
					m2.maf_diagnosis_normal={v1:m['MinN.D'],v2:m['TinN.D'],f:m['MinN.D']/m['TinN.D']}
				}
				g2mlst[_gn].push(m2)
			}
			if(m.call_r=='somatic') {
				var m2={}
				for(var k in m) {
					m2[k]=m[k]
				}
				m2.sample=m.sample+'.R'
				m2.origin='R'
				m2.dt=sja.dtsnvindel
				m2.maf_relapse={v1:m['MinD.R'],v2:m['TinD.R'],f:m.maf2}
				if('MinN.D' in m) {
					m2.maf_relapse_normal={v1:m['MinN.D'],v2:m['TinN.D'],f:m['MinN.D']/m['TinN.D']}
				}
				g2mlst[_gn].push(m2)
			}
		}
		*/
	}
	// done iterating
	if (badlines.length > 0) {
		client.bulk_badline(header, badlines)
	}
	if (flag.good == 0) {
		return 'No valid data.'
	}

	// good data ready
	holder.append('p').text('File: ' + filename)

	/*
	no dataset

	// register in dataset
	var dsname=thisfile.name;
	if(dsname in sja.datasets) {
		// name already used
		dsname='user: '+dsname;
		if(dsname in sja.datasets) {
			var j=1;
			var n2=dsname+' '+j;
			while(n2 in sja.datasets) {
				j++;
				n2=dsname+' '+j;
			}
		}
	}

	var s=gselect[0][0]
	var usegenome=s.options[s.selectedIndex].innerHTML
	var hassample=header.indexOf('sample')!=-1
	sja.datasets[dsname]={
		genome:usegenome,
		shortlabel:dsname,
		bulkdata:g2mlst,
		header:header,
		mbygmcoord:true,
		sample_attributes:hparse.atlst,
		hassample:hassample
		}
	*/

	// people and gene total number
	let peopletotal = 0
	for (const n in peoplehash) peopletotal++
	let genetotal = 0
	for (const n in genehash) genetotal++

	const boxh = 16
	const table = holder.append('table')

	const tr = table.append('tr')
	const td = tr.append('td').attr('valign', 'top')
	td.append('div').html(
		'<div style="display:inline-block;width:' +
			boxh +
			'px;height:' +
			boxh +
			'px;background-color:' +
			color1 +
			'"></div> Diagnosis only ' +
			'<div style="display:inline-block;width:' +
			boxh +
			'px;height:' +
			boxh +
			'px;background-color:' +
			colorshare +
			'"></div> Shared ' +
			'<div style="display:inline-block;width:' +
			boxh +
			'px;height:' +
			boxh +
			'px;background-color:' +
			color2 +
			'"></div> Relapse only'
	)
	const peopleholder = td
		.append('div')
		.style('margin-top', '10px')
		.style('height', '200px')
		.style('width', '300px')
		.style('padding', '5px')
		.style('overflow-y', 'scroll')
		.style('resize', 'both')
		.style('border', 'solid 1px #ccc')

	const geneholder = td
		.append('div')
		.style('margin-top', '10px')
		.style('height', '200px')
		.style('width', '300px')
		.style('padding', '5px')
		.style('overflow-y', 'scroll')
		.style('resize', 'both')
		.style('border', 'solid 1px #ccc')

	const showholder = tr.append('td').style('vertical-align', 'top')

	for (const n in pairs) {
		const ss = flag.pairsetname[n]
		if (ss) {
			pairs[n].setname = ss
		} else {
			pairs[n].setname = { 1: 'Diagnosis', 2: 'Relapse' }
		}
	}

	const odata = {
		genome: genome,
		//dsname:dsname,
		pairs: pairs,
		color1: color1,
		color2: color2,
		colorshare: colorshare,
		rowh: boxh,
		peoplewidth: 150,
		genewidth: 150,
		showholder: showholder,
		//peoplelimit:Math.min(20,peopletotal),
		genelimit: Math.min(20, genetotal),
		purity1set: flag.purity1set,
		purity2set: flag.purity2set
	}

	d2maf_peopletable(odata, peopleholder)

	//d2maf_genetable(odata)
}

function parseheader(line) {
	const lower = line.toLowerCase().split('\t')
	const header = line.split('\t')
	if (header.length <= 1) {
		return ['invalid file header']
	}
	const htry = (...lst) => {
		for (const i of lst) {
			const j = lower.indexOf(i)
			if (j != -1) return j
		}
		return -1
	}

	let i = htry('person', 'sample', 'samplename', 'patient')
	if (i == -1) return ['sample missing from header']
	header[i] = 'sample'

	i = htry('type')
	if (i == -1) return ['type missing from header']
	header[i] = 'type'

	i = htry('mind.d1_g1', 'mind.d', 'mind')
	if (i == -1) return ['MinD.D missing from header']
	header[i] = 'MinD.D'

	i = htry('tind.d1_g1', 'tind.d', 'tind')
	if (i == -1) return ['TinD.D missing from header']
	header[i] = 'TinD.D'

	i = htry('mind.r1_g1', 'mind.r', 'minr')
	if (i == -1) return ['MinD.R missing from header']
	header[i] = 'MinD.R'

	i = htry('tind.r1_g1', 'tind.r', 'tinr')
	if (i == -1) return ['TinD.R missing from header']
	header[i] = 'TinD.R'

	i = htry('call_d1_g1', 'call_d')
	if (i == -1) return ['call_d missing from header']
	header[i] = 'call_d'

	i = htry('call_r1_g1', 'call_r')
	if (i == -1) return ['call_r missing from header']
	header[i] = 'call_r'

	i = htry('genename', 'gene')
	if (i == -1) return ['gene missing from header']
	header[i] = 'gene'

	i = htry('amino_acid_change', 'annovar_sj_aachange', 'aachange', 'protein_change')
	if (i == -1) return ['amino_acid_change missing from header']
	header[i] = 'mname'

	i = htry('class', 'mclass', 'variant_class', 'variant_classification', 'annovar_sj_class')
	if (i == -1) return ['variant_class missing from header']
	header[i] = 'class'

	i = htry('chromosome', 'chr')
	if (i == -1) return ['chromosome missing from header']
	header[i] = 'chr'

	i = htry('start', 'start_position', 'wu_hg19_pos', 'chr_position')
	if (i == -1) return ['start missing from header']
	header[i] = 'chrstart'

	// optional
	i = htry('minn.d1_g1', 'minn.d')
	if (i != -1) header[i] = 'MinN.D'
	i = htry('tinn.d1_g1', 'tinn.d')
	if (i != -1) header[i] = 'TinN.D'
	i = htry('minn.r1_g1', 'minn.r')
	if (i != -1) header[i] = 'MinN.R'
	i = htry('tinn.r1_g1', 'tinn.r')
	if (i != -1) header[i] = 'TinN.R'

	i = htry('mrna_accession', 'refseq_mrna_id', 'annovar_sj_filter_isoform', 'refseq')
	if (i != -1) header[i] = 'isoform'
	i = htry('primary_purity', 'purity_d')
	if (i != -1) header[i] = 'purity1'
	i = htry('relapse_purity', 'purity_r')
	if (i != -1) header[i] = 'purity2'
	i = htry('tag_d_cnvloh', 'cnvloh_d')
	if (i != -1) header[i] = 'Dcnvloh'
	i = htry('tag_r_cnvloh', 'cnvloh_r')
	if (i != -1) header[i] = 'Rcnvloh'

	const atlst = []
	for (const j of header) {
		switch (j) {
			case 'Dcnvloh':
				atlst.push({
					label: 'D. CNV/LOH',
					get: m => m.Dcnvlohraw
				})
				break
			case 'Rcnvloh':
				atlst.push({
					label: 'R. CNV/LOH',
					get: m => m.Rcnvlohraw
				})
				break
			case 'type':
				atlst.push({
					label: 'Type',
					get: m => m.type
				})
				break
			case 'chr':
				break
			case 'chrstart':
				atlst.push({
					label: 'Genome Loc.',
					get: m => m.chr + ':' + (m.chrstart + 1)
				})
				break
			case 'class':
				atlst.push({
					label: 'Class',
					get: m => {
						if (m.class == common.mclassnonstandard) {
							return m.originalclasslabel ? m.originalclasslabel : common.mclass[m.class].label
						}
						return common.mclass[m.class].label
					}
				})
				break
			case 'mname':
				atlst.push({
					label: 'Mutation',
					get: m => {
						let s = m.mname
						if (!s) s = m.cdna_change
						return s
					}
				})
				break
			case 'MinD.D':
				atlst.push({
					ismaf: true,
					width: 60,
					height: 14,
					readcountcredible: 30,
					get: m => m.maf_diagnosis,
					label: 'D. tumor MAF',
					fill: '#F7483B',
					fillbg: '#FCBAB6'
				})
				break
			case 'TinD.D':
				break
			case 'MinD.R':
				atlst.push({
					ismaf: true,
					width: 60,
					height: 14,
					readcountcredible: 30,
					get: m => m.maf_relapse,
					label: 'R. tumor MAF',
					fill: '#146EFF',
					fillbg: '#B6D5FC'
				})
				break
			case 'TinD.R':
				break
			case 'MinN.D':
				atlst.push({
					ismaf: true,
					width: 60,
					height: 14,
					readcountcredible: 30,
					get: m => m.maf_diagnosis_normal,
					label: 'D. normal MAF',
					fill: '#F7483B',
					fillbg: '#FCBAB6'
				})
				break
			case 'TinN.D':
				break
			case 'MinN.R':
				atlst.push({
					ismaf: true,
					width: 60,
					height: 14,
					readcountcredible: 30,
					get: m => m.maf_relapse_normal,
					label: 'R. normal MAF',
					fill: '#146EFF',
					fillbg: '#B6D5FC'
				})
				break
			case 'TinN.R':
				break
			case 'call_d':
				atlst.push({
					label: 'D. call',
					get: m => m.call_d
				})
				break
			case 'call_r':
				atlst.push({
					label: 'R. call',
					get: m => m.call_r
				})
				break
			case 'purity1':
				atlst.push({
					label: 'D. purity',
					get: m => m.purity1
				})
				break
			case 'purity2':
				atlst.push({
					label: 'R. purity',
					get: m => m.purity2
				})
				break
			default:
				atlst.push({
					label: j,
					get: m => m[j]
				})
		}
	}
	return [null, header, atlst]
}

function d2maf_render(showholder, pdata) {
	const tooltip = new client.Menu({ border: 'solid 1px black' })

	const set_1 = []
	const set_2 = []
	const set_share = []
	const mlst = pdata.mlst
	const person = mlst[0].sample
	const symbolgen = symbol()

	let maxtotal = 0
	let bysymbol = {}
	const mclasses = {}
	for (const m of mlst) {
		if (m['TinD.D'] > 0) {
			maxtotal = Math.max(maxtotal, m['TinD.D'])
		}
		if (m['TinD.R'] > 0) {
			maxtotal = Math.max(maxtotal, m['TinD.R'])
		}
		if (m.set_share) {
			set_share.push(m)
		} else if (m.set_1) {
			set_1.push(m)
		} else if (m.set_2) {
			set_2.push(m)
		}
		if (!(m.class in mclasses)) {
			mclasses[m.class] = 0
		}
		if (m.symbol) {
			if (!bysymbol[m.symbol]) {
				bysymbol[m.symbol] = { numlines: 0, label: m.symbollabel, hidden: false }
			}
			bysymbol[m.symbol].numlines++
		}
		mclasses[m.class]++
	}

	const a = Math.min(window.innerWidth, window.innerHeight)

	const axiswidth = 50,
		sharewidth = a * 0.5,
		shareheight = a * 0.5,
		sample1height = shareheight / 2,
		sample2height = sharewidth / 2,
		sp = axiswidth / 3,
		sp2 = sample1height / 5,
		labelfontsize = Math.min(20, (12 * a) / 500),
		radius = a / 40,
		indelboxw = radius * 0.7,
		r_cnvloh = 3

	const radiusscale = scaleLinear()
		.domain([0, maxtotal])
		.range([radius / 2, radius])
	const radiustoarea = d => Math.PI * Math.pow(radiusscale(d), 2)

	for (const m of mlst) {
		// for creating dot label upon pushing button
		m.radius = Math.max(m['TinD.D'] ? radiusscale(m['TinD.D']) : 0, m['TinD.R'] ? radiusscale(m['TinD.R']) : 0)
	}

	// holder
	const outtable = showholder.append('table')
	const tr = outtable.append('tr')
	const tdgraph = tr.append('td').style('vertical-align', 'top')
	const tdgenetable = tr.append('td').style('vertical-align', 'top')
	tdgenetable
		.append('div')
		.style('margin', '10px')
		.text('Name: ' + person)

	// controls
	const headerdiv = tdgraph.append('div')

	headerdiv
		.append('button')
		.text('Hide')
		.on('click', () => {
			pdata.shown = false
			if (pdata.handle) {
				pdata.handle.attr('font-weight', 'normal')
			}
			outtable.remove()
		})

	const anchors = new Anchors({ axiswidth, sp, sp2, sample1height, sample2height, shareheight, sharewidth, headerdiv })

	headerdiv
		.append('button')
		.text('Screenshot')
		.on('click', () => {
			client.to_svg(svg.node(), '2dmaf_' + pdata.name)
		})

	{
		// mclass filter
		const mcselect = headerdiv.append('select').on('change', event => {
			const v = event.target.options[event.target.selectedIndex].value
			if (v == 'all') {
				select_share.transition().attr('transform', d => d.posstring + ' scale(1)')
				select_set1.transition().attr('transform', d => d.posstring + ' scale(1)')
				select_set2.transition().attr('transform', d => d.posstring + ' scale(1)')
				return
			}
			select_share.transition().attr('transform', d => d.posstring + ' scale(' + (d.class == v ? 1 : 0) + ')')
			select_set1.transition().attr('transform', d => d.posstring + ' scale(' + (d.class == v ? 1 : 0) + ')')
			select_set2.transition().attr('transform', d => d.posstring + ' scale(' + (d.class == v ? 1 : 0) + ')')
		})
		mcselect.append('option').text('Show all mutation classes').property('value', 'all')
		const lst = []
		for (const c in mclasses) {
			lst.push([c, mclasses[c]])
		}
		lst.sort((a, b) => b[1] - a[1])
		for (const i of lst) {
			mcselect
				.append('option')
				.text((i[0] in common.mclass ? common.mclass[i[0]].label : i[0]) + ' (' + i[1] + ')')
				.property('value', i[0])
		}
	}

	/*
if(pdata.purity1!=undefined) {
	headerdiv.append('span').html('&nbsp;Diagnosis expected MAF&nbsp;')
	const select=headerdiv.append('select')
	select.append('option').text('off').property('value','off')
	select.append('option').text('diploid').property('value','diploid')
	select.append('option').text('1-copy loss').property('value','loss')
	select.append('option').text('copy-neutral LOH').property('value','cnloh')
	select.on('change',(event)=>{
		const v=event.target.options[event.target.selectedIndex].value
		if(v=='off') {
			emafline_1.transition().duration(1000).attr('fill-opacity',0)
			return
		}
		let x
		if(v=='diploid') {
			x=pdata.purity1/2
		} else if(v=='loss') {
			x=pdata.purity1/(2-pdata.purity1)
		} else {
			x=pdata.purity1
		}
		emafline_1.transition().duration(1000)
			.attr('fill-opacity',1)
			.attr('x',x*sharewidth)
	})
}
if(pdata.purity2!=undefined) {
	headerdiv.append($('<span>').html('&nbsp;Relapse expected MAF&nbsp;'))
	.append($('<select>')
		.append($('<option>').text('off').attr('value','off'))
		.append($('<option>').text('diploid').attr('value','diploid'))
		.append($('<option>').text('1-copy loss').attr('value','loss'))
		.append($('<option>').text('copy-neutral LOH').attr('value','cnloh'))
		.on('change',function(e){
			var v=e.target.options[e.target.selectedIndex].value
			if(v=='off') {
				emafline_2.transition().duration(1000).attr('fill-opacity',0)
				return
			}
			var x
			if(v=='diploid') {
				x=pdata.purity2/2
			} else if(v=='loss') {
				x=pdata.purity2/(2-pdata.purity2)
			} else {
				x=pdata.purity2
			}
			emafline_2.transition().duration(1000)
				.attr('fill-opacity',1)
				.attr('y',(1-x)*shareheight)
		})
	)
}
*/

	const svg = tdgraph
		.append('svg')
		.attr('width', axiswidth + sp + sample2height + sharewidth + sp * 2)
		.attr('height', axiswidth + sp + sample1height + shareheight + sp * 2)
	const g = svg.append('g').attr('transform', 'translate(' + sp + ',' + sp + ')')

	anchors.setWrapper(g.append('g'))

	// axis 1 (horizontal)
	const scale1 = scaleLinear().domain([0, 1]).range([0, sharewidth])
	const scalediv1 = g
		.append('g')
		.attr('transform', 'translate(' + (axiswidth + sp + sample2height) + ',' + (shareheight + sample1height + sp) + ')')
		.call(axisBottom().scale(scale1).tickSize(5))
	client.axisstyle({ axis: scalediv1, showline: true, fontsize: labelfontsize * 0.8 })

	// axis 1 label
	const c = set_1.length + set_share.length
	scalediv1
		.append('text')
		.text(pdata.setname[1] + ', n=' + c + (pdata.purity1 ? ', purity=' + pdata.purity1 : ''))
		.attr('x', sharewidth / 2)
		.attr('y', axiswidth - 4)
		.attr('text-anchor', 'middle')
		.attr('font-size', labelfontsize)

	// axis 2 (vertical)
	const scale2 = scaleLinear().domain([0, 1]).range([shareheight, 0])
	const scalediv2 = g
		.append('g')
		.attr('transform', 'translate(' + axiswidth + ',0)')
		.call(axisLeft().scale(scale2).tickSize(5))
	client.axisstyle({ axis: scalediv2, showline: true, fontsize: labelfontsize * 0.8 })

	// axis 2 label
	const c2 = set_2.length + set_share.length
	scalediv2
		.append('text')
		.text(pdata.setname[2] + ', n=' + c2 + (pdata.purity2 ? ', purity=' + pdata.purity2 : ''))
		.attr('transform', 'translate(' + (labelfontsize - axiswidth - 10) + ',' + shareheight / 2 + ') rotate(-90)')
		.attr('text-anchor', 'middle')
		.attr('font-size', labelfontsize)

	// border
	g.append('path')
		.attr(
			'd',
			'M' +
				(axiswidth + sp) +
				',0' +
				'h' +
				(sample2height + sharewidth) +
				'v' +
				(shareheight + sample1height) +
				'h-' +
				sharewidth +
				'v-' +
				(sample1height + shareheight) +
				'M' +
				(axiswidth + sp) +
				',0' +
				'v' +
				shareheight +
				'h' +
				(sample2height + sharewidth) +
				'M' +
				(axiswidth + sp + sample2height) +
				',' +
				shareheight +
				'l' +
				sharewidth +
				',-' +
				shareheight
		)
		.attr('fill', 'none')
		.attr('stroke', 'black')
		.attr('shape-rendering', 'crispEdges')
		.attr('stroke-dasharray', '5,5')

	// set share
	const select_share = g
		.append('g')
		.attr('transform', 'translate(' + (axiswidth + sp + sample2height) + ',0)')
		.selectAll()
		.data(set_share)
		.enter()
		.append('g')
		.attr('transform', d => {
			d.posstring = 'translate(' + scale1(d.maf1) + ',' + scale2(d.maf2) + ')'
			return d.posstring
		})

	// set share - cnv loh
	select_share
		.filter(d => d.Dcnvloh)
		.append('circle')
		.attr('cy', d => {
			return d.issnv ? radiusscale(d['TinD.R']) : indelboxw / 2
		})
		.attr('fill', '#858585')
		.attr('r', r_cnvloh)
	select_share
		.filter(d => d.Rcnvloh)
		.append('circle')
		.attr('cx', d => {
			return d.issnv ? -radiusscale(d['TinD.D']) : -indelboxw / 2
		})
		.attr('fill', '#858585')
		.attr('r', r_cnvloh)

	// set share - snv
	let snv = select_share
	//.filter(function(d){return d.issnv})

	// not sure why this documented option to supply a function to append is not working
	// snv.append(function(d){return document.createElement(1 || d.symbol ? 'path' : 'circle')})
	// ... do this instead for now
	for (const tagName in sharedFilters) {
		snv
			.filter(sharedFilters[tagName])
			.append(tagName)
			.attr('rx', d => (d.symbol ? null : radiusscale(d['TinD.D'])))
			.attr('ry', d => (d.symbol ? null : radiusscale(d['TinD.R'])))
			.attr('d', d =>
				!d.symbol
					? null
					: symbolgen.type(symbols[d.symbol]).size(radiustoarea(d['TinD.D']) + radiustoarea(d['TinD.R']) / 2)()
			)
			.attr('fill', d => d.style.fill)
			.attr('fill-opacity', d => d.style.fillopacity)
			.attr('stroke', d => d.style.stroke)
			.attr('stroke-opacity', d => d.style.strokeopacity)
			.attr('stroke-dasharray', d => (d.chr == 'chrX' ? '5,5' : 'none'))
			.on('mouseover', (event, d) => d2maf_dotmover(event, d, tooltip))
			.on('mouseout', (event, d) => d2maf_dotmout(event, d, tooltip))
			.on('click', (event, d) => d2maf_minfo(event, pdata.header, d))
	}
	snv
		.append('line')
		.attr('stroke', d => d.style.stroke)
		.attr('stroke-opacity', d => d.style.strokeopacity)
		.attr('x1', -3)
		.attr('y1', -3)
		.attr('x2', 3)
		.attr('y2', 3)
	snv
		.append('line')
		.attr('stroke', d => d.style.stroke)
		.attr('stroke-opacity', d => d.style.strokeopacity)
		.attr('x1', -3)
		.attr('y1', 3)
		.attr('x2', 3)
		.attr('y2', -3)
	/*
// set share - indel
select_share
	.filter(function(d){return d.isindel})
	.append('rect')
	.attr('fill',function(d){return d.style.fill})
	.attr('fill-opacity',function(d){return d.style.fillopacity})
	.attr('stroke',function(d){return d.chr=='chrX' ? '#858585' : 'none'})
	.attr('stroke-dasharray',function(d){return d.chr=='chrX' ? '5,5' : 'none'})
	.attr({
		x:-indelboxw/2,
		y:-indelboxw/2,
		width:indelboxw,
		height:indelboxw,
		'shape-rendering':'crispEdges'
		})
	.on('mouseover',function(event,d){ sja.f.crypt_2dmaf_dotmover(d,this) })
	.on('mouseout',function(event,d){ sja.f.crypt_2dmaf_dotmout(d,this) })
	.on('click',function(event,d){ sja.f.crypt_2dmaf_minfo(pdata.header,d) })
	*/

	// set 1 - total coverage axis
	const set1totalscale = scaleLinear()
		.domain([0, maxtotal])
		.range([sample1height - sp2, 0])
	const g_set1 = g
		.append('g')
		.attr('transform', 'translate(' + (axiswidth + sp + sample2height) + ',' + (shareheight + sp2) + ')')
	const emaflinecolor = '#FFBEAD'
	const emafline_1 = g_set1
		.append('rect')
		.attr('fill', emaflinecolor)
		.attr('fill-opacity', 0)
		.attr('x', 0)
		.attr('width', 3)
		.attr('height', sample1height - sp2)
	client.axisstyle({
		axis: g_set1.call(axisLeft().scale(set1totalscale).tickValues([0, maxtotal])),
		showline: true,
		fontsize: labelfontsize * 0.8
	})
	g_set1
		.append('g')
		.attr('transform', 'translate(-' + labelfontsize / 2 + ',' + (sample1height - sp2) / 2 + ')')
		.append('text')
		.text('D total')
		.attr('font-size', labelfontsize * 0.8)
		.attr('font-family', client.font)
		.attr('fill', 'black')
		.attr('text-anchor', 'middle')
		.attr('dominant-baseline', 'middle')
		.attr('transform', 'rotate(-90)')

	// set 1
	const select_set1 = g_set1
		.selectAll()
		.data(set_1)
		.enter()
		.append('g')
		.attr('transform', d => {
			d.posstring = 'translate(' + scale1(d.maf1) + ',' + set1totalscale(d['TinD.D']) + ')'
			return d.posstring
		})

	// set 1 - cnv loh
	select_set1
		.filter(d => d.Dcnvloh)
		.append('circle')
		.attr('cy', d => {
			return d.issnv ? radiusscale(d['TinD.R']) : indelboxw / 2
		})
		.attr('fill', '#858585')
		.attr('r', r_cnvloh)
	select_set1
		.filter(d => d.Rcnvloh)
		.append('circle')
		.attr('cx', d => (d.issnv ? -radiusscale(d['TinD.D']) : -indelboxw / 2))
		.attr('fill', '#858585')
		.attr('r', r_cnvloh)

	// set 1 - snv
	snv = select_set1
	// not sure why this documented option to supply a function to append is not working
	// snv.append(function(d){return document.createElement(1 || d.symbol ? 'path' : 'circle')})
	// ... do this instead for now
	for (const tagName in symbolFilters) {
		snv
			.filter(symbolFilters[tagName])
			.append(tagName)
			.attr('class', d => (d.symbol ? 'twodmaf-' + d.symbol : null))
			.attr('r', d => (d.symbol ? null : radiusscale(d['TinD.R'])))
			.attr('d', d => (!d.symbol ? null : symbolgen.type(symbols[d.symbol]).size(radiustoarea(d['TinD.R']))()))
			.attr('fill', d => d.style.fill)
			.attr('fill-opacity', d => d.style.fillopacity)
			.attr('stroke', d => d.style.stroke)
			.attr('stroke-opacity', d => d.style.strokeopacity)
			.attr('stroke-dasharray', d => (d.chr == 'chrX' ? '5,5' : 'none'))
			.on('mouseover', (event, d) => d2maf_dotmover(event, d, tooltip))
			.on('mouseout', (event, d) => d2maf_dotmout(event, d, tooltip))
			.on('click', (event, d) => d2maf_minfo(event, pdata.header, d))
	}
	snv
		.append('line')
		.attr('stroke', d => d.style.stroke)
		.attr('stroke-opacity', d => d.style.strokeopacity)
		.attr('x1', -3)
		.attr('y1', -3)
		.attr('x2', 3)
		.attr('y2', 3)
	snv
		.append('line')
		.attr('stroke', d => d.style.stroke)
		.attr('stroke-opacity', d => d.style.strokeopacity)
		.attr('x1', -3)
		.attr('y1', 3)
		.attr('x2', 3)
		.attr('y2', -3)
	/*
// set 1 - indel
select_set1
	.filter(function(d){return d.isindel})
	.append('rect')
	.attr('fill',function(d){return d.style.fill})
	.attr('fill-opacity',function(d){return d.style.fillopacity})
	.attr('stroke',function(d){return d.chr=='chrX' ? '#858585' : 'none'})
	.attr('stroke-dasharray',function(d){return d.chr=='chrX' ? '5,5' : 'none'})
	.attr({
		x:-indelboxw/2,
		y:-indelboxw/2,
		width:indelboxw,
		height:indelboxw,
		'shape-rendering':'crispEdges'
		})
	.on('mouseover',function(event,d){ sja.f.crypt_2dmaf_dotmover(d,this) })
	.on('mouseout',function(event,d){ sja.f.crypt_2dmaf_dotmout(d,this) })
	.on('click',function(event,d){ sja.f.crypt_2dmaf_minfo(pdata.header,d) })
	*/

	// set 2 - total coverage axis
	const set2totalscale = scaleLinear()
		.domain([0, maxtotal])
		.range([0, sample2height - sp2])
	const g_set2 = g.append('g').attr('transform', 'translate(' + (axiswidth + sp) + ',0)')
	const emafline_2 = g_set2
		.append('rect')
		.attr('fill', emaflinecolor)
		.attr('fill-opacity', 0)
		.attr('y', shareheight)
		.attr('width', sample2height - sp2)
		.attr('height', 3)
	const g_set2_axis = g_set2
		.append('g')
		.attr('transform', 'translate(0,' + shareheight + ')')
		.call(axisBottom().scale(set2totalscale).tickValues([0, maxtotal]))
	client.axisstyle({
		axis: g_set2_axis,
		showline: true,
		fontsize: labelfontsize * 0.8
	})
	g_set2
		.append('text')
		.text('R total')
		.attr('font-size', labelfontsize * 0.8)
		.attr('font-family', client.font)
		.attr('fill', 'black')
		.attr('x', (sample2height - sp2) / 2)
		.attr('y', shareheight + labelfontsize)
		.attr('text-anchor', 'middle')
	// set 2
	const select_set2 = g_set2
		.selectAll()
		.data(set_2)
		.enter()
		.append('g')
		.attr('transform', d => {
			d.posstring = 'translate(' + set2totalscale(d['TinD.R']) + ',' + scale2(d.maf2) + ')'
			return d.posstring
		})

	// set 2 - cnv loh
	select_set2
		.filter(d => d.Dcnvloh)
		.append('circle')
		.attr('cy', d => (d.issnv ? radiusscale(d['TinD.R']) : indelboxw / 2))
		.attr('fill', '#858585')
		.attr('r', r_cnvloh)
	select_set2
		.filter(d => d.Rcnvloh)
		.append('circle')
		.attr('cx', d => (d.issnv ? -radiusscale(d['TinD.D']) : -indelboxw / 2))
		.attr('fill', '#858585')
		.attr('r', r_cnvloh)

	// set 2 - snv
	snv = select_set2
	//.filter(function(d){return d.issnv});

	// not sure why this documented option to supply a function to append is not working
	// snv.append(function(d){return document.createElement(1 || d.symbol ? 'path' : 'circle')})
	// ... do this instead for now
	for (const tagName in symbolFilters) {
		snv
			.filter(symbolFilters[tagName])
			.append(tagName)
			.attr('class', d => (d.symbol ? 'twodmaf-' + d.symbol : null))
			.attr('r', d => (d.symbol ? null : radiusscale(d['TinD.D'])))
			.attr('d', d => (!d.symbol ? null : symbolgen.type(symbols[d.symbol]).size(radiustoarea(d['TinD.R']))()))
			.attr('fill', d => d.style.fill)
			.attr('fill-opacity', d => d.style.fillopacity)
			.attr('stroke', d => d.style.stroke)
			.attr('stroke-opacity', d => d.style.strokeopacity)
			.attr('stroke-dasharray', d => (d.chr == 'chrX' ? '5,5' : 'none'))
			.on('mouseover', (event, d) => d2maf_dotmover(event, d, tooltip))
			.on('mouseout', (event, d) => d2maf_dotmout(event, d, tooltip))
			.on('click', (event, d) => d2maf_minfo(event, pdata.header, d))
	}
	snv
		.append('line')
		.attr('stroke', d => d.style.stroke)
		.attr('stroke-opacity', d => d.style.strokeopacity)
		.attr('x1', -3)
		.attr('y1', -3)
		.attr('x2', 3)
		.attr('y2', 3)
	snv
		.append('line')
		.attr('stroke', d => d.style.stroke)
		.attr('stroke-opacity', d => d.style.strokeopacity)
		.attr('x1', -3)
		.attr('y1', 3)
		.attr('x2', 3)
		.attr('y2', -3)
	/*
// set 2 - indel
select_set2
	.filter(function(d){return d.isindel})
	.append('rect')
	.attr('fill',function(d){return d.style.fill})
	.attr('fill-opacity',function(d){return d.style.fillopacity})
	.attr('stroke',function(d){return d.chr=='chrX' ? '#858585' : 'none'})
	.attr('stroke-dasharray',function(d){return d.chr=='chrX' ? '5,5' : 'none'})
	.attr({
		x:-indelboxw/2,
		y:-indelboxw/2,
		width:indelboxw,
		height:indelboxw,
		'shape-rendering':'crispEdges'
		})
	.on('mouseover',function(d){ sja.f.crypt_2dmaf_dotmover(d,this) })
	.on('mouseout',function(d){ sja.f.crypt_2dmaf_dotmout(d,this) })
	.on('click',function(d){ sja.f.crypt_2dmaf_minfo(pdata.header,d) })
	*/

	// legend - person name
	const leng = g.append('g').attr('transform', 'translate(0,' + (shareheight + sp2) + ')')
	let y = labelfontsize
	leng.append('text').text(person).attr('font-size', labelfontsize).attr('y', y)
	// legend - snv text
	const r1 = radiusscale(20),
		r2 = radiusscale(maxtotal)
	y += labelfontsize + r2
	let x
	leng
		.append('text')
		.text('SNV coverage')
		.attr('y', y)
		.attr('dominant-baseline', 'middle')
		.each(function () {
			x = this.getBBox().width
		})

	// legend - snv ball 1
	x += r1 + 10
	leng.append('circle').attr('cx', x).attr('cy', y).attr('r', r1).attr('stroke', 'black').attr('fill', 'none')
	leng
		.append('text')
		.text(20)
		.attr('x', x)
		.attr('y', y)
		.attr('text-anchor', 'middle')
		.attr('dominant-baseline', 'middle')
	x += r1 + r2 + 10

	// legend - snv ball 2
	leng.append('circle').attr('cx', x).attr('cy', y).attr('r', r2).attr('stroke', 'black').attr('fill', 'none')
	leng
		.append('text')
		.text(maxtotal)
		.attr('x', x)
		.attr('y', y)
		.attr('text-anchor', 'middle')
		.attr('dominant-baseline', 'middle')

	// legend - indel
	y += r2 + 10
	leng
		.append('text')
		.text('Indel')
		.attr('y', y)
		.attr('dominant-baseline', 'middle')
		.each(function () {
			x = this.getBBox().width
		})
	leng
		.append('circle')
		.attr('cx', x + 10 + indelboxw / 2)
		.attr('cy', y)
		.attr('r', indelboxw / 2)
		.attr('fill', 'black')
		.attr('fill-opacity', 0.3)
	y += 30

	// legend - chrx
	leng
		.append('text')
		.text('chrX')
		.attr('y', y)
		.attr('dominant-baseline', 'middle')
		.each(function () {
			x = this.getBBox().width
		})
	x += r1 + 10
	leng
		.append('circle')
		.attr('cx', x)
		.attr('cy', y)
		.attr('r', 10)
		.attr('stroke', 'black')
		.attr('stroke-dasharray', '5,5')
		.attr('fill', 'none')
	y += 30

	// legend - cnv/loh in d
	leng
		.append('text')
		.text('D. CNV/LOH')
		.attr('y', y)
		.attr('dominant-baseline', 'middle')
		.each(function () {
			x = this.getBBox().width
		})
	x += r1 + 10
	leng.append('circle').attr('cx', x).attr('cy', y).attr('r', 10).attr('stroke', 'black').attr('fill', 'none')
	leng
		.append('circle')
		.attr('cx', x)
		.attr('cy', y + 10)
		.attr('r', r_cnvloh)
		.attr('fill', 'black')
	y += 30

	// legend - cnv/loh in r
	leng
		.append('text')
		.text('R. CNV/LOH')
		.attr('y', y)
		.attr('dominant-baseline', 'central')
		.each(function () {
			x = this.getBBox().width
		})
	x += r1 + 10
	leng.append('circle').attr('cx', x).attr('cy', y).attr('r', 10).attr('stroke', 'black').attr('fill', 'none')
	leng
		.append('circle')
		.attr('cx', x - 10)
		.attr('cy', y)
		.attr('r', r_cnvloh)
		.attr('fill', 'black')
	y += 30

	if (pdata.purity1 != undefined || pdata.purity2 != undefined) {
		// emaf
		leng
			.append('text')
			.text('Expected MAF')
			.attr('y', y)
			.attr('dominant-baseline', 'middle')
			.each(function () {
				x = this.getBBox().width
			})
		x += 10
		leng.append('rect').attr('fill', emaflinecolor).attr('x', x).attr('y', y).attr('width', 40).attr('height', 3)
		y += 30
	}

	//
	const renderedsymbols = Object.keys(bysymbol)
	if (renderedsymbols.length) {
		leng
			.append('text')
			.text('Symbols')
			.attr('y', y)
			.attr('dominant-baseline', 'middle')
			.each(function () {
				x = this.getBBox().width
			})

		let x1
		for (const symbolname in bysymbol) {
			const s = bysymbol[symbolname]
			const g = leng.append('g').on('click', () => {
				s.hidden = !s.hidden
				svg.selectAll('.twodmaf-' + symbolname).style('display', s.hidden ? 'none' : '')
				label.style('text-decoration', s.hidden ? 'line-through' : '')
			})

			x1 = x + 20
			g.append('path')
				.attr('transform', 'translate(' + x1 + ',' + y + ')')
				.attr('d', symbolgen.type(symbols[symbolname]).size(100)())
				.attr('stroke', 'black')
				.attr('fill', 'none')
				.each(function () {
					x1 += this.getBBox().width
				})

			//x+=10
			const label = g
				.append('text')
				.text(s.label ? s.label + ' (' + s.numlines + ')' : '')
				.attr('y', y + 2)
				.attr('x', x1)
				.attr('dominant-baseline', 'middle')
				.style('text-decoration', s.hidden ? 'line-through' : '')
			y += 30
		}
		y += 30
	}

	// gene table - sort genes
	const g2m = {},
		g1 = {},
		g2 = {},
		gs = {}
	for (const m of mlst) {
		if (!m.gene) continue
		if (!(m.gene in g2m)) {
			g2m[m.gene] = []
		}
		g2m[m.gene].push(m)
		if (m.set_1) {
			g1[m.gene] = 1
		} else if (m.set_2) {
			g2[m.gene] = 1
		} else if (m.set_share) {
			gs[m.gene] = 1
		}
	}
	const genelst = []
	for (const n in g1) {
		genelst.push(n)
	}
	for (const n in g2) {
		if (!(n in g1)) {
			genelst.push(n)
		}
	}
	for (const n in gs) {
		if (!(n in g1) && !(n in g2)) {
			genelst.push(n)
		}
	}
	const table = tdgenetable
		.append('div')
		.style('height', shareheight + sample1height + 'px')
		.style('margin', '10px')
		.style('padding', '10px')
		.style('border', 'solid 1px #ccc')
		.style('overflow-y', 'scroll')
		.style('resize', 'both')
		.append('table')
	{
		const tr = table.append('tr')
		tr.append('td').text('Gene')
		tr.append('td').text(pdata.setname[1] + ' only')
		tr.append('td').text(pdata.setname[2] + ' only')
		tr.append('td').text('Shared')
	}
	let bg = true
	for (const name of genelst) {
		const tr = table.append('tr')
		if (bg) {
			tr.style('background-color', '#f3f3f3')
		}
		bg = !bg
		tr.append('td').text(name)
		let mlst = []
		if (name in g2m) {
			mlst = g2m[name]
		}
		const s1 = [],
			s2 = [],
			ss = []
		for (const m of mlst) {
			if (m.set_share) ss.push(m)
			else if (m.set_1) s1.push(m)
			else if (m.set_2) s2.push(m)
		}
		let td = tr.append('td')
		if (s1.length) {
			for (const m of s1) {
				const div = td
					.append('div')
					.attr('class', 'sja_clbtext')
					.style('color', m.style.fillhl)
					.text(m.mname || '')
					.on('click', event => {
						click(event.target, m, select_set1)
					})

				if (m.labelIsVisible) {
					click(div.node(), m, select_set1)
				}
			}
		}
		td = tr.append('td')
		if (s2.length) {
			for (const m of s2) {
				const div = td
					.append('div')
					.attr('class', 'sja_clbtext')
					.style('color', m.style.fillhl)
					.text(m.mname || '')
					.on('click', event => {
						click(event.target, m, select_set2)
					})

				if (m.labelIsVisible) {
					click(div.node(), m, select_set1)
				}
			}
		}
		td = tr.append('td')
		if (ss.length) {
			for (const m of ss) {
				const div = td
					.append('div')
					.attr('class', 'sja_clbtext')
					.style('color', m.style.fillhl)
					.text(m.mname || '')
					.on('click', event => {
						click(event.target, m, select_share)
					})

				if (m.labelIsVisible) {
					click(div.node(), m, select_set1)
				}
			}
		}
	}
	function click(butt, m, select) {
		if (m.selected) {
			butt.style.border = ''
			m.selected = false
		} else {
			butt.style.border = 'solid 1px black'
			m.selected = true
		}
		const found = select.filter(d => {
			return d.gene == m.gene && d.class == m.class && d.mname == m.mname
		})
		found
			.selectAll('rect')
			.attr('fill-opacity', m.selected ? 0.5 : m.style.fillopacity)
			.attr('fill', m.selected ? m.style.fillhl : m.style.fill)
		found
			.selectAll('circle,ellipse,line')
			.attr('stroke-opacity', m.selected ? 1 : m.style.strokeopacity)
			.attr('stroke', m.selected ? m.style.strokehl : m.style.stroke)
			.attr('stroke-width', m.selected ? 2 : 1)
		if (m.selected) {
			// add mobile label
			let x = Math.max(20, m.radius),
				y = 0
			if ((m.set_1 || m.set_share) && m.maf1 >= 0.8) {
				x = -m.radius
				y = m.radius * 2
			}
			const g = found
				.append('g')
				.attr('class', 'sja_2dmaf_mlabel')
				.attr('transform', 'translate(' + x + ',' + y + ')')
			let w
			g.append('text')
				.text(m.labelAs ? m.labelAs : m.gene + ' ' + m.mname)
				.attr('fill', m.style.fillhl)
				.attr('dominant-baseline', 'middle')
				.attr('text-anchor', 'start')
				.attr('font-size', m.radius)
				.each(function () {
					w = this.getBBox().width
				})
			g.append('rect')
				.attr('y', -m.radius / 2)
				.attr('width', w)
				.attr('height', m.radius)
				.attr('fill', 'black')
				.attr('fill-opacity', 0)
				.on('mouseover', event => d3select(event.target).attr('fill-opacity', 0.2))
				.on('mouseout', event => d3select(event.target).attr('fill-opacity', 0))
				.on('mousedown', event => {
					const x0 = x,
						y0 = y,
						mx = event.clientX,
						my = event.clientY,
						body = d3select(document.body)
					body.on('mousemove', event => {
						event.preventDefault()
						x = x0 + event.clientX - mx
						y = y0 + event.clientY - my
						g.attr('transform', 'translate(' + x + ',' + y + ')')
					})
					body.on('mouseup', () => {
						body.on('mousemove', null).on('mouseup', null)
					})
				})
		} else {
			found.select('.sja_2dmaf_mlabel').remove()
		}
	}
	return outtable
}

function d2maf_dotmover(event, m, tooltip) {
	if (!m.selected) {
		d3select(event.target).attr('fill', m.style.fillhl).attr('fill-opacity', 0.2)
	}
	tooltip.clear()
	tooltip.show(event.clientX, event.clientY)
	tooltip.d
		.append('div')
		.html(
			(m.gene || 'no gene') +
				' <span style="color:' +
				m.style.fillhl +
				'">' +
				(m.mname || '') +
				'</span>' +
				(m.class ? ' <span style="font-size:70%">' + common.mclass[m.class].label + '</span>' : '')
		)
}

function d2maf_dotmout(event, m, tooltip) {
	if (!m.selected) {
		d3select(event.ele)
			.attr('fill', m.style.fill)
			.attr('fill-opacity', m.style.fillopacity)
			.attr('stroke', m.style.stroke)
	}
	tooltip.hide()
}

function d2maf_minfo(event, header, m) {
	const pane = client.newpane({ x: event.clientX + 30, y: event.clientY - 30 })
	pane.header.text((m.gene ? m.gene : 'No gene') + ' ' + (m.mname ? m.mname : ''))
	var data = []
	for (let i = 0; i < header.length; i++) {
		data.push({ k: header[i], v: m[header[i]] })
	}
	client.make_table_2col(pane.body, data)
}

function d2maf_click(data, person) {
	const v = data.pairs[person]
	if (v.shown) {
		v.shown = false
		v.holder.remove()
		if (v.handle) {
			v.handle.attr('font-weight', 'normal')
		}
	} else {
		v.shown = true
		if (v.holder) {
			data.showholder.node().appendChild(v.holder.node())
		} else {
			v.holder = d2maf_render(data.showholder, v)
		}
		if (v.handle) {
			v.handle.attr('font-weight', 'bold')
		}
	}
}

function d2maf_peopletable(data, holder) {
	const plst = []
	for (const n in data.pairs) {
		plst.push([n, data.pairs[n].mlst.length])
	}

	holder.selectAll('*').remove()
	const searchrow = holder.append('div').style('margin-bottom', '5px')

	searchrow.append('span').text(plst.length + ' individual' + (plst.length > 1 ? 's' : ''))

	/*
no buttons

	.append($('<div>')
		.append('<span>Patients, top '+data.peoplelimit+' of '+plst.length+'&nbsp;</span>')
		.append($('<input>').attr({type:'text',size:10,placeholder:'search'}).on('keyup',function(e){
			var v=e.target.value
			if(v.length<2) {
				sja.d.menu.hide()
				return
			}
			v=v.toLowerCase()
			var hit=[]
			plst.forEach(function(p){
				if(p[0].toLowerCase().indexOf(v)!=-1) {
					hit.push(p[0])
				}
			})
			if(hit.length==0) {
				sja.d.menu.hide()
				return
			}
			sja.d.menu.showunder(e.target)
			for(var i=0; i<Math.min(20,hit.length); i++) {
				sja.d.menu.append($('<div>').addClass('sja_menuoption').text(hit[i]).click((function(n){return function(){
					sja.f.d2maf_click(data,n)
					sja.d.menu.fadeOut()
					e.target.value=''
				}})(hit[i])))
			}
		}))
	)
	.append($('<div>').css('margin-top','5px')
		.append($('<button>').text('more').click(function(){
			data.peoplelimit=Math.min(plst.length,data.peoplelimit+10)
			sja.f.d2maf_peopletable(data)
		}))
		.append($('<button>').text('less').click(function(){
			data.peoplelimit=Math.max(Math.min(5,parseInt(plst.length/3)),data.peoplelimit-10)
			sja.f.d2maf_peopletable(data)
		}))
		.append($('<button>').text('wider').click(function(){
			data.peoplewidth+=100
			sja.f.d2maf_peopletable(data)
		}))
		.append($('<button>').text('narrower').click(function(){
			data.peoplewidth=Math.max(150,data.peoplewidth-100)
			sja.f.d2maf_peopletable(data)
		}))
		.append($('<button>').text('screenshot').click(function(){
			var a=document.createElement('a')
			document.body.appendChild(a)
			$(a).click(function(){
				a.download='2dmaf.patients.bar.svg'
				a.href=sja.f.to_svg(svg[0][0])
				document.body.removeChild(a)
			})
			a.click()
		}))
	)
	*/

	const svg = holder.append('svg')

	const space = 5,
		axish = 20,
		rowh = data.rowh
	let maxlabelw = 0

	for (const s of plst) {
		svg
			.append('text')
			.text(s[0])
			.attr('font-size', rowh)
			.attr('font-family', client.font)
			.each(function () {
				maxlabelw = Math.max(maxlabelw, this.getBBox().width)
			})
			.remove()
	}

	svg.attr('width', maxlabelw + space + data.peoplewidth + 30).attr('height', axish + space + rowh * plst.length)

	plst.sort((a, b) => b[1] - a[1])

	let maxmcount = 0
	for (const k in data.pairs) {
		maxmcount = Math.max(maxmcount, data.pairs[k].mlst.length)
	}

	const ag = svg
		.append('g')
		.attr('transform', 'translate(' + (maxlabelw + space) + ',' + axish + ')')
		.call(
			axisTop()
				.scale(scaleLinear().domain([0, maxmcount]).range([0, data.peoplewidth]))
				.tickFormat(d3format('d'))
				.ticks(3)
		)
	client.axisstyle({
		axis: ag,
		showline: true,
		color: 'black'
	})

	const wsf = data.peoplewidth / maxmcount
	let y = axish + space

	for (const s of plst) {
		const person = s[0]
		data.pairs[person].handle = svg
			.append('text')
			.text(person)
			.attr('class', 'sja_svgtext2')
			.attr('font-size', rowh - 2)
			.attr('font-family', client.font)
			.attr('x', maxlabelw)
			.attr('y', y + space + rowh / 2)
			.attr('text-anchor', 'end')
			.on('click', () => {
				d2maf_click(data, person)
			})
		let m1 = 0,
			m2 = 0,
			ms = 0
		for (const m of data.pairs[person].mlst) {
			if (m.set_1) m1++
			else if (m.set_2) m2++
			else if (m.set_share) ms++
		}
		const g = svg.append('g').attr('transform', 'translate(' + (maxlabelw + space) + ',' + y + ')')
		if (m1 > 0) {
			g.append('rect')
				.attr('width', wsf * m1)
				.attr('height', rowh - 1)
				.attr('fill', data.color1)
		}
		if (ms > 0) {
			g.append('rect')
				.attr('x', wsf * m1)
				.attr('width', wsf * ms)
				.attr('height', rowh - 1)
				.attr('fill', data.colorshare)
		}
		if (m2 > 0) {
			g.append('rect')
				.attr('x', wsf * (m1 + ms))
				.attr('width', wsf * m2)
				.attr('height', rowh - 1)
				.attr('fill', data.color2)
		}
		y += rowh
	}
}

/*
d2maf_genetable=function(data)
{
var dsc=sja.datasets[data.dsname]
var hash={}
for(var n in data.pairs) {
	data.pairs[n].mlst.forEach(function(m){
		if(!(m.gene in hash)) {
			hash[m.gene]={
				s1:{},
				s2:{},
				share:{},
				total:0
			}
		}
		if(m.set_1) {
			if(!(m.sample in hash[m.gene].s1)) {
				hash[m.gene].s1[m.sample]=[]
				hash[m.gene].total++
			}
			hash[m.gene].s1[m.sample].push(m)
		} else if(m.set_2) {
			if(!(m.sample in hash[m.gene].s2)) {
				hash[m.gene].s2[m.sample]=[]
				hash[m.gene].total++
			}
			hash[m.gene].s2[m.sample].push(m)
		} else {
			if(!(m.sample in hash[m.gene].share)) {
				hash[m.gene].share[m.sample]=[]
				hash[m.gene].total++
			}
			hash[m.gene].share[m.sample].push(m)
		}
	})
}
var genelst=[]
for(var n in hash) {
	genelst.push([n,hash[n]])
}
genelst.sort(function(a,b){
	return b[1].total-a[1].total
})
data.geneholder.empty()
data.geneholder.append($('<div>').css('margin-bottom','5px')
	.append($('<div>')
		.append('<span>Genes, top '+data.genelimit+' of '+genelst.length+'&nbsp;</span>')
		.append($('<input>').attr({type:'text',size:10,placeholder:'search'}).on('keyup',function(e){
			var v=e.target.value
			if(v=='') {
				sja.d.menu.hide()
				return
			}
			v=v.toLowerCase()
			var hit=[]
			genelst.forEach(function(i){
				if(i[0].toLowerCase().indexOf(v)==0) {
					hit.push(i[0])
				}
			})
			if(hit.length==0) {
				sja.d.menu.hide()
				return
			}
			sja.d.menu.showunder(e.target)
			var d=$('<div>').css('width',300)
			sja.d.menu.append(d)
			for(var i=0; i<Math.min(30,hit.length); i++) {
				d.append($('<div>').addClass('sja_menuoption_y').text(hit[i]).click((function(gene){return function(){
					sja.d.menu.hide()
					e.target.value=''
					showgene(gene)
				}})(hit[i])))
			}
		}))
	)
	.append($('<div>').css('margin-top','5px')
		.append($('<button>').text('more')
			.click(function(){
				data.genelimit=Math.min(genelst.length,data.genelimit+10)
				sja.f.d2maf_genetable(data)
			})
		)
		.append($('<button>').text('less')
			.click(function(){
				data.genelimit=Math.max(Math.min(10,parseInt(genelst.length/3)),data.genelimit-10)
				sja.f.d2maf_genetable(data)
			})
		)
		.append($('<button>').text('wider').click(function(){
			data.genewidth+=100
			sja.f.d2maf_genetable(data)
			}))
		.append($('<button>').text('narrower').click(function(){
			data.genewidth=Math.max(150,data.genewidth-100)
			sja.f.d2maf_genetable(data)
			}))
		.append($('<button>').text('screenshot').click(function(){
			var a=document.createElement('a')
			document.body.appendChild(a)
			$(a).click(function(){
				a.download='2dmaf.genes.bar.svg'
				a.href=sja.f.to_svg(svg[0][0])
				document.body.removeChild(a)
			})
			a.click()
		}))
	)
)
var svg=d3.select(data.geneholder[0]).append('svg')
var space=5,axish=20,rowh=data.rowh
var maxlabelw=0
for(var i=0; i<data.genelimit; i++) {
	var s=genelst[i]
	svg.append('text').text(s[0])
	.attr({'font-size':rowh,'font-family':sja.font})
	.each(function(){
		maxlabelw=Math.max(maxlabelw,this.getBBox().width)
	})
	.remove()
}
svg.attr('width',maxlabelw+space+data.genewidth+20)
	.attr('height',axish+space+rowh*data.genelimit)
var maxmcount=0
genelst.forEach(function(g){
	maxmcount=Math.max(maxmcount,g[1].total)
})
var ag=svg.append('g')
	.attr('transform','translate('+(maxlabelw+space)+','+axish+')')
	.call(d3.svg.axis().scale(
		d3.scale.linear().domain([0,maxmcount]).range([0,data.genewidth])
		).orient('top')
		.tickFormat(d3.format('d'))
	)
sja.f.axis_applystyle({
	axis:ag,
	showline:true,
	color:'black'
})

var wsf=data.genewidth/maxmcount
var y=axish+space
for(var i=0; i<data.genelimit; i++) {
	var s=genelst[i]
	var gene=s[0]
	svg.append('text')
		.text(gene)
		.attr({
			class:'sja_svgtext2',
			'font-size':rowh-2,
			'font-family':sja.font,
			x:maxlabelw,
			y:y+space+rowh/2,
			'text-anchor':'end',
		})
		.on('click', (function(gene){ return function(){
			showgene(gene)
		}})(gene))
	var g=svg.append('g').attr('transform','translate('+(maxlabelw+space)+','+y+')')
	var m1=0
	for(var n in s[1].s1) m1++
	if(m1>0) {
		g.append('rect')
		.attr({
			width:wsf*m1,
			height:rowh-1,
			fill:data.color1
			})
	}
	var ms=0
	for(var n in s[1].share) ms++
	if(ms>0) {
		g.append('rect')
		.attr({
			x:wsf*m1,
			width:wsf*ms,
			height:rowh-1,
			fill:data.colorshare
			})
	}
	var m2=0
	for(var n in s[1].s2) m2++
	if(m2>0) {
		g.append('rect')
		.attr({
			x:wsf*(m1+ms),
			width:wsf*m2,
			height:rowh-1,
			fill:data.color2
			})
	}
	y+=rowh
}
function showgene(genename) {
	sja.clear()
	var mlst=dsc.bulkdata[genename.toUpperCase()]
	if(!mlst || mlst.length==0) return
	// sort through isoforms
	// skip cnv
	var lst=[]
	mlst.forEach(function(m){
		if(m.dt==sja.dtcnv) return
		lst.push(m)
	})
	mlst=lst
	var hash={} // key: isoform name, val: mlst
	var noisoform=[]
	mlst.forEach(function(m){
		if(!m.isoform) {
			noisoform.push(m)
			return
		}
		if(!(m.isoform in hash)) {
			hash[m.isoform]=[]
		}
		hash[m.isoform].push(m)
	})
	var lst=[]
	for(var n in hash) {
		if(hash[n].length>0) {
			lst.push(n)
		}
	}
	if(noisoform.length>0) {
		sja.error(noisoform.length+' mutations do not have isoform, use gene name '+genename+' instead.');
		(new sja.c.Paint({
			genome:dsc.genome,
			mutations:noisoform,
			mbygmcoord:true,
			name:dsc.shortlabel
			})
		).getIsoforms(genename)
	}
	if(lst.length==0) {
		return
	}
	if(lst.length==1) {
		genename=lst[0];
		(new sja.c.Paint({
			genome:dsc.genome,
			mutations:mlst,
			mbygmcoord:true,
			name:dsc.shortlabel
		})).getIsoforms(genename)
		return
	}
	for(var n in hash) {
		(new sja.c.Paint({
			genome:dsc.genome,
			mutations:hash[n],
			mbygmcoord:true,
			name:dsc.shortlabel
		})).getIsoforms(n)
	}
}
}
*/
