import { select as d3select, event as d3event } from 'd3-selection'
import * as client from './client'
import { scaleLog, scaleLinear } from 'd3-scale'
import { axisLeft } from 'd3-axis'
import { format as d3format } from 'd3-format'

export default function spectrumui(genomes) {
	const [pane, inputdiv, gselect, filediv, saydiv, visualdiv] = client.newpane3(100, 100, genomes)
	pane.header.text('Mutation burden & spectrum')
	pane.body.style('margin', '10px')
	inputdiv
		.append('div')
		.style('margin-top', '20px')
		.html(
			'<ul>' +
				'<li>Upload a text file</li>' +
				'<li>Line 1 must be a header with these columns:</li>' +
				'<ul><li><b>disease</b>, required, the diagrams will group samples by diseases.</li>' +
				'<li><b>patient</b>, the name of patient, individual, or sample.</li>' +
				'<li><b>sampletype</b>, optional, for describing different samples from the same patient, e.g. diagnosis and relapse.</li>' +
				'<li><b>reference_allele</b>, reference allele.</li>' +
				'<li><b>mutant_allele</b>, mutant allele.</li>' +
				'<li><b>mutant_readcount</b>, number of reads with mutant allele, optional, must be used together with total_readcount.</li>' +
				'<li><b>total_readcount</b>, total number of reads over the mutation site, optional.</li>' +
				'<li><b>flanking_left</b>, optional, upstream flanking nucleotide, limited to 1 nucleotide</li>' +
				'<li><b>flanking_right</b>, optional, downstream flanking nucleotide, limited to 1 you hear me</li>' +
				'</ul>' +
				'<li>Order of columns does not matter</li>' +
				'<li>Rest of the file are mutations, one per line</li>' +
				'<li>Spectrum plot will only use SNVs but not indels, mutation burden plot will count all.</li>' +
				'<li>Lines starting with # will be ignored</li>' +
				'</ul>'
		)
	inputdiv
		.append('p')
		.html('<a href=https://www.dropbox.com/s/qquzf6rxdejflk8/snv.spectrum.txt?dl=0 target=_blank>Example file</a>')
	function cmt(t, red) {
		saydiv.style('color', red ? 'red' : 'black').html(t)
	}
	const fileui = () => {
		filediv.selectAll('*').remove()
		const input = filediv
			.append('input')
			.attr('type', 'file')
			.on('change', () => {
				const file = d3event.target.files[0]
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
					const err = parseraw(event.target.result.trim().split('\n'), genomes[usegenome], file.name)
					if (err) {
						cmt(err, 1)
						fileui()
						return
					}
					pane.pane.remove()
				}
				reader.onerror = function() {
					cmt('Error reading file ' + file.name, 1)
					fileui()
					return
				}
				reader.readAsText(file, 'utf8')
			})

		setTimeout(()=>input.node().focus(), 1100)
	}
	fileui()
}

const sp = {
	subs: [
		{
			key: 'CT',
			change: ['CT', 'GA'],
			color: '#d4d131',
			//color:'#97c84a',
			color2: '#4eb6ea'
		},
		{
			key: 'AG',
			change: ['AG', 'TC'],
			color: '#faf75f',
			//color:'#afea56',
			color2: '#5e65b9'
		},
		{
			key: 'CG',
			change: ['CG', 'GC'],
			color: '#006a88',
			color2: '#3db94d'
		},
		{
			key: 'CA',
			change: ['CA', 'GT'],
			color: '#009cc9',
			color2: '#f68124'
		},
		{
			key: 'AT',
			change: ['AT', 'TA'],
			color: '#00b5ea',
			color2: '#e52c52'
		},
		{
			key: 'AC',
			change: ['AC', 'TG'],
			color: '#00c2fb',
			color2: '#bdbcbc'
		}
	],
	change0: { CT: 1, AG: 1, CG: 1, CA: 1, AT: 1, AC: 1 },
	change1: { GA: 'CT', TC: 'AG', GC: 'CG', GT: 'CA', TA: 'AT', TG: 'AC' },
	subcolor: {},
	change2subkey: {}
}

for (const s of sp.subs) {
	sp.subcolor[s.key] = s.color
	for (const c of s.change) {
		sp.change2subkey[c] = s.key
	}
}

const NT = { A: 'T', T: 'A', C: 'G', G: 'C' }

function parseraw(lines, genome, filename) {
	const [err, header] = parseheader(lines[0].trim())
	if (err) {
		return header
	}
	const hasst = header.indexOf('sampletype') != -1
	let good = 0
	const data = {},
		datasnv = {},
		badlines = [],
		setnamehash = {},
		drawtotal = {}
	for (let i = 1; i < lines.length; i++) {
		if (lines[i] == '') continue
		if (lines[i][0] == '#') continue
		const lst = lines[i].trim().split('\t')
		const m = {}
		for (let j = 0; j < header.length; j++) {
			m[header[j]] = lst[j]
		}
		if (!m.sample) {
			return ['Line ' + (i + 1) + ': missing sample']
		}
		if (hasst && !m.sampletype) {
			return ['Line ' + (i + 1) + ': missing sampletype']
		}
		if (!m.disease) {
			return ['Line ' + (i + 1) + ': missing disease']
		}
		good++

		if (!data[m.disease]) {
			data[m.disease] = {}
			datasnv[m.disease] = {}
			drawtotal[m.disease] = 0
		}
		drawtotal[m.disease]++
		if (!data[m.disease][m.sample]) {
			const s = {
				name: m.sample,
				alltotal: 0, // for mutation burden plot
				set: [] // ??????
			}
			if (hasst) {
				// don't do yet
			} else {
				s.set.push({ mlst: [] })
			}
			data[m.disease][m.sample] = s

			const s2 = {
				name: m.sample,
				alltotal: 0, // for mutation burden plot
				set: []
			}
			if (hasst) {
				// don't do yet
			} else {
				s2.set.push({ mlst: [] })
			}
			datasnv[m.disease][m.sample] = s2
		}

		if (m.ref) {
			m.ref = m.ref.toUpperCase()
		}
		if (m.mut) {
			m.mut = m.mut.toUpperCase()
		}
		const issnv = m.ref && NT[m.ref] && m.mut && NT[m.mut]

		data[m.disease][m.sample].alltotal++
		if (issnv) {
			datasnv[m.disease][m.sample].alltotal++
			// nonsynonymous snv
			const change = m.ref + m.mut
			if (sp.change0[change]) {
				m.change = change
			} else {
				m.change = sp.change1[change]
				m.changereverse = true
			}
		}

		// maf
		const mut = m.readcountmut ? Number.parseInt(m.readcountmut) : NaN
		const total = m.readcounttotal ? Number.parseInt(m.readcounttotal) : NaN
		if (!Number.isNaN(mut) && !Number.isNaN(total)) {
			m.maf = mut / total
		}
		const sobj = data[m.disease][m.sample]
		if (hasst) {
			const stname = m.sampletype.toLowerCase()
			let stobj = null
			for (const s of sobj.set) {
				if (s.name == stname) {
					stobj = s
					break
				}
			}
			if (stobj) {
				stobj.mlst.push(m)
			} else {
				sobj.set.push({
					name: stname,
					mlst: [m]
				})
			}
		} else {
			//  no separate sets -- put to default one
			sobj.set[0].mlst.push(m)
		}
		if (issnv) {
			const sobj = datasnv[m.disease][m.sample]
			if (hasst) {
				const stname = m.sampletype.toLowerCase()
				let stobj = null
				for (const s of sobj.set) {
					if (s.name == stname) {
						stobj = s
						break
					}
				}
				if (stobj) {
					stobj.mlst.push(m)
				} else {
					sobj.set.push({
						name: stname,
						mlst: [m]
					})
				}
			} else {
				//  no separate sets -- put to default one
				sobj.set[0].mlst.push(m)
			}
		}
	}
	// done iterating
	if (badlines.length > 0) {
		client.bulk_badline(header, badlines)
	}
	if (good == 0) {
		return ['No valid data']
	}
	// good data ready
	const pane = client.newpane({ x: 100, y: 100 })
	pane.header.text(filename)
	const ul = pane.body.append('ul')
	const hasflank = header.indexOf('lflank') != -1
	for (const disease in drawtotal) {
		let lacklflank = 0,
			lackrflank = 0
		if (hasflank) {
			// see if snv all has flank
			for (const sn in data[disease]) {
				for (const s of datasnv[disease][sn].set) {
					for (const m of s.mlst) {
						if (!m.lflank) lacklflank++
						if (!m.rflank) lackrflank++
					}
				}
			}
		}
		ul.append('li').text(disease)
		let snvcount = 0,
			snvsamplecount = 0
		for (const sn in datasnv[disease]) {
			snvsamplecount++
			for (const s of data[disease][sn].set) {
				snvcount += s.mlst.length
			}
		}
		const ul2 = ul.append('ul')
		ul2.append('li').text('total mutations: ' + drawtotal[disease])
		ul2.append('li').text('total SNVs: ' + snvcount)
		ul2.append('li').text(snvsamplecount + ' patients with SNVs')
		ul2
			.append('li')
			.html(
				hasflank
					? lacklflank + lackrflank == 0
						? 'all SNVs have flanking sequences'
						: (lacklflank ? lacklflank + ' SNVs lack left flank&nbsp;' : '') +
						  (lackrflank ? lackrflank + ' SNVs lack right flank' : '')
					: 'no flanking sequence'
			)
	}
	const d = pane.body.append('div').style('margin', '10px')
	d.append('div')
		.classed('sja_menuoption', true)
		.text('Mutation frequency / burden')
		.on('click', () => {
			burden_render(data, d3event.target.getBoundingClientRect())
		})
	d.append('div')
		.classed('sja_menuoption', true)
		.text('Mutation spectrum')
		.on('click', () => {
			spectrum_render(datasnv)
		})
	if (hasflank) {
		d.append('div')
			.classed('sja_menuoption', true)
			.text('SNV flanking sequence pattern')
			.on('click', () => {
				snvflank_render(data)
			})
	}
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
	let i = htry('patient', 'sample')
	if (i == -1) return 'sample missing from header'
	header[i] = 'sample'
	i = htry('reference_allele')
	if (i == -1) return 'reference_allele missing from header'
	header[i] = 'ref'
	i = htry('tumorseq_allele2', 'mutant_allele')
	if (i == -1) return 'mutant_allele missing from header'
	header[i] = 'mut'
	i = htry('disease', 'diseases')
	if (i == -1) return 'disease missing from header'
	header[i] = 'disease'
	i = htry('tumor_readcount_alt', 'mutant_readcount')
	if (i != -1) header[i] = 'readcountmut'
	i = htry('tumor_readcount_total', 'total_readcount')
	if (i != -1) header[i] = 'readcounttotal'
	i = htry('sampletype')
	if (i != -1) header[i] = 'sampletype' // sample origin
	i = htry('flanking_left')
	if (i != -1) header[i] = 'lflank'
	i = htry('flanking_right')
	if (i != -1) header[i] = 'rflank'
	return [null, header]
}

function burden_render(data, p) {
	/* data
key: disease
val: {}
   key: sample
   val: see doc
*/
	const pane = client.newpane({ x: p.left + 200, y: p.top - 100 })
	pane.body
		.append('button')
		.style('display', 'block')
		.text('SVG')
		.on('click', () => client.to_svg(svg.node(), 'burden'))
	const scalewidth = 50,
		dwidth = 100,
		dpad = 10,
		toppad = 20,
		height = 300,
		labpad = 10,
		labfontsize = dwidth / 5
	const svg = pane.body.append('svg')
	let maxlabelw = 0
	const diseaselst = []
	const dsamplespace = {}
	let maxmutationf = 0,
		minmutationf = null
	for (const diseasename in data) {
		const sethash = new Set()
		for (const n in data[diseasename]) {
			for (const s of data[diseasename][n].set) {
				if (s.name) {
					sethash.add(s.name)
				}
			}
		}
		const setnames = [...sethash]
		if (setnames.length == 0) {
			// hack for all
			setnames.push(null)
		}
		for (const setname of setnames) {
			const dsname = diseasename + (setname ? ' - ' + setname : '')
			svg
				.append('text')
				.text(dsname)
				.attr('font-size', labfontsize)
				.attr('font-family', client.font)
				.each(function() {
					maxlabelw = Math.max(maxlabelw, this.getBBox().width)
				})
				.remove()
			const samplelst = []
			for (const samplename in data[diseasename]) {
				let count = null // mutation count in this sample
				if (setname) {
					for (const s of data[diseasename][samplename].set) {
						if (s.name == setname) {
							count = s.mlst.length
						}
					}
					if (count == null) {
						// this sample does not have this set!!
						continue
					}
				} else {
					count = data[diseasename][samplename].set[0].mlst.length
				}
				let f = count //
				samplelst.push({
					disease: dsname,
					name: samplename,
					f: f
				})
				maxmutationf = Math.max(maxmutationf, f)
				if (minmutationf == null) {
					minmutationf = count
				} else {
					minmutationf = Math.min(minmutationf, f)
				}
			}
			samplelst.sort((a, b) => a.f - b.f)
			diseaselst.push({
				name: dsname,
				median: samplelst[Math.floor((samplelst.length - 1) / 2)].f,
				samples: samplelst
			})
			dsamplespace[dsname] = dwidth / samplelst.length
		}
	}
	diseaselst.sort((a, b) => a.median - b.median)
	svg
		.attr('width', scalewidth + diseaselst.length * (dwidth + dpad) + 100)
		.attr('height', toppad + height + labpad + maxlabelw)
	// y lab
	svg
		.append('g')
		.attr('transform', 'translate(10,' + (toppad + height / 2) + ')')
		.append('text')
		.text('Background mutation rate')
		.attr('font-size', 14)
		.attr('font-family', client.font)
		.attr('text-anchor', 'middle')
		.attr('donimant-baseline', 'central')
		.attr('transform', 'rotate(-90)')
	// y axis
	const g = svg.append('g').attr('transform', 'translate(' + scalewidth + ',' + toppad + ')')
	let yscale
	if (1 || minmutationf > 0) {
		yscale = scaleLog()
	} else {
		yscale = scaleLinear()
	}
	yscale.domain([minmutationf == 0 ? 0.1 : minmutationf, maxmutationf]).range([height, 0])
	g.call(
		axisLeft()
			.scale(yscale)
			.ticks(8)
	)
	client.axisstyle({
		axis: g,
		color: 'black',
		showline: true
	})
	const g2 = svg.append('g').attr('transform', 'translate(' + (scalewidth + dpad) + ',' + toppad + ')')
	// disease groups
	const diseasegroup = g2
		.selectAll()
		.data(diseaselst)
		.enter()
		.append('g')
		.attr('transform', (d, i) => 'translate(' + (dwidth + dpad) * i + ',' + height + ')')
	// shade
	diseasegroup
		.append('rect')
		.attr('y', -height)
		.attr('width', dwidth)
		.attr('height', height)
		.attr('fill', '#f1f1f1')
	// median bar
	diseasegroup
		.append('rect')
		.attr('y', d => yscale(d.median) - 2 - height)
		.attr('x', 0)
		.attr('width', dwidth)
		.attr('height', 4)
		.attr('fill', '#FF6666')
		.attr('shape-rendering', 'crispEdges')
	// label
	diseasegroup
		.append('g')
		.attr('transform', 'translate(' + dwidth / 2 + ',' + labpad + ')')
		.append('text')
		.text(d => d.name)
		.attr('font-size', labfontsize)
		.attr('font-family', client.font)
		.attr('text-anchor', 'end')
		.attr('dominant-baseline', 'central')
		.attr('transform', 'rotate(-90)')
	// dots
	diseasegroup
		.append('g')
		.selectAll()
		.data(d => d.samples)
		.enter()
		.append('circle')
		.attr('cx', (d, i) => i * dsamplespace[d.disease])
		.attr('cy', d => yscale(d.f == 0 ? 0.1 : d.f) - height)
		.attr('r', 4)
		.attr('fill', 'black')
		.attr('fill-opacity', 0.3)
		.attr('stroke', 'none')
}

function spectrum_render(data) {
	const pane = client.newpane({ x: 50, y: 50 })
	for (const disease in data) {
		for (const sample in data[disease]) {
			const sobj = data[disease][sample]
			for (const s of sobj.set) {
				const sum = {}
				for (const s0 of sp.subs) {
					sum[s0.key] = []
				}
				for (const b of s.mlst) {
					for (const s of sp.subs) {
						if (b.change == s.change[0] || b.change == s.change[1]) {
							sum[s.key].push(b)
						}
					}
				}
				s.sum = sum
			}
		}
	}
	// each disease
	for (const disease in data) {
		const samples = []
		const setnamehash = new Set()
		let maxmcount = 0
		for (const sample in data[disease]) {
			const s = data[disease][sample]
			let snvtotal = 0
			for (const i of s.set) {
				snvtotal += i.mlst.length
				if (i.name) {
					setnamehash.add(i.name)
				}
			}
			s.snvtotal = snvtotal
			if (snvtotal == 0) {
				continue
			}
			for (const s2 of s.set) {
				if (s2.mlst.length == 0) continue
				maxmcount = Math.max(s2.mlst.length, maxmcount)
				s2.sub = []
				const percentage = []
				for (const a of sp.subs) {
					percentage.push(s2.sum[a.key].length / s2.mlst.length)
				}
				for (let i = 0; i < sp.subs.length; i++) {
					const change = sp.subs[i].key
					const ele = {
						type: change,
						perc: percentage[i],
						count: s2.sum[change].length,
						cum: 0
					}
					for (let j = 0; j < i; j++) {
						ele.cum += percentage[j]
					}
					s2.sub.push(ele)
				}
			}
			samples.push(s)
		}
		const snlst = [...setnamehash]
		if (snlst.length == 0) {
			snlst.push(null)
		}
		const div = pane.body
			.append('div')
			.append('div')
			.style('margin', '80px 200px 10px 10px')
			.style('display', 'inline-block')
			.style('position', 'relative')

		const samplecount = samples.reduce((i, j) => i + j.set.length, 0)

		spectrum_init(
			{
				name: disease,
				data: samples,
				sort: { i: 0, n: 'tran' },
				mcountcutoff: null,
				max: maxmcount,
				mafcat: true,
				setnames: snlst,
				barwidth: Math.max(1, 800 / samplecount),
				barheight: 200
			},
			div
		)
	}
	// done diseases
}

const mafcat = [{ v: 0.2, n: '0-0.2' }, { v: 0.3, n: '0.2-0.3' }, { v: 0.6, n: '0.3-0.6' }, { v: 1, n: '0.6-1' }]

function spectrum_init(p, holder) {
	holder.selectAll('*').remove()
	const guide = holder.append('div').style('margin', '10px')
	guide
		.append('span')
		.text(p.name)
		.style('font-weight', 'bold')
	if (!p.nodetail) {
		let t = 0
		for (const s of p.data) {
			t += s.snvtotal
		}
		guide
			.append('span')
			.style('padding-left', '20px')
			.append('span')
			.text(p.data.length + ' samples, ' + t + ' mutations')
	}
	guide
		.append('input')
		.style('margin-left', '20px')
		.attr('placeholder', 'mutation burden cutoff')
		.attr('size', 20)
		.property('value', p.mcountcutoff == null ? '' : p.mcountcutoff)
		.on('keyup', () => {
			if (d3event.code != 'Enter') return
			const v = d3event.target.value
			let cutoff
			if (v == '') {
				p.mcountcutoff = null
				cutoff = p.max
			} else {
				cutoff = Number.parseInt(v)
				if (Number.isNaN(cutoff) || cutoff <= 0) {
					alert('invalid cutoff')
					return
				}
			}
			setcutoff(cutoff)
		})
	guide
		.append('span')
		.style('padding-left', '20px')
		.html('sort samples by&nbsp;')
	const select = guide
		.append('select')
		.style('margin-right', '20px')
		.on('change', () => {
			const s = select.node()
			const o = s.options[s.selectedIndex]
			p.sort = {
				i: Number.parseInt(o.getAttribute('i')),
				n: o.getAttribute('n')
			}
			spectrum_sort(p)
			spectrum_init(p, holder)
		})

	for (let i = 0; i < p.setnames.length; i++) {
		const name = p.setnames[i]
		const o1 = select
			.append('option')
			.text((name ? name + ' ' : '') + 'transversion rate')
			.attr('i', i)
			.attr('n', 'tran')
		if (p.sort.i == i && p.sort.n == 'tran') {
			o1.attr('selected', 1)
		}
		const o2 = select
			.append('option')
			.text((name ? name + ' ' : '') + 'mutation burden')
			.attr('i', i)
			.attr('n', 'burd')
		if (p.sort.i == i && p.sort.n == 'burd') {
			o2.attr('selected', 1)
		}
	}
	guide
		.append('button')
		.text('SVG')
		.on('click', () => client.to_svg(svg.node(), 'spectrum ' + p.name))
	guide
		.append('input')
		.style('margin-left', '20px')
		.attr('placeholder', 'bar width and height')
		.attr('size', 20)
		.on('keyup', () => {
			if (d3event.code != 'Enter') return
			const lst = d3event.target.value.split(' ')
			if (lst.length != 2) {
				alert('width and height joined by space')
				return
			}
			const w = Number.parseInt(lst[0])
			const h = Number.parseInt(lst[1])
			if (Number.isNaN(w)) {
				alert('invalid width')
				return
			}
			if (Number.isNaN(h)) {
				alert('invalid height')
				return
			}
			resize(h, w)
		})
	// done guide

	spectrum_sort(p)

	const samplecount = p.data.reduce((i, j) => i + j.set.length, 0)

	let mafcath = 13,
		legheight = 15, // legend row height
		pad3 = 3,
		pad4 = 3,
		pad5 = 7,
		mcheight = 50,
		width = 1000,
		pad = 10,
		pad2 = 15,
		labpad = 5,
		scalewidth = 100,
		maxlabelw = 0,
		maxsetlabelw = 0

	const svg = holder.append('svg')

	// legend, fixed size
	const leg = svg
		.append('g')
		.attr('transform', 'translate(' + scalewidth + ',0)')
		.selectAll()
		.data(sp.subs)
		.enter()
		.append('g')
		.attr('transform', (d, i) => 'translate(' + i * 100 + ',0)')
	leg
		.append('rect')
		.attr('fill', d => sp.subcolor[d.key])
		.attr('width', 15)
		.attr('height', 15)
	leg
		.append('text')
		.text(d => {
			const a = d.change[0],
				b = d.change[1]
			return a[0] + '(' + b[0] + ')>' + a[1] + '(' + b[1] + ')'
		})
		.attr('font-size', legheight - 2)
		.attr('font-family', client.font)
		.attr('x', 18)
		.attr('y', legheight / 2)
		.attr('dominant-baseline', 'central')

	const g0 = svg.append('g').attr('transform', 'translate(0,' + (legheight + pad) + ')')
	// left titles
	const llab1 = g0.append('text').text('Mutation')
	const llab2 = g0
		.append('text')
		.text('spectrum')
		.attr('dominant-baseline', 'hanging')
	const llabg2 = g0.append('g')
	const llab3 = llabg2.append('text').text('Mutation')
	const llab4 = llabg2
		.append('text')
		.text('count')
		.attr('dominant-baseline', 'hanging')
	let llab5, llab6
	if (p.mafcat) {
		llab5 = llabg2.append('text').text('MAF')
		llab6 = llabg2
			.append('text')
			.text('distri.')
			.attr('dominant-baseline', 'hanging')
	}

	// scale left top
	const axis = axisLeft()
		.tickSize(4)
		.tickValues([0, 1])
		.tickFormat(d3format('.0f'))
	const axisg = g0.append('g').attr('transform', 'translate(' + (scalewidth - 2) + ',0)')
	// scale left bottom
	const mcountscale = scaleLinear()
		.domain([0, 0])
		.range([0, mcheight])
	const mcountaxis = axisLeft()
		.scale(mcountscale)
		.tickSize(4)
	const mcountaxisg = g0.append('g')
	// samples
	const sample_g = g0.append('g').attr('transform', 'translate(' + scalewidth + ',0)')
	const gsample = sample_g
		.selectAll()
		.data(p.data)
		.enter()
		.append('g')
	// one bar per sampletype
	const gbar = gsample
		.selectAll()
		.data(d => d.set)
		.enter()
		.append('g')
	// spectrum bars
	const gbarbox = gbar
		.filter(d => d.sub)
		.selectAll()
		.data(d => d.sub)
		.enter()
		.append('rect')
		.attr('fill', d => sp.subcolor[d.type])
		.attr('shape-rendering', 'crispEdges')
	// mutation count bar
	const mcountbarg = gbar.append('g')
	const mcountbar = mcountbarg
		.append('rect')
		.attr('height', 0)
		.attr('fill', '#545454')
		.attr('shape-rendering', 'crispEdges')
	// sample label
	const samplelabg = gsample.append('g')
	const samplelabtext = samplelabg
		.append('text')
		.text(d => d.name)
		.attr('font-family', client.font)
		.attr('text-anchor', 'end')
		.attr('dominant-baseline', 'central')
		.attr('transform', 'rotate(-90)')
		.classed('sja_svgtext2', true)
		.on('mouseover', d => {
			const pos = d3event.target.getBoundingClientRect()
			const div = client
				.menushow(pos.left + 30, pos.top)
				.append('div')
				.style('border', 'solid 1px black')
				.style('padding', '10px')
			for (const ss of d.set) {
				div
					.append('div')
					.style('margin', '5px 0px')
					.html('<span style="color:#858585">name:</span> ' + (ss.name ? ss.name : d.name))
				if (!ss.sub) {
					div
						.append('div')
						.style('margin', '5px 0px')
						.text(ss.name + ': no non-synonymous SNV')
					continue
				}
				div
					.append('div')
					.style('margin', '5px 0px')
					.html('<span style="color:#858585">total:</span> ' + ss.mlst.length)
				const table = div.append('table')
				const tr = table.append('tr').style('color', '#858585')
				tr.append('td')
				tr.append('td').text('count')
				if (p.mafcat) {
					for (let i = 0; i < mafcat.length; i++) {
						tr.append('td')
							.style('background-color', i % 2 == 0 ? '#f0f0f0' : '')
							.style('font-size', '.7em')
							.style('padding-right', '5px')
							.text(mafcat[i].n)
					}
				}
				for (var i = 0; i < sp.subs.length; i++) {
					const v = ss.sub[i]
					if (v.count == 0) continue
					const tr = table.append('tr')
					tr.append('td')
						.style('background-color', sp.subs[i].color)
						.style('font-size', '.8em')
						.text(v.type[0] + '>' + v.type[1])
					tr.append('td').text(v.count)
					if (p.mafcat) {
						const vlst = []
						for (const j of mafcat) {
							vlst.push(0)
						}
						const mlst = ss.sum[v.type]
						for (let j = 0; j < mlst.length; j++) {
							for (let k = 0; k < mafcat.length; k++) {
								if (mlst[j].maf <= mafcat[k].v) {
									vlst[k]++
									break
								}
							}
						}
						for (let j = 0; j < vlst.length; j++) {
							const mcv = vlst[j]
							tr.append('td')
								.style('background-color', j % 2 == 0 ? '#f0f0f0' : '')
								.text(mcv > 0 ? mcv : '')
						}
					}
				}
			}
		})
	// sampletype label
	const stlabg = gbar.filter(d => d.name).append('g')
	const stlabtext = stlabg
		.append('text')
		.text(d => d.name)
		.attr('font-family', client.font)
		.attr('text-anchor', 'end')
		.attr('dominant-baseline', 'central')
		.attr('transform', 'rotate(-90)')
	// mafcat
	let mafcatlabg, mafcatbarg, mafcatbar
	if (p.mafcat) {
		for (const s of p.data) {
			for (const ss of s.set) {
				const lst = []
				for (const i of mafcat) {
					lst.push(0)
				}
				for (const m of ss.mlst) {
					if (m.maf == undefined) continue
					for (let i = 0; i < mafcat.length; i++) {
						if (m.maf <= mafcat[i].v) {
							lst[i]++
							break
						}
					}
				}
				const max = Math.max(...lst)
				const flst = []
				for (const i of lst) {
					if (i == 0) {
						flst.push(0)
					} else {
						flst.push(i / max)
					}
				}
				ss.mafcat = flst
			}
		}
		// labels
		mafcatlabg = g0.append('g')
		mafcatlabg
			.selectAll()
			.data(mafcat)
			.enter()
			.append('text')
			.text(d => d.n)
			.attr('y', (d, i) => mafcath * (i + 0.5))
			.attr('font-size', mafcath)
			.attr('font-family', client.font)
			.attr('text-anchor', 'end')
			.attr('dominant-baseline', 'central')
		mafcatbarg = gbar.append('g')
		mafcatbar = mafcatbarg
			.selectAll()
			.data(d => d.mafcat)
			.enter()
			.append('g')
			.attr('transform', (d, i) => 'translate(0,' + mafcath * i + ')')
			.append('rect')
			.attr('fill-opacity', d => d)
			.attr('fill', '#990000')
			.attr('height', mafcath)
			.attr('shape-rendering', 'crispEdges')
	}
	const resizebutton = holder
		.append('div')
		.style('position', 'absolute')
		.style('right', '0px')
		.style('bottom', '0px')
		.text('drag to resize')
		.classed('sja_clbtext', true)
		.on('mousedown', () => {
			d3event.preventDefault()
			const b = d3select(document.body)
			const x = d3event.clientX
			const y = d3event.clientY
			const w = p.barwidth
			const h = p.barheight
			b.on('mousemove', () => {
				resize(h + d3event.clientY - y, w + (d3event.clientX - x) / samplecount)
			})
			b.on('mouseup', () => {
				b.on('mousemove', null).on('mouseup', null)
			})
		})
	function resize(barh, barw) {
		if (barh) {
			p.barheight = barh
			p.barwidth = barw
		}
		const barheight = p.barheight
		const barwidth = p.barwidth
		const svgwidth = scalewidth + Math.max(sp.subs.length * 100, samplecount * barwidth)
		svg.attr('width', svgwidth)
		maxlabelw = 0
		maxsetlabelw = 0
		if (barwidth >= 8) {
			// show sample label
			for (const i of p.data) {
				svg
					.append('text')
					.text(i.name)
					.attr('font-size', barwidth)
					.attr('font-family', client.font)
					.each(function() {
						maxlabelw = Math.max(maxlabelw, Math.ceil(this.getBBox().width))
					})
					.remove()
				for (const j of i.set) {
					if (!j.name) continue
					svg
						.append('text')
						.text(j.name)
						.attr('font-size', barwidth)
						.attr('font-family', client.font)
						.each(function() {
							maxsetlabelw = Math.max(maxsetlabelw, Math.ceil(this.getBBox().width))
						})
						.remove()
				}
			}
			samplelabg.attr(
				'transform',
				d => 'translate(' + barwidth / 2 + ',' + (barheight + pad3 + maxsetlabelw + pad4) + ')'
			)
			samplelabtext.attr('font-size', barwidth)
			stlabg.attr('transform', d => 'translate(' + barwidth / 2 + ',' + (barheight + pad3) + ')')
			stlabtext.attr('font-size', barwidth)
		} else {
			// hide sample label
			samplelabtext.attr('font-size', 0)
			stlabtext.attr('font-size', 0)
		}
		if (maxsetlabelw == 0) {
			pad4 = 0
		}
		const svgheight =
			legheight +
			pad +
			barheight +
			pad3 +
			maxsetlabelw +
			pad4 +
			maxlabelw +
			pad5 +
			mcheight +
			pad2 +
			(p.mafcat ? mafcat.length * mafcath : 0) +
			20
		svg.attr('height', svgheight)
		llab1.attr('y', barheight / 2 - 1)
		llab2.attr('y', barheight / 2 + 1)
		llabg2.attr('transform', 'translate(0,' + (barheight + pad3 + maxsetlabelw + pad4 + maxlabelw + pad5) + ')')
		llab3.attr('y', mcheight / 2 - 1)
		llab4.attr('y', mcheight / 2 + 1)
		if (llab5) {
			llab5.attr('y', mcheight + pad2 + (mafcat.length * mafcath) / 2 - 1)
			llab6.attr('y', mcheight + pad2 + (mafcat.length * mafcath) / 2 + 1)
		}
		axis.scale(
			scaleLinear()
				.domain([0, 1])
				.range([barheight, 0])
		)
		axisg.call(axis)
		client.axisstyle({
			axis: axisg,
			color: 'black',
			showline: true
		})
		mcountaxisg.attr(
			'transform',
			'translate(' + (scalewidth - 2) + ',' + (barheight + pad3 + maxsetlabelw + pad4 + maxlabelw + pad5) + ')'
		)
		let barcount = 0
		gsample.attr('transform', d => {
			const str = 'translate(' + barcount * barwidth + ',0)'
			barcount += d.set.length
			return str
		})
		gbar.attr('transform', (d, i) => 'translate(' + i * barwidth + ',0)')
		gbarbox
			.attr('y', d => d.cum * barheight)
			.attr('height', d => d.perc * barheight)
			.attr('width', barwidth)
		mcountbarg.attr('transform', 'translate(0,' + (barheight + pad3 + maxsetlabelw + pad4 + maxlabelw + pad5) + ')')
		mcountbar.attr('width', barwidth)
		if (mafcatlabg) {
			mafcatlabg.attr(
				'transform',
				'translate(' +
					(scalewidth - 2) +
					',' +
					(barheight + pad3 + maxsetlabelw + pad4 + maxlabelw + pad5 + mcheight + pad2) +
					')'
			)
			mafcatbarg.attr(
				'transform',
				'translate(0,' + (barheight + pad3 + maxsetlabelw + pad4 + maxlabelw + pad5 + mcheight + pad2) + ')'
			)
			mafcatbar.attr('width', barwidth)
		}
		//resizebutton.attr('x',svgwidth-5) .attr('y',svgheight-3)
		// end of resize()
	}
	resize()
	setcutoff(p.mcountcutoff == null ? p.max : p.mcountcutoff)
	function setcutoff(cutoff) {
		p.mcountcutoff = cutoff
		mcountscale.domain([0, cutoff])
		mcountaxis.scale(mcountscale).tickValues([0, cutoff])
		mcountaxisg.call(mcountaxis)
		client.axisstyle({
			axis: mcountaxisg,
			showline: true,
			color: 'black'
		})
		mcountbar.transition().attr('height', d => (Math.min(d.mlst.length, cutoff) * mcheight) / cutoff)
		mcountbarg.selectAll('text').remove()
		mcountbarg
			.filter(d => d.mlst.length > cutoff)
			.append('text')
			.text(d => d.mlst.length)
			.attr('fill', 'white')
			.attr('font-size', p.barwidth)
			.attr('font-family', client.font)
			.attr('text-anchor', 'end')
			.attr('dominant-baseline', 'hanging')
			.attr('transform', 'rotate(-90)')
			.attr('y', 1)
			.each(function(d) {
				d._mcountstrw = this.getBBox().width
			})
			.attr('x', d => d._mcountstrw - mcheight)
	}
}

function spectrum_sort(p) {
	if (p.sort.n == 'tran') {
		// by transversion rate
		p.data.sort((a, b) => {
			var A = a.set[p.sort.i],
				B = b.set[p.sort.i]
			if (!A) {
				if (!B) {
					return 0
				}
				return 1
			}
			if (!B) {
				return -1
			}
			if (!A.sub) {
				if (!B.sub) {
					return 0
				}
				return 1
			}
			if (!B.sub) {
				return -1
			}
			var ct1 = A.sub[0].perc,
				ct2 = B.sub[0].perc,
				ag1 = A.sub[1].perc,
				ag2 = B.sub[1].perc
			if (ct1 + ag1 == ct2 + ag2) {
				if (ct1 == ct2) {
					var cg1 = A.sub[2].perc,
						cg2 = B.sub[2].perc
					if (cg1 == cg2) {
						var ca1 = A.sub[3].perc,
							ca2 = B.sub[3].perc
						return ca1 - ca2
					} else {
						return cg2 - cg1
					}
				} else {
					return ct1 - ct2
				}
			} else {
				return ct1 + ag1 - ct2 - ag2
			}
		})
	} else {
		// by burden
		p.data.sort((a, b) => {
			var A = a.set[p.sort.i],
				B = b.set[p.sort.i]
			if (!A) {
				if (!B) {
					return 0
				}
				return 1
			}
			if (!B) {
				return -1
			}
			return b.set[p.sort.i].mlst.length - a.set[p.sort.i].mlst.length
		})
	}
}

function snvflank_render(data) {
	const pane = client.newpane({ x: 50, y: 50 })
	const barheight = 200,
		barwidth = 10,
		scalewidth = 70,
		pad = 10,
		sp1 = 2,
		sp2 = 15,
		flanklabh = 30,
		translabfontsize = 20,
		fllst = []
	for (const a in NT) {
		for (const b in NT) {
			fllst.push(a + b)
		}
	}
	for (const diseasename in data) {
		const sethash = new Set()
		for (const n in data[diseasename]) {
			for (const s of data[diseasename][n].set) {
				if (s.name) {
					sethash.add(s.name)
				}
			}
		}
		const setnames = [...sethash]
		if (setnames.length == 0) {
			setnames.push(null) // hack for all
		}
		setnames.sort()
		for (const setname of setnames) {
			const dsname = diseasename + (setname ? ' - ' + setname : '')
			const subs = {}
			/* k: substitution
		   v: {}
		      k: l-r flank
			  v: snv count
		*/
			for (const s of sp.subs) {
				var a = {}
				for (const b of fllst) {
					a[b] = 0
				}
				subs[s.key] = a
			}
			for (const sample in data[diseasename]) {
				for (const set of data[diseasename][sample].set) {
					if (setname) {
						if (!set.name || set.name != setname) continue
					} else {
						if (set.name) continue
					}
					for (const m of set.mlst) {
						let l = m.lflank,
							r = m.rflank
						if (!l || !r) continue
						l = l.toUpperCase()
						r = r.toUpperCase()
						let flank
						if (m.changereverse) {
							flank = NT[r] + NT[l]
						} else {
							flank = l + r
						}
						subs[sp.change2subkey[m.change]][flank]++
					}
				}
			}
			let maxsnvcount = 0
			let snvtotal = 0
			for (const k in subs) {
				for (const j in subs[k]) {
					maxsnvcount = Math.max(maxsnvcount, subs[k][j])
					snvtotal += subs[k][j]
				}
			}
			const holder = pane.body.append('div').style('margin', '15px')
			holder.append('div').text(dsname)
			const svg = holder.append('svg')
			svg
				.attr('height', pad + barheight + flanklabh + translabfontsize)
				.attr('width', scalewidth + sp.subs.length * (sp2 + fllst.length * (barwidth + sp1) - sp1))
			const scale = scaleLinear()
				.domain([0, (maxsnvcount * 100) / snvtotal])
				.range([barheight, 0])
			const g = svg
				.append('g')
				.attr('transform', 'translate(' + scalewidth + ',' + pad + ')')
				.call(axisLeft().scale(scale))
			client.axisstyle({
				axis: g,
				color: 'black',
				showline: true
			})
			svg
				.append('g')
				.attr('transform', 'translate(10,' + (pad + barheight / 2) + ')')
				.append('text')
				.text('SNV percentage')
				.attr('font-size', 15)
				.attr('text-anchor', 'middle')
				.attr('dominant-baseline', 'middle')
				.attr('transform', 'rotate(-90)')
			for (let i = 0; i < sp.subs.length; i++) {
				const subkey = sp.subs[i].key
				const g = svg
					.append('g')
					.attr(
						'transform',
						'translate(' +
							(scalewidth + sp2 + (sp2 + fllst.length * (barwidth + sp1) - sp1) * i) +
							',' +
							(pad + barheight) +
							')'
					)
				g.append('text')
					.text(subkey[0] + '>' + subkey[1])
					.attr('x', (fllst.length * (barwidth + sp1) - sp1) / 2)
					.attr('y', flanklabh)
					.attr('text-anchor', 'middle')
					.attr('dominant-baseline', 'hanging')
					.attr('font-size', translabfontsize)
				for (let j = 0; j < fllst.length; j++) {
					const g2 = g.append('g').attr('transform', 'translate(' + ((barwidth + sp1) * j + barwidth / 2) + ',0)')
					g2.append('g')
						.attr('transform', 'translate(0,15)')
						.append('text')
						.text(fllst[j])
						.attr('font-size', barwidth)
						.attr('text-anchor', 'middle')
						.attr('dominant-baseline', 'middle')
						.attr('transform', 'rotate(-90)')
					const h = scale((subs[subkey][fllst[j]] * 100) / snvtotal)
					g2.append('rect')
						.attr('fill', sp.subcolor[subkey])
						.attr('x', -barwidth / 2)
						.attr('y', h - barheight)
						.attr('width', barwidth)
						.attr('height', barheight - h)
						.attr('shape-rendering', 'crispEdges')
				}
			}
		}
	}
}
