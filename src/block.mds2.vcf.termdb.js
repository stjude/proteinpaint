import * as common from './common'
import * as client from './client'
import {scaleOrdinal,schemeCategory10} from 'd3-scale'


/*
********************** EXPORTED
termdb_bygenotype
********************** INTERNAL
get_ssid_by_onevcfm
*/




export async function termdb_bygenotype( plotdiv, m, tk, block ) {
/*
launch termdb by the genotype of one vcf variant

official track only
*/

	// sample session id
	const {ssid, groups} = await get_ssid_by_onevcfm( m, tk.mds.label, block.genome.name )

	// assign a color for each group, show color legend
	{
		const row = plotdiv.append('div')
			.style('margin','10px')
		const f = scaleOrdinal(schemeCategory10)
		for(const name in groups) {
			groups[ name ].color = f(name)
			row.append('div')
				.style('font-size','.7em')
				.style('color','white')
				.style('display','inline-block')
				.style('background',groups[name].color)
				.style('padding','2px 4px')
				.text(groups[name].size)
			row.append('div')
				.style('display','inline-block')
				.style('padding','1px 5px')
				.style('margin-right','5px')
				.text(name)
		}
	}



	const obj = {
		mds: tk.mds,
		genome: block.genome,
		div: plotdiv,
		default_rootterm: {},
		modifier_ssid_barchart: {
			chr: m.chr, // chr and pos needed for computing AF with respect to sex & par
			pos: m.pos,
			mutation_name: m.mname,
			ssid: ssid,
			groups: groups
		}
	}
	const _ = await import('./mds.termdb')
	_.init( obj )


	const h = client.may_get_locationsearch()
	if(h && h.has('testall')) {
		const div = plotdiv.append('div')
			.style('margin-top','20px')
		const wait = div.append('div').text('Loading...')
		const arg = [
			'genome='+block.genome.name,
			'dslabel='+tk.mds.label,
			'ssid='+ssid,
			'testall=1'
		]
		const data = await client.dofetch2('/termdb?'+arg.join('&'))
		wait.remove()
		const table = div.append('table')
		const tr = table.append('tr')
		tr.append('th').text('Term')
		tr.append('th').text('Category')
		tr.append('th').text('Case #ALT')
		tr.append('th').text('Case #REF')
		tr.append('th').text('Ctrl #ALT')
		tr.append('th').text('Ctrl #REF')
		tr.append('th')
		tr.append('th').text('Adjust p-value')

		// collect AF difference then render
		const afdiff_lst = []
		let vmax = 0

		for(const i of data.results) {
			const tr = table.append('tr')
			tr.attr('class','sja_tr')
			tr.append('td').text(i.term.name)
			tr.append('td').text(i.category)
			tr.append('td').text(i.table[0])
			tr.append('td').text(i.table[1])
			tr.append('td').text(i.table[2])
			tr.append('td').text(i.table[3])
			const afdiff_td = tr.append('td')
			tr.append('td').text(i.pvalue)

			const v = i.table[0]/(i.table[0]+i.table[1]) - i.table[2]/(i.table[2]+i.table[3])
			vmax = Math.max( vmax, Math.abs(v) )

			afdiff_lst.push({ v, td: afdiff_td })
		}

		const w = 30
		const h = 15
		for(const {v,td} of afdiff_lst) {
			const s = td.append('svg')
				.attr('width', w)
				.attr('height', h)
			s.append('rect')
				.attr('height',h)
				.attr('width', Math.abs(w*v/vmax) )
				.attr('fill', v>0 ?  '#D07A30' : '#3086D0')
		}
	}
}



function get_ssid_by_onevcfm ( m, dslabel, genome ) {
/*
using the genotype of one variant from the vcf file
divide samples to groups
record it in a temp file at cache
and get the file name
use the file name as a session in termdb
*/
	const arg = {
		dslabel: dslabel,
		genome: genome,
		m: {
			chr: m.chr,
			pos: m.pos,
			ref: m.ref,
			alt: m.alt
		},
		trigger_ssid_onevcfm:true
	}

	return client.dofetch('mds2', arg )
	.then(data=>{
		if(data.error) throw data.error
		return data
	})
}
