import * as common from '#shared/common.js'
import * as client from './client'
import { make_ui as mafcovplot_makeui } from './block.mds2.vcf.mafcovplot'
import { termdb_bygenotype, make_phewas } from './block.mds2.vcf.termdb'
import { AFtest_groupname } from './block.mds2.vcf.numericaxis.AFtest'
import { addparameter_rangequery } from './block.mds2'

/*
********************** EXPORTED
vcf_clickvariant
********************** INTERNAL
*/

export async function vcf_clickvariant(m, p, tk, block) {
	/*
p{}
	.left
	.top
*/

	// if to show sunburst, do it here, no pane

	if (tk.ld && tk.ld.overlaywith) {
		await overlay_ld(m, tk, block)
		return
	}

	const $id = 'sja-pp-block-' + block.blockId + '-' + block.tklst.findIndex(t => t === tk) + '-vcf_clickvariant'
	const pane = client.newpane({ x: p.left, y: p.top, $id })
	pane.pane.style('line-height', 1.15)
	pane.header.html(m.mname + ' <span style="font-size:.7em;">' + common.mclass[m.class].label + '</span>')

	const tabs = []
	addtab_functionalannotation(tabs, m, tk, block)
	mayaddtab_fishertable(tabs, m, tk, block)
	//mayaddtab_termdbbygenotype(tabs, m, tk, block)
	mayaddtab_phewas(tabs, m, tk, block)
	mayaddtab_mafcovplot(tabs, m, tk, block)
	mayaddtab_fimo(tabs, m, tk, block)

	client.tab2box(pane.body.style('padding-top', '10px'), tabs)
}

function mayaddtab_mafcovplot(tabs, m, tk, block) {
	// only for vcf item
	if (!tk.vcf || !tk.vcf.plot_mafcov) return
	tabs.push({
		label: 'Coverage-MAF plot',
		callback: async div => {
			const wait = client.tab_wait(div)
			try {
				await mafcovplot_makeui(div, m, tk, block)
				wait.remove()
			} catch (e) {
				wait.text('Error: ' + (e.message || e))
			}
		}
	})
}

function mayaddtab_termdbbygenotype(tabs, m, tk, block) {
	// only for vcf, by variant genotype

	if (!tk.vcf) return
	if (!tk.vcf.termdb_bygenotype) return
	tabs.push({
		label: 'Clinical info',
		callback: async div => {
			// runs only once
			const wait = client.tab_wait(div)
			try {
				await termdb_bygenotype(div, m, tk, block)
				wait.remove()
			} catch (e) {
				wait.text('Error: ' + (e.message || e))
			}
		}
	})
}
function mayaddtab_phewas(tabs, m, tk, block) {
	// only for vcf, by variant genotype

	if (!tk.vcf) return
	if (!tk.vcf.termdb_bygenotype) return
	if (tk.mds && tk.mds.hide_phewas) return
	tabs.push({
		label: 'Phewas',
		callback: async div => {
			// runs only once
			const wait = client.tab_wait(div)
			try {
				await make_phewas(div, m, tk, block)
				wait.remove()
			} catch (e) {
				wait.text('Error: ' + (e.message || e))
			}
		}
	})
}

function mayaddtab_fishertable(tabs, m, tk, block) {
	if (
		!tk.vcf.numerical_axis ||
		!tk.vcf.numerical_axis.inuse_AFtest ||
		!tk.vcf.numerical_axis.AFtest ||
		!tk.vcf.numerical_axis.AFtest.testby_fisher ||
		!m.contigencytable
	)
		return

	tabs.push({
		label: "Fisher' exact test",
		callback
	})

	async function callback(div) {
		const af = tk.vcf.numerical_axis.AFtest

		/*
		at fisher test
		when group1 is termdb,
		will test it against all the other control populations, if any
		*/
		const additionalpop2test = []
		if (af.groups[0].is_termdb) {
			// for every population not in af.groups, test the group1 against it
			if (tk.populations) {
				for (const g of tk.populations) {
					if (!af.groups[1].is_population || af.groups[1].key != g.key) {
						additionalpop2test.push({ key: g.key, label: g.label })
					}
				}
			}
		}

		// the table to be shown in different ways
		const table = div.append('table').style('border', '1px solid #ccc').style('border-collapse', 'collapse')

		if (additionalpop2test.length) {
			// to test against additional populations
			{
				const tr = table.append('tr')
				tr.append('td')
				tr.append('th').text('#ALT alleles')
				tr.append('th').text('#REF alleles')
				tr.append('th').text('P-value')
			}
			{
				const tr = table.append('tr')
				tr.append('th').text(AFtest_groupname(tk, 0))
				tr.append('td').text(m.contigencytable[0].toFixed(0)).style('padding', '5px')
				tr.append('td').text(m.contigencytable[1].toFixed(0)).style('padding', '5px')
				tr.append('td').text('-')
			}
			{
				const tr = table.append('tr')
				tr.append('th').text(AFtest_groupname(tk, 1))
				tr.append('td').text(m.contigencytable[2].toFixed(0)).style('padding', '5px')
				tr.append('td').text(m.contigencytable[3].toFixed(0)).style('padding', '5px')
				tr.append('td').text(m.AFtest_pvalue).style('padding', '5px')
			}
			for (const g of additionalpop2test) {
				const tr = table.append('tr')
				tr.append('th').text(g.label)
				const td_altcount = tr.append('td').text('...').style('padding', '5px')
				const td_refcount = tr.append('td').text('...').style('padding', '5px')
				const td_pvalue = tr.append('td').text('...').style('padding', '5px')

				// run a full-blown query with altered parameter
				const par = addparameter_rangequery(tk, block)
				delete par.trigger_ld
				// replace the control
				par.AFtest.groups[1] = {
					is_population: true,
					key: g.key
				}
				// replace the range
				par.rglst = [{ chr: m.chr, start: m.pos, stop: m.pos + 1 }]
				const data = await client.dofetch('mds2', par)
				if (data.vcf && data.vcf.rglst && data.vcf.rglst[0] && data.vcf.rglst[0].variants) {
					const m2 = data.vcf.rglst[0].variants[0]
					if (m2) {
						if (m2.contigencytable) {
							td_altcount.text(m2.contigencytable[2])
							td_refcount.text(m2.contigencytable[3])
						}
						if (m2.AFtest_pvalue != undefined) {
							td_pvalue.text(m2.AFtest_pvalue)
						}
					}
				}
			}
		} else {
			// no further testing
			{
				const tr = table.append('tr')
				tr.append('td')
				tr.append('th').text('#ALT alleles')
				tr.append('th').text('#REF alleles')
			}
			{
				const tr = table.append('tr')
				tr.append('th').text(AFtest_groupname(tk, 0))
				tr.append('td').text(m.contigencytable[0].toFixed(0)).style('padding', '5px')
				tr.append('td').text(m.contigencytable[1].toFixed(0)).style('padding', '5px')
			}
			{
				const tr = table.append('tr')
				tr.append('th').text(AFtest_groupname(tk, 1))
				tr.append('td').text(m.contigencytable[2].toFixed(0)).style('padding', '5px')
				tr.append('td').text(m.contigencytable[3].toFixed(0)).style('padding', '5px')
			}
			table
				.append('tr')
				.append('td')
				.attr('colspan', 3)
				.style('border', '1px solid #ccc')
				.style('padding', '5px')
				.html('<span style="opacity:.5">Fisher exact p-value:</span> ' + m.AFtest_pvalue)
		}

		if (m.popsetadjvalue) {
			const termdbgidx = af.groups.findIndex(i => i.is_termdb)
			const termdbg = af.groups.find(i => i.is_termdb)
			const popgrp = af.groups.find(i => i.is_population)

			const table = div
				.append('table')
				.style('margin-top', '30px')
				.style('border', '1px solid #ccc')
				.style('border-collapse', 'collapse')
			{
				const tr = table.append('tr')
				tr.append('td').style('padding', '5px')
				for (const s of termdbg.popsetaverage) {
					tr.append('th').text(s[0]).style('padding', '5px')
				}
			}
			{
				const tr = table.append('tr')
				tr.append('th')
					.text('Group ' + (termdbgidx + 1) + ' average admix')
					.style('padding', '5px')
				for (const s of termdbg.popsetaverage) {
					tr.append('td').text(s[1].toFixed(2)).style('padding', '5px')
				}
			}
			{
				const tr = table.append('tr')
				tr.append('th')
					.text(popgrp.key + ' raw ALT/REF')
					.style('padding', '5px')
				for (const s of termdbg.popsetaverage) {
					const v = m.popsetadjvalue.find(i => i[0] == s[0])
					tr.append('td')
						.text(v[1] + '/' + v[2])
						.style('padding', '5px')
				}
			}
			{
				const tr = table.append('tr')
				tr.append('th')
					.text(popgrp.key + ' adjusted ALT/REF')
					.style('padding', '5px')
				for (const s of termdbg.popsetaverage) {
					const v = m.popsetadjvalue.find(i => i[0] == s[0])
					tr.append('td')
						.text(v[3] + '/' + v[4])
						.style('padding', '5px')
				}
			}
		}
	}
}

function addtab_functionalannotation(tabs, m, tk, block) {
	tabs.push({
		label: 'Annotation',
		callback: show_immediate
	})

	function show_immediate(div) {
		div
			.append('span')
			.html(
				(m.gene ? '<i>' + m.gene + '</i> ' : '') +
					(m.isoform ? '<span style="font-size:.8em;text-decoration:italic">' + m.isoform + '</span> ' : '') +
					m.mname +
					'&nbsp; <span style="font-size:.7em;padding:3px;color:white;background:' +
					common.mclass[m.class].color +
					'">' +
					common.mclass[m.class].label +
					'</span>' +
					(m.name && m.name.startsWith('rs')
						? '&nbsp; <a href=https://www.ncbi.nlm.nih.gov/snp/' + m.name + ' target=_blank>' + m.name + '</a>'
						: '')
			)

		if (m.csq_count && m.csq_count > 1) {
			// variant does not keep csq on client
			// a button to retrieve actual csq
			const button = div
				.append('div')
				.style('margin-left', '20px')
				.text(m.csq_count - 1 + ' other interpretations')
				.attr('class', 'sja_button')
				.style('zoom', '.7')

			let loading = false,
				loaded = false
			const plotdiv = div.append('div').style('margin', '20px').style('display', 'none')

			button.on('click', async () => {
				if (plotdiv.style('display') == 'none') {
					client.appear(plotdiv)
					button.attr('class', 'sja_button_open')
				} else {
					client.disappear(plotdiv)
					button.attr('class', 'sja_button_fold')
				}
				if (loaded || loading) return
				loading = true // prevent clicking while loading
				button.text('Loading...')
				try {
					await get_csq(plotdiv, m, tk, block)
				} catch (e) {
					plotdiv.text('Error: ' + (e.message || e))
				}
				loaded = true
				loading = false
				button.text(m.csq_count - 1 + ' other interpretations')
			})
		}

		const lst = [] // items for showing in a table

		// genomic position
		{
			let text = m.chr + ':' + (m.pos + 1)
			if (m.ref + '>' + m.alt != m.mname) {
				// m has hgvs, so display alleles
				text +=
					' <span style="font-size:.7em;opacity:.5">REF</span> ' +
					m.ref +
					' <span style="font-size:.7em;opacity:.5">ALT</span> ' +
					m.alt
			}
			lst.push({ k: 'Genomic', v: text })
		}

		// info fields add to lst
		if (m.altinfo) {
			// alt allele info
			for (const k in m.altinfo) {
				// value from altinfo maybe array
				const infovalue = Array.isArray(m.altinfo[k]) ? m.altinfo[k] : [m.altinfo[k]]
				const showvalue = infovalue
				/*
				let showvalue
				if( altkey2category[ k ] ) {
					showvalue = infovalue.map( i=> {
						const cat = altkey2category[k][i]
						if(cat) {
							return '<span style="padding:1px 3px;background:'+cat.color+';color:'+(cat.textcolor || 'black')+';">'+i+'</span>'
						}
						return i
					})
				} else {
					showvalue = infovalue
				}
				*/
				lst.push({
					k: k,
					v:
						showvalue.join(', ') +
						(tk.vcf.info && tk.vcf.info[k]
							? ' <span style="font-size:.7em;opacity:.5">' + tk.vcf.info[k].Description + '</span>'
							: '')
				})
			}
		}

		if (m.info) {
			// locus info
			for (const k in m.info) {
				const infovalue = Array.isArray(m.info[k]) ? m.info[k] : [m.info[k]]
				const showvalue = infovalue
				/*
				let showvalue
				if( lockey2category[ k ] ) {
					showvalue = infovalue.map( i=> {
						const cat = lockey2category[k][i]
						if(cat) {
							return '<span style="padding:1px 3px;background:'+cat.color+';color:'+(cat.textcolor || 'black')+';">'+i+'</span>'
						}
						return i
					})
				} else {
					showvalue = infovalue
				}
				*/
				lst.push({
					k: k,
					v:
						showvalue.join(', ') +
						(tk.vcf.info && tk.vcf.info[k]
							? ' <span style="font-size:.7em;opacity:.5">' + tk.vcf.info[k].Description + '</span>'
							: '')
				})
			}
		}

		const table = client.make_table_2col(div, lst).style('margin', '20px 0px 0px 0px')

		// add dynamic columns

		if (tk.vcf.check_pecanpie) {
			const tr = table.append('tr')
			tr.append('td').attr('colspan', 2).text('PeCAN-PIE').style('opacity', 0.5)
			const td = tr.append('td').text('Loading...')
			fetch(
				'https://pecan.stjude.cloud/variant/decision/' +
					block.genome.name +
					'/' +
					m.chr.replace('chr', '') +
					'/' +
					(m.pos + 1) +
					'/' +
					m.ref +
					'/' +
					m.alt
			)
				.then(data => {
					return data.json()
				})
				.then(data => {
					if (data.length == 0) throw 'Not in PeCAN-PIE'
					const v = data[0].paneldecision
					if (!v) throw 'Not in PeCAN-PIE'

					const info = tk.vcf.check_pecanpie.info
					td.html(
						'<a href=https://pecan.stjude.cloud/variant/' +
							block.genome.name +
							'/' +
							m.chr.replace('chr', '') +
							'/' +
							(m.pos + 1) +
							'/' +
							m.ref +
							'/' +
							m.alt +
							' target=_blank ' +
							' style="font-size:.8em;text-decoration:none;background:' +
							info[v].fill +
							';color:' +
							(info[v].color || 'white') +
							';padding:3px 5px">' +
							'PeCAN-PIE: ' +
							info[v].label +
							'</a>'
					)
				})
				.catch(e => {
					td.text(e.message || e)
					if (e.stack) console.log(e.stack)
				})
		}
	}
}

function get_csq(div, m, tk, block) {
	const par = {
		genome: block.genome.name,
		trigger_getvcfcsq: 1,
		m: {
			chr: m.chr,
			pos: m.pos,
			ref: m.ref,
			alt: m.alt
		}
	}
	if (tk.mds) {
		par.dslabel = tk.mds.label
	} else {
		par.vcf = {
			file: tk.vcf.file,
			url: tk.vcf.url,
			indexURL: tk.vcf.indexURL
		}
	}

	return client
		.dofetch('mds2', par)
		.then(data => {
			if (data.error) throw data.error
			if (!data.csq) throw 'cannot load csq'
			for (const item of data.csq) {
				let blown = false
				let thislabel
				{
					const lst = []
					if (item.HGVSp) {
						lst.push('<span style="font-size:.7em;opacity:.5">HGVSp</span> ' + item.HGVSp)
					} else if (item.HGVSc) {
						lst.push('<span style="font-size:.7em;opacity:.5">HGVSc</span> ' + item.HGVSc)
					} else if (item.Feature) {
						// no hgvs
						lst.push('<span style="font-size:.7em;opacity:.5">no HGVS</span> ' + item.Feature)
					}
					if (item.Consequence) {
						lst.push('<span style="font-size:.7em;opacity:.5">CONSEQUENCE</span> ' + item.Consequence)
					} else {
						lst.push('<span style="font-size:.7em;opacity:.5">no CONSEQUENCE</span>')
					}
					thislabel = lst.join(' ')
				}
				// show header row
				const row = div.append('div').style('margin', '5px').attr('class', 'sja_clbtext').html(thislabel)
				const detailtable = div.append('div').style('display', 'none')
				const lst = []
				for (const h of tk.vcf.info.CSQ.csqheader) {
					const v = item[h.name]
					if (v) {
						lst.push({ k: h.name, v: v })
					}
				}
				client.make_table_2col(detailtable.append('div').style('display', 'inline-block'), lst)
				row.on('click', () => {
					detailtable.style('display', detailtable.style('display') == 'none' ? 'block' : 'none')
				})
			}
		})
		.catch(e => {
			div.text(e.message || e)
		})
}

function mayaddtab_fimo(tabs, m, tk, block) {
	/*
may create a tf motif find button for mutation
*/
	if (!block.genome.fimo_motif) return
	tabs.push({
		label: 'TF motif',
		callback: async div => {
			const wait = client.tab_wait(div)
			const fimoarg = {
				genome: block.genome,
				div,
				m: {
					chr: m.chr,
					pos: m.pos + 1, // 1 based
					ref: m.ref,
					alt: m.alt
				}
			}
			try {
				const _ = await import('./mds.fimo')
				await _.init(fimoarg)
				wait.remove()
			} catch (e) {
				wait.text('Error: ' + (e.message || e))
			}
		}
	})
}

async function overlay_ld(m, tk, block) {
	const par = {
		genome: block.genome.name,
		trigger_overlayld: 1,
		ldtkname: tk.ld.overlaywith,
		m: {
			chr: m.chr,
			pos: m.pos,
			ref: m.ref,
			alt: m.alt
		}
	}
	if (tk.mds) {
		par.dslabel = tk.mds.label
	} else {
		// TODO add custom ld track
	}

	const data = await client.dofetch('mds2', par)

	const key2r2 = new Map()
	// k: pos+'.'+alleles
	// v: r2
	for (const v of data.lst) {
		key2r2.set(v.pos + '.' + v.alleles, v.r2)
	}

	tk.skewer2.selectAll('.sja_aa_disk_fill').attr('fill', m2 => {
		if (m2.pos == m.pos && m2.ref == m.ref && m2.alt == m.alt) {
			// self
			return tk.ld.overlay.color_1
		}
		const r2 = key2r2.get(m2.pos + '.' + m2.ref + '.' + m2.alt) || 0
		return tk.ld.overlay.r2_to_color(r2)
	})

	// show the overlay circle
	tk.ld.overlay.vcfcircle.attr('stroke-opacity', 1)
	// overlay by adding to <g> of the disks
	tk.skewer2
		.selectAll('.sja_aa_discg')
		.filter(m2 => m2.pos == m.pos && m2.ref == m.ref && m2.alt == m.alt)
		.node()
		.appendChild(tk.ld.overlay.vcfcircle.node())
}
