import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'
import * as client from './client'
import {findgenemodel_bysymbol} from './gene'
import './style.css'
import * as common from './common'
import {bulkui,bulkembed} from './bulk.ui'
import {string2pos, invalidcoord} from './coord'
import {loadstudycohort} from './tp.init'
import {rgb as d3rgb} from 'd3-color'
import blockinit from './block.init'
import {getsjcharts}     from './getsjcharts'
import { debounce } from 'debounce'
import * as parseurl from './app.parseurl'
import { init_mdsjson } from './app.mdsjson'

import * as wrappers from './wrappers/PpReact'

/*

exports a global function runproteinpaint()
will be called for launching anything from pp
returns a promise that resolve to something e.g. block


********** INTERNAL

findgene2paint

********** loaders from parseembedthenurl()

launchblock()
launchgeneview()
launchfusioneditor()
launchmavb()
launch2dmaf()
launchhic()
launchsamplematrix()
launchmdssamplescatterplot
launchmdssurvivalplot
launch_fimo
launch_singlecell
*/


const ppsrc = (document && document.currentScript && document.currentScript.src) || ''

const headtip=new client.Menu({padding:'0px',offsetX:0,offsetY:0})
headtip.d.style('z-index', 5555)
// headtip must get a crazy high z-index so it can stay on top of all, no matter if server config has base_zindex or not


export function runproteinpaint(arg) {
	const app = {
		error0(m) {
			client.sayerror(app.holder0, m)
		},

		// default data host, may be overriden later by arg.host
		// will allow different hostURLs for each holder 
		// when calling runproteinpaint() multiple times in the same page
		hostURL: ppsrc.includes('://') ? ppsrc.split('://')[0] + '://' + ppsrc.split('://')[1].split('/')[0] : '',

		/*
		server emitted state, if true, will trigger globals e.g. window.bb
		it needs to be set before launching any apps
		*/
		debugmode: false
	}

	if(arg.clear) {
		// for use by pecan
		d3selectAll('.sja_menu').remove()
		d3selectAll('.sja_pane').remove()
		return
	}
	// parse embedding arguments
	app.holder = d3select(arg.holder ? arg.holder : document.body)
		.append('div')
		.attr('class', 'sja_root_holder')
		.style('font','1em Arial, sans-serif')
		.style('color','black')

	if(arg.host) {
		app.hostURL = arg.host
	} else if (window.location.hostname == 'localhost') {
		// easily switch server host for testing in developer machine,
		// for example the rendered data from a docker container vs host machine
		const urlp=parseurl.url2map()
		if (urlp.has('hosturl')) app.hostURL = urlp.get('hosturl')
		else {
			const hostname = urlp.get('hostname')
			const hostport = urlp.get('hostport')
			const prot = window.location.protocol + '//'
			if (hostname && hostport) app.hostURL = prot  + hostname + ':' + hostport
			else if (hostname) app.hostURL = prot + hostname
			else if (hostport) app.hostURL = prot + window.location.hostname + ':' + hostport 
		}
	}

	// store fetch parameters
	sessionStorage.setItem('hostURL', app.hostURL)
	if(arg.jwt) {
		sessionStorage.setItem('jwt',arg.jwt)
	}


	if(arg.variantPageCall_snv) {
		app.variantPageCall_snv = arg.variantPageCall_snv
	}
	if(arg.samplecart) {
		app.samplecart = arg.samplecart
	}

	if(arg.base_zindex) {
		/*
		dirty fix! to set base_zindex global in client.js
		done the same in /genomes
		*/
		client.newpane({setzindex:arg.base_zindex})
	}

	// option to use a server data cache in memory 
	// during a browser page session
	// see client.dofetch2 for how the cache name is derived
	const serverData = arg.serverData 
		// allow server data caching by app, 
		// may generalize later
		|| (arg.termdb && arg.termdb.serverData)
		|| (arg.toy && arg.toy.serverData)
	// load genomes

	const response = client.dofetch2('genomes', {}, {serverData})

	return response.then(data=>{
		if(data.error) throw({message:'Cannot get genomes: '+data.error})
		if(!data.genomes) throw({message:'no genome data!?'})

		if(data.base_zindex) {
			client.newpane({setzindex:data.base_zindex})
		}

		app.genomes = data.genomes

		if(data.debugmode) {
			app.debugmode=true
		}

		// genome data init
		for(const genomename in app.genomes) {
			const err=client.initgenome(app.genomes[genomename])
			if(err) {
				throw({message:'Error with '+genomename+' genome: '+err})
			}
		}

		let selectgenome // the <select> genome, should belong to this particular launch

		if(!arg.noheader) {
			selectgenome = makeheader( app, data, arg.jwt )
		}

    app.holder0 = app.holder.append('div').style('margin','20px')

		return parseembedthenurl(arg, app, selectgenome)
	})
	.catch(err=>{
		app.holder.text(err.message || err)
		if(err.stack) console.log(err.stack)
	})
}

runproteinpaint.wrappers = wrappers

function makeheader(app, obj, jwt) {
    /*
    app
    obj: server returned data
    jwt: token
    */
    const color = d3rgb(common.defaultcolor)
    const padw = '13px'
        // head
    const row = app.holder.append('div')
    const app_row = app.holder.append('div')
    const headbox = row.append('div')
        .style('margin', '10px')
        .style('padding-right', '10px')
        .style('display', 'inline-block')
        .style('border', 'solid 1px rgba(' + color.r + ',' + color.g + ',' + color.b + ',.3)')
        .style('border-radius', '5px')
        .style('background-color', 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',.1)')
    const headinfo = row.append('div')
        .style('display', 'inline-block')
        .style('padding', padw)
        .style('font-size', '.8em')
        .style('color', common.defaultcolor)
		{
            // a row for server stats
            const row = headinfo.append('div')
            row.append('span')
                .text(
                    'Code updated: ' +
                    (obj.codedate || '??') +
                    ', server launched: ' +
                    (obj.launchdate || '??') + '.'
                )
            if (obj.hasblat) {
                row.append('a')
                    .style('margin-left', '10px')
                    .text('Running BLAT')
                    .on('click', async() => {
                        headtip.clear().showunder(d3event.target)
                        const div = headtip.d.append('div').style('margin', '10px')
                        const wait = div.append('div').text('Loading...')
                        try {
                            const data = await client.dofetch2('blat?serverstat=1')
                            if (data.error) throw data.error
                            if (!data.lst) throw 'invalid response'
                            wait.remove()
                            for (const i of data.lst) {
                                div.append('div').text(i)
                            }
                        } catch (e) {
                            wait.text(e.message || e)
                            if (e.stack) console.log(e.stack)
                        }
                    })
            }
        }
    if (obj.headermessage) {
        headinfo.append('div').html(obj.headermessage)
    }

    // 1
    headbox.append('div').text('ProteinPaint')
        .style('display', 'inline-block')
        .style('padding', padw)
        .style('color', common.defaultcolor)
        .style('font-weight', 'bold')

    // 2, search box
    const tip = new client.Menu({ border: '', padding: '0px' })

    function entersearch() {
        // by pressing enter, if not gene will search snp
        d3selectAll('.sja_ep_pane').remove() // poor fix to remove existing epaint windows
        let str = input.property('value').trim()
        if (!str) return
        const hitgene = tip.d.select('.sja_menuoption')
        if (hitgene.size() > 0 && hitgene.attr('isgene')) {
            str = hitgene.text()
        }
        findgene2paint(app, str, selectgenome.property('value'), jwt)
        input.property('value', '')
        tip.hide()
    }

    function genesearch() {
        // any other key typing
        tip.clear().showunder(input.node())
        findgenelst(
            app,
            input.property('value'),
            selectgenome.property('value'),
            tip,
            jwt
        )
    }
    const debouncer = debounce(genesearch, 300)
    const input = headbox.append('div')
        .style('display', 'inline-block')
        .style('padding', padw)
        .style('padding-right', '5px')
        .append('input')
        .style('border', 'solid 1px ' + common.defaultcolor)
        .style('padding', '3px')
        .attr('size', 20)
        .attr('placeholder', 'Gene, position, or SNP')
        .attr('title', 'Search by gene, SNP, or position')
        .on('keyup', () => {
            if (client.keyupEnter()) entersearch()
            else debouncer()
            app_btn_active = false
            apps_off()
        })
    input.node().focus()

    const selectgenome = headbox.append('div')
        .style('display', 'inline-block')
        .style('padding', padw)
        .style('padding-left', '5px')
        .append('select')
        .attr('title', 'Select a genome')
        .style('margin', '1px 20px 1px 10px')
        .on('change', () => {
            make_genome_browser_btn(gb_div)
        })
    for (const n in app.genomes) {
        selectgenome.append('option')
            .attr('n', n)
            .text(app.genomes[n].species + ' ' + n)
            .property('value', n)
    }
    //Holds element in a consistent location
    const gb_div = headbox.append('span')
    make_genome_browser_btn(gb_div)

    //Launch genome browser button in headbox
    async function make_genome_browser_btn(div){
        div.selectAll('#genome_btn').remove()
        const ss = selectgenome.node()
        const genomename = ss.options[ss.selectedIndex].value

        const genome_browser_btn = div
            .attr('class', 'sja_menuoption')
            .attr('id', 'genome_btn')
            .style('padding', padw)
            .style('border-radius', '5px')
            .text(genomename + ' Genome Browser')
            .on('click', ()=>{
                apps_off()
                const g = app.genomes[genomename]
                if(!g) {
                    alert('Invalid genome name: '+genomename)
                    return
                }
                //TODO change from pop out pane to new div in the page
                const p=div.node().getBoundingClientRect()
                const pane=client.newpane({x:p.left,y:p.top+p.height+10})
                pane.header.text(genomename+' genome browser')

                const par = {
                    hostURL: app.hostURL,
                    jwt: jwt,
                    holder: pane.body,
                    genome: g,
                    chr: g.defaultcoord.chr,
                    start: g.defaultcoord.start,
                    stop: g.defaultcoord.stop,
                    nobox:true,
                    tklst:[],
                    debugmode: app.debugmode,
                }
                client.first_genetrack_tolist( g, par.tklst )

                import('./block').then(b=>new b.Block( par ))
            })
        return genome_browser_btn
    }

    //Hides app_div and toggles app_btn off
    function apps_off(){
        app_btn_active = false
            if (app_holder !== undefined) {
                app_holder.style('display', app_btn_active ? 'inline-block' : 'none')
                app_btn_toggle()
            }
    }

    // launchApps()

    let app_btn, app_btn_active, app_holder

    if (!obj.features.examples) {
        app_btn = headbox.append('span')
            .attr('class', 'sja_menuoption')
            .style('padding', padw)
            .style('border-radius', '5px')
            .text('Apps')
            .on('click',()=>{
				appmenu( app, headbox, selectgenome, jwt )
			})
    } else {
        // show 'apps' div only when url is barbone without any paramerters or example page
        app_btn_active = window.location.pathname == '/' && !window.location.search.length ?
            true : false
        let apps_rendered = false

        app_holder = app_row
            .append('div')
            .style('margin', '10px')
            .style('padding-right', '10px')
            .style('display', app_btn_active ? 'inline-block' : 'none')
            .style('background-color', '#f2f2f2')
            .style('border-radius', '5px')
            .style('width', '95vw')

        async function load_app_div() {
            if (apps_rendered) return
            apps_rendered = true
            const _ = await
            import ('./examples')
            await _.init_examples({ holder: app_holder, new_div: app.holder })
        }

        if (app_btn_active) load_app_div()

        app_btn = headbox.append('span')
            .attr('class', 'sja_menuoption')
            .style('background-color', app_btn_active ? '#e2e2e2' : '#f2f2f2')
            .style('border-right', app_btn_active ? 'solid 1px #c2c2c2' : '')
            .style('border-bottom', app_btn_active ? 'solid 1px #c2c2c2' : '')
            .style('padding', padw)
            .style('border-radius', '5px')
            .text('Apps')
            .on('click', () => {
                // toggle button color and hide/show apps div 
                app_btn_active = !app_btn_active
                load_app_div()
                app_btn_toggle()

                app_holder
                    .transition()
                    .duration(500)
                    .style('display', app_btn_active ? 'inline-block' : 'none')
            })
            .on('mouseover', () => {
                app_btn.style('background-color', app_btn_active ? '#e2e2e2' : '#e6e6e6')
            })
            .on('mouseout', () => {
                app_btn.style('background-color', app_btn_active ? '#e2e2e2' : '#f2f2f2')
            })
    }

    function app_btn_toggle() {
        app_btn
            .transition()
            .duration(500)
            .style('background-color', app_btn_active ? '#e2e2e2' : '#f2f2f2')
            .style('border-right', app_btn_active ? 'solid 1px #c2c2c2' : '')
            .style('border-bottom', app_btn_active ? 'solid 1px #c2c2c2' : '')
    }

    headbox.append('span').classed('sja_menuoption', true).style('padding', padw).style('border-radius', '5px').text('Help').on('click', () => {
        const p = d3event.target.getBoundingClientRect()
        const div = headtip.clear()
            .show(p.left - 50, p.top + p.height + 5)
            .d
            .append('div')
            .style('padding', '5px 20px')
        div.append('p').html('<a href=https://docs.google.com/document/d/1KNx4pVCKd4wgoHI4pjknBRTLrzYp6AL_D-j6MjcQSvQ/edit?usp=sharing target=_blank>Embed in your website</a>')
        div.append('p').html('<a href=https://drive.google.com/open?id=121SsSYiCb3NCU8jz0bF7UujFSN-1Y20b674dqa30iXE target=_blank>Make a Study View</a>')
        div.append('p').html('<a href=https://docs.google.com/document/d/1e0JVdcf1yQDZst3j77Xeoj_hDN72B6XZ1bo_cAd2rss/edit?usp=sharing target=_blank>URL parameters</a>')
        div.append('p').html('<a href=https://docs.google.com/document/d/1JWKq3ScW62GISFGuJvAajXchcRenZ3HAvpaxILeGaw0/edit?usp=sharing target=_blank>All tutorials</a>')
        div.append('p').html('<a href=https://groups.google.com/forum/#!forum/genomepaint target=_blank>User community</a>')
    })

    return selectgenome
}

async function launchApps(app){
    const new_div = app.holder.append('div')
    new_div
    .style('margin', '10px')
    .style('padding-right', '10px')
    .style('border-radius', '5px')
    .style('width', '95vw')

    return new_div
}



function appmenu( app, headbox, selectgenome, jwt ) {
	/*
	headbox
	selectgenome: <select>
	*/

	const p=d3event.target.getBoundingClientRect()
	headtip.clear().show(p.left-50,p.top+p.height+5)
	{
		const ss=selectgenome.node()
		const genomename= ss.options[ss.selectedIndex].value
		const g = app.genomes[genomename]
		if(!g) {
			alert('Invalid genome name: '+genomename)
			return
		}
		headtip.d.append('div').attr('class','sja_menuoption').text(genomename+' genome browser').style('padding','20px').on('click',()=>{
			// showing default-looking browser
			headtip.hide()
			const p=headbox.node().getBoundingClientRect()
			const pane=client.newpane({x:p.left,y:p.top+p.height+10})
			pane.header.text(genomename+' genome browser')

			const par = {
				hostURL: app.hostURL,
				jwt: jwt,
				holder: pane.body,
				genome: g,
				chr: g.defaultcoord.chr,
				start: g.defaultcoord.start,
				stop: g.defaultcoord.stop,
				nobox:true,
				tklst:[],
				debugmode: app.debugmode,
			}
			client.first_genetrack_tolist( g, par.tklst )

			import('./block').then(b=>new b.Block( par ))
		})
	}
	headtip.d.append('div').attr('class','sja_menuoption').text('Load mutations from text files').style('padding','20px').on('click',()=>{
		headtip.hide()
		bulkui(p.left-100,p.top+p.height+5, app.genomes, app.hostURL, jwt)
	})
	headtip.d.append('div').attr('class','sja_menuoption').text('View a study').style('padding','20px').on('click',()=>{
		headtip.hide()
		studyui(app, p.left-100,p.top+p.height+5,app.genomes, app.hostURL, jwt)
	})
	headtip.d.append('div').attr('class','sja_menuoption').text('Fusion editor').style('padding-left','20px').on('click',()=>{
		headtip.hide()
		const lst = client.newpane3(100, 100, app.genomes)
		// [0] is pane{}
		lst[0].header.text('Fusion Editor')
		lst[0].body.style('margin','10px')
		const wait = lst[0].body.append('div').text('Loading...').style('margin','10px')
		import('./svmr').then(p=>{
			wait.remove()
			p.svmrui( lst, app.genomes, app.hostURL, jwt)
		})
	})
	headtip.d.append('div').attr('class','sja_menuoption').text('Junction-by-sample matrix display').style('padding-left','20px').on('click',()=>{
		headtip.hide()
		import('./block.tk.junction.textmatrixui').then(p=>{
			p.default(app.genomes, app.hostURL, jwt)
		})
	})
	headtip.d.append('div').attr('class','sja_menuoption').text('Differential gene expression viewer').style('padding-left','20px').on('click',()=>{
		headtip.hide()
		import('./mavb').then(p=>{
			p.mavbui(app.genomes, app.hostURL, jwt)
			return
		})
	})
	headtip.d.append('div').attr('class','sja_menuoption').text('MAF timeline plot').style('padding-left','20px').on('click',()=>{
		headtip.hide()
		import('./maftimeline').then(p=>{
			p.default(app.genomes)
		})
	})
	headtip.d.append('div').attr('class','sja_menuoption').text('2DMAF plot').style('padding-left','20px').on('click',()=>{
		headtip.hide()
		import('./2dmaf').then(p=>{
			p.d2mafui(app.genomes)
		})
	})
	headtip.d.append('div').attr('class','sja_menuoption').text('Mutation burden & spectrum').style('padding-left','20px').on('click',()=>{
		headtip.hide()
		import('./spectrum').then(p=>{
			p.default(app.genomes)
		})
	})
	headtip.d.append('div').attr('class','sja_menuoption').text('Expression to PCA map').style('padding-left','20px').on('click',()=>{
		headtip.hide()
		import('./e2pca').then(p=>{
			p.e2pca_inputui(app.hostURL, jwt)
		})
	})
}





function findgenelst( app, str, genome, tip, jwt ) {
	if(str.length<=1) {
		tip.d.selectAll('*').remove()
		return
	}
	const req=new Request(app.hostURL+'/genelookup',{
		method:'POST',
		body:JSON.stringify({
			input: str,
			genome,
			jwt,
			})
	})
	fetch(req)
	.then(data=>{return data.json()})
	.then(data=>{
		if(data.error) throw(data.error)
		if(!data.hits) throw('.hits[] missing')
		for(const name of data.hits) {
			tip.d.append('div')
			.attr('class','sja_menuoption')
			.attr('isgene','1')
			.text(name)
			.on('click',()=>{
				tip.hide()
				findgene2paint(app, name, genome, jwt)
			})
		}
	})
	.catch(err=>{
		tip.d.append('div')
			.style('border','solid 1px red')
			.style('padding','10px')
			.text(err)
	})
}





async function findgene2paint( app, str, genomename, jwt ) {
	const g = app.genomes[genomename]
	if(!g) {
		console.error('unknown genome '+genomename)
		return
	}
	app.holder0.selectAll('*').remove()

	// may yield tklst from url parameters
	const urlp=parseurl.url2map()
	const tklst = await parseurl.get_tklst(urlp, g)

	const pos=string2pos(str,g)
	if(pos) {
		// input is coordinate, launch block
		const par = {
			hostURL: app.hostURL,
			jwt,
			holder: app.holder0,
			genome:g,
			chr:pos.chr,
			start:pos.start,
			stop:pos.stop,
			dogtag: genomename,
			allowpopup:true,
			tklst,
			debugmode: app.debugmode
		}
		client.first_genetrack_tolist( g, par.tklst )

		import('./block')
			.then(b=>new b.Block( par ))
			.catch(err=>{
				app.error0( err.message)
				console.log(err)
			})
		return
	}

	// input string is not coordinate, find gene match

	const par = {
		hostURL: app.hostURL,
		jwt,
		query: str,
		genome:g,
		holder: app.holder0,
		variantPageCall_snv: app.variantPageCall_snv,
		samplecart: app.samplecart,
		tklst,
		debugmode: app.debugmode
	}


	// add svcnv tk from url param
	const tmp = sessionStorage.getItem( 'urlp_mds' )
	if(tmp) {
		const l = tmp.split(',')
		if(l.length==2) {
			par.datasetqueries = [ { dataset: l[0], querykey: l[1] } ]
		}
	}

	blockinit( par )
}




function studyui(app, x, y) {
	const pane=client.newpane({x:x,y:y})
	pane.header.text('View a study')
	pane.body.style('padding','20px')
	pane.body.append('div')
		.style('color','#858585')
		.html('A study can organize various data for a cohort, and is hosted on this server.<br>To view, enter the path to the study\'s JSON config file.<br><a href=https://drive.google.com/open?id=121SsSYiCb3NCU8jz0bF7UujFSN-1Y20b674dqa30iXE target=_blank>Learn how to organize data in a study</a>.')
	const row=pane.body.append('div').style('margin-top','20px')
	const input=row.append('input')
		.style('margin-right','5px')
		.attr('size',15)
		.attr('placeholder','Study name')
	input.on('keyup',()=>{
			if(d3event.code!='Enter') return
			submit()
		})
		.node().focus()
	row.append('button')
		.text('Submit')
		.on('click',submit)
	row.append('button')
		.text('Clear')
		.on('click',()=>{
			input.property('value','').node().focus()
		})
	pane.body.append('p')
		.html('<a href=https://www.dropbox.com/s/psfzwkbg7v022ef/example_study.json?dl=0 target=_blank>Example study</a>')
	function submit() {
		const v=input.property('value')
		if(v=='') return
		input.property('value','')
		input.node().blur()
		const p2=client.newpane({x:100,y:100})
		p2.header.html('<span style="font-size:.7em">STUDY</span> '+v)
		p2.body.style('padding','0px 20px 20px 20px')
		loadstudycohort(
			app.genomes,
			v,
			p2.body,
			app.hostURL,
			null, // jwt
			false, // no show
			app.debugmode
		)
	}
}













async function parseembedthenurl(arg, app, selectgenome) {
	/*
	first, try to parse any embedding parameters
	quit in case of any blocking things
	after exhausting embedding options, try URL parameters

	arg: embedding param
	app: {genomes, study, holder0, hostURL, debugmode, jwt?}
	selectgenome: <select>

	*/

	if(arg.genome && selectgenome) {
		// embedding argument specified genome, so flip the <select>
		for(let i=0; i<selectgenome.node().childNodes.length; i++) {
			if(selectgenome.node().childNodes[i].value == arg.genome) {
				selectgenome.property('selectedIndex',i)
				break
			}
		}
	}
	if( arg.xintest) {
		// a shortcut to xin's experiments and not to be used in prod
		launchxintest(arg.xintest, app)
		return
	}

	if(arg.singlecell) {
		launch_singlecell( arg.singlecell, app )
		return
	}

	if(arg.fimo) {
		launch_fimo( arg.fimo, app)
		return
	}

	if(arg.mdssurvivalplot) {
		if(arg.genome) arg.mdssurvivalplot.genome = arg.genome
		launchmdssurvivalplot(arg.mdssurvivalplot, app)
		return
	}

	if(arg.mdssamplescatterplot) {
		if(arg.genome) arg.mdssamplescatterplot.genome = arg.genome
		launchmdssamplescatterplot(arg.mdssamplescatterplot, app)
		return
	}

	if(arg.samplematrix) {
		arg.samplematrix.jwt = arg.jwt
		launchsamplematrix( arg.samplematrix, app )
		return
	}

	if(arg.hic) {
		arg.hic.jwt = arg.jwt
		launchhic( arg.hic, app )
		return
	}

	if(arg.block) {
		// load this before study / studyview
		return launchblock(arg, app)
	}

	if(arg.study) {
		// launch study-view through name of server-side configuration file (study.json)
		loadstudycohort(
			app.genomes,
			arg.study,
			app.holder0,
			app.hostURL,
			arg.jwt,
			false, // no show
			app.debugmode
		)
		return
	}

	if(arg.studyview) {
		// launch study-view through an object
		const obj = arg.studyview
		obj.hostURL = arg.host
		const gn = obj.genome || arg.genome
		obj.genome = app.genomes[gn]
		obj.hostURL = app.hostURL
		obj.jwt = arg.jwt
		obj.holder = app.holder0
		bulkembed(obj)
		return
	}

	if(await may_launchGeneView(arg, app)) {
		// gene view launched
		return
	}


	if(arg.fusioneditor) {
		launchfusioneditor(arg, app)
		return
	}

	if(arg.mavolcanoplot) {
		launchmavb(arg, app)
		return
	}

	if(arg.twodmaf) {
		launch2dmaf(arg, app)
		return
	}

	if(arg.parseurl && location.search.length) {
		/*
		since jwt token is only passed from arg of runpp()
		so no way of sending it via url parameter, thus url parameter won't work when jwt is activated
		*/
		const err = await parseurl.parse({
			genomes: app.genomes,
			hostURL: app.hostURL,
			variantPageCall_snv: app.variantPageCall_snv,
			samplecart: app.samplecart,
			holder: app.holder,
			selectgenome: selectgenome,
			debugmode: app.debugmode
		})
		if(err) {
			app.error0(err)
		}
	}

	if (arg.project) {
		bulkui(0,0, app.genomes, app.hostURL)
	}

	if (arg.toy) {
		launchtoy(arg.toy, app)
	}
	if (arg.termdb) {
		launchtermdb(arg.termdb, app)
	}
}


async function may_launchGeneView(arg,app) {
	// arg.gene is required to launch gene view
	// arg.gene may come from different places
	if(arg.p) {
		// backward-compatible with old parameter name
		arg.gene = arg.p
		delete arg.p
	}
	if(arg.gene2canonicalisoform) {
		if(!arg.genome) throw '.genome missing for gene2canonicalisoform'
		const data = await client.dofetch2('gene2canonicalisoform?genome='+arg.genome+'&gene='+arg.gene2canonicalisoform)
		if(data.error) throw data.error
		if(!data.isoform) throw 'no canonical isoform for given gene accession'
		arg.gene = data.isoform
	}
	if(arg.mds3_ssm2canonicalisoform) {
		/* logic specific for mds3 gdc dataset
		given a ssm id, retrieve the canonical isoform and launch gene view with it
		*/
		if(!arg.genome) throw '.genome missing'
		if(!arg.mds3_ssm2canonicalisoform.ssm_id) throw '.ssm_id missing from mds3_ssm2canonicalisoform'
		if(!arg.mds3_ssm2canonicalisoform.dslabel) throw '.dslabel missing from mds3_ssm2canonicalisoform'
		const data=await client.dofetch2('mds3?'
			+'genome='+arg.genome
			+'&dslabel='+arg.mds3_ssm2canonicalisoform.dslabel
			+'&ssm2canonicalisoform=1'
			+'&ssm_id='+arg.mds3_ssm2canonicalisoform.ssm_id
		)
		if(data.error) throw data.error
		if(!data.isoform) throw 'no isoform found for given ssm_id'
		arg.gene = data.isoform
		// will also highlight this ssm
		if(arg.tracks) {
			const tk = arg.tracks.find(i=>i.dslabel==arg.mds3_ssm2canonicalisoform.dslabel)
			if(tk) {
				tk.hlssmid = arg.mds3_ssm2canonicalisoform.ssm_id
			}
		}
	}
	if(arg.gene) {
		launchgeneview(arg, app)
		return true
	}
	return false
}



function launchmdssamplescatterplot(arg, app) {
	if(!arg.genome) {
		app.error0('missing genome for mdssamplescatterplot')
		return
	}
	const genome = app.genomes[arg.genome]
	if(!genome) {
		app.error0('invalid genome for mdssamplescatterplot')
		return
	}
	arg.genome = genome
	if(arg.dataset) {
		arg.mds = genome.datasets[arg.dataset]
		if(!arg.mds) {
			app.error0('invalid dataset for mdssamplescatterplot')
			return
		}
		arg.dslabel = arg.dataset
		delete arg.dataset
	} else if(arg.analysisdata) {
		// validate later
	} else {
		app.error0('neither .dataset or .analysisdata is given')
		return
	}

	import('./mds.samplescatterplot').then(_=>{
		_.init(arg, app.holder0, app.debugmode)
	})
}



function launchmdssurvivalplot(arg, app) {
	if(!arg.genome) {
		app.error0('missing genome for mdssurvivalplot')
		return
	}
	const genome = app.genomes[arg.genome]
	if(!genome) {
		app.error0('invalid genome for mdssurvivalplot')
		return
	}
	arg.genome = genome
	if(!arg.dataset) {
		app.error0('missing dataset for mdssurvivalplot')
		return
	}
	arg.mds = genome.datasets[arg.dataset]
	if(!arg.mds) {
		app.error0('invalid dataset for mdssurvivalplot')
		return
	}
	delete arg.dataset
	if(arg.plotlist) {
		for(const p of arg.plotlist) {
			// instruct this plot to be shown by default
			p.renderplot=1
		}
	}
	import('./mds.survivalplot').then(_=>{
		_.init(arg, app.holder0, app.debugmode)
	})
}



function launch_fimo ( arg, app ) {
	if(!arg.genome) {
		app.error0('missing genome for fimo')
		return
	}
	const genome = app.genomes[arg.genome]
	if(!genome) {
		app.error0('invalid genome for fimo')
		return
	}
	arg.genome = genome
	arg.div = app.holder0
	import('./mds.fimo').then(_=>{
		_.init( arg )
	})
}



function launchhic(hic, app) {
	if(!hic.genome) {
		app.error0('missing genome for hic')
		return
	}
	hic.genome = app.genomes[hic.genome]
	if(!hic.genome) {
		app.error0('invalid genome for hic')
		return
	}
	if(!hic.file) {
		app.error0('missing file for hic')
		return
	}
	hic.hostURL = app.hostURL
	hic.holder = app.holder0
	import('./hic.straw').then(_=>{
		_.hicparsefile(hic, app.debugmode)
	})
}



function launchsamplematrix(cfg, app) {
	if(!cfg.genome) {
		app.error0('missing genome for launching samplematrix')
		return
	}
	cfg.genome = app.genomes[cfg.genome]
	if(!cfg.genome) {
		app.error0('invalid genome for samplematrix')
		return
	}
	cfg.hostURL = app.hostURL
	cfg.holder = app.holder0
	cfg.debugmode = app.debugmode
	// dynamic import works with static values, not expressions
	if (window.location.search.includes('smx=3')) {
		cfg.client = client
		cfg.common = common
		cfg.string2pos = string2pos
		cfg.invalidcoord = invalidcoord
		cfg.block = import('./block.js')
		getsjcharts(sjcharts => {
			sjcharts.dthm( cfg )
		})
	}
	else {
		import('./samplematrix').then(_=>{
			new _.Samplematrix(cfg)
		})
	}
}




async function launchgeneview(arg, app) {
	if(!arg.genome) {
		app.error0('Cannot embed: must specify reference genome')
		return
	}
	if(arg.tracks) {
		for(const t of arg.tracks) {
			t.iscustom=true
		}
	}

	// when "tkjsonfile" is defined, load all tracks as defined in the json file into tracks[]
	if(arg.tkjsonfile) {
		if(!arg.tracks) arg.tracks=[]
		const urlp = new Map([['tkjsonfile',arg.tkjsonfile]])
		const lst = await parseurl.get_tklst(urlp, genomeobj)
		for(const i of lst) {
			arg.tracks.push(i)
		}
	}

	const pa={
		jwt: arg.jwt,
		hostURL: app.hostURL,
		query: arg.gene,
		genome: app.genomes[arg.genome],
		holder: app.holder0,
		variantPageCall_snv: app.variantPageCall_snv,
		samplecart: app.samplecart,
		debugmode: app.debugmode,
		datasetqueries: arg.datasetqueries,
		mset: arg.mset,
		tklst: arg.tracks,
		gmmode: arg.gmmode
	}
	let ds=null
	if(arg.dataset) {
		pa.dataset=arg.dataset.split(',')
		if(arg.hidedatasetexpression) {
			pa.hidedatasetexpression=true
		}
	}
	if(arg.hidegenecontrol) {
		pa.hidegenecontrol=true
	}
	if(arg.hidegenelegend) {
		pa.hidegenelegend=true
	}
	let hlaa=null
	if(arg.hlaachange) {
		hlaa=new Map()
		if(Array.isArray(arg.hlaachange)) {
			for(const s of arg.hlaachange) {
				if(s.name) {
					hlaa.set(s.name,s)
				}
			}
		} else {
			for(const s of arg.hlaachange.split(',')) {
				hlaa.set(s,false)
			}
		}
		if(hlaa.size) {
			pa.hlaachange=hlaa
		}
	}
	if(arg.hlvariants) {
		pa.hlvariants=arg.hlvariants
	}

	// TODO support tracks in block.init.js
	blockinit(pa)
}



async function launchblock(arg, app) {
	/*
	launch genome browser, rather than gene-view
	may load a study file at same time, to add as .genome.tkset[]
	*/
	if(!arg.genome) {
		app.error0('Cannot embed: must specify reference genome')
		return
	}
	const genomeobj = app.genomes[arg.genome]
	if(!genomeobj) {
		app.error0('Invalid genome: '+arg.genome)
		return
	}

	if(arg.study) {
		/*
		try to load this study
		tracks to be added to .genome.tkset
		later to be loaded in the same browser panel

		FIXME asynchronized, won't be able to add tracks directly to current browser
		*/
		loadstudycohort(
			app.genomes,
			arg.study,
			app.holder0,
			app.hostURL,
			arg.jwt,
			true, // no show
			app.debugmode
			)
	}
	if(arg.studyview) {
		// TODO
	}

	if(arg.tracks) {
		// tracks have to be labeled custom, even for smuggled native tracks
		for(const t of arg.tracks) {
			if( t.type == client.tkt.mds2 && t.dslabel ) {
				// is an official mds2, do not flag as custom
				continue
			}
			if(t.mdsjsonfile || t.mdsjsonurl){
				try {
					const tks = await init_mdsjson(t.mdsjsonfile, t.mdsjsonurl)
					arg.tracks = arg.tracks.filter(tk => tk != t )
					arg.tracks.push(...tks)
				}catch(e) {
					client.sayerror(app.holder0,e.message || e)
				}
			}
			t.iscustom=true
		}
	}

	// when "tkjsonfile" is defined, load all tracks as defined in the json file into tracks[]
	if(arg.tkjsonfile) {
		if(!arg.tracks) arg.tracks=[]
		const urlp = new Map([['tkjsonfile',arg.tkjsonfile]])
		const lst = await parseurl.get_tklst(urlp, genomeobj)
		for(const i of lst) {
			arg.tracks.push(i)
		}
	}

	const blockinitarg = {
		genome: genomeobj,
		hostURL: app.hostURL,
		jwt: arg.jwt,
		holder: app.holder0,
		nativetracks: arg.nativetracks,
		tklst: arg.tracks,
		debugmode: app.debugmode,
	}


	if(arg.width) {
		const v=Number.parseInt(arg.width)
		if(Number.isNaN(v)) return app.error0('browser width must be integer')
		blockinitarg.width=v
	}

	if(arg.subpanels) {
		if(!Array.isArray(arg.subpanels)) return app.error0('subpanels is not array')
		const lst=[]
		for(const r of arg.subpanels) {
			if(!r.chr) {
				app.error0('missing chr in one subpanel')
				continue
			}
			if(!r.start || !r.stop) {
				app.error0('missing start or stop in one subpanel')
				continue
			}
			if(!r.width) {
				// may decide by screen size
				r.width = 400
			}
			if(!r.leftpad) {
				r.leftpad = 5
			}
			lst.push(r)
		}
		if(lst.length) {
			blockinitarg.subpanels=lst
		}
	}

	if(arg.nobox) {
		blockinitarg.nobox=true
	} else {
		// show box
		blockinitarg.dogtag= arg.dogtag || arg.genome
	}

	if(arg.chr && Number.isInteger(arg.start)) {
		// quick fix!!
		// as string2pos() will force minimum 400bp span, use {chr,start,stop} to avoid changing it
		blockinitarg.chr=arg.chr
		blockinitarg.start=arg.start
		blockinitarg.stop= Number.isInteger(arg.stop) ? arg.stop : arg.start+1
	} else if(arg.position) {
		const pos=string2pos(arg.position, genomeobj)
		if(pos) {
			blockinitarg.chr=pos.chr
			blockinitarg.start=pos.start
			blockinitarg.stop=pos.stop
		}
	} else if(arg.positionbygene) {

		try {

			const gmlst = await findgenemodel_bysymbol( arg.genome, arg.positionbygene )
			if( gmlst && gmlst[0] ) {
				const gm = gmlst[0]
				blockinitarg.chr = gm.chr
				blockinitarg.start = gm.start
				blockinitarg.stop = gm.stop
			}
				
		}catch(e) {
			app.error0(e)
		}
	}

	if(!blockinitarg.chr) {
		blockinitarg.chr=genomeobj.defaultcoord.chr
		blockinitarg.start=genomeobj.defaultcoord.start
		blockinitarg.stop=genomeobj.defaultcoord.stop
	}

	if(arg.datasetqueries) {
		/*
		each dataset comes with customization
		it will be appended as .customization{} to the tk object
		and parsed in makeTk() of svcnv track

		also for launching gene view
		*/
		blockinitarg.datasetqueries=arg.datasetqueries
	}

	// apply url parameter
	const h = client.may_get_locationsearch()
	if(h) {
		if(h.has('position')) {
			const pos = string2pos( h.get('position'), genomeobj )
			if(pos) {
				blockinitarg.chr=pos.chr
				blockinitarg.start=pos.start
				blockinitarg.stop=pos.stop
			}
		}
		if(h.has('hlregion')) {
			const lst = []
			for(const tmp of h.get('hlregion').split(',')) {
				const pos = string2pos( tmp, genomeobj, true )
				if(pos) {
					lst.push(pos)
				}
			}
			if(lst.length) {
				blockinitarg.hlregions = lst
			}
		}
		if(h.has('bedgraphdotfile')) {
			if(!blockinitarg.tklst) blockinitarg.tklst = []
			const lst=h.get('bedgraphdotfile').split(',')
			for(let i=0; i<lst.length; i+=2) {
				if(lst[i] && lst[i+1]) {
					blockinitarg.tklst.push({
						type:client.tkt.bedgraphdot,
						name:lst[i],
						file:lst[i+1]
					})
				}
			}
		}
	}

	// return a promise resolving to block
	return import('./block')
		.then(b=>{
			const bb = new b.Block(blockinitarg)
			return {block:bb}
		})
}



function launchfusioneditor(arg, app) {
	if( arg.fusioneditor.uionly ) {
		// duplicate newpane3
		const inputdiv = app.holder0.append('div').style('margin', '40px 20px 20px 20px')
		const p = inputdiv.append('p')
		p.append('span').html('Genome&nbsp;')
		const gselect = p.append('select').attr('title', 'Select a genome')
		for (const n in app.genomes) {
			gselect.append('option').text(n)
		}
		const filediv = inputdiv.append('div').style('margin', '20px 0px')
		const saydiv = app.holder0.append('div').style('margin', '10px 20px')
		const visualdiv = app.holder0.append('div').style('margin', '20px')
		import('./svmr').then(p=>{
			p.svmrui( [null, inputdiv, gselect.node(), filediv, saydiv, visualdiv], app.genomes, app.hostURL, arg.jwt )
		})
		return
	}
	const genomeobj = app.genomes[arg.genome]
	if(!genomeobj) {
		app.error0('Invalid genome: '+arg.genome)
		return
	}
	import('./svmr').then(p=>{
		p.svmrparseinput(
			arg.fusioneditor,
			app.error0,
			genomeobj,
			app.holder0,
			app.hostURL,
			arg.jwt
		)
	})
}


function launchmavb(arg, app) {
	const genomeobj = app.genomes[arg.genome]
	if(!genomeobj) {
		app.error0('Invalid genome: '+arg.genome)
		return
	}
	arg.mavolcanoplot.hostURL = app.hostURL
	arg.mavolcanoplot.genome = genomeobj
	import('./mavb').then(p=>{
		p.mavbparseinput(
			arg.mavolcanoplot,
			app.error0,
			app.holder0,
			arg.jwt
		)
	})
}




function launch2dmaf(arg, app) {
	const genomeobj = app.genomes[arg.genome]
	if(!genomeobj) {
		app.error0('Invalid genome: '+arg.genome)
		return
	}
	arg.twodmaf.hostURL = app.hostURL
	arg.twodmaf.genome=genomeobj
	import('./2dmaf').then(d2maf=>{
		d2maf.d2mafparseinput(
			arg.twodmaf,
			app.holder0
		)
	})
}



/*
function launchjdv(arg, app) {
	const genomeobj = app.genomes[arg.genome]
	if(!genomeobj) {
		app.error0('Invalid genome: '+arg.genome)
		return
	}
	arg.hostURL = app.hostURL
	arg.genome = genomeobj
	import('./jdv').then(jdv=>{
		jdv.jdvparseinput(arg, app.holder0)
	})
}
*/


async function launch_singlecell ( arg, app ) {
	try {
		const genome = app.genomes[arg.genome]
		if(!genome) throw 'Invalid genome: '+arg.genome
		arg.genome = genome

		await client.add_scriptTag( '/static/js/three.js' )
		await client.add_scriptTag('/static/js/loaders/PCDLoader.js')
		await client.add_scriptTag('/static/js/controls/TrackballControls.js')
		await client.add_scriptTag('/static/js/WebGL.js')
		await client.add_scriptTag('/static/js/libs/stats.min.js')

		const _ = await import('./singlecell')
		await _.init( arg, app.holder0 )
	}catch(e){
		app.error0('Error launching single cell viewer: '+e)
		if(e.stack) console.log(e.stack)
	}
}

/* 
opts
.state may be a partial or full instance of src/toy/toy.store defaultState
*/
function launchtoy(opts, app) {
	if (!opts.holder) opts.holder = app.holder0
	import('./toy/toy.app').then(_=>{
		_.appInit(null, opts)
	})
}

function launchtermdb(opts, app) {
	if (!opts.holder) opts.holder = app.holder0
	if (!opts.callbacks) opts.callbacks = {}
	import('./termdb/app').then(_=>{
		_.appInit(null, opts)
	})
}

function launchxintest(opts, app) {
	opts.holder = app.holder0
	import('./xin/app').then(_=> _.appInit(null,opts))
}
