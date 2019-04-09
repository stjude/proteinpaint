import * as common from './common'
import * as client from './client'
import {show_mafcovplot} from './block.mds2.vcf.mafcovplot'
import {termdb_bygenotype} from './block.mds2.vcf.termdb'


/*
********************** EXPORTED
vcf_clickvariant
********************** INTERNAL
maymakebutton_vcf_termdbbygenotype
maymakebutton_vcf_mafcovplot

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
		m.mname
		+' <span style="font-size:.7em;">'+common.mclass[m.class].label+'</span>'
	)

	const buttonrow = pane.body.append('div')
		.style('margin','20px')

	const showholder = pane.body.append('div')

	maymakebutton_vcf_termdbbygenotype( buttonrow, showholder, m, tk, block )
	maymakebutton_vcf_mafcovplot( buttonrow, showholder, m, tk, block )

	show_functionalannotation( pane.body.append('div').style('margin','20px'), m, tk, block )
}








function maymakebutton_vcf_mafcovplot ( buttonrow, showholder, m, tk, block ) {
// only for vcf item

	if(!tk.vcf) return
	if(!tk.vcf.plot_mafcov ) return

	let loading = false,
		loaded = false

	const button = buttonrow.append('div')
		.attr('class','sja_button')
		.text('Coverage-maf plot')
		.style('margin-left','2px')

	const plotdiv = showholder.append('div')
		.style('display','none')

	button.on('click', async ()=>{

		if(plotdiv.style('display')=='none') {
			client.appear(plotdiv)
			button.attr('class','sja_button_open')
		} else {
			client.disappear(plotdiv)
			button.attr('class','sja_button_fold')
		}
		if(loaded || loading) return
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

	let loaded=false, loading=false

	const button = buttonrow.append('div')
		.attr('class','sja_button')
		.text('Clinical info')

	const plotdiv = showholder.append('div')
		.style('display','none')

	button.on('click', async ()=>{

		if(plotdiv.style('display')=='none') {
			client.appear(plotdiv)
			button.attr('class','sja_button_open')
		} else {
			client.disappear(plotdiv)
			button.attr('class','sja_button_fold')
		}
		if( loaded || loading ) return
		loading = true // prevent clicking while loading
		button.text('Loading...')
		try {
			await termdb_bygenotype( plotdiv, m, tk, block )
		}catch(e){
			plotdiv.text('Error: '+(e.message||e))
		}
		loaded=true
		loading=false
		button.text('Clinical info')
	})
}




function show_functionalannotation ( div, m, tk, block ) {
	div.append('span').html(
		(m.gene ? '<i>'+m.gene+'</i> ' : '')
		+(m.isoform ? '<span style="font-size:.8em;text-decoration:italic">'+m.isoform+'</span> ' : '')
		+m.mname
		+' <span style="font-size:.7em;padding:3px;color:white;background:'+common.mclass[m.class].color+'">'+common.mclass[m.class].label+'</span>'
		// may print alleles if hgvsp
		+( m.ref+'>'+m.alt == m.mname ? ''
			: ' <span style="font-size:.7em;opacity:.5">REF</span> '+m.ref+' <span style="font-size:.7em;opacity:.5">ALT</span> '+m.alt )
	)
	if( m.csq_count && m.csq_count>1 ) {
		const button = div.append('div')
			.style('margin-left','10px')
			.text((m.csq_count-1)+' other interpretations')
			.attr('class','sja_button')
			.style('zoom','.7')

		let loading=false,loaded=false
		const plotdiv = div.append('div')
			.style('margin','20px')
			.style('display','none')

		button.on('click', async ()=>{

			if(plotdiv.style('display')=='none') {
				client.appear(plotdiv)
				button.attr('class','sja_button_open')
			} else {
				client.disappear(plotdiv)
				button.attr('class','sja_button_fold')
			}
			if( loaded || loading ) return
			loading = true // prevent clicking while loading
			button.text('Loading...')
			try {
				await get_csq( plotdiv, m, tk, block )
			}catch(e){
				plotdiv.text('Error: '+(e.message||e))
			}
			loaded=true
			loading=false
			button.text((m.csq_count-1)+' other interpretations')
		})
	}
}


function get_csq ( div, m, tk, block ) {
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
	if( tk.mds ) {
		par.dslabel = tk.mds.label
	} else {
		par.vcf = {
			file: tk.vcf.file,
			url: tk.vcf.url,
			indexURL: tk.vcf.indexURL
		}
	}

	return client.dofetch('mds2', par )
	.then(data=>{
		if(data.error) throw data.error
		if(!data.csq) throw 'cannot load csq'
		for(const item of data.csq) {
			let blown=false
			let thislabel
			{
				const lst=[]
				if(item.HGVSp) {
					lst.push('<span style="font-size:.7em;color:#858585">HGVSp</span> '+item.HGVSp)
				} else if(item.HGVSc) {
					lst.push('<span style="font-size:.7em;color:#858585">HGVSc</span> '+item.HGVSc)
				} else {
					lst.push('no_HGVS')
				}
				if(item.Consequence) {
					lst.push('<span style="font-size:.7em;color:#858585">CONSEQUENCE</span> '+item.Consequence)
				} else {
					lst.push('no_consequence')
				}
				thislabel=lst.join(' ')
			}
			// show header row
			const row = div.append('div')
				.style('margin','5px')
				.attr('class','sja_clbtext')
				.html( thislabel )
			const detailtable = div.append('div')
				.style('display','none')
			const lst=[]
			for(const h of tk.vcf.info.CSQ.csqheader) {
				const v=item[h.name]
				if(v) {
					lst.push({k:h.name, v:v})
				}
			}
			client.make_table_2col(
				detailtable.append('div').style('display','inline-block'),
				lst
				)
			row.on('click',()=>{
				detailtable.style('display', detailtable.style('display')=='none' ? 'block' : 'none' )
			})
		}
	})
	.catch(e=>{
		div.text(e.message||e)
	})
}
