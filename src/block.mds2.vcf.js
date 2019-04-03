import * as numericaxis from './block.mds2.vcf.numericaxis'
import * as common from './common'
import * as client from './client'


/*
********************** EXPORTED
may_render_vcf
vcf_m_color
vcf_m_click
********************** INTERNAL


*/



export function may_render_vcf ( data, tk, block ) {
/* for now, assume always in variant-only mode for vcf
return vcf row height
*/
	if( !tk.vcf ) return 0
	if( !data.vcf ) return 0
	if( !data.vcf.rglst ) return 0

	tk.g_vcfrow.selectAll('*').remove()

	/* current implementation ignore subpanels
	to be fixed in p4
	*/


	let rowheight = 0

	for(const r of data.vcf.rglst) {
		
		const g = tk.g_vcfrow.append('g')
			.attr('transform','translate('+r.xoff+',0)')

		if( r.rangetoobig ) {
			r.text_rangetoobig = g.append('text')
				.text( r.rangetoobig )
				.attr('text-anchor','middle')
				.attr('dominant-baseline','central')
				.attr('x', r.width/2 )
				// set y after row height is decided
			rowheight = Math.max( rowheight, 50 )
			continue
		}

		if( r.imgsrc ) {
			g.append('image')
				.attr('width', r.width)
				.attr('height', r.imgheight)
				.attr('xlink:href', r.imgsrc)
			rowheight = Math.max( rowheight, r.imgheight )
			continue
		}

		if( r.variants ) {
			const height = vcf_render_variants( r, g, tk, block )
			rowheight = Math.max( rowheight, height )
			continue
		}
	}

	// row height set
	for(const r of data.vcf.rglst) {
		if(r.rangetoobig) {
			r.text_rangetoobig.attr('y', rowheight/2 )
		}
	}

	return rowheight
}




function vcf_render_variants ( r, g, tk, block ) {
/*
got the actual list of variants at r.variants[], render them
*/

	if( tk.vcf.numerical_axis && tk.vcf.numerical_axis.in_use ) {
		// numerical axis by info field
		const height = numericaxis.render( r, g, tk, block )
		return height
	}

	// not numerical axis
	// TODO
	return 50
}



export function vcf_m_color ( m, tk ) {
// TODO using categorical attribute
	return common.mclass[m.class].color
}



export function vcf_m_click ( m, p, tk, block ) {
/*
p{}
	.left
	.top
*/
	// if to show sunburst, do it here, no pane

	const pane = client.newpane({x: p.left, y: p.top})

	if( tk.vcf.plot_mafcov ) {
		const div = pane.body.append('div')
			.style('margin','20px')
		may_show_mafcovplot( div, m, tk, block )
	}
}




function may_show_mafcovplot ( div, m, tk, block ) {
	const wait = div.append('div')
		.text('Loading...')
	const par = {
		genome: block.genome.name,
		trigger_mafcovplot:1,
		m: {
			chr: m.chr,
			pos: m.pos,
			ref: m.ref,
			alt: m.alt
		}
	}
	if(tk.mds) {
		par.dslabel = tk.mds.label
	} else {
		par.vcf = {
			file: tk.vcf.file,
			url: tk.vcf.url,
			indexURL: tk.vcf.indexURL
		}
	}
	client.dofetch('mds2',par)
	.then(data=>{
		if(data.error) throw data.error
		wait.remove()
		console.log(data)
	})
	.catch(e=>{
		wait.text('ERROR: '+(e.message||e))
		if(e.stack) console.log(e.stack)
	})
}
