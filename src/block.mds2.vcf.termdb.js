import * as common from './common'
import * as client from './client'
import {scaleOrdinal,schemeCategory10, scaleLinear} from 'd3-scale'
import {axisLeft} from 'd3-axis'
import {event as d3event} from 'd3-selection'


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
	if(h && h.has('phewas')) {
		const div = plotdiv.append('div')
			.style('margin-top','20px')
		const wait = div.append('div').text('Loading...')
		const arg = [
			'genome='+block.genome.name,
			'dslabel='+tk.mds.label,
			'ssid='+ssid,
			'phewas=1'
		]
		const data = await client.dofetch2('/termdb?'+arg.join('&'))
		wait.remove()
		phewas_svg( data, div, tk, block )
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



function phewas_table ( data, div ) {
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







function phewas_svg ( data, div, tk, block ) {
	const axiswidth = 100
	const xpad = 5
	const svg = div.append('svg')
		.attr('width', axiswidth + xpad + data.canvaswidth )
		.attr('height', data.canvasheight)
	
	// axis
	const yscale = scaleLinear()
	const axis_g = svg.append('g')
		.attr('transform','translate('+axiswidth+','+data.toppad+')')
	update_axis( data )

	// axis label
	svg.append('g')
		.attr('transform','translate(10,'+(data.toppad+data.axisheight/2)+')')
		.append('text')
		.text('-Log10(FDR p-value)')
		.attr('text-anchor','middle')
		.attr('dominant-baseline','central')
		.attr('transform','rotate(-90)')


	// plot
	const g = svg.append('g')
		.attr('transform','translate('+(axiswidth+xpad)+',0)')
	const image = g.append('image')
		.attr('width', data.canvaswidth)
		.attr('height', data.canvasheight)
		.attr('xlink:href', data.src)

	const hoverdots = g.append('g')
		.attr('transform','translate(0,'+data.toppad+')')
		.selectAll()
		.data( data.hoverdots )
		.enter()
		.append('g')
	hoverdots.append('circle')
		.attr('r', data.dotradius)
		.attr('fill', 'red')
		.on('mouseover', d=>{
			tk.legend.tip.clear()
			const lst = [
				{k:'Term',v:d.term.name},
				{k:'Category',v:d.category},
				{k:'FDR pvalue',v:d.pvalue},
				{k:'Case',v: d.table[0]+' <span style="font-size:.7em;">ALT</span> &nbsp;'+d.table[1]+' <span style="font-size:.7em">REF</span>'},
				{k:'Control',v: d.table[2]+' <span style="font-size:.7em;">ALT</span> &nbsp;'+d.table[3]+' <span style="font-size:.7em">REF</span>'},
			]
			client.make_table_2col( tk.legend.tip.d, lst )
			tk.legend.tip.show( d3event.clientX, d3event.clientY )
		})
		.on('mouseout',()=>{
			tk.legend.tip.hide()
		})
	place_hoverdots( data.maxlogp )



	////////////// message
	div.append('div')
		.text(data.testcount+' attributes tested')
		.style('margin-bottom','5px')
		.style('opacity',.6)
	div.append('div')
		.text(data.hoverdots.length+' attributes with FDR p-value <= 0.05')
		.style('margin-bottom','5px')
		.style('opacity',.6)
	div.append('div')
		.text('Max -log10(FDR pvalue) is '+data.maxlogp)
		.style('margin-bottom','5px')
		.style('opacity',.6)



	////////////// controls
	const row = div.append('div')
	const input = row.append('input')
		.attr('type','number')
		.style('width', '150px')
		.attr('placeholder','Set Y axis max')
		.on('keyup',()=>{
			if(client.keyupEnter()) {
				const s = input.property('value')
				if(!s) return
				const v = Number(s)
				if(v<=0) {
					window.alert('Max value must be above 0')
					return
				}
				update_image( v )
			}
		})


	function update_axis ( data ) {
		yscale.domain([data.maxlogp,0])
			.range([0, data.axisheight])
		client.axisstyle({
			axis: axis_g.call( axisLeft().scale( yscale ) ),
			fontsize: 12,
			showline:true
		})
	}

	function place_hoverdots ( ymax ) {
		hoverdots
			.attr('transform', d=> 'translate('+d.x+','+(d.logp >= ymax ? 0 : yscale(d.logp))+')' )
	}

	async function update_image ( ymax ) {
		const arg = [
			'genome='+block.genome.name,
			'dslabel='+tk.mds.label,
			'file='+data.tmpfile,
			'max='+ymax,
			'updatephewas=1'
		]
		input
			.property('value','')
			.property('disabled',true)
			.attr('placeholder','Loading...')
		const data2 = await client.dofetch2('/termdb?'+arg.join('&'))
		image.attr('xlink:href', data2.src )
		update_axis( data2 )
		place_hoverdots( ymax )
		input
			.property('disabled',false)
			.attr('placeholder','Set Y axis max')
	}
}
