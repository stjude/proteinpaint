import * as client from './client'
import { renderSandboxFormDiv } from '../dom/sandbox.ts'

/*
copy-paste a junction-by-sample matrix and show data

data go into tk.fixeddata

*/

export default function (genomes, hostURL, jwt, holder) {
	let pane, inputdiv, gselect, filediv, saydiv, visualdiv
	if (holder !== undefined) [inputdiv, gselect, filediv, saydiv, visualdiv] = renderSandboxFormDiv(holder, genomes)
	else {
		;[pane, inputdiv, gselect, filediv, saydiv, visualdiv] = client.newpane3(100, 100, genomes)
		pane.header.text('Splice junctions by sample matrix visualization')
	}
	filediv.append('p').text('Enter junction-by-sample read count matrix data:')
	const ul = filediv.append('ul').style('color', '#858585').style('font-size', '.8em')
	ul.append('li').text('The matrix is tab-delimited, junctions on rows, samples on columns.')
	ul.append('li').text('First row lists sample names')
	ul.append('li').text('Each row is one junction, with read count in each sample')
	ul.append('li').text('Junction position example: chr21:39739570:+,chr21:39817327:+[,type], the type is optional')
	ul.append('li').text('Junction start and stop positions are 1-based and should be exonic bases but not intronic.')
	const ta1 = filediv
		.append('div')
		.append('textarea')
		.attr('rows', 6)
		.attr('cols', 50)
		.attr('placeholder', 'junction-by-sample matrix')
	setTimeout(() => ta1.node().focus(), 1100)
	const p = filediv.append('p')
	p.append('button')
		.text('Submit')
		.on('click', () => {
			saydiv.text('')
			const gn = gselect.options[gselect.selectedIndex].innerHTML
			const genomeobj = genomes[gn]
			if (!genomeobj) {
				saydiv.text('invalid genome name: ' + gn)
				return
			}
			const v = ta1.property('value')
			if (v == '') {
				return
			}
			const [err, junctions, samples] = junction_parsematrix(v, genomeobj)
			if (err) {
				saydiv.text(err)
				return
			}
			const range = new Map()
			for (const j of junctions) {
				if (!range.has(j.chr)) {
					range.set(j.chr, {
						chr: j.chr,
						start: j.start,
						stop: j.stop
					})
				}
				range.get(j.chr).start = Math.min(j.start, range.get(j.chr).start)
				range.get(j.chr).stop = Math.max(j.stop, range.get(j.chr).stop)
			}
			const arange = [...range][0][1]
			const tracks = [
				{
					type: client.tkt.junction,
					name: 'Junction',
					fixeddata: junctions,
					tracks: [
						{
							samplecount: samples.length
						}
					],
					iscustom: true
				}
			]
			client.first_genetrack_tolist(genomeobj, tracks)
			import('./block').then(
				b =>
					new b.Block({
						hostURL: hostURL,
						jwt: jwt,
						holder: holder !== undefined ? holder : pane.body.append('div'),
						genome: genomeobj,
						chr: arange.chr,
						start: arange.start,
						stop: Math.min(arange.start + 100000, arange.stop),
						nobox: true,
						tklst: tracks
					})
			)
			inputdiv.remove()
		})
	p.append('button')
		.text('Clear')
		.on('click', () => {
			ta1.property('value', '')
		})
	filediv
		.append('p')
		.html('<a href=https://www.dropbox.com/s/xu52ke9cify24hw/junction.txt?dl=0 target=_blank>Example file</a>')
}

function junction_parsematrix(text, gn) {
	const lines = text.trim().split('\n')
	if (lines.length <= 1) {
		return ['input should be at least 2 lines']
	}

	const lst = lines[0].split('\t')
	const samples = []
	for (let i = 1; i < lst.length; i++) {
		samples.push({
			tkid: Math.random().toString(),
			type: client.tkt.junction,
			name: lst[i]
		})
	}

	const junctions = []

	for (let i = 1; i < lines.length; i++) {
		const jstr = lines[i].split('\t')[0]
		const [e, j] = junction_parsecoord(jstr, gn)
		if (e) return ['Error parsing junction ' + jstr + ': ' + e]
		j.data = []
		junctions.push(j)
	}
	if (junctions.length == 0) {
		return ['No valid junctions']
	}
	for (let i = 1; i < lines.length; i++) {
		const lst = lines[i].split('\t')
		for (let j = 1; j < lst.length; j++) {
			if (lst[j] == '') {
				// allow blank
				continue
			}
			const readcount = Number.parseInt(lst[j])
			if (Number.isNaN(readcount) || readcount < 0) {
				return ['invalid read count ' + lst[j] + ' at line ' + (i + 1)]
			}
			if (readcount == 0) {
				// no zero
				continue
			}
			junctions[i - 1].data.push({
				tkid: samples[j - 1].tkid,
				sample: samples[j - 1].name,
				v: readcount
			})
		}
	}
	return [null, junctions, samples]
}

function junction_parsecoord(s, g) {
	const lst = s.split(',')
	if (lst.length < 2) return ['expecting two fields separated by comma']
	const a = lst[0].split(':'),
		b = lst[1].split(':'),
		jtype = lst[2]
	if (a.length != 3) return ['left position not 3 fields by :']
	if (b.length != 3) return ['right position not 3 fields by :']
	if (a[0] != b[0]) return ['disagreeing chromosomes']
	const pos1 = Number.parseInt(a[1])
	const pos2 = Number.parseInt(b[1])
	if (isNaN(pos1)) return ['invalid position 1']
	if (isNaN(pos2)) return ['invalid position 2']
	const start = Math.min(pos1, pos2) - 1
	const stop = Math.max(pos1, pos2) - 1
	let name = a[0].toLowerCase()
	if (name.indexOf('chr') != 0) {
		name = 'chr' + name
	}
	const chr = g.chrlookup[name.toUpperCase()]
	if (!chr) return ['invalid chromosome']
	if (start <= 0 || start >= chr.len) return ['position 1 out of bound']
	if (stop <= 0 || stop >= chr.len) return ['position 2 out of bound']
	if (start >= stop) return ['start greater than stop']
	const j = { chr: chr.name, start: start, stop: stop }
	if (jtype) {
		j.type = jtype
	}
	return [null, j]
}
