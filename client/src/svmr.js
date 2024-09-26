import { select as d3select } from 'd3-selection'
import * as client from './client'
import { genomic2gm } from './coord'
import { bplen as bplength } from '#shared/common.js'
import Svmr from './svmr.c'

export function svmrparseinput(arg, sayerror, genome, holder, hostURL, jwt) {
	if (!arg.dataname) {
		arg.dataname = 'Unnamed dataset'
	}
	if (arg.input) {
		const [e, header, items] = svmrparseraw(arg.input, genome)
		if (e) {
			sayerror('Fusion Editor input error: ' + e)
			return
		}
		svmrlaunch(genome, header, items, arg.dataname, holder, hostURL, jwt)
		return
	}
	if (!arg.urls) {
		sayerror('neither .input:"" or .urls:[] is provided for Fusion Editor')
		return
	}
	if (!Array.isArray(arg.urls)) {
		sayerror('fusioneditor.urls[] should be an array of URL strings')
		return
	}
	if (arg.urls.length == 0) {
		sayerror('fusioneditor.urls[] is empty')
		return
	}
	const wait = holder
		.append('div')
		.style('margin', '20px')
		.style('color', '#aaa')
		.style('font-size', '1.5em')
		.text('Loading fusion gene data ...')

	const tasks = []

	arg.urls.forEach(url => {
		tasks.push(
			fetch(
				new Request(hostURL + '/urltextfile', {
					method: 'POST',
					body: JSON.stringify({ url: url, jwt: jwt })
				})
			)
				.then(data => {
					return data.json()
				})
				.then(data => {
					if (data.error) throw { message: 'Error with ' + url + ': ' + data.error }
					return { data: data.text, url: url }
				})
		)
	})

	Promise.all(tasks)
		.then(data => {
			wait.remove()
			if (data.length == 0) {
				sayerror('No data retrieved from fusioneditor.urls')
				return
			}
			// begin with parsing the first file and initialize holders
			const [e, header, items] = svmrparseraw(data[0].data, genome)
			if (e) {
				sayerror('Error parsing fusion gene data in file ' + data[0].url)
				return
			}
			// first file parsed, proceed with more
			for (let i = 1; i < data.length; i++) {
				const [e, header2, items2] = svmrparseraw(data[i].data, genome)
				if (e) {
					sayerror('Error parsing fusion gene data in file ' + data[i].url)
					return
				}
				for (const j of items2) {
					items.push(j)
				}
				// anything new in header2 will be added to header
				for (const h of header2) {
					let notfound = true
					for (const h2 of header) {
						if (h2.key == h.key) {
							notfound = false
							break
						}
					}
					if (notfound) {
						header.push(h)
					}
				}
			}
			if (items.length == 0) {
				sayerror('No fusion genes parsed from fusioneditor')
				return
			}
			svmrlaunch(genome, header, items, arg.dataname, holder, hostURL, jwt)
		})
		.catch(err => {
			wait.remove()
			sayerror(err.message)
			if (err.stack) console.log(err.stack)
		})
}

export function svmrui(dlst, genomes, hostURL, jwt) {
	const [pane, inputdiv, gselect, filediv, saydiv, visualdiv] = dlst
	inputdiv
		.append('div')
		.style('margin-top', '20px')
		.html(
			'<p>Please upload CICERO output as a text file. ' +
				'See <a href=https://docs.google.com/document/d/1jkVYRPIJpkWvA9vqtahRlNn63Hk5DehjHbF_BH9k7Rs/edit?usp=sharing target=_blank>file format</a>.</p>' +
				'<p>See <a href=https://docs.google.com/document/d/1DRVzE_WenG490eRYB7VGFOygtSqtF5L97rhK0HOUCNY/edit?usp=sharing target=_blank>function usage</a>.</p>'
		)
	inputdiv
		.append('p')
		.html('<a href=https://proteinpaint.stjude.org/ppdemo/hg19/fusion/cicero.output target=_blank>Example file</a>')
	function cmt(t, red) {
		saydiv.style('color', red ? 'red' : 'black').text(t)
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
					const genomeobj = genomes[usegenome]
					const [err, header, items] = svmrparseraw(event.target.result, genomeobj)
					if (err) {
						cmt(err, 1)
						fileui()
						return
					}
					svmrlaunch(genomeobj, header, items, file.name, visualdiv, hostURL, jwt)
					filediv.remove()
					inputdiv.remove()
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

export function svmrlaunch(genome, header, items, filename, holder, hostURL, jwt) {
	new Svmr(genome, header, items, filename, holder, hostURL, jwt)
}

export function svmrparseraw(raw, genome) {
	const lines = raw.trim().split('\n')
	const [err, header] = parseheader(lines[0])
	if (err) {
		return ['File header error: ' + err]
	}
	const skipword = lines[0].split('\t')[0]
	const items = []
	const badlines = []
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i]
		if (line == '') continue
		if (line[0] == '#') continue
		const lst = line.trim().split('\t')
		if (lst[0] == skipword) continue
		// m is a product
		const m = {
			notes: [] // collect notes
		}
		for (let j = 0; j < header.length; j++) {
			if (lst[j] !== undefined && lst[j].includes('"'))
				return ['Input file has  invalid character " e.g. "NM_001007565"']
			m[header[j].key] = lst[j]
		}
		if (!m.rating) {
			badlines.push([i, 'rating unspecified', lst])
			continue
		}
		let s = m.rating
		if (s.toLowerCase() == 'major') {
			m.rating = 'HQ'
			s = 'HQ'
		}
		if (s != 'HQ' && s != 'LQ' && s != 'RT' && s != 'bad') {
			badlines.push([i, 'invalid rating: ' + m.rating, lst])
			continue
		}
		if (!m.chrA) {
			badlines.push([i, 'missing chrA', lst])
			continue
		}
		if (!genome.chrlookup[m.chrA.toUpperCase()]) {
			badlines.push([i, 'invalid chrA: ' + m.chrA, lst])
			continue
		}
		if (!m.chrB) {
			badlines.push([i, 'missing chrB', lst])
			continue
		}
		if (!genome.chrlookup[m.chrB.toUpperCase()]) {
			badlines.push([i, 'invalid chrB: ' + m.chrB, lst])
			continue
		}
		s = m.posA
		if (!s) {
			badlines.push([i, 'missing posA', lst])
			continue
		}
		let v = Number.parseInt(s)
		if (Number.isNaN(v)) {
			badlines.push([i, 'invalid posA: ' + s, lst])
			continue
		}
		if (v < 0 || v >= genome.chrlookup[m.chrA.toUpperCase()]) {
			badlines.push([i, 'invalid posA: ' + s, lst])
			continue
		}
		m.posA = v
		s = m.posB
		if (!s) {
			badlines.push([i, 'missing posB', lst])
			continue
		}
		v = Number.parseInt(s)
		if (isNaN(v)) {
			badlines.push([i, 'invalid posB: ' + s, lst])
			continue
		}
		if (v < 0 || v >= genome.chrlookup[m.chrB.toUpperCase()]) {
			badlines.push([i, 'invalid posB: ' + s, lst])
			continue
		}
		m.posB = v
		if (!m.ratioA) {
			badlines.push([i, 'missing ratioA', lst])
			continue
		}
		v = Number.parseFloat(m.ratioA)
		if (Number.isNaN(v)) {
			badlines.push([i, 'invalid value for ratioA', lst])
			continue
		}
		if (v > 1) {
			badlines.push([i, 'ratioA > 100%', lst])
			v = 1
		}
		m.ratioA = v
		if (!m.ratioB) {
			badlines.push([i, 'missing ratioB', lst])
			continue
		}
		v = Number.parseFloat(m.ratioB)
		if (Number.isNaN(v)) {
			badlines.push([i, 'invalid value for ratioB', lst])
			continue
		}
		if (v > 1) {
			badlines.push([i, 'ratioB > 100%', lst])
			v = 1
		}
		m.ratioB = v
		if (!m.score) {
			badlines.push([i, 'missing score', lst])
			continue
		}
		v = Number.parseFloat(m.score)
		if (Number.isNaN(v)) {
			badlines.push([i, 'invalid value for score', lst])
			continue
		}
		m.score = v

		if (!m.readsA) {
			badlines.push([i, 'readsA missing', lst])
			continue
		}
		v = Number.parseInt(m.readsA)
		if (Number.isNaN(v)) {
			badlines.push([i, 'invalid value for readsA', lst])
			continue
		}
		m.readsA = v
		if (!m.readsB) {
			badlines.push([i, 'readsB missing', lst])
			continue
		}
		v = Number.parseInt(m.readsB)
		if (Number.isNaN(v)) {
			badlines.push([i, 'invalid value for readsB', lst])
			continue
		}
		m.readsB = v

		if (!m.matchA) {
			badlines.push([i, 'matchA missing', lst])
			continue
		}
		v = Number.parseInt(m.matchA)
		if (Number.isNaN(v)) {
			badlines.push([i, 'invalid value for matchA', lst])
			continue
		}
		m.matchA = v
		if (!m.matchB) {
			badlines.push([i, 'matchB missing', lst])
			continue
		}
		v = Number.parseInt(m.matchB)
		if (Number.isNaN(v)) {
			badlines.push([i, 'invalid value for matchB', lst])
			continue
		}
		m.matchB = v

		if (!m.repeatA) {
			badlines.push([i, 'repeatA missing', lst])
			continue
		}
		v = Number.parseFloat(m.repeatA)
		if (Number.isNaN(v)) {
			badlines.push([i, 'invalid value for repeatA', lst])
			continue
		}
		m.repeatA = v
		if (!m.repeatB) {
			badlines.push([i, 'repeatB missing', lst])
			continue
		}
		v = Number.parseFloat(m.repeatB)
		if (Number.isNaN(v)) {
			badlines.push([i, 'invalid value for repeatB', lst])
			continue
		}
		m.repeatB = v

		if (m.type2) {
			switch (m.type2.toLowerCase()) {
				case 'closs':
					m.iscloss = true
					break
				case 'nloss':
					m.isnloss = true
					break
				case 'fusion':
					m.isfusion = true
					break
				case 'itd':
					m.isitd = true
					break
				case 'other':
					m.isother = true
					break
				case 'uptss':
					m.isuptss = true
					break
				default:
					badlines.push([i, 'unknown type2: ' + m.type2, lst])
					continue
			}
		}
		// A B names
		if (m.geneA == '' || m.geneA == 'NA') {
			m.geneA = null
		}
		if (m.geneB == '' || m.geneB == 'NA') {
			m.geneB = null
		}
		if (m.featureA == 'intergenic') m.geneA = null
		if (m.featureB == 'intergenic') m.geneB = null
		// validate isoform pairs
		const isoforma = m.lstisoforma ? m.lstisoforma.toUpperCase().split(',') : [],
			isoformb = m.lstisoformb ? m.lstisoformb.toUpperCase().split(',') : [],
			codona = m.lstisoformacodon ? m.lstisoformacodon.split(',') : [],
			codonb = m.lstisoformbcodon ? m.lstisoformbcodon.split(',') : [],
			frame = m.lstframe ? m.lstframe.split(',') : []
		let exona = null,
			exonb = null,
			anchora = null,
			anchorb = null,
			contigaaA = null,
			contigaaB = null,
			contigbpA = null,
			contigbpB = null
		if (m.lstisoformaexon) exona = m.lstisoformaexon.split(',')
		if (m.lstisoformbexon) exonb = m.lstisoformbexon.split(',')
		if (m.lstisoformaanchor) anchora = m.lstisoformaanchor.split(',')
		if (m.lstisoformbanchor) anchorb = m.lstisoformbanchor.split(',')
		if (m.lstcontigaaA) contigaaA = m.lstcontigaaA.split(',')
		if (m.lstcontigaaB) contigaaB = m.lstcontigaaB.split(',')
		if (m.lstcontigbpA) contigbpA = m.lstcontigbpA.split(',')
		if (m.lstcontigbpB) contigbpB = m.lstcontigbpB.split(',')
		const paircount = Math.max(isoforma.length, isoformb.length, codona.length, codonb.length, frame.length)
		// good one, make pairs
		m.pairs = []
		for (let j = 0; j < paircount; j++) {
			const pair = {
				a: {
					isoform: isoforma[j] && isoforma[j].length > 0 ? isoforma[j] : null,
					exon: exona ? Number.parseInt(exona[j]) : NaN,
					codon: codona[j] ? Number.parseInt(codona[j]) : NaN,
					anchor: anchora ? anchora[j] : undefined
				},
				b: {
					isoform: isoformb[j] && isoformb[j].length > 0 ? isoformb[j] : null,
					exon: exonb ? Number.parseInt(exonb[j]) : NaN,
					codon: codonb[j] ? Number.parseInt(codonb[j]) : NaN,
					anchor: anchorb ? anchorb[j] : undefined
				},
				frame: frame[j],
				inframe: frame[j] == '1' || frame[j] == '2'
			}
			if (m.isuptss) {
				pair.inframe = true
			}
			let aaa = NaN,
				aab = NaN,
				bpa = NaN,
				bpb = NaN
			if (contigaaA && contigaaA[j]) aaa = Number.parseInt(contigaaA[j])
			if (contigaaB && contigaaB[j]) aab = Number.parseInt(contigaaB[j])
			if (contigbpA && contigbpA[j]) bpa = Number.parseInt(contigbpA[j])
			if (contigbpB && contigbpB[j]) bpb = Number.parseInt(contigbpB[j])
			if (!Number.isNaN(aaa) && !Number.isNaN(aab)) {
				pair.a.contigaa = aaa
				pair.b.contigaa = aab
			}
			if (!Number.isNaN(bpa) && !Number.isNaN(bpb)) {
				pair.a.contigbp = bpa
				pair.b.contigbp = bpb
			}
			m.pairs.push(pair)
		}
		if (m.exception) {
			m.notes.push(m.exception)
		}
		if (m.hlgene) {
			const v = Number.parseInt(m.hlgene)
			if (Number.isNaN(v) || (v != 0 && v != 1 && v != 2 && v != 3 && v != 4)) {
				badlines.push([i, 'invalid value for highlight gene flag: ' + m.hlgene, lst])
				delete m.hlgene
			} else {
				m.hlgene = v
			}
		}
		items.push(m)
	}
	if (badlines.length > 0) {
		const hlst = header.map(i => i.key)
		client.bulk_badline(hlst, badlines)
	}
	if (items.length == 0) {
		return ['No data loaded']
	}
	return [null, header, items]
}

function parseheader(line) {
	const original = line.trim().split('\t')
	if (original.length <= 1) return ['invalid file header']
	const header = []
	const lower = []
	for (const i of original) {
		lower.push(i.toLowerCase())
		header.push({
			label: i,
			key: i.toLowerCase(),
			custom: true
		})
	}
	const htry = (...arg) => {
		for (const s of arg) {
			const i = lower.indexOf(s)
			if (i != -1) return i
		}
		return -1
	}
	// A
	let i = htry('genea')
	if (i == -1) return ['geneA missing']
	header[i].key = 'geneA'
	delete header[i].custom
	i = htry('chra')
	if (i == -1) return ['chrA missing']
	header[i].key = 'chrA'
	delete header[i].custom
	i = htry('posa')
	if (i == -1) return ['posA missing']
	header[i].key = 'posA'
	delete header[i].custom
	i = htry('orta')
	if (i == -1) return ['ortA missing']
	header[i].key = 'ortA'
	delete header[i].custom
	i = htry('featurea')
	if (i == -1) return ['featureA missing']
	header[i].key = 'featureA'
	delete header[i].custom
	i = htry('ratioa')
	if (i == -1) return ['ratioA missing']
	header[i].key = 'ratioA'
	delete header[i].custom
	i = htry('readsa')
	if (i == -1) return ['readsA missing']
	header[i].key = 'readsA'
	delete header[i].custom
	i = htry('sv_refseqa_aa_index')
	if (i != -1) {
		header[i].key = 'lstcontigaaA'
		delete header[i].custom
	}
	i = htry('sv_refseqa_contig_index')
	if (i != -1) {
		header[i].key = 'lstcontigbpA'
		delete header[i].custom
	}
	i = htry('total_readsa')
	if (i != -1) {
		header[i].key = 'totalreadsA'
		delete header[i].custom
	}

	// B
	i = htry('geneb')
	if (i == -1) return ['geneB missing']
	header[i].key = 'geneB'
	delete header[i].custom
	i = htry('chrb')
	if (i == -1) return ['chrB missing']
	header[i].key = 'chrB'
	delete header[i].custom
	i = htry('posb')
	if (i == -1) return ['posB missing']
	header[i].key = 'posB'
	delete header[i].custom
	i = htry('ortb')
	if (i == -1) return ['ortB missing']
	header[i].key = 'ortB'
	delete header[i].custom
	i = htry('featureb')
	if (i == -1) return ['featureB missing']
	header[i].key = 'featureB'
	delete header[i].custom
	i = htry('ratiob')
	if (i == -1) return ['ratioB missing']
	header[i].key = 'ratioB'
	delete header[i].custom
	i = htry('readsb')
	if (i == -1) return ['readsB missing']
	header[i].key = 'readsB'
	delete header[i].custom
	i = htry('sv_refseqb_aa_index')
	if (i != -1) {
		header[i].key = 'lstcontigaaB'
		delete header[i].custom
	}
	i = htry('sv_refseqb_contig_index')
	if (i != -1) {
		header[i].key = 'lstcontigbpB'
		delete header[i].custom
	}
	i = htry('total_readsb')
	if (i != -1) {
		header[i].key = 'totalreadsB'
		delete header[i].custom
	}
	// others
	i = htry('sv_inframe', 'frame')
	if (i == -1) return ['sv_inframe missing']
	header[i].key = 'lstframe'
	delete header[i].custom
	i = htry('sv_refseqa')
	if (i == -1) return ['sv_refseqA missing']
	header[i].key = 'lstisoforma'
	delete header[i].custom

	i = htry('sv_refseqa_codon')
	//if(i==-1) return ['sv_refseqA_codon missing']
	//header[i].key='lstisoformacodon'
	if (i != -1) {
		header[i].key = 'lstisoformacodon'
	}

	i = htry('sv_refseqb_codon')
	//if(i==-1) return ['sv_refseqB_codon missing']
	//header[i].key='lstisoformbcodon'
	if (i != -1) {
		header[i].key = 'lstisoformbcodon'
	}

	i = htry('score')
	if (i == -1) return ['score missing']
	header[i].key = 'score'
	delete header[i].custom
	i = htry('sv_refseqb')
	if (i == -1) return ['sv_refseqB missing']
	header[i].key = 'lstisoformb'
	delete header[i].custom
	i = htry('rating')
	if (i == -1) return ['rating missing']
	header[i].key = 'rating'
	delete header[i].custom

	i = htry('matcha')
	if (i == -1) return ['matchA missing']
	header[i].key = 'matchA'
	delete header[i].custom
	i = htry('matchb')
	if (i == -1) return ['matchB missing']
	header[i].key = 'matchB'
	delete header[i].custom
	i = htry('repeata')
	if (i == -1) return ['repeatA missing']
	header[i].key = 'repeatA'
	delete header[i].custom
	i = htry('repeatb')
	if (i == -1) return ['repeatB missing']
	header[i].key = 'repeatB'
	delete header[i].custom

	i = htry('functional effect')
	if (i == -1) return ['functional effect missing']
	header[i].key = 'type2'
	delete header[i].custom

	// may need to support other fusion builder format, so keep optional fields
	i = htry('sample')
	if (i != -1) {
		header[i].key = 'sample'
		delete header[i].custom
	}
	i = htry('sv_processing_exception')
	if (i != -1) {
		header[i].key = 'exception'
	}
	i = htry('medal')
	if (i != -1) {
		header[i].key = 'hlgene'
	}
	i = htry('sv_refseqa_exon')
	if (i != -1) {
		header[i].key = 'lstisoformaexon'
		delete header[i].custom
	}
	i = htry('sv_refseqb_exon')
	if (i != -1) {
		header[i].key = 'lstisoformbexon'
		delete header[i].custom
	}
	i = htry('sv_refseqa_anchor_type')
	if (i != -1) {
		header[i].key = 'lstisoformaanchor'
		delete header[i].custom
	}
	i = htry('sv_refseqb_anchor_type')
	if (i != -1) {
		header[i].key = 'lstisoformbanchor'
		delete header[i].custom
	}
	return [null, header]
}
