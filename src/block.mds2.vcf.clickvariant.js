import * as common from './common'
import * as client from './client'
import {show_mafcovplot} from './block.mds2.vcf.mafcovplot'
import {termdb_bygenotype} from './block.mds2.vcf.termdb'


/*
********************** EXPORTED
vcf_clickvariant
may_render_vcf
vcf_m_color
getvcfheader_customtk
********************** INTERNAL
vcf_render_variants

*/




export function vcf_clickvariant ( m, p, tk, block ) {
/*
p{}
	.left
	.top
*/
	// if to show sunburst, do it here, no pane

	const pane = client.newpane({x: p.left, y: p.top})
	pane.header.html(
		(m.gene ? '<i>'+m.gene+'</i> ' : '')
		+(m.isoform ? '<span style="font-size:.7em;text-decoration:italic">'+m.isoform+'</span> ' : '')
		+m.mname
		+' <span style="font-size:.7em;padding:3px;color:white;background:'+common.mclass[m.class].color+'">'+common.mclass[m.class].label+'</span>'
	)

	const buttonrow = pane.body.append('div')
		.style('margin','20px')

	const showholder = pane.body.append('div')

	maymakebutton_vcf_termdbbygenotype( buttonrow, showholder, m, tk, block )
	maymakebutton_vcf_mafcovplot( buttonrow, showholder, m, tk, block )
}





function maymakebutton_vcf_mafcovplot ( buttonrow, showholder, m, tk, block ) {
// only for vcf item

	if(!tk.vcf) return
	if(!tk.vcf.plot_mafcov ) return

	let loading = false,
		loaded = false

	const button = buttonrow.append('div')
		.style('display','inline-block')
		.attr('class','sja_menuoption')
		.text('Coverage-maf plot')

	const plotdiv = showholder.append('div')

	button.on('click', async ()=>{

		if( loading ) return
		if( loaded ) {
			if(plotdiv.style('display')=='none') {
				client.appear(plotdiv)
			} else {
				client.disappear(plotdiv)
			}
			return
		}
		loading=true
		button.text('Loading...')
		try {
			await show_mafcovplot( plotdiv, m, tk, block )
		}catch(e){
			plotdiv.text('Error: '+(e.message||e))
		}
		loading=false
		loaded=true
		button.text('Coverage-maf plot')
	})
}




function maymakebutton_vcf_termdbbygenotype ( buttonrow, showholder, m, tk, block ) {
// only for vcf, by variant genotype

	if(!tk.vcf) return
	if(!tk.vcf.termdb_bygenotype) return

	let loading = false,
		loaded = false

	const button = buttonrow.append('div')
		.style('display','inline-block')
		.attr('class','sja_menuoption')
		.text('Clinical info')

	const plotdiv = showholder.append('div')

	button.on('click', async ()=>{

		if( loading ) return
		if( loaded ) {
			if(plotdiv.style('display')=='none') {
				client.appear(plotdiv)
			} else {
				client.disappear(plotdiv)
			}
			return
		}
		loading=true
		button.text('Loading...')
		try {
			await termdb_bygenotype( plotdiv, m, tk, block )
		}catch(e){
			plotdiv.text('Error: '+(e.message||e))
		}
		loading=false
		loaded=true
		button.text('Clinical info')
	})
}
