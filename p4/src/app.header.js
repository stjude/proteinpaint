import * as client from './client'
import * as coord from './coord'
import {event as d3event} from 'd3-selection'



/******** EXTERNAL
makeheader()

********* INTERNAL

*/






export function makeheader (arg, headermessage, lastupdate) {
	/*
	*/

	const bordercolor = '#ededed'
	const padw='13px'

	const div = arg._headerdiv.append('div')

	const buttonrow = div.append('div') // contains buttonrow and listdiv
		.style('display','inline-block')
		.style('padding-right','3px')
		.style('border','solid 1px '+bordercolor)

	const messageholder = div.append('div')
		.style('display','inline-block')
		.style('vertical-align','top')

	const tip = new client.Menu({padding:'0px'})


	// 1
	buttonrow.append('div')
		.style('display','inline-block')
		.style('padding',padw)
		.style('font-weight','bold')
		.style('opacity',.3)
		.text('ProteinPaint')

	// 2 <input>
	const inputdom = buttonrow.append('div')
		.style('display','inline-block')
		.style('padding',padw)
		.style('padding-right','5px')
		.append('input')
		.style('border','solid 1px #ccc')
		.style('padding','3px')
		.attr('size',20)
		.attr('placeholder','Gene, position, or SNP')
		.on('keyup',()=>{
			input_keyup( arg, selectgenome, tip )
		})
		.node()
		.focus()

	const selectgenome = buttonrow.append('div')
		.style('display','inline-block')
		.style('padding',padw)
		.style('padding-left','5px')
		.append('select')
		.style('margin','1px 10px 1px 10px')
	for(const n in arg.genomes) {
		selectgenome.append('option')
			.attr('n',n)
			.text( (arg.genomes[n].species ? arg.genomes[n].species+' ' : '') + n)
			.property('value',n)
	}



	buttonrow.append('span')
		.attr('class','sja_menuoption')
		.style('padding',padw)
		.text('Genome browser')
		.on('click',()=>{
			launch_block_shortcut( arg, selectgenome )
		})

	buttonrow.append('span')
		.attr('class','sja_menuoption')
		.style('padding',padw)
		.text('Apps')
		.on('click',()=>{
			header_clickbutton_apps(arg,tip)
		})

	buttonrow.append('span')
		.attr('class','sja_menuoption')
		.style('padding',padw)
		.text('Help')
		.on('click',()=>{
			header_clickbutton_help(arg,tip)
		})

	messageholder
		.style('padding',padw)
		.style('font-size','.8em')
		.style('opacity',.5)

	if(lastupdate) {
		messageholder
			.append('div')
			.text('Last updated: '+lastupdate)
	}
	if(headermessage) {
		messageholder
			.append('div')
			.html(headermessage)
	}
}



function launch_block_shortcut ( arg, selectgenome ) {
	/*
	click button from header
	*/

	const stmp = selectgenome.node()
	const usegenomeobj = arg.genomes[ stmp.options[stmp.selectedIndex].getAttribute('n') ]
	const pane = client.newpane({x:100,y:100})
	pane.header.text(usegenomeobj.name)

	const p = {
		genome: usegenomeobj,
		holder: pane.body,
		// show default position
	}
	if( usegenomeobj.tracks ) {
		const genetk = usegenomeobj.tracks.find( i=> i.__isgene )
		if(genetk) p.tklst = [ genetk ]
	}
	client.launch_block( p )
}






async function input_keyup2 ( arg, selectgenome ) {
	const stmp = selectgenome.node()
	const usegenomeobj = arg.genomes[ stmp.options[stmp.selectedIndex].getAttribute('n') ]
	const inputdom = d3event.target
	const str = inputdom.value.trim()
	
}






async function input_keyup (arg, selectgenome, tip) {
	/*
	arg {} as passed from runpp()
	*/

	const stmp = selectgenome.node()
	const usegenomeobj = arg.genomes[ stmp.options[stmp.selectedIndex].getAttribute('n') ]
	const inputdom = d3event.target

	const str = inputdom.value.trim()
	if(!str) {
		tip.hide()
		return
	}

	try {

		if( d3event.key == 'Enter' ) {

			/* 1 - gene
			symbol/alias, convert to neat symbol
			isoform, use isoform
			any hit will be displayed as buttons in tip, otherwise it's not a gene
			*/
			if(tip.d.style('display')=='block') {
				const hitgene = tip.d.select('.sja_menuoption')
				if(hitgene.size()>0) {
					// input indeed matches with gene name
					return header_deepgene({
						arg: arg,
						genome: usegenomeobj,
						tip: tip,
						isoform: hitgene.attr('isoform'),
						genename: hitgene.attr('genename')
					})
				}
			}

			// 2 - single region
			// assume the region is 1-based
			const position = coord.string2pos(str, usegenomeobj)
			if(position) {
				arg.showholder.selectAll('*').remove()
				return client.launch_block( {
					genome: usegenomeobj,
					holder: arg.showholder,
					range_0based: position,
				})
			}

			// 3 - multiple regions TODO


			// 4 - snp
			const snp = await string2snp( str, usegenomeobj.name )
			if(snp) {
				// hit a snp
				tip.hide()
				arg.showholder.selectAll('*').remove()
				return client.launch_block( {
					genome: usegenomeobj,
					holder: arg.showholder,
					range_0based: {
						chr: snp.chrom,
						start: snp.chromStart,
						stop: snp.chromEnd
					},
					// TODO highlight snp
				})
			} else {
				throw 'Not a gene or snp'
			}

			return
		}

		// show list of matching gene names

		const names = await fetch_genelookup( {input:str, genome:usegenomeobj.name } )
		if(names.length==0) {
			tip.hide()
			return
		}
		tip
			.clear()
			.showunder(inputdom)
		for(const n of names) {
			const row = tip.d.append('div')
				.attr('class','sja_menuoption')
				.attr('genename', n.name)
				.on('click',()=>{
					header_deepgene({
						arg: arg,
						genome: usegenomeobj,
						tip: tip,
						isoform: n.isoform,
						genename: n.name
					})
				})
			if(n.alias) {
				row.html( '<span style="opacity:.7;font-size:.7em">'+n.alias+'</span> '+n.name )
			} else if(n.isoform) {
				row.html( n.name+' <span style="opacity:.7;font-size:.7em">'+n.isoform+'</span>' )
				row.attr('isoform', n.isoform) // upon hitting Enter this will be captured
			} else {
				row.text(n.name)
			}
		}
	} catch(e){
		if(e.stack) console.error(e.stack)
		tip
			.clear()
			.showunder(inputdom)
			.d
			.append('div')
			.style('margin','5px')
			.style('color','red')
			.text('Error: '+e)
	}
}




function string2snp ( str, genome ) {
	return client.dofetch( 'snpbyname', {genome:genome, str:str} )
	.then(data=>{
		if(data.error) throw data.error
		return data.hit
	})
}




async function header_deepgene ( p ) {
	/*
	call from header gene search
	tip showing under <input>

	given a gene name, find isoforms and summarize regions
	if single region, launch block (protein mode)
	else, list regions and ask to choose one in order to launch block

	given a isoform
	*/
	const { arg, tip, genome, isoform, genename } = p
	
	tip.clear()

	try {
		if(isoform) {
			// one isoform name could still match with multiple gm
			const gmlst = await fetch_genelookup( {input:isoform, genome:genome.name, deep:1, isisoform:1} )
			if(gmlst.length==0) throw 'No gene found by '+isoform
			if(gmlst.length>1) {
				for(const m of gmlst) {
					tip.append('div')
					.attr('class','sja_menuoption')
					.text(m.isoform+' '+m.chr+':'+m.start+'-'+m.stop)
					.on('click',()=>{
						tip.hide()

						launch_block_protein( {
							genome: genome,
							gm: m,
							arg: arg
						})
					})
				}
				return
			}
			tip.hide()
			launch_block_protein( {
				genome: genome,
				gm: gmlst[0],
				arg: arg
			})
			return
		}

		// by gene symbol
		const gmlst = await fetch_genelookup( {input:genename, genome:genome.name, deep:1 } )
		if(gmlst.length==0) throw 'No gene found by '+genename
		tip.hide()
		launch_block_protein( {
			genome: genome,
			gmlst: gmlst,
			arg: arg
		})

	} catch(e) {
		if(e.stack) console.log(e.stack)
		tip.append('div').text('ERROR: '+(e.message||e))
	}
}







function launch_block_protein( p ) {
	/*
	TODO

	.arg.showholder
	.genome
	.gm{} or .gmlst[]
	*/
	const { arg, genome, gm, gmlst } = p

	arg.showholder.selectAll('*').remove()

	client.launch_block( {
		holder: arg.showholder,
		genome: genome,
		gm: gm,
		gmlst: gmlst
	})
}




function fetch_genelookup( p ) {
	/*
	input
	genome
	deep
	isisoform
	*/
	return client.dofetch( 'genelookup', p )
	.then(data=>{
		if(data.error) throw data.error
		if(!data.lst) throw '.lst[] missing'
		return data.lst
	})
}


function header_clickbutton_apps (arg, tip) {
	tip.showunder(d3event.target)
		.clear()
	tip.d.append('p').text('to show list of apps')
}



function header_clickbutton_help (arg, tip) {
	tip.showunder(d3event.target)
		.clear()
	const d = tip.d.append('div')
		.style('margin','0px 10px')
	d.append('p').html('<a href=https://docs.google.com/document/d/1KNx4pVCKd4wgoHI4pjknBRTLrzYp6AL_D-j6MjcQSvQ/edit?usp=sharing target=_blank>Embed in your website</a>')
	d.append('p').html('<a href=https://drive.google.com/open?id=121SsSYiCb3NCU8jz0bF7UujFSN-1Y20b674dqa30iXE target=_blank>Make a Study View</a>')
	d.append('p').html('<a href=https://docs.google.com/document/d/1e0JVdcf1yQDZst3j77Xeoj_hDN72B6XZ1bo_cAd2rss/edit?usp=sharing target=_blank>URL parameters</a>')
	d.append('p').html('<a href=https://docs.google.com/document/d/1JWKq3ScW62GISFGuJvAajXchcRenZ3HAvpaxILeGaw0/edit?usp=sharing target=_blank>All tutorials</a>')
	d.append('p').html('<a href=https://plus.google.com/u/0/communities/102575530275461548028 target=_blank>User community</a>')
}
