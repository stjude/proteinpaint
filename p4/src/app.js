import {select as d3select, event as d3event} from 'd3-selection'
import 'normalize.css'
import './style.css'
import * as client from './client'
import * as coord from './coord'
//import {rgb as d3rgb} from 'd3-color'
//import * as common from './common'


// do not use genomes as global



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

	return client.dofetch('/genomes',null,true)
	.then(data=>{
		if(data.error) throw 'Cannot get genomes: '+data.error

		init_genomes( data, arg )

		may_makeheader( arg, data.headermessage, data.lastupdate)

		arg.showholder = arg.holder.append('div').style('margin','20px')

	})
	.catch(e=>{
		arg.holder.text('Error: '+e)
	})
}




function init_genomes ( data, arg ) {
	if(!data.genomes) throw '.genomes missing from response'
	arg.genomes = data.genomes
	for(const n in arg.genomes) {
		const g = arg.genomes[n]
		g.chrlookup = {}
		for(const c in g.majorchr) {
			g.chrlookup[ c.toUpperCase() ] = { name: c, len: g.majorchr[c] }
		}
		if(g.minorchr) {
			for(const c in g.minorchr) {
				g.chrlookup[ c.toUpperCase() ] = { name: c, len: g.minorchr[c] }
			}
		}
	}
}



//////////////////// __header


function may_makeheader (arg, headermessage, lastupdate) {
	if(arg.noheader) return
	const bordercolor = '#ededed'
	const padw='13px'

	const div = arg.holder.append('div')

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
	buttonrow.append('div')
		.style('display','inline-block')
		.style('padding',padw)
		.style('padding-right','5px')
		.append('input')
		.style('border','solid 1px #ccc')
		.style('padding','3px')
		.attr('size',20)
		.attr('placeholder','Gene, position, or SNP')
		.on('keyup',()=>{
			header_inputkeyup( arg, selectgenome, tip )
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



function header_inputkeyup (arg, selectgenome, tip) {
	/*
	arg {} as passed from runpp()
	*/

	const stmp = selectgenome.node()
	const usegenomeobj = arg.genomes[ stmp.options[stmp.selectedIndex].getAttribute('n') ]
	const inputdom = d3event.target
	const typeenter = d3event.key == 'Enter'

	Promise.resolve().then(()=>{

		if(typeenter) {

			return Promise.resolve().then(()=>{

				// now launch block, make argument
				const blockarg = {
					genome: usegenomeobj,
					holder: arg.showholder.append('div'),
				}

				// detect input
				
				// 1 - gene name
				if(tip.d.style('display')=='block') {
					const hitgene = tip.d.select('.sja_menuoption')
					if(hitgene.size()>0) {
						blockarg.showgenename = hitgene.text()
						return blockarg
					}
				}

				// input string
				const str = inputdom.value.trim()

				// 2 - single region
				const position = coord.string2pos(str, usegenomeobj)
				if(position) {
					blockarg.singleregion = position
					return blockarg
				}

				// 3 - multiple regions
				console.log('parse multi region')

				// 4 - snp
				console.log('parse snp')
			})
			.then( blockarg => {
				console.log(blockarg)
				// return import('./block').then(_=> ... )
			})
		}

		// show list of matching gene names
		const str = inputdom.value.trim()
		if(!str) {
			tip.hide()
			return
		}
		client.dofetch('/genelookup',{
			input:str,
			genome: usegenomeobj.name
		})
		.then(data=>{
			if(data.error) throw data.error
			if(!data.names || data.names.length==0) {
				tip.hide()
				return
			}
			tip.showunder(inputdom)
				.clear()
			for(const n of data.names) {
				tip.d.append('div')
					.attr('class','sja_menuoption')
					.text(n.name)
			}
		})
	})
	.catch(e=>{
		if(e.stack) console.error(e.stack)
		tip.showunder(inputdom)
			.clear()
			.d
			.append('div')
			.style('margin','5px')
			.style('color','red')
			.text('Error: '+e)
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


//////////////////// __header ends
