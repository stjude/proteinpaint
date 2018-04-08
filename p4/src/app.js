import {select as d3select, event as d3event} from 'd3-selection'
import 'normalize.css'
import './style.css'
import * as client from './client'
//import {rgb as d3rgb} from 'd3-color'
//import * as common from './common'





window.runproteinpaint = (arg) => {
	/*
	all parameters and triggers are contained in arg
	including genomes retrieved from server
	*/

	arg.holder = d3select( arg.holder || document.body )
	arg.holder
		.style('font-family', client.font)

	// for inverse color, may do something like client.__init(arg)

	if(arg.host) {
		localStorage.setItem('host', arg.host)
	}
	if(arg.jwt) {
		localStorage.setItem('jwt', arg.jwt)
	}

	return client.dofetch('/genomes')
	.then(data=>{
		if(data.error) throw 'Cannot get genomes: '+data.error
		// attach genomes to arg, so as not to deal with extra variable
		arg.genomes = data.genomes
		if(!arg.genomes) throw '.genomes missing from response'

		may_makeheader(
			arg,
			data.headermessage,
			data.lastupdate
		)

	})
}





//////////////////// __header


function may_makeheader (arg, headermessage, lastupdate) {
	if(arg.noheader) return
	const bordercolor = '#ededed'
	const padw='13px'

	const div = arg.holder.append('div')

	const controlholder = div.append('div') // contains buttonrow and listdiv
		.style('display','inline-block')
		.style('border','solid 1px '+bordercolor)

	const messageholder = div.append('div')
		.style('display','inline-block')
		.style('vertical-align','top')

	const buttonrow = controlholder.append('div') // <input> <select> buttons
		.style('padding-right','10px')

	const header = {}

	header.listdiv = controlholder.append('div') // for search results, list apps and links
		.style('margin','5px')
		.style('display','none')




	// 1
	buttonrow.append('div')
		.style('display','inline-block')
		.style('padding',padw)
		.style('font-weight','bold')
		.style('opacity',.3)
		.text('ProteinPaint')

	// 2 <input>
	header.input = buttonrow.append('div')
		.style('display','inline-block')
		.style('padding',padw)
		.style('padding-right','5px')
		.append('input')
	
	header.input
		.style('border','solid 1px #ccc')
		.style('padding','3px')
		.attr('size',20)
		.attr('placeholder','Gene, position, or SNP')
		.on('keyup',()=>{
			header_inputkeyup( arg, header )
		})
		.node().focus()

	const selectgenome = buttonrow.append('div')
		.style('display','inline-block')
		.style('padding',padw)
		.style('padding-left','5px')
		.append('select')
		.style('margin','1px 20px 1px 10px')
	for(const n in arg.genomes) {
		selectgenome.append('option')
			.attr('n',n)
			.text( (arg.genomes[n].species ? arg.genomes[n].species+' ' : '') + n)
			.property('value',n)
	}
	header.selectgenome = selectgenome

	buttonrow.append('span')
		.attr('class','sja_menuoption')
		.style('padding',padw)
		.text('Apps')
		.on('click',()=>{
			header_clickbutton_apps(arg,header)
		})

	buttonrow.append('span')
		.attr('class','sja_menuoption')
		.style('padding',padw)
		.text('Help')
		.on('click',()=>{
			header_clickbutton_help(arg,header)
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



function header_inputkeyup (arg, header) {
	/*
	arg {} as passed from runpp()
	header {}
	.listdiv
	.input
	.selectgenome
	.showingapps bool
	.showinghelp bool
	*/

	header.showingapps = false // set flag so clicking the other buttons will work
	header.showinghelp = false

	const stmp = header.selectgenome.node()
	const usegenomeobj = arg.genomes[ stmp.options[stmp.selectedIndex].getAttribute('n') ]
	if(d3event.key=='Enter') {

		// poor fix to remove existing epaint windows
		//d3selectAll('.sja_ep_pane').remove()

		let str = header.input.attr('value').trim()
		const hitgene = header.listdiv.select('.sja_menuoption')
		if(hitgene.size()>0 && hitgene.attr('isgene')) {
			str=hitgene.text()
		}
		//findgene2paint( str, usegenome, jwt )
		header.input.property('value','')
		header.listdiv.style('display','none')
		return
	}

	header.listdiv
		.style('display','block')
		.selectAll('*').remove()

	const str = header.input.property('value').trim()
	if(!str) {
		header.listdiv.style('display','none')
		return
	}
	client.dofetch('/genelookup',{
		input:str,
		genome: usegenomeobj.name
	})
	.then(data=>{
		console.log(data)
	})
}


function header_clickbutton_apps (arg, header) {
	if(header.showingapps) {
		header.showingapps=false
		header.listdiv.style('display','none')
		return
	}
	header.showingapps=true
	header.showinghelp=false
	header.listdiv.selectAll('*').remove()
	client.appear(header.listdiv)
	header.listdiv.append('p').text('to show list of apps')
}
function header_clickbutton_help (arg, header) {
	const ld = header.listdiv
	if(header.showinghelp) {
		header.showinghelp=false
		ld.style('display','none')
		return
	}
	header.showinghelp=true
	header.showingapps=false
	ld.selectAll('*').remove()
	client.appear(ld)
	ld.append('p').html('<a href=https://docs.google.com/document/d/1KNx4pVCKd4wgoHI4pjknBRTLrzYp6AL_D-j6MjcQSvQ/edit?usp=sharing target=_blank>Embed in your website</a>')
	ld.append('p').html('<a href=https://drive.google.com/open?id=121SsSYiCb3NCU8jz0bF7UujFSN-1Y20b674dqa30iXE target=_blank>Make a Study View</a>')
	ld.append('p').html('<a href=https://docs.google.com/document/d/1e0JVdcf1yQDZst3j77Xeoj_hDN72B6XZ1bo_cAd2rss/edit?usp=sharing target=_blank>URL parameters</a>')
	ld.append('p').html('<a href=https://docs.google.com/document/d/1JWKq3ScW62GISFGuJvAajXchcRenZ3HAvpaxILeGaw0/edit?usp=sharing target=_blank>All tutorials</a>')
	ld.append('p').html('<a href=https://plus.google.com/u/0/communities/102575530275461548028 target=_blank>User community</a>')
}


//////////////////// __header ends
