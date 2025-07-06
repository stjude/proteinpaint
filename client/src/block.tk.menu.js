import * as client from './client'
import { schemeCategory10 } from 'd3-scale-chromatic'
import { scaleOrdinal } from 'd3-scale'
import { rgb as d3rgb } from 'd3-color'
import { Menu } from '../dom/menu'

/*
generate the menu by click "Track" button on block

********************** EXPORTED

tkmenu()


********************** INTERNAL

hardlist4block
stringisurl()
newtk_bw
newtk_bedj
newtk_junction
newtk_vcf
newtk_interaction
notAllowedToHideThisTrack

************* function cascade
facettrigger
	facetmake
		backward_compatible
		get_dimensions
		sort_dimensions
		makecell
		batchselect_assay
		batchselect_sample
		toggle_tracks
*/

const colorfunc = scaleOrdinal(schemeCategory10)

export default function (block, tip, x, y) {
	/*
	make the most current menu, consisted of:
		"one search" and result display
		facet
		hardlist
		custom track

	- block
	- tip: instance of Menu, belongs to block, unnamed but persistant
	- x/y
	*/

	tip.clear()
	const div = tip.d

	///// search box for genome.tkset or more
	onesearchui(block, div)

	///// facet
	facettrigger(block, div, tip)

	/*
	upon showing tkmenu, hide any existing facet tables
	important for:
	1. the facet content won't appear out of sync when user toggle tracks in tkmenu
	2. since the facet table will be remade each time it is shown,
	   it can ensure the table to be pointed to the correct browser (when multiple ones are opened)
	*/
	for (const s of block.genome.tkset) {
		if (s.facetlst) {
			for (const f of s.facetlst) {
				if (f.facetpane) {
					client.disappear(f.facetpane.pane)
				}
			}
		}
		if (s.facetpane) {
			client.disappear(s.facetpane.pane)
		}
	}

	///// hard list table
	hardlist4block(block, div)

	// custom track entry button
	if (!JSON.parse(sessionStorage.getItem('optionalFeatures')).disableCustomTrackUI) {
		div
			.append('div')
			.html('Add custom track &raquo;')
			.style('padding', '15px')
			.style('text-align', 'center')
			.attr('class', 'sja_menuoption')
			.on('click', () => {
				customtracktypeui(block, div)
			})
	}

	tip.show(x, y)
}

function onesearchui(block, div) {
	/*
	one search box on top
	
	block.genome.tkset[]

	search within each set and return results
	*/

	let count = 0
	for (const s of block.genome.tkset) {
		count += s.tklst.length
	}

	if (count == 0) {
		return
	}

	const searchrow = div.append('div').style('margin', count == 0 ? '0px' : '15px 15px 5px 15px')
	const input = searchrow
		.append('input')
		.attr('size', 15)
		.attr('placeholder', 'Search ' + count + ' tracks')
	const searchsays = searchrow.append('span').style('font-size', '.8em').style('padding-left', '10px')
	input.on('keyup', event => {
		founddiv.selectAll('*').remove()
		searchsays.text('')
		const v = event.target.value
		if (v.length < 2) {
			return
		}
		const vv = v.toLowerCase()
		let foundnum = 0
		for (const set of block.genome.tkset) {
			const hits = []
			for (const t of set.tklst) {
				if (t.name && t.name.toLowerCase().indexOf(vv) != -1) {
					hits.push(t)
					continue
				}
				if (t.patient && t.patient.toLowerCase().indexOf(vv) != -1) {
					hits.push(t)
					continue
				}
				if (t.sampletype && t.sampletype.toLowerCase().indexOf(vv) != -1) {
					hits.push(t)
					continue
				}
				if (t.assayname && t.assayname.toLowerCase().indexOf(vv) != -1) {
					hits.push(t)
					continue
				}
			}
			foundnum += hits.length
			if (hits.length == 0) continue
			const color = colorfunc(set.name)
			const tr = founddiv.append('table').style('border-spacing', '0px').append('tr')
			const thisscroll = tr
				.append('td')
				.style('padding', '0px 10px 0px 20px')
				.append('div')
				.style('border', 'solid 1px ' + color)
			if (hits.length > 13) {
				thisscroll
					.style('padding', '10px 10px 10px 0px')
					.style('height', '300px')
					.style('overflow-y', 'scroll')
					.style('resize', 'vertical')
			}
			const tktable = thisscroll.append('table').style('border-spacing', '1px')
			// this table has only two columns
			// 1. "shown"
			// 2. track button
			tr.append('td')
				//.style('padding','5px')
				.style('color', color)
				.style('font-size', '.8em')
				.style('font-weight', 'bold')
				.text(set.name)
			for (const cold of hits) {
				let hot = null
				for (const t of block.tklst) {
					if (t.id == cold.id && t.file == cold.file && t.url == cold.url) {
						// FIXME equivalency test for vcf tracks
						hot = t
						break
					}
				}
				const tr = tktable.append('tr')
				//tr.append('td').style('font-size','.7em').text(cold.assayname || 'n/a')
				//tr.append('td').style('font-size','.7em').text(cold.type)
				const td1 = tr.append('td').style('color', '#555').style('font-size', '.7em')
				if (hot) {
					td1.text('SHOWN')
				}
				const handle = tr.append('td').classed('sja_menuoption', true).text(tkhtmllabel(cold, block))
				if (hot) {
					handle.on('click', () => tkhandleclick(block, hot, td1))
				} else {
					handle.on('click', () => tkhandleclick(block, cold, td1))
				}
			}
		}
		// TODO query server to find tracks
		searchsays.text(foundnum == 0 ? 'No tracks found' : 'Found ' + foundnum + ' track' + (foundnum > 1 ? 's' : ''))
	})
	const founddiv = div.append('div').style('margin-top', '3px')
}

function hardlist4block(block, div) {
	/*
	"hardlist"

	block.tklst[]
	genome.tracks[]

	*/

	const harddiv = div.append('div').style('margin', '20px')
	{
		const set = new Set()
		for (const t of block.tklst) {
			set.add(t.name)
		}
		for (const t of block.genome.tracks) {
			set.add(t.name)
		}
		if (set.size > 13) {
			harddiv
				.style('border-top', 'solid 1px #eee')
				.style('border-bottom', 'solid 1px #eee')
				.style('padding', '10px 10px 10px 0px')
				.style('height', '300px')
				.style('overflow-y', 'scroll')
				.style('resize', 'vertical')
		}
	}

	const hardtable = harddiv.append('table')
	// table has three columns
	// 1. "shown"
	// 2. track button
	// 3. "delete" for custom

	/////// block.tklst
	for (const tk of block.tklst) {
		const tr = hardtable.append('tr')
		const td1 = tr.append('td')
		td1.text('SHOWN').style('color', '#555').style('font-size', '.7em')

		const handle = tr.append('td').text(tkhtmllabel(tk, block))

		if (notAllowedToHideThisTrack(tk)) {
			handle.style('padding', '5px 10px')
		} else {
			// allowed to toggle show/hide of this tk, show button over tk name
			handle.attr('class', 'sja_menuoption').on('click', () => {
				tkhandleclick(block, tk, td1)
			})
		}

		/*
		no longer allow to delete a custom track; too many complains
		const td3 = tr.append('td')
		if (tk.iscustom) {
			td3
				.html('&times;')
				.attr('class', 'sja_menuoption')
				.on('click', () => {
					deletecustom(block, tk, tr)
				})
		}
		*/
	}

	///// genome.tracks[]
	for (const tk of block.genome.tracks) {
		let ishot = false
		for (const t of block.tklst) {
			if (t.tkid == tk.tkid) {
				ishot = true
				break
			}
		}
		if (ishot) {
			// this track is on display and its entry has been added to hardtable
			continue
		}
		const tr = hardtable.append('tr')
		const td1 = tr.append('td').style('color', '#555').style('font-size', '.7em')
		const handle = tr.append('td').attr('class', 'sja_menuoption').text(tkhtmllabel(tk, block))
		/*
		const td3 = tr.append('td')
		if (tk.iscustom) {
			td3
				.html('&times;')
				.attr('class', 'sja_menuoption')
				.on('click', () => {
					deletecustom(block, tk, tr)
				})
		}
		*/
		handle.on('click', () => {
			tkhandleclick(block, tk, td1)
		})
	}
}

function customtracktypeui(block, div) {
	div.selectAll('*').remove()
	div
		.append('div')
		.style('margin', '30px')
		.style('text-align', 'center')
		.style('color', '#858585')
		.text('Add track for ' + block.genome.name + ' genome')

	const d1 = div.append('div').style('margin', '20px')

	// bigwig
	d1.append('div')
		.attr('class', 'sja_menuoption')
		.html('bigWig <span style="opacity:.5;font-size:.8em">numerical data</span>')
		.on('click', () => newtk_bw(block, div))

	// json bed
	d1.append('div')
		.attr('class', 'sja_menuoption')
		.html('JSON-BED <span style="opacity:.5;font-size:.8em">positional annotations</span>')
		.on('click', () => newtk_bedj(block, div))

	// junction
	d1.append('div')
		.attr('class', 'sja_menuoption')
		.text('Splice junction')
		.on('click', () => newtk_junction(block, div))

	// vcf
	d1.append('div')
		.attr('class', 'sja_menuoption')
		.html('VCF <span style="opacity:.5;font-size:.8em">SNV/indel</span>')
		.on('click', () => newtk_vcf(block, div))

	// interaction
	d1.append('div')
		.attr('class', 'sja_menuoption')
		.html('Interaction <span style="opacity:.5;font-size:.8em">pairs of genomic regions</span>')
		.on('click', () => newtk_interaction(block, div))

	// mds to be added here

	//// add new track type here

	const d2 = div.append('div').style('margin', '20px')
	d2.append('p').style('color', '#858585').text('Declare tracks as JSON text:')
	const ta = d2.append('textarea').attr('rows', 5).attr('cols', '30').attr('placeholder', 'Enter JSON text')
	const row = d2.append('div').style('margin-top', '3px')
	row
		.append('button')
		.text('Submit')
		.on('click', () => {
			const v = ta.property('value')
			if (v == '') return
			let j
			try {
				j = JSON.parse(v)
			} catch (e) {
				alert('Invalid JSON: ' + e)
				return
			}
			if (!Array.isArray(j)) {
				j = [j]
			}
			for (const t of j) {
				if (t.hidden) {
					delete t.hidden
					block.genome.tracks.push(t)
				} else {
					const tt = block.block_addtk_template(t)
					if (tt) {
						block.tk_load(tt)
					}
				}
			}
		})
	row
		.append('button')
		.text('Clear')
		.on('click', () => ta.property('value', ''))
	row
		.append('span')
		.style('padding-left', '10px')
		.html('<a href=https://github.com/stjude/proteinpaint/wiki/Tracks target=_blank>Track format</a>')
	row.append('span').style('padding-left', '10px').html('<a href=https://jsonlint.com/ target=_blank>debug</a>')
}

function may_add_customtk(tk, block, div) {
	/* trying to add a custom track anew, from input UI
	but not, say from repeatedly clicking on tk menu
	need to check if the track has been added before
	*/
	const tk_reg = client.tkexists(tk, block.genome.tracks)
	if (tk_reg) {
		// the track has already been registered
		if (client.tkexists(tk, block.tklst)) {
			// it is shown now
			window.alert('The track is already shown')
		} else {
			// registered but not shown
			const tk2 = block.block_addtk_template(tk_reg)
			block.tk_load(tk2)
			customtracktypeui(block, div)
		}
	} else {
		// the track has not been registered
		tk.tkid = Math.random().toString()
		block.genome.tracks.push(tk)
		const tk2 = block.block_addtk_template(tk)
		block.tk_load(tk2)
		customtracktypeui(block, div)
	}
}

function newtk_bw(block, div) {
	div.selectAll('*').remove()
	div
		.append('div')
		.style('margin', '20px')
		.style('display', 'inline-block')
		.html('≪ Go back')
		.attr('class', 'sja_menuoption')
		.on('click', () => customtracktypeui(block, div))

	{
		const box = div.append('div').style('margin', '0px 20px 20px 20px')
		box.append('p').text('Add a single track').style('color', '#858585').style('font-size', '.7em')
		const iname = box
			.append('p')
			.append('input')
			.attr('type', 'text')
			.attr('placeholder', 'bigWig track name')
			.attr('size', 20)
		const iurl = box
			.append('p')
			.append('input')
			.attr('type', 'text')
			.attr('placeholder', 'URL or server-side file path')
			.attr('size', 40)
		const p2 = box.append('p')

		p2.append('button')
			.text('Add bigWig track')
			.on('click', () => {
				const text = iurl.property('value').trim()
				if (text == '') return
				let file, url
				if (stringisurl(text)) {
					url = text
				} else {
					file = text
				}
				const tk = {
					type: client.tkt.bigwig,
					name: iname.property('value').trim() || 'bigwig track',
					scale: {
						auto: 1
					},
					file: file,
					url: url,
					iscustom: true
				}
				may_add_customtk(tk, block, div)
			})
		p2.append('button')
			.text('Clear')
			.on('click', () => (iurl.node().value = iname.node().value = ''))
	}

	{
		const box = div.append('div').style('margin', '0px 20px 20px 20px')
		box.append('p').text('Add multiple tracks').style('color', '#858585').style('font-size', '.7em')
		const input = box
			.append('p')
			.append('textarea')
			.attr('placeholder', 'one track per line: [track name],[path/to/file.bw or URL]')
			.attr('rows', 2)
			.attr('cols', 50)
		const p2 = box.append('p')
		p2.append('button')
			.text('Add tracks')
			.on('click', () => {
				const text = input.property('value').trim()
				if (text == '') return
				for (const s of text.split(/[\r\n]/)) {
					const l = s.split(',')
					if (l[0] && l[1]) {
						const t = {
							type: client.tkt.bigwig,
							name: l[0].trim(),
							scale: { auto: 1 },
							iscustom: true
						}

						const tmp = l[1].trim()

						if (stringisurl(tmp)) t.url = tmp
						else t.file = tmp

						const t2 = block.block_addtk_template(t)
						block.tk_load(t2)
					}
				}
			})
		p2.append('button')
			.text('Clear')
			.on('click', () => (input.node().value = ''))
	}
	div
		.append('div')
		.style('margin', '20px')
		.html('<a href=https://genome.ucsc.edu/goldenpath/help/bigWig.html target=_blank>bigWig file format</a>')
}

function newtk_bws(block, div) {
	// not in use
	div.selectAll('*').remove()
	div
		.append('div')
		.style('margin', '20px')
		.style('display', 'inline-block')
		.html('&lt; go back')
		.attr('class', 'sja_menuoption')
		.on('click', () => customtracktypeui(block, div))

	const box = div.append('div').style('margin', '20px')
	const iname = box
		.append('p')
		.append('input')
		.attr('type', 'text')
		.attr('placeholder', 'Stranded bigWig track name')
		.attr('size', 20)
	const forwardurl = box
		.append('p')
		.append('input')
		.attr('type', 'text')
		.attr('placeholder', 'Forward strand URL or server-side file path')
		.attr('size', 40)
	const reverseurl = box
		.append('p')
		.append('input')
		.attr('type', 'text')
		.attr('placeholder', 'Reverse strand URL or server-side file path')
		.attr('size', 40)
	const p2 = box.append('p')
	p2.append('button')
		.text('Add stranded bigWig track')
		.on('click', () => {
			let file1, url1, file2, url2
			const text = forwardurl.property('value').trim()
			if (text == '') return
			if (stringisurl(text)) {
				url1 = text
			} else {
				file1 = text
			}
			const text2 = reverseurl.property('value').trim()
			if (text2 == '') return
			if (stringisurl(text2)) {
				url2 = text2
			} else {
				file2 = text2
			}
			const name = iname.property('value').trim()
			const tk = block.block_addtk_template({
				type: client.tkt.bigwigstranded,
				name: name ? name : 'stranded bigwig',
				strand1: {
					scale: {
						auto: 1
					},
					file: file1,
					url: url1
				},
				strand2: {
					scale: {
						auto: 1
					},
					file: file2,
					url: url2
				},
				iscustom: true
			})
			block.tk_load(tk)
			customtracktypeui(block, div)
		})
	p2.append('button')
		.text('Clear')
		.on('click', () => (forwardurl.node().value = reverseurl.node().value = iname.node().value = ''))
	box
		.append('p')
		.style('color', '#858585')
		.style('width', '400px')
		.style('font-size', '.8em')
		.text(
			'Note that this track is designed for data such as strand-specific read coverage, and it requires the reverse strand bigWig file to store negative values.'
		)
}

function newtk_bedj(block, div) {
	div.selectAll('*').remove()
	div
		.append('div')
		.style('margin', '20px')
		.style('display', 'inline-block')
		.html('&lt; go back')
		.attr('class', 'sja_menuoption')
		.on('click', () => customtracktypeui(block, div))

	const box = div.append('div').style('margin', '20px')
	const nta = box
		.append('p')
		.append('input')
		.attr('type', 'text')
		.attr('placeholder', 'JSON-BED track name')
		.attr('size', 20)
	const ta = box
		.append('p')
		.append('input')
		.attr('type', 'text')
		.attr('placeholder', 'URL or server-side file path')
		.attr('size', 40)
	const p = box.append('p')
	p.append('button')
		.text('Add JSON-BED track')
		.on('click', () => {
			const text = ta.property('value').trim()
			if (text == '') return
			let file, url
			if (stringisurl(text)) {
				url = text
			} else {
				file = text
			}
			const tk = {
				type: client.tkt.bedj,
				name: nta.property('value').trim() || 'JSON-BED',
				file: file,
				url: url,
				iscustom: true
			}
			may_add_customtk(tk, block, div)
		})
	p.append('button')
		.text('Clear')
		.on('click', () => (ta.node().value = nta.node().value = ''))
	box
		.append('p')
		.html(
			'<a href=https://github.com/stjude/proteinpaint/wiki/Tracks#Track-JSON-BED-track-format target=_blank>JSON-BED format</a>'
		)
}

function newtk_junction(block, div) {
	div.selectAll('*').remove()
	div
		.append('div')
		.style('margin', '20px')
		.style('display', 'inline-block')
		.html('&lt; go back')
		.attr('class', 'sja_menuoption')
		.on('click', () => customtracktypeui(block, div))

	const box = div.append('div').style('margin', '20px')
	const nta = box
		.append('p')
		.append('input')
		.attr('type', 'text')
		.attr('placeholder', 'Junction track name')
		.attr('size', 20)
	const ta = box
		.append('p')
		.append('input')
		.attr('type', 'text')
		.attr('placeholder', 'URL or server-side file path')
		.attr('size', 40)
	const p = box.append('p')
	p.append('button')
		.text('Add junction track')
		.on('click', () => {
			const text = ta.property('value').trim()
			if (text == '') return
			let file, url
			if (stringisurl(text)) {
				url = text
			} else {
				file = text
			}
			const tk = {
				type: client.tkt.junction,
				name: nta.property('value').trim() || 'junction',
				tracks: [
					{
						file: file,
						url: url
					}
				],
				iscustom: true
			}
			may_add_customtk(tk, block, div)
		})
	p.append('button')
		.text('Clear')
		.on('click', () => (ta.node().value = nta.node().value = ''))
	box
		.append('p')
		.html(
			'<a href=https://github.com/stjude/proteinpaint/wiki/Tracks#Track-splice-junction target=_blank>Junction track format</a>'
		)
}

function newtk_vcf(block, div) {
	div.selectAll('*').remove()
	div
		.append('div')
		.style('margin', '20px')
		.style('display', 'inline-block')
		.html('&lt; go back')
		.attr('class', 'sja_menuoption')
		.on('click', () => customtracktypeui(block, div))

	const box = div.append('div').style('margin', '20px')
	const nta = box
		.append('p')
		.append('input')
		.attr('type', 'text')
		.attr('placeholder', 'VCF track name')
		.attr('size', 20)
	const ta = box
		.append('p')
		.append('input')
		.attr('type', 'text')
		.attr('placeholder', 'URL or server-side file path')
		.attr('size', 40)
	const p = box.append('p')
	p.append('button')
		.text('Add VCF track')
		.on('click', () => {
			const text = ta.property('value').trim()
			if (text == '') return
			let file, url
			if (stringisurl(text)) {
				url = text
			} else {
				file = text
			}
			const vcfid = Math.random().toString()
			const ds = {
				label: nta.property('value').trim() || 'VCF',
				id2vcf: {}
			}
			ds.id2vcf[vcfid] = {
				vcfid: vcfid,
				file: file,
				url: url,
				headernotloaded: true
			}
			const tk = {
				type: client.tkt.ds,
				ds: ds,
				isvcf: true, // trigger
				iscustom: true
			}
			may_add_customtk(tk, block, div)
		})
	p.append('button')
		.text('Clear')
		.on('click', () => (ta.node().value = nta.node().value = ''))
	box.append('p').html('<a href=https://en.wikipedia.org/wiki/Variant_Call_Format target=_blank>VCF format</a>')
	box.append('p').style('color', '#858585').style('font-size', '.8em').text('SNV/indel data only')
}

function newtk_interaction(block, div) {
	div.selectAll('*').remove()
	div
		.append('div')
		.style('margin', '20px')
		.style('display', 'inline-block')
		.html('&lt; go back')
		.attr('class', 'sja_menuoption')
		.on('click', () => customtracktypeui(block, div))

	const box = div.append('div').style('margin', '20px')

	const tknameinput = box
		.append('p')
		.append('input')
		.attr('type', 'text')
		.attr('placeholder', 'Interaction track name')
		.attr('size', 20)

	const tr = box.append('table').append('tr')
	tr.append('td')
		.text('Data source')
		.style('opacity', 0.5)
		.style('vertical-align', 'top')
		.style('padding-right', '10px')
	const td = tr.append('td')
	const id = Math.random().toString()
	{
		const row = td.append('div')
		row
			.append('input')
			.attr('type', 'radio')
			.attr('name', id)
			.attr('id', id + 1)
			.property('checked', 1)
			.on('change', () => change(1))
		row
			.append('label')
			.attr('class', 'sja_clbtext')
			.html('&nbsp;Hi-C, juicebox format')
			.attr('for', id + 1)
	}
	{
		const row = td.append('div')
		row
			.append('input')
			.attr('type', 'radio')
			.attr('name', id)
			.attr('id', id + 2)
			.on('change', () => change(2))
		row
			.append('label')
			.attr('class', 'sja_clbtext')
			.html('&nbsp;BED file, compressed and indexed')
			.attr('for', id + 2)
	}
	{
		const row = td.append('div')
		row
			.append('input')
			.attr('type', 'radio')
			.attr('name', id)
			.attr('id', id + 3)
			.on('change', () => change(3))
		row
			.append('label')
			.attr('class', 'sja_clbtext')
			.html('&nbsp;Text input')
			.attr('for', id + 3)
	}

	const div1 = box.append('div')
	{
		// hic straw
		div1
			.append('p')
			.html(
				'Juicebox: <a href=https://github.com/theaidenlab/Juicebox target=_blank>github.com/theaidenlab/Juicebox</a>'
			)
		const urlinput = div1
			.append('p')
			.append('input')
			.attr('type', 'text')
			.attr('placeholder', '*.hic file URL or server-side path')
			.attr('size', 40)
		let enzymeselect
		if (block.genome.hicenzymefragment) {
			const p = div1.append('p')
			p.append('span').html('Restriction enzyme:&nbsp;')
			enzymeselect = p.append('select')
			enzymeselect.append('option').text('none')
			for (const e of block.genome.hicenzymefragment) {
				enzymeselect.append('option').text(e.enzyme).property('value', e.enzyme)
			}
		}
		div1
			.append('p')
			.append('button')
			.text('Add track')
			.on('click', () => {
				const str = urlinput.property('value')
				if (!str) return
				const tk = {
					type: client.tkt.hicstraw,
					name: tknameinput.property('value') || 'Custom interaction',
					mode_hm: true,
					mode_arc: false,
					iscustom: 1
				}
				if (stringisurl(str)) tk.url = str
				else tk.file = str
				if (enzymeselect) {
					const s = enzymeselect.node()
					tk.enzyme = s.options[s.selectedIndex].value
					if (tk.enzyme == 'none') delete tk.enzyme
				}
				may_add_customtk(tk, block, div)
			})
	}

	const div2 = box.append('div').style('display', 'none')
	{
		// bed file
		div2
			.append('p')
			.html(
				'<a href=https://github.com/stjude/proteinpaint/wiki/Tracks#track-json-bed-track-format target=_blank>BED file format</a>'
			)
		const urlinput = div2
			.append('p')
			.append('input')
			.attr('type', 'text')
			.attr('placeholder', '*.gz file URL or server-side path')
			.attr('size', 40)
		div2
			.append('p')
			.append('button')
			.text('Add track')
			.on('click', () => {
				const str = urlinput.property('value')
				if (!str) return
				const tk = {
					type: client.tkt.hicstraw,
					name: tknameinput.property('value') || 'Custom interaction',
					mode_hm: false,
					mode_arc: true,
					iscustom: 1
				}
				if (stringisurl(str)) tk.bedurl = str
				else tk.bedfile = str
				may_add_customtk(tk, block, div)
			})
	}

	const div3 = box.append('div').style('display', 'none')
	{
		// text data
		div3
			.append('p')
			.html(
				'Enter interaction data as <a href=https://github.com/stjude/proteinpaint/wiki/Tracks#Track-splice-junction target=_blank>tab-delimited text</a>.'
			)
		const textinput = div3
			.append('textarea')
			.attr('placeholder', 'One line per interaction')
			.attr('cols', 45)
			.attr('rows', 5)
		div3
			.append('p')
			.append('button')
			.text('Add track')
			.on('click', () => {
				const str = textinput.property('value')
				if (!str) return
				const tk = {
					type: client.tkt.hicstraw,
					name: tknameinput.property('value') || 'Custom interaction',
					mode_hm: false,
					mode_arc: true,
					iscustom: 1,
					textdata: { raw: str }
				}
				may_add_customtk(tk, block, div)
			})
	}

	const change = i => {
		div1.style('display', i == 1 ? 'block' : 'none')
		div2.style('display', i == 2 ? 'block' : 'none')
		div3.style('display', i == 3 ? 'block' : 'none')
	}
}

function facettrigger(block, holder, menutip) {
	/*
	show buttons for launching facet tables
	one for each applicable set in genome.tkset[]
	*/

	const toshow = []

	for (const tkset of block.genome.tkset) {
		// { isfacet: bool, name:str, tklst:[ {tk} ] }

		if (tkset.facetlst) {
			// this set has predefined facets as supplied from tp.init
			// [ {samples[], assays[]} ]
			toshow.push(tkset)
			continue
		}

		if (tkset.isfacet) {
			toshow.push(tkset)
			continue
		}

		console.log('the .isfacet flag is missing on this tkset and may need to be supported')
	}
	if (toshow.length == 0) {
		return
	}
	// has facets to be shown
	// a holder to show one button for each facet table
	const div = holder.append('div').style('margin', '15px')
	div.append('div').text('FACET').style('color', '#858585').style('font-size', '.7em')

	for (const tkset of toshow) {
		if (tkset.facetlst) {
			// predefined sets
			for (const flet of tkset.facetlst) {
				div
					.append('div')
					.style('display', 'inline-block')
					.attr('class', 'sja_menuoption')
					.text((flet.name ? flet.name + ': ' : '') + tkset.name)
					.on('click', event => {
						menutip.hide()
						if (flet.facetpane) {
							document.body.appendChild(flet.facetpane.pane.node())
							client.appear(flet.facetpane.pane)
						} else {
							const pane = client.newpane({
								x: event.clientX - 100,
								y: event.clientY - 20,
								closekeep: true
							})
							flet.facetpane = pane
						}
						facetmake(block, tkset, flet)
					})
			}
			continue
		}

		div
			.append('div')
			.style('display', 'inline-block')
			.attr('class', 'sja_menuoption')
			.text(tkset.tklst.length + ' tracks from ' + tkset.name)
			.on('click', event => {
				menutip.hide()
				if (tkset.facetpane) {
					document.body.appendChild(tkset.facetpane.pane.node())
					client.appear(tkset.facetpane.pane)
				} else {
					const pane = client.newpane({
						x: event.clientX - 100,
						y: event.clientY - 20,
						closekeep: true
					})
					tkset.facetpane = pane
				}
				facetmake(block, tkset)
			})
	}
}

/*
called by clicking a button in tkmenu linking to a set in genome.tkset[]
to make a facet table for a set in genome.tkset[]

tkset{}
  required
  {isfacet:true, name, tklst[], facetpane}

flet{}
  optional, a facet table with predefined rows and columns
  {samples[], assays[]}
  if undefined, will generate table using tkset.tklst[]
*/
function facetmake(block, tkset, flet) {
	const tip = new Menu()

	const facetpane = (flet || tkset).facetpane

	facetpane.header.html('<span style="color:#858585;font-size:.8em">Tracks from</span> ' + tkset.name)
	facetpane.body.selectAll('*').remove()

	backward_compatible(tkset.tklst)

	const [assays, sample2assay2tracks, level2sample, L1_2_L2, samplewithlevel] = get_dimensions(tkset, flet)

	const [assaynamelst] = sort_dimensions(assays, flet)

	const scrollholder = facetpane.body.append('div')
	if (sample2assay2tracks.size > 50) {
		// more than 50 samples
		scrollholder.style('height', '500px').style('overflow-y', 'scroll').style('resize', 'vertical')
	}

	const table = scrollholder
		.append('table')
		.style('margin', '10px')
		.style('border-spacing', '3px')
		.style('border-collapse', 'separate')
		.attr('class', 'sja_simpletable')

	///////////////// header row
	const tr = table.append('tr')
	// blank cells for level1/2 and sample column
	if (L1_2_L2) {
		// two columns for two groups
		tr.append('td')
		tr.append('td')
	} else if (level2sample) {
		// only one column
		tr.append('td')
	}
	tr.append('td') // sample column

	// one column for each assay
	for (const assay of assaynamelst) {
		tr.append('td')
			.text(assay)
			.attr('class', 'sja_clbtext')
			.on('click', () => {
				batchselect_assay(assay)
			})
	}

	///////////////// sample rows

	if (L1_2_L2) {
		// one row for each L1 that contains a set of L2
		for (const [L1, o] of L1_2_L2) {
			// number of samples under this L1
			let samplecount = 0
			for (const s of o.values()) {
				samplecount += s.size
			}

			let tr = table.append('tr')
			// to disable creating <tr> at first L2
			// set to true after first L2 and to create <tr> at subsequent L2s
			let createnewrow_at_L2 = false
			tr.append('td')
				.text(L1)
				.attr('class', 'sja_clbtext')
				.attr('rowspan', samplecount)
				.on('click', () => {
					batchselect_sample({ L1 })
				})

			for (const [L2, sampleset] of o) {
				if (createnewrow_at_L2) tr = table.append('tr')
				// to disable creating <tr> at first sample
				// set to true after first sample and allow to create <tr> at subsequent samples
				let createnewrow_at_sample = false

				tr.append('td')
					.text(L2)
					.attr('rowspan', sampleset.size)
					.attr('class', 'sja_clbtext')
					.on('click', () => {
						batchselect_sample({ L1, L2 })
					})

				for (const sample of sampleset) {
					if (createnewrow_at_sample) tr = table.append('tr')

					tr.append('td')
						.text(sample)
						.attr('class', 'sja_clbtext')
						.on('click', () => {
							batchselect_sample({ L1, L2, sample })
						})

					for (const assay of assaynamelst) {
						makecell(sample, assay, tr)
					}
					createnewrow_at_sample = true
				}
				createnewrow_at_L2 = true
			}
		}
	}
	if (level2sample) {
		// one row for each group of samples, no sub groups
		for (const [level, sampleset] of level2sample) {
			let tr = table.append('tr')
			let createnewrow = false
			const td = tr
				.append('td')
				.text(level)
				.attr('rowspan', sampleset.size)
				.attr('class', 'sja_clbtext')
				.on('click', () => {
					batchselect_sample({ level })
				})
			if (L1_2_L2) {
				td.attr('colspan', 2)
			}
			for (const sample of sampleset) {
				if (createnewrow) tr = table.append('tr')
				tr.append('td')
					.text(sample)
					.attr('class', 'sja_clbtext')
					.on('click', () => {
						batchselect_sample({ level, sample })
					})
				for (const assay of assaynamelst) {
					makecell(sample, assay, tr)
				}
				createnewrow = true
			}
			createnewrow = true
		}
	}
	// level-less samples, one row for each
	for (const [sample, o] of sample2assay2tracks) {
		if (samplewithlevel.has(sample)) continue
		const tr = table.append('tr')
		const td = tr
			.append('td')
			.text(sample)
			.attr('class', 'sja_clbtext')
			.on('click', () => {
				batchselect_sample({ sample })
			})
		if (L1_2_L2) {
			td.attr('colspan', 3)
		} else if (level2sample) {
			td.attr('colspan', 2)
		}
		for (const assay of assaynamelst) {
			makecell(sample, assay, tr)
		}
	}

	function makecell(sample, assay, tr) {
		const td = tr.append('td')
		const s = sample2assay2tracks.get(sample)
		if (!s) return
		const tklst = s.get(assay)
		if (!tklst) return
		// this cell has tracks
		td.attr('class', 'sja_menuoption').style('font-size', '.7em').style('text-align', 'center')

		let numdisplayed = 0
		for (const t of tklst) {
			// only match by tkid
			if (findtkbytkid(block, t.tkid)) {
				numdisplayed++
			}
		}

		if (tklst.length > 1) {
			// multiple tracks, click to list
			td.text(tklst.length).on('click', event => {
				// list each track
				tip.clear().show(event.clientX, event.clientY)
				const table = tip.d.append('table')
				for (const t of tklst) {
					const tr = table.append('tr')
					const td1 = tr.append('td').style('color', '#555').style('font-size', '.7em')
					if (findtkbytkid(block, t.tkid)) {
						td1.text('SHOWN')
					}
					tr.append('td')
						.text(t.partname || t.name)
						.attr('class', 'sja_menuoption')
						.on('click', () => {
							tkhandleclick(block, t, td1)
						})
				}
			})
		} else {
			// single track, click cell to add or remove
			if (findtkbytkid(block, tklst[0].tkid)) {
				td.text('SHOWN')
			}
			td.on('click', () => {
				tkhandleclick(block, tklst[0], td)
			})
		}
	}

	function batchselect_assay(assay) {
		// get all tk from a assay
		const tklst = []
		for (const t of tkset.tklst) {
			if (flet) {
				// predefined facet, must check assay
				if (!assays.has(t.assay)) continue
			}
			if (t.assay == assay) {
				tklst.push(t)
			}
		}
		toggle_tracks(tklst)
		facetmake(block, tkset, flet)
	}

	/*
	all parameters are optional
	L1: from L1_2_L2, get all samples under L1
	L2: from L1_2_L2, L1 should be provided; to get all samples under L1 and L2
	level: from level2sample, get all samples under the level

	in all above cases, sample may be provided
	if sample is provided alone, to get level-less tracks from this sample
	*/
	function batchselect_sample({ L1, L2, level, sample }) {
		const tklst = []
		for (const t of tkset.tklst) {
			if (flet) {
				// predefined facet, must check assay
				if (!assays.has(t.assay)) continue
			}
			const l1 = t.level1
			const l2 = t.level2
			if (L1) {
				if (l1 != L1) continue
				if (L2) {
					if (l2 != L2) continue
					if (sample) {
						if (t.sample == sample) tklst.push(t)
					} else {
						tklst.push(t)
					}
				} else {
					tklst.push(t)
				}
			} else if (level) {
				if ((l1 && l2) || (!l1 && !l2)) continue
				const l = l1 || l2
				if (l != level) continue
				if (sample) {
					if (t.sample == sample) tklst.push(t)
				} else {
					tklst.push(t)
				}
			} else if (sample) {
				if (l1 || l2) continue
				if (t.sample == sample) tklst.push(t)
			}
		}
		toggle_tracks(tklst)
		facetmake(block, tkset, flet)
	}

	function toggle_tracks(lst) {
		if (lst.length == 0) return
		const notshown = []
		for (const t of lst) {
			if (!findtkbytkid(block, t.tkid)) {
				notshown.push(t)
			}
		}
		if (notshown.length) {
			// 1 or more not shown, show these
			for (const t of notshown) {
				const t2 = block.block_addtk_template(t)
				if (t2) {
					block.tk_load(t2)
				} else {
					// error, already displayed
				}
			}
		} else {
			// all are shown, hide all
			for (const t of lst) {
				for (let i = 0; i < block.tklst.length; i++) {
					if (block.tklst[i].tkid == t.tkid) {
						block.tk_remove(i)
						break
					}
				}
			}
		}
	}
}

/*
from a list of tracks, summarize the sample and assay dimensions for making the table
detect if .level1 or .level2 is set on tracks
if so, summarize the grouping method
detect old schema with "patient/sampletype" and convert to new schema
*/
function get_dimensions(tkset, flet) {
	/* unique list of assays and number of tracks for each
	to produce ordered list of assays as facet columns
	k: assay name
	v: tk count
	*/
	const assays = new Map()

	/* record assays from each sample, and list of tracks from each assay
	k: sample
	v: map
	   k: assay
	   v: tklst
	*/
	const sample2assay2tracks = new Map()

	/* set to a map when a track has just one level, but not both
	k: either tk.level1 or tk.level2
	v: set of samples
	*/
	let level2sample

	/* set to a map when when both tk.level2 and tk.level2 are set
	k: tk.level1
	v: map
	   k: tk.level2
	   v: set of samples
	*/
	let L1_2_L2

	/* samples from track with any of the level setting
	when levels are specified,
	use this to identify samples from level-less tracks
	so these tracks can be rendered as new rows in addition to level-grouped rows
	*/
	const samplewithlevel = new Set()

	if (flet) {
		// predefined facet
		// identify examples where flet is used
		for (const n of flet.assays) {
			assays.set(n, 0)
		}
		for (const n of flet.samples) {
			sample2assay2tracks.set(n, new Map())
		}
		for (const t of tkset.tklst) {
			if (!assays.has(t.assay)) continue
			const sample = t.patient || t.sample
			if (!sample2assay2tracks.has(sample)) continue
			assays.set(t.assay, assays.get(t.assay) + 1)

			if (!sample2assay2tracks.get(sample).has(t.assay)) sample2assay2tracks.get(sample).set(t.assay, [])
			sample2assay2tracks.get(sample).get(t.assay).push(t)
		}
		return [assays, sample2assay2tracks, null, null, samplewithlevel]
	}

	// flet is not provided

	for (const t of tkset.tklst) {
		if (!assays.has(t.assay)) assays.set(t.assay, 0)
		assays.set(t.assay, assays.get(t.assay) + 1)
	}

	// detect if level1 and level2 is set on any track
	let hasl1 = false,
		hasl2 = false
	for (const t of tkset.tklst) {
		if (t.level1) hasl1 = true
		if (t.level2) hasl2 = true
	}

	if (hasl1 || hasl2) {
		// at least one level is set, initiate holder to map single level to samples
		level2sample = new Map()
		if (hasl1 && hasl2) {
			// both levels are set, initiate holder to capture level1 to level2 mapping
			L1_2_L2 = new Map()
		}
	}
	for (const t of tkset.tklst) {
		const sample = t.sample
		const assay = t.assay
		if (!assay || !sample) {
			// assay and sample are required for a tk to go into facet table
			continue
		}

		// capture sample to assay to track mapping
		if (!sample2assay2tracks.has(sample)) sample2assay2tracks.set(sample, new Map())
		if (!sample2assay2tracks.get(sample).has(assay)) sample2assay2tracks.get(sample).set(assay, [])
		sample2assay2tracks.get(sample).get(assay).push(t)

		const L1 = t.level1,
			L2 = t.level2
		if (L1 || L2) {
			// has either level
			samplewithlevel.add(sample)
			if (L1 && L2) {
				// has both levels
				if (!L1_2_L2.has(L1)) L1_2_L2.set(L1, new Map())
				if (!L1_2_L2.get(L1).has(L2)) L1_2_L2.get(L1).set(L2, new Set())
				L1_2_L2.get(L1).get(L2).add(sample)
			} else {
				// has just one level, allow it to be either L1 or L2, and associate the sample with it
				const L = L1 || L2
				if (!level2sample.has(L)) level2sample.set(L, new Set())
				level2sample.get(L).add(sample)
			}
		}
	}
	return [assays, sample2assay2tracks, level2sample, L1_2_L2, samplewithlevel]
}

/*
for both sample and assays, determine the order of appearance in the table
sample sorting is not implemented, need to account for optional levels
*/
function sort_dimensions(assays, flet) {
	let assaynamelst
	//patientnamelst

	if (flet && flet.nosortassay) {
		assaynamelst = [...assays].map(a => a[0])
	} else {
		assaynamelst = [...assays]
			.sort((a, b) => {
				// tk count
				const [aname, atknum] = a
				const [bname, btknum] = b
				if (atknum == btknum) {
					// same tk count
					// sort alphabetically by assay name
					if (aname < bname) return -1
					return 1
				} else {
					return btknum - atknum
				}
			})
			.map(a => a[0])
	}
	/*

	if (flet && flet.nosortsample) {
		patientnamelst = [...patients].map(a => a[0])
	} else {
		patientnamelst = [...patients].sort((a, b) => b[1].count - a[1].count).map(a => a[0])
	}
	*/

	/*
	show sampletype column?
	if a patient do not have sampletype, the sampletype value is the same as patient name
	if none of the patients have sampletype, do not show sampletype column
	otherwise show
	let hasst = false
	for (const [patient, a] of patients) {
		for (const [st, b] of a.st) {
			if (st != patient) {
				hasst = true
				break
			}
		}
		if (hasst) break
	}
	*/
	return [assaynamelst]
}

function backward_compatible(lst) {
	// change .assayname to .assay, patient/sampletype to level1/level2
	for (const t of lst) {
		if (t.assayname) {
			// change .assayname to .assay
			t.assay = t.assayname
			delete t.assayname
		}
		if (!t.assay) continue
		// assay is required

		if (t.patient) {
			// has the old designation of .patient
			if (t.sampletype && t.patient == t.sampletype) {
				delete t.sampletype
			}
			if (!t.sample) {
				// has patient but no sample
				t.sample = t.patient
				delete t.patient
			}
		}

		if (!t.sample) continue
		// sample is required
		// this track can show in facet table
		if (t.patient) {
			t.level1 = t.patient
			delete t.patient
			if (t.sampletype) {
				t.level2 = t.sampletype
				delete t.sampletype
			}
		}
	}
}

function findtkbytkid(block, tkid) {
	for (const t of block.tklst) {
		if (t.tkid == tkid) return true
	}
	return false
}

function tkhandleclick(block, tk, td1) {
	/*
	called by clicking on the *handle* that shows the track name
	will show/hide the track
	*/
	for (let i = 0; i < block.tklst.length; i++) {
		const t = block.tklst[i]
		// different ways of identifying equal tracks
		let equal = false
		if (tk.ds && tk.ds.iscustom) {
			// is child ds of official dstk
			if (t.ds && t.ds.label == tk.ds.label) {
				equal = true
			}
		} else if (tk.tkid) {
			// using tkid
			if (t.tkid == tk.tkid) equal = true
		} else if (tk.id) {
			// tkid not set, this is possible for cohort-generated tracks
			// cohort assay id
			if (t.id == tk.id && t.file == tk.file && t.url == tk.url) {
				equal = true
			}
		}
		if (equal) {
			// match, this one is currently shown
			block.tk_remove(i)
			block.tkchangeaffectlegend(tk)
			if (td1) {
				td1.text('')
			}
			return
		}
	}
	// here this track is to be shown
	let newt
	if (tk.type == client.tkt.ds) {
		/*
		is dstk
		must SHED old stuff from scopped tk !?
		*/

		const newtemplate = {
			type: tk.type,
			tkid: tk.tkid, // must retain tkid
			ds: tk.ds,
			isvcf: tk.isvcf,
			itemlabelname: tk.itemlabelname,
			iscustom: tk.iscustom,
			vcfinfofilter: tk.vcfinfofilter,
			populationfrequencyfilter: tk.populationfrequencyfilter,
			url4variant: tk.url4variant,
			button4variant: tk.button4variant,
			viewrangeupperlimit: tk.viewrangeupperlimit
		}

		if (tk.ds.iscustom) {
			// is a custom ds, must be child from official dstk
			block.addchilddsnoload(tk.ds)
		}
		newt = block.block_addtk_template(newtemplate)
	} else {
		newt = block.block_addtk_template(tk)
	}
	block.tk_load(newt)
	if (td1) {
		td1.text('SHOWN')
	}
}

function deletecustom(block, tk, tr) {
	tr.remove()
	for (let i = 0; i < block.tklst.length; i++) {
		const t = block.tklst[i]
		if (t.tkid == tk.tkid) {
			// match, this one is currently shown
			block.tk_remove(i)
			block.tkchangeaffectlegend(tk)
			break
		}
	}
	for (let i = 0; i < block.genome.tracks.length; i++) {
		const t = block.genome.tracks[i]
		if (t.tkid == tk.tkid) {
			block.genome.tracks.splice(i, 1)
			break
		}
	}
	if (!block.tklst.find(i => i.type == 'bam' && i.gdcFile)) {
		// some tk has been deleted and no more gdc bam slicing tk, hide this button
		block.gdcBamSliceDownloadBtn.style('display', 'none')
	}
}

/* this function has been changed to return text rather than HTML,
to prevent it from showing injected code in custom tk name
*/
function tkhtmllabel(tk, block) {
	let basename
	if (tk.type == client.tkt.usegm) {
		// is usegm tk, show block gmmode
		if (block) {
			switch (block.gmmode) {
				case client.gmmode.gmsum:
					const usecount = block.allgm.reduce((i, j) => i + (j.hidden ? 0 : 1), 0)
					basename =
						tk.name +
						', sum of ' +
						(usecount < block.allgm.length ? usecount + ' of ' + block.allgm.length : usecount) +
						' isoforms'
					break
				case client.gmmode.splicingrna:
					basename = tk.name + ' exons'
					break
				case client.gmmode.exononly:
					basename = tk.name + ' RNA'
					break
				case client.gmmode.genomic:
					basename = tk.name + ' genomic view'
					break
				case client.gmmode.protein:
					basename = tk.name + ' protein'
					break
			}
		} else {
			basename = tk.name
		}
	} else if (tk.type == client.tkt.ds) {
		basename = tk.ds.label
	} else if (tk.name) {
		basename = tk.name
	} else {
		// no name, go figure
		if (tk.dslabel) {
			basename = tk.dslabel
		} else {
			const lst = []
			if (tk.patient) lst.push(tk.patient)
			if (tk.sampletype) lst.push(tk.sampletype)
			if (tk.assayname) lst.push(tk.assayname)
			basename = lst.join(' ')
		}
	}

	if (tk.type == client.tkt.junction) {
		// weird counting method for # samples in junction tk
		if (tk.totalsamplecount == undefined) {
			// this can happen for a junction track that has not been loaded yet, so don't know # samples
			return basename
		}
		if (tk.totalsamplecount == 1) {
			return basename
		}
		return `${basename} (${tk.totalsamplecount})`
		/*
		return (
			basename +
			' <span class="sja_mcdot" style="font-size:.7em;background-color:#bbb">' +
			tk.totalsamplecount +
			' combined</span>'
		)
		*/
	}
	if (!tk.tracks || tk.tracks.length == 1) {
		// singleton
		return basename
	}
	// tell # of members
	return `${basename} (${tk.tracks.length})`
	/*
	return (
		basename +
		' <span style="font-size:.7em;padding:1px 5px;background-color:#bbb;color:white;border-radius:3px">' +
		tk.tracks.length +
		' combined</span>'
	)
	*/
}

function stringisurl(s) {
	const ss = s.toLowerCase()
	if (ss.startsWith('http://')) return true
	if (ss.startsWith('https://')) return true
	if (ss.startsWith('ftp://')) return true
	return false
}

function notAllowedToHideThisTrack(tk) {
	// return true to indicate the track cannot be turned hidden in tk menu

	// usegm track is always on, cannot remove, because it's not registered in genome.tracks[]
	if (tk.type == client.tkt.usegm) return true

	// is official mds3 tk, always on; could be temporary fix! can encode this choice at ds if indeed we need to hide an official mds3...
	// 4-2024 can show/hide from tk menu without leaving menu. issue is that tk is not registered as custom tk and won't reappear in tkmenu after closing menu, thus still does not allow hiding it
	if (tk.type == 'mds3' && tk.dslabel) return true

	// is a gdc bam tk, it only shows in gdc bam slicing app and doesn't make sense to hide it
	if (tk.type == 'bam' && tk.gdcFile) return true

	return false
}
