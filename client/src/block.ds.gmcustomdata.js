import * as client from './client'
import * as common from '#shared/common'
import * as coord from './coord'

// TODO reuse ui for genomic mode too

export default function (block) {
	if (!block.usegm) {
		return
	}
	const tip = block.tip.d
	tip
		.append('div')
		.text(`Add data to show over ${block.usegm.name} ${block.usegm.isoform}`)
		.style('margin', '10px')
		.style('font-size', '.8em')
	// snv
	tip
		.append('div')
		.attr('class', 'sja_menuoption')
		.style('border-radius', '0px')
		.text('Mutation')
		.on('click', () => {
			customdataui_snv(block)
		})
	// sv
	tip
		.append('div')
		.attr('class', 'sja_menuoption')
		.style('border-radius', '0px')
		.text('SV/Fusion')
		.on('click', () => {
			customdataui_sv(block)
		})

	/*
		show both itd and del as cnvs (itd may be specially designated)
	// itd
	tip
		.append('div')
		.attr('class','sja_menuoption')
		.style('border-radius', '0px')
		.text('Internal Tandem Duplication')
		.on('click', () => {
			customdataui_itd(block)
		})
	// del
	tip
		.append('div')
		.attr('class','sja_menuoption')
		.style('border-radius', '0px')
		.text('Intragenic Deletion')
		.on('click', () => {
			customdataui_del(block)
		})
		*/
}

function customdataui_sv(block, x, y) {
	block.tip.clear()
	const div = block.tip.d.append('div').style('margin', '25px')
	div.append('p').text('SV/fusion events of ' + block.usegm.name + ' (' + block.genome.name + ')')
	div
		.append('p')
		.style('font-size', '.9em')
		.html('<span style="font-size:.8em;color:#aaa">EXAMPLE</span> PAX5,NM_016734,201,JAK2,NM_004972,812')
	const ta = div.append('textarea').attr('cols', '50').attr('rows', '3')

	const nameinput = div
		.append('div')
		.append('input')
		.attr('type', 'text')
		.style('width', '130px')
		.property('placeholder', 'Dataset name')

	const row = div.append('div').style('margin-top', '5px')
	const select = row.append('select')
	select.append('option').text('Codon position')
	select.append('option').text('RNA position')
	select.append('option').text('Genomic position')
	row
		.append('button')
		.style('margin-left', '5px')
		.text('Submit')
		.on('click', () => {
			const v = ta.property('value')
			if (v == '') return
			says.style('display', 'none')
			const mlst = []
			const bad = []
			for (const line of v.trim().split('\n')) {
				const l = line.split(',')
				if (l.length < 6) {
					bad.push(line + ': less than 6 fields')
					continue
				}
				const selecti = select.node().selectedIndex
				let codon1 = null,
					codon2 = null,
					rnapos1 = null,
					rnapos2 = null,
					chr1 = null,
					chr2 = null,
					position1 = null,
					position2 = null
				if (selecti == 0) {
					codon1 = Number.parseInt(l[2].trim())
					if (Number.isNaN(codon1)) {
						bad.push(line + ': N-term codon position is not integer')
						continue
					}
					codon2 = Number.parseInt(l[5].trim())
					if (Number.isNaN(codon2)) {
						bad.push(line + ': C-term codon position is not integer')
						continue
					}
				} else if (selecti == 1) {
					rnapos1 = Number.parseInt(l[2].trim())
					if (Number.isNaN(rnapos1)) {
						bad.push(line + ': N-term RNA position is not integer')
						continue
					}
					rnapos2 = Number.parseInt(l[5].trim())
					if (Number.isNaN(rnapos2)) {
						bad.push(line + ': C-term RNA position is not integer')
						continue
					}
				} else {
					let t = l[2].trim().split(':')
					if (t.length != 2) {
						bad.push(line + ': N-term genomic position format is not chr:position')
						continue
					}
					chr1 = t[0]
					position1 = Number.parseInt(t[1])
					if (Number.isNaN(position1)) {
						bad.push(line + ': invalid N-term genomic position')
						continue
					}
					position1--
					const e1 = coord.invalidcoord(block.genome, chr1, position1, position1)
					if (e1) {
						bad.push(line + ': N-term genomic position error: ' + e1)
						continue
					}
					t = l[5].trim().split(':')
					if (t.length != 2) {
						bad.push(line + ': C-term genomic position format is not chr:position')
						continue
					}
					chr2 = t[0]
					position2 = Number.parseInt(t[1])
					if (Number.isNaN(position2)) {
						bad.push(line + ': invalid C-term genomic position')
						continue
					}
					position2--
					const e2 = coord.invalidcoord(block.genome, chr2, position2, position2)
					if (e2) {
						bad.push(line + ': C-term genomic position error: ' + e2)
						continue
					}
				}
				const isoform1 = l[1].trim().toUpperCase()
				const isoform2 = l[4].trim().toUpperCase()
				const thisisoform = block.usegm.isoform.toUpperCase()
				if (isoform1 != thisisoform && isoform2 != thisisoform) {
					bad.push(line + ': ' + thisisoform + ' is not used')
					continue
				}
				const m = {
					class: common.mclassfusionrna,
					dt: common.dtfusionrna,
					gene1: l[0].trim(),
					gene2: l[3].trim(),
					chr1,
					chr2,
					pos1: position1,
					pos2: position2
				}
				// TODO map codon/rna to genomic
				mlst.push(m)
			}
			if (bad.length) {
				says.style('display', 'block').text('Rejected: ' + bad.join('\n'))
			}
			if (mlst.length == 0) return
			const tk = block.block_addtk_template({
				type: 'mds3',
				name: nameinput.property('value') || 'Custom fusion',
				iscustom: true,
				custom_variants: mlst
			})
			block.tk_load(tk)
		})
	row
		.append('button')
		.text('Clear')
		.style('margin-left', '5px')
		.on('click', () => {
			ta.property('value', '')
			nameinput.property('value', '')
		})
	const says = div.append('div').style('display', 'none', 'margin-top', '20px')
	div
		.append('div')
		.style('margin-top', '20px')
		.style('color', '#858585')
		.html(
			`Limited to two-gene fusion products.<br>
One product per line.<br>
Each line has six fields joined by comma:
<ol><li>N-term gene symbol</li>
<li>N-term gene isoform</li>
<li>N-term gene break-end position</li>
<li>C-term gene symbol</li>
<li>C-term gene isoform</li>
<li>C-term gene break-end position</li>
<li>(optional) interstitial sequence AA length</li>
</ol>
Break-end position types:
<ul><li>Codon position: integer, 1-based</li>
<li>RNA position: integer, 1-based, beginning from transcription start site</li>
<li>Genomic position: chromosome name and 1-based coordinate joined by colon, e.g. chr1:2345</li></ul>
Either one of the isoforms must be already displayed.`
		)
}

function customdataui_snv(block) {
	block.tip.clear()
	const div = block.tip.d.append('div').style('margin', '25px')
	div.append('p').text('SNV/indel variants of ' + block.usegm.name + ' (' + block.genome.name + ')')
	div
		.append('p')
		.style('font-size', '.9em')
		.html('<span style="font-size:.8em;color:#aaa">FORMAT</span> mutation name ; position ; class')
	const ta = div.append('textarea').attr('cols', '30').attr('rows', '4')

	const nameinput = div
		.append('div')
		.append('input')
		.attr('type', 'text')
		.style('width', '130px')
		.property('placeholder', 'Dataset name')

	const row = div.append('div').style('margin-top', '5px')
	const select = row.append('select')
	select.append('option').text('Codon position')
	select.append('option').text('RNA position')
	select.append('option').text('Genomic position')
	row
		.append('button')
		.style('margin-left', '5px')
		.text('Submit')
		.on('click', () => {
			const v = ta.property('value')
			if (v == '') return
			says.style('display', 'none')
			const mlst = []
			const bad = []
			for (const line of v.trim().split('\n')) {
				const l = line.split(';')
				if (l.length != 3) {
					bad.push(line + ': not 3 fields')
					continue
				}
				const selecti = select.node().selectedIndex
				let chr = null,
					position = null
				if (selecti == 0) {
					const codon = Number.parseInt(l[1].trim())
					if (Number.isNaN(codon)) {
						bad.push(line + ': codon position is not integer')
						continue
					}
					position = coord.aa2gmcoord(codon, block.usegm)
					if (position == null) {
						bad.push(line + ': cannot convert codon to genomic position')
						continue
					}
					chr = block.usegm.chr
				} else if (selecti == 1) {
					const rnapos = Number.parseInt(l[1].trim())
					if (Number.isNaN(rnapos)) {
						bad.push(line + ': RNA position is not integer')
						continue
					}
					position = coord.rna2gmcoord(rnapos, block.usegm)
					if (position == null) {
						bad.push(line + ': cannot convert RNA position to genomic position')
						continue
					}
					chr = block.usegm.chr
				} else {
					const t = l[1].trim().split(':')
					if (t.length != 2) {
						bad.push(line + ': genomic position format is not chr:position')
						continue
					}
					chr = t[0]
					position = Number.parseInt(t[1])
					if (Number.isNaN(position)) {
						bad.push(line + ': invalid genomic position')
						continue
					}
					position--
					const e = coord.invalidcoord(block.genome, chr, position, position)
					if (e) {
						bad.push(line + ': genomic position error: ' + e)
						continue
					}
				}
				const _class = l[2].trim()
				if (!common.mclass[_class]) {
					bad.push(line + ': invalid mutation class')
					continue
				}
				mlst.push({
					class: _class,
					dt: common.dtsnvindel,
					isoform: block.usegm.isoform,
					mname: l[0].trim(),
					chr: chr,
					pos: position
				})
			}
			if (bad.length) {
				says.style('display', 'block').text('Rejected: ' + bad.join('\n'))
			}
			if (mlst.length == 0) return
			const tk = block.block_addtk_template({
				type: 'mds3',
				name: nameinput.property('value') || 'Custom mutation',
				iscustom: true,
				custom_variants: mlst
			})
			block.tk_load(tk)
		})
	row
		.append('button')
		.text('Clear')
		.style('margin-left', '5px')
		.on('click', () => {
			ta.property('value', '')
			nameinput.property('value', '')
		})
	const says = div.append('div').style('display', 'none', 'margin-top', '20px')
	div
		.append('div')
		.style('margin-top', '20px')
		.style('color', '#858585')
		.html(
			`One mutation per line.<br>
Each line has three fields joined by <strong>semicolon</strong>:
<ol><li>Mutation name, can be any string</li>
<li>Mutation position</li>
<li>Mutation class code</li></ol>
Position types:
<ul><li>Codon position: integer, 1-based (do not use for noncoding gene)</li>
<li>RNA position: integer, 1-based, beginning from transcription start site</li>
<li>Genomic position: chromosome name and 1-based coordinate joined by colon, e.g. chr1:2345</li></ul>`
		)

	const table = div.append('table').style('margin-top', '3px')
	client.mclasscolor2table(table, true)
}

function customdataui_itd(block, x, y) {
	block.tip.clear()
	const div = block.tip.d.append('div').style('margin', '25px')
	div.append('p').text('ITD events of ' + block.usegm.name + ' (' + block.genome.name + ')')
	div
		.append('p')
		.style('font-size', '.9em')
		.html('<span style="font-size:.8em;color:#aaa">FORMAT</span> position1 ; position2/span')
	const ta = div.append('textarea').attr('cols', '20').attr('rows', '5')

	const nameinput = div
		.append('div')
		.append('input')
		.attr('type', 'text')
		.style('width', '130px')
		.property('placeholder', 'Dataset name')

	const row = div.append('div').style('margin-top', '5px')
	const select = row.append('select')
	select.append('option').text('RNA position and basepair length of duplication')
	select.append('option').text('Genomic start and stop position')
	row
		.append('button')
		.style('margin-left', '5px')
		.text('Submit')
		.on('click', () => {
			const v = ta.property('value')
			if (v == '') return
			says.style('display', 'none')
			const mlst = []
			const bad = []
			for (const line of v.trim().split('\n')) {
				const l = line.split(';')
				if (l.length != 2) {
					bad.push(line + ': not two fields')
					continue
				}
				const selecti = select.node().selectedIndex
				const m = {
					class: common.mclassitd,
					dt: common.dtitd,
					isoform: block.usegm.isoform,
					mname: 'ITD'
				}
				if (selecti == 0) {
					m.rnaposition = Number.parseInt(l[0].trim())
					if (Number.isNaN(m.rnaposition)) {
						bad.push(line + ': RNA position is not integer')
						continue
					}
					m.rnaduplength = Number.parseInt(l[1].trim())
					if (Number.isNaN(m.rnaduplength)) {
						bad.push(line + ': duplication length is not integer')
						continue
					}
				} else if (selecti == 1) {
					const pos1 = Number.parseInt(l[0].trim())
					if (Number.isNaN(pos1)) {
						bad.push(line + ': genomic start position is not integer')
						continue
					}
					const pos2 = Number.parseInt(l[1].trim())
					if (Number.isNaN(pos2)) {
						bad.push(line + ': genomic stop position is not integer')
						continue
					}
					let t = coord.genomic2gm(pos1, block.usegm)
					const rnapos1 = Math.ceil(t.rnapos)
					t = coord.genomic2gm(pos2, block.usegm)
					const rnapos2 = Math.ceil(t.rnapos)
					m.rnaposition = Math.min(rnapos1, rnapos2)
					m.rnaduplength = Math.abs(rnapos1 - rnapos2)
				}
				mlst.push(m)
			}
			if (bad.length) {
				says.style('display', 'block').text('Rejected: ' + bad.join('\n'))
			}
			if (mlst.length == 0) return
			const ds = {
				bulkdata: {},
				iscustom: true
			}
			ds.bulkdata[block.usegm.name.toUpperCase()] = mlst
			const label = nameinput.property('value') || 'custom ITD'
			ds.label = label
			let i = 0
			while (block.ownds[ds.label]) {
				ds.label = label + ' ' + ++i
			}
			block.ownds[ds.label] = ds
			//block.dshandle_new(ds.label)
			const tk = block.block_addtk_template({ type: client.tkt.ds, ds: ds })
			block.tk_load(tk)
		})
	row
		.append('button')
		.text('Clear')
		.style('margin-left', '5px')
		.on('click', () => {
			ta.property('value', '')
			nameinput.property('value', '')
		})
	const says = div.append('div').style('display', 'none', 'margin-top', '20px')
	div
		.append('div')
		.style('margin-top', '20px')
		.style('color', '#858585')
		.html(
			`One ITD per line.<br>
Each line has two integer values joined by <strong>semicolon</strong>.<br>
Position types:
<li>RNA position: integer, 1-based, beginning from transcription start site. Span of duplication is number of bases in the RNA.</li>
<li>Genomic position: start and stop position of the ITD</li>`
		)
}

function customdataui_del(block, x, y) {
	block.tip.clear()
	const div = block.tip.d.append('div').style('margin', '25px')
	div.append('p').text('Deletion events of ' + block.usegm.name + ' (' + block.genome.name + ')')
	div
		.append('p')
		.style('font-size', '.9em')
		.html('<span style="font-size:.8em;color:#aaa">FORMAT</span> position1 ; position2/span')
	const ta = div.append('textarea').attr('cols', '20').attr('rows', '5')

	const nameinput = div
		.append('div')
		.append('input')
		.attr('type', 'text')
		.style('width', '130px')
		.property('placeholder', 'Dataset name')

	const row = div.append('div').style('margin-top', '5px')
	const select = row.append('select')
	select.append('option').text('RNA position and basepair length of deletion')
	select.append('option').text('Genomic start and stop position')
	row
		.append('button')
		.style('margin-left', '5px')
		.text('Submit')
		.on('click', () => {
			const v = ta.property('value')
			if (v == '') return
			says.style('display', 'none')
			const mlst = []
			const bad = []
			for (const line of v.trim().split('\n')) {
				const l = line.split(';')
				if (l.length != 2) {
					bad.push(line + ': not two fields')
					continue
				}
				const selecti = select.node().selectedIndex
				const m = {
					class: common.mclassdel,
					dt: common.dtdel,
					isoform: block.usegm.isoform,
					mname: 'DEL'
				}
				if (selecti == 0) {
					m.rnaposition = Number.parseInt(l[0].trim())
					if (Number.isNaN(m.rnaposition)) {
						bad.push(line + ': RNA position is not integer')
						continue
					}
					m.rnadellength = Number.parseInt(l[1].trim())
					if (Number.isNaN(m.rnaduplength)) {
						bad.push(line + ': deletion length is not integer')
						continue
					}
				} else if (selecti == 1) {
					const pos1 = Number.parseInt(l[0].trim())
					if (Number.isNaN(pos1)) {
						bad.push(line + ': genomic start position is not integer')
						continue
					}
					const pos2 = Number.parseInt(l[1].trim())
					if (Number.isNaN(pos2)) {
						bad.push(line + ': genomic stop position is not integer')
						continue
					}
					let t = coord.genomic2gm(pos1, block.usegm)
					const rnapos1 = Math.ceil(t.rnapos)
					t = coord.genomic2gm(pos2, block.usegm)
					const rnapos2 = Math.ceil(t.rnapos)
					m.rnaposition = Math.min(rnapos1, rnapos2)
					m.rnadellength = Math.abs(rnapos1 - rnapos2)
				}
				mlst.push(m)
			}
			if (bad.length) {
				says.style('display', 'block').text('Rejected: ' + bad.join('\n'))
			}
			if (mlst.length == 0) return
			const ds = {
				bulkdata: {},
				iscustom: true
			}
			ds.bulkdata[block.usegm.name.toUpperCase()] = mlst
			const label = nameinput.property('value') || 'custom deletion'
			ds.label = label
			let i = 0
			while (block.ownds[ds.label]) {
				ds.label = label + ' ' + ++i
			}
			block.ownds[ds.label] = ds
			//block.dshandle_new(ds.label)
			const tk = block.block_addtk_template({ type: client.tkt.ds, ds: ds })
			block.tk_load(tk)
		})
	row
		.append('button')
		.text('Clear')
		.style('margin-left', '5px')
		.on('click', () => {
			ta.property('value', '')
			nameinput.property('value', '')
		})
	const says = div.append('div').style('display', 'none', 'margin-top', '20px')
	div
		.append('div')
		.style('margin-top', '20px')
		.style('color', '#858585')
		.html(
			`One deletion per line.<br>
Each line has two integer values joined by <strong>semicolon</strong>.<br>
Position types:
<ul>
<li>RNA position: integer, 1-based, beginning from transcription start site. Span of deletion is number of bases in the RNA.</li>
<li>Genomic position: start and stop position of the deletion</li></ul>`
		)
}
