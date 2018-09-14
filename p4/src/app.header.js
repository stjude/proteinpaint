import * as client from './client'
import * as coord from './coord'
import {event as d3event} from 'd3-selection'
import {findgene} from './findgene'



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






function input_keyup ( arg, selectgenome, tip ) {
	/*
	specific to header
	*/
	const stmp = selectgenome.node()
	const usegenomeobj = arg.genomes[ stmp.options[stmp.selectedIndex].getAttribute('n') ]

	findgene(
		usegenomeobj,
		tip,
		d3event.target,
		d3event.key,
		( gm, gmlst, pos )=>{

			// may check condition on whether to clear holder
			arg.showholder.selectAll('*').remove()

			if( gm || gmlst ) {
				return launch_block_protein( {
					genome: usegenomeobj,
					gm: gm,
					gmlst: gmlst,
					arg: arg
				})
			}
			if( pos ) {
				return client.launch_block( {
					genome: usegenomeobj,
					holder: arg.showholder,
					range_0based: pos,
				})
			}
		}
	)
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
