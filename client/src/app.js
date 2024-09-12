// depending on the bundler, stylesheets may be outputted separately as a css file
// and thus require the embedder or runpp caller to manually include a link rel='stylesheet',
// or the bundled code itself may dynamically attach that link stylesheet
import './style-normalize-scoped.css'
import 'highlight.js/styles/github.css'
import './style.css'
import './style-zoomify-scoped.css'
import { select as d3select, selectAll as d3selectAll } from 'd3-selection'
import * as client from './client'
import { dofetch3, setAuth } from '#common/dofetch'
import { findgenemodel_bysymbol } from './gene'
import * as common from '#shared/common'
import { bulkui, bulkembed } from './bulk.ui'
import { string2pos } from './coord'
import { loadstudycohort } from './tp.init'
import blockinit from './block.init'
import * as parseurl from './app.parseurl'
import { init_mdsjson } from './app.mdsjson'
import urlmap from '#common/urlmap'
import { renderSandboxFormDiv } from '../dom/sandbox.ts'
import { sayerror } from '../dom/sayerror'
import { Menu } from '#dom/menu'

/*
exports a global function runproteinpaint()
will be called for launching anything from pp
returns a promise that resolve to something e.g. block

internal "app{}"
.debugmode
.error0()
.genomes{}
.holder
.holder0
.hostURL
.callbacks{}
.instanceTrackers{}

********** INTERNAL

********** loaders from parseEmbedThenUrl()

launchblock()
may_launchGeneView
	launchgeneview()
launchfusioneditor()
launchmavb()
launch2dmaf()
launchhic()
launchsamplematrix()
launchmdssamplescatterplot
launchmdssurvivalplot
launch_fimo
launch_genefusion
launch_singlecell

geneSearch4GDCmds3
launchGdcMatrix
launchGdcHierCluster
launchGdcMaf
gdcbamslice
*/

const headtip = new Menu({ padding: '0px', offsetX: 0, offsetY: 0 })
headtip.d.style('z-index', 5555)
// headtip must get a crazy high z-index so it can stay on top of all, no matter if server config has base_zindex or not

export function runproteinpaint(arg) {
	// polyfill
	if (!window.structuredClone) window.structuredClone = val => JSON.parse(JSON.stringify(val))
	/*
	the "app" object is the main Proteinpaint instance, unique for each runproteinpaint() call
	NOTE: this app instance may be returned or not depending on the
	results of parseEmbedThenUrl()
	TODO: standardize runpp() return value to better work with external portal
	*/
	const app = {
		error0(m) {
			client.sayerror(app.holder0, m)
		},

		/*
		server emitted state, if true, will trigger globals e.g. window.bb
		it needs to be set before launching any apps
		*/
		debugmode: false,
		// event callbacks for dynamically-loaded renderer instances
		callbacks: arg.callbacks || { sjcharts: {} },
		// object to store instances as created by dynamically loaded apps/renderers
		// the default is to have a unique tracker per Proteinpaint app instance
		instanceTracker: arg.instanceTracker || { sjcharts: {} }
	}

	setHostUrl(arg, app)
	// subnest an sjcharts object to track its app instances by rendererType,
	// to avoid namespace conflicts with PP renderer instances
	if (!app.instanceTracker.sjcharts) {
		app.instanceTracker.sjcharts = {}
	}
	if (!app.callbacks.sjcharts) {
		app.callbacks.sjcharts = {}
	}

	if (arg.clear) {
		// for use by pecan
		d3selectAll('.sja_pane').remove()
		return
	}
	// parse embedding arguments

	app.holder = d3select(arg.holder ? arg.holder : document.body)
		.append('div')
		.attr('class', 'sja_root_holder')
		//must not use the method of ".datum({ clientVersion })", as d3 propagates bound data custom property to all descendents and are accidentally passed to event listeners
		.attr('data-ppclientversion', `___current-proteinpaint-client-version___`)
		.style('font', '1em Arial, sans-serif')
		.style('color', 'black')

	app.sandbox_header = arg.sandbox_header || undefined

	if (arg.jwt) {
		sessionStorage.setItem('jwt', arg.jwt)
	}

	// replace the stored value for this option
	// for multiple runpp calls in the same page, the last call may override
	// previous stored values for this option in the same browser tab
	sessionStorage.setItem('suppressErrors', JSON.stringify(arg.suppressErrors))

	if (arg.variantPageCall_snv) {
		app.variantPageCall_snv = arg.variantPageCall_snv
	}
	if (arg.samplecart) {
		app.samplecart = arg.samplecart
	}

	if (arg.base_zindex) {
		/*
		dirty fix! to set base_zindex global in client.js
		done the same in /genomes
		*/
		client.newpane({ setzindex: arg.base_zindex })
	}

	// option to use a server data cache in memory
	// during a browser page session
	// see client.dofetch2 for how the cache name is derived
	const serverData =
		arg.serverData ||
		// allow server data caching by app,
		// may generalize later
		(arg.termdb && arg.termdb.serverData)
	// load genomes

	const response = dofetch3('genomes', {}, { serverData })

	return response
		.then(async data => {
			if (data.error) throw { message: 'Cannot get genomes: ' + data.error }
			if (!data.genomes) throw { message: 'no genome data!?' }

			if (data.base_zindex) {
				client.newpane({ setzindex: data.base_zindex })
			}
			if (data.features) {
				sessionStorage.setItem('optionalFeatures', JSON.stringify(data.features))
			}

			app.genomes = data.genomes
			app.cardsPath = data.cardsPath

			if (data.debugmode) {
				app.debugmode = true
				if (!data.features?.disableDevBrowserNotification) {
					import('./notify').catch(e => console.warn(`debugmode: server-sent notifications is not setup`, e))
				}
			}
			setAuth({ dsAuth: data.dsAuth, holder: app.holder })

			if (data.commonOverrides || arg.commonOverrides) {
				// NOTE: required or imported code files are only loaded once
				// and module variables are static so that changes to common key-values will affect all
				// client-side code that import common.js
				// TODO??: server-side rendered viz should see client-side arg.commonOverrides ???
				common.applyOverrides(Object.assign(data.commonOverrides || {}, arg.commonOverrides || {}))
			}
			// TODO: may import(style-normalize-unscoped.css) here for pp portals
			//       where is it certain html, body css resets will not conflict with portal styles;
			//       will also need to remove the import of the unscoped.css file from style.css
			if (data.targetPortal && data.targetPortal == 'gdc') await import('./style.gdc.css') // actual string value will let webpack find and bundle this optional stylesheet
			// genome data init
			for (const genomename in app.genomes) {
				const err = initgenome(app.genomes[genomename])
				if (err) {
					throw { message: 'Error with ' + genomename + ' genome: ' + err }
				}
			}

			if (
				!arg.noheader &&
				!window.location.search.includes('noheader') &&
				!window.location.search.includes('mass-session-id') &&
				//Fix for header appearing on URL parameters
				!window.location.search.includes('mass-session-file') &&
				!window.location.search.includes('mass-session-url')
			) {
				const _ = await import('./header/AppHeader.ts')
				const appHeader = new _.AppHeader({
					headtip,
					app,
					data,
					jwt: arg.jwt
				})

				await appHeader.makeheader()
			}

			app.holder0 = app.holder.append('div').style('margin', '20px')

			const subapp = await parseEmbedThenUrl(arg, app)
			return subapp || app
		})
		.catch(err => {
			app.holder.text(err.message || err)
			if (err.stack) console.log(err.stack)
		})
}

runproteinpaint.getStatus = async function getStatus(outputAs = '') {
	return await fetch('/healthcheck')
		.then(res => res.json())
		.then(res => {
			const status = {
				clientVersion: document.querySelector('.sja_root_holder')?.dataset.ppclientversion,
				versionInfo: res.versionInfo
			}
			if (outputAs == 'log') console.info(status)
			else if (outputAs == 'json') return JSON.stringify(status)
			else return status
		})
		.catch(console.error)
}

// KEEP THIS ppsrc DECLARATION AT THE TOP SCOPE !!!
// need to know the script src when pp is first loaded
// the source context may be lost after the pp script is loaded
// and a different script gets loaded in the page
const ppsrc = (document && document.currentScript && document.currentScript.src) || ''

function setHostUrl(arg, app) {
	// attaching hostURL to app will allow different hostURLs for each holder
	// when calling runproteinpaint() multiple times in the same page

	if (arg.host) {
		app.hostURL = arg.host
	} else if (window.location.hostname == 'localhost') {
		// easily switch server host for testing in developer machine,
		// for example the rendered data from a docker container vs host machine
		const urlp = urlmap()
		if (urlp.has('hosturl')) app.hostURL = urlp.get('hosturl')
		else if (window.testHost) {
			app.hostURL = window.testHost
		} else {
			const hostname = urlp.get('hostname')
			const hostport = urlp.get('hostport')
			const prot = window.location.protocol + '//'
			if (hostname && hostport) app.hostURL = prot + hostname + ':' + hostport
			else if (hostname) app.hostURL = prot + hostname
			else if (hostport) app.hostURL = prot + window.location.hostname + ':' + hostport
		}
	}

	if (!app.hostURL) {
		if (ppsrc.includes('://')) {
			// use the script source as the host URL
			app.hostURL = ppsrc.split('://')[0] + '://' + ppsrc.split('://')[1].split('/')[0]
		} else {
			app.hostURL = ''
		}
	}

	// strip trailing slash
	if (app.hostURL.endsWith('/')) app.hostURL = app.hostURL.slice(0, -1)

	// store fetch parameters
	sessionStorage.setItem('hostURL', app.hostURL)
}

async function parseEmbedThenUrl(arg, app) {
	/*
	first, try to parse any embedding parameters
	quit in case of any blocking things
	after exhausting embedding options, try URL parameters

	arg: embedding param
	app: {genomes, study, holder0, hostURL, debugmode, jwt?, selectgenome, genome_browser_btn}

	*/

	if (arg.genome && app.selectgenome) {
		// embedding argument specified genome, so flip the <select>
		for (let i = 0; i < app.selectgenome.node().childNodes.length; i++) {
			if (app.selectgenome.node().childNodes[i].value == arg.genome) {
				app.selectgenome.property('selectedIndex', i)
				break
			}
		}
	}

	if (arg.mclassOverride) {
		if (!arg.mclassOverride.mclassName) arg.mclassOverride.mclassName = 'Class'
		for (const k in arg.mclassOverride.classes) {
			const c = common.mclass[k]
			if (c) {
				Object.assign(c, arg.mclassOverride.classes[k])
			}
		}
	}

	if (arg.singlecell) {
		launch_singlecell(arg.singlecell, app)
		return app
	}

	if (arg.fimo) {
		launch_fimo(arg.fimo, app)
		return app
	}

	if (arg.mdssurvivalplot) {
		if (arg.genome) arg.mdssurvivalplot.genome = arg.genome
		launchmdssurvivalplot(arg.mdssurvivalplot, app)
		return app
	}

	if (arg.mdssamplescatterplot) {
		if (arg.genome) arg.mdssamplescatterplot.genome = arg.genome
		launchmdssamplescatterplot(arg.mdssamplescatterplot, app)
		return app
	}

	if (arg.samplematrix) {
		arg.samplematrix.jwt = arg.jwt
		launchsamplematrix(arg.samplematrix, app)
		return app
	}

	if (arg.hic) {
		arg.hic.jwt = arg.jwt
		launchhic(arg.hic, app)
		return app
	}

	if (arg.block) {
		// load this before study / studyview
		return launchblock(arg, app)
	}

	if (arg.study) {
		// launch study-view through name of server-side configuration file (study.json)
		loadstudycohort(
			app.genomes,
			arg.study,
			app.holder0,
			app.hostURL,
			arg.jwt,
			false, // no show
			app
		)
		return app
	}

	if (arg.studyview) {
		// launch study-view through an object
		const obj = arg.studyview
		obj.hostURL = arg.host
		const gn = obj.genome || arg.genome
		obj.genome = app.genomes[gn]
		obj.hostURL = app.hostURL
		obj.jwt = arg.jwt
		obj.holder = app.holder0
		bulkembed(obj)
		return app
	}

	if (await may_launchGeneView(arg, app)) {
		// gene view launched
		return app
	}

	if (arg.fusioneditor) {
		launchfusioneditor(arg, app)
		return app
	}

	if (arg.genefusion) {
		launch_genefusion(arg, app)
		return app
	}

	if (arg.mavolcanoplot) {
		launchmavb(arg, app)
		return app
	}

	if (arg.twodmaf) {
		launch2dmaf(arg, app)
		return app
	}

	if (arg.junctionbymatrix) {
		launchJunctionbyMatrix(arg, app)
		return
	}

	if (arg.selectGenomeWithTklst) {
		await launchSelectGenomeWithTklst(arg, app)
		return
	}

	if (arg.disco) {
		return await launchDisco(arg, app)
	}

	if (arg.geneSearch4GDCmds3) {
		/* can generalize by changing to geneSearch4tk:{tkobj}
		so it's no longer hardcoded for one dataset of one track type
		*/
		return await launchGeneSearch4GDCmds3(arg, app)
	}
	if (arg.launchGdcMatrix) {
		return await launchGdcMatrix(arg, app)
	}
	if (arg.launchGdcHierCluster) {
		return await launchGdcHierCluster(arg, app)
	}
	if (arg.launchGdcMaf) {
		return await launchGdcMaf(arg, app)
	}
	if (arg.launchGdcScRNAseq) {
		return await launchGdcScRNAseq(arg, app)
	}

	if (arg.parseurl && location.search.length) {
		/*
		since jwt token is only passed from arg of runpp()
		so no way of sending it via url parameter, thus url parameter won't work when jwt is activated
		*/
		try {
			await parseurl.parse({
				app,
				genomes: app.genomes,
				hostURL: app.hostURL,
				variantPageCall_snv: app.variantPageCall_snv,
				samplecart: app.samplecart,
				holder: app.holder,
				selectgenome: app.selectgenome,
				genome_browser_btn: app.genome_browser_btn,
				debugmode: app.debugmode
			})
		} catch (e) {
			app.error0(e)
			console.error(e.stack || e)
		}
	}

	if (arg.project) {
		let holder = undefined
		if (arg.project.uionly) holder = app.holder0
		bulkui(0, 0, app.genomes, app.hostURL, holder, app.sandbox_header)
	}

	if (arg.termdb) {
		await launchtermdb(arg.termdb, app)
	}
	if (arg.maftimeline) {
		launchmaftimeline(arg, app)
	}

	if (arg.gdcbamslice) {
		return await launchgdcbamslice(arg, app)
	}

	if (arg.mass) {
		return await launchmass(arg, app)
	}

	if (arg.tkui) {
		launch_tkUIs(arg, app)
	}

	if (arg.massSessionId) {
		const res = await client.dofetch3(`/massSession?id=${arg.massSessionId}`)
		if (res.error) throw res.error
		const opts = {
			debug: app.debugmode,
			holder: app.holder0,
			state: res.state,
			genome: app.genomes[res.state.vocab.genome],
			massSessionDuration: res.massSessionDuration,
			getDatasetAccessToken: arg.getDatasetAccessToken,
			addLoginCallback: arg.addLoginCallback
		}
		const _ = await import('../mass/app')
		_.appInit(opts)
		return
	}

	if (arg.massSessionFile || arg.massSessionURL) {
		let state
		if (arg.massSessionFile) {
			const file = arg.massSessionFile
			const jsonFile = await client.dofetch3(`/textfile`, {
				method: 'POST',
				body: JSON.stringify({ file })
			})
			if (jsonFile.error) throw jsonFile.error
			state = JSON.parse(jsonFile.text)
		} else {
			const url = arg.massSessionURL
			const jsonURL = await client.dofetch3(`/urltextfile`, {
				method: 'POST',
				body: JSON.stringify({ url })
			})
			if (jsonURL.error) throw jsonURL.error
			state = JSON.parse(jsonURL.text)
		}
		const opts = {
			debug: app.debugmode,
			holder: app.holder0,
			state,
			genome: app.genomes[state.vocab.genome]
		}
		const _ = await import('../mass/app')
		_.appInit(opts)
		return
	}

	if (arg.profileHome) {
		/* adhoc, special purpose trigger to load PrOFILE homepage showing two buttons, each load a separate mass ds
		- profile has 2 ds sharing jwt, but runpp() can only load 1 ds at a time
		- this adhoc trigger has minimum change to app.js and will not affect rest of function
		- the intermediate logic in profileHome.js provides entry to two ds while presenting custom contents tailored for ds owner
		*/
		const _ = await import('./profileHome.js')
		_.init(arg)
		return
	}
}

async function may_launchGeneView(arg, app) {
	// arg.gene is required to launch gene view
	// arg.gene may come from different places
	if (arg.p) {
		// backward-compatible with old parameter name
		arg.gene = arg.p
		delete arg.p
	}
	if (arg.gene2canonicalisoform) {
		if (!arg.genome) throw '.genome missing for gene2canonicalisoform'
		const data = await client.dofetch2(
			'gene2canonicalisoform?genome=' + arg.genome + '&gene=' + arg.gene2canonicalisoform
		)
		if (data.error) throw data.error
		if (!data.isoform) throw 'no canonical isoform for given gene accession'
		arg.gene = data.isoform
	}
	if (arg.mds3_ssm2canonicalisoform) {
		/* logic specific for mds3 gdc dataset
		given a ssm id, retrieve the canonical isoform and launch gene view with it
		*/
		if (!arg.genome) throw '.genome missing'
		if (!arg.mds3_ssm2canonicalisoform.ssm_id) throw '.ssm_id missing from mds3_ssm2canonicalisoform'
		if (!arg.mds3_ssm2canonicalisoform.dslabel) throw '.dslabel missing from mds3_ssm2canonicalisoform'
		const data = await client.dofetch2(
			'mds3?' +
				'genome=' +
				arg.genome +
				'&dslabel=' +
				arg.mds3_ssm2canonicalisoform.dslabel +
				'&ssm2canonicalisoform=1' +
				'&ssm_id=' +
				arg.mds3_ssm2canonicalisoform.ssm_id
		)
		if (data.error) throw data.error
		if (!data.isoform) throw 'no isoform found for given ssm_id'
		arg.gene = data.isoform
		// will also highlight this ssm
		if (arg.tracks) {
			const tk = arg.tracks.find(i => i.dslabel == arg.mds3_ssm2canonicalisoform.dslabel)
			if (tk) {
				tk.hlssmid = arg.mds3_ssm2canonicalisoform.ssm_id
			}
		}
	}
	if (arg.gene) {
		launchgeneview(arg, app)
		return true
	}
	return false
}

async function launchmdssamplescatterplot(arg, app) {
	if (!arg.genome) {
		app.error0('missing genome for mdssamplescatterplot')
		return
	}
	const genome = app.genomes[arg.genome]
	if (!genome) {
		app.error0('invalid genome for mdssamplescatterplot')
		return
	}
	arg.genome = genome
	if (arg.dataset) {
		arg.mds = genome.datasets[arg.dataset]
		if (!arg.mds) {
			app.error0('invalid dataset for mdssamplescatterplot')
			return
		}
		arg.dslabel = arg.dataset
		delete arg.dataset

		if (arg.mds.mdsIsUninitiated) {
			const d = await dofetch3(`getDataset?genome=${arg.genome.name}&dsname=${arg.dslabel}`)
			if (d.error) throw d.error
			if (!d.ds) throw 'ds missing'
			Object.assign(arg.mds, d.ds)
			delete arg.mds.mdsIsUninitiated
		}
	} else if (arg.analysisdata) {
		// validate later
	} else if (arg.analysisdata_file) {
		try {
			const data = await client.dofetch('textfile', { file: arg.analysisdata_file })
			if (data.error) throw tmp.error
			else if (data.text) arg.analysisdata = JSON.parse(data.text)
		} catch (e) {
			app.error0(e)
			return
		}
	} else {
		app.error0('neither .dataset or .analysisdata is given')
		return
	}

	import('./mds.samplescatterplot').then(_ => {
		_.init(arg, app.holder0, app.debugmode)
	})
}

function launchmdssurvivalplot(arg, app) {
	if (!arg.genome) {
		app.error0('missing genome for mdssurvivalplot')
		return
	}
	const genome = app.genomes[arg.genome]
	if (!genome) {
		app.error0('invalid genome for mdssurvivalplot')
		return
	}
	arg.genome = genome
	if (!arg.dataset) {
		app.error0('missing dataset for mdssurvivalplot')
		return
	}
	arg.mds = genome.datasets[arg.dataset]
	if (!arg.mds) {
		app.error0('invalid dataset for mdssurvivalplot')
		return
	}
	delete arg.dataset
	if (arg.plotlist) {
		for (const p of arg.plotlist) {
			// instruct this plot to be shown by default
			p.renderplot = 1
		}
	}
	import('./mds.survivalplot').then(_ => {
		_.init(arg, app.holder0, app.debugmode)
	})
}

function launch_fimo(arg, app) {
	if (!arg.genome) {
		app.error0('missing genome for fimo')
		return
	}
	const genome = app.genomes[arg.genome]
	if (!genome) {
		app.error0('invalid genome for fimo')
		return
	}
	arg.genome = genome
	arg.div = app.holder0
	import('./mds.fimo').then(_ => {
		_.init(arg)
	})
}

function launchhic(hic, app) {
	if (!hic.genome) {
		app.error0('missing genome for hic')
		return
	}
	hic.genome = app.genomes[hic.genome]
	if (!hic.genome) {
		app.error0('invalid genome for hic')
		return
	}
	if (!hic.file) {
		app.error0('missing file for hic')
		return
	}
	hic.hostURL = app.hostURL
	hic.holder = app.holder0
	import('../tracks/hic/HicApp.ts').then(async _ => {
		await _.hicInit(hic, app.debugmode)
	})
}

function launchsamplematrix(cfg, app) {
	if (!cfg.genome) {
		app.error0('missing genome for launching samplematrix')
		return
	}
	cfg.genome = app.genomes[cfg.genome]
	if (!cfg.genome) {
		app.error0('invalid genome for samplematrix')
		return
	}
	cfg.hostURL = app.hostURL
	cfg.holder = app.holder0
	cfg.debugmode = app.debugmode
	import('./samplematrix').then(_ => {
		new _.Samplematrix(cfg)
	})
}

async function launchgeneview(arg, app) {
	if (!arg.genome) {
		app.error0('Cannot embed: must specify reference genome')
		return
	}
	if (arg.tracks) {
		for (const t of arg.tracks) {
			if (t.type == 'mds3' && t.dslabel) continue // is an official mds3, do not flag as custom
			t.iscustom = true
		}
	}

	// when "tkjsonfile" is defined, load all tracks as defined in the json file into tracks[]
	if (arg.tkjsonfile) {
		if (!arg.tracks) arg.tracks = []
		const urlp = new Map([['tkjsonfile', arg.tkjsonfile]])
		const lst = await parseurl.get_tklst(urlp, genomeobj)
		for (const i of lst) {
			arg.tracks.push(i)
		}
	}

	const pa = {
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
		gmmode: arg.gmmode,
		mclassOverride: arg.mclassOverride,
		hide_dsHandles: arg.hide_dsHandles,
		onloadalltk_always: arg.onloadalltk_always
	}
	let ds = null
	if (arg.dataset) {
		pa.dataset = arg.dataset.split(',')
		pa.legacyDsFilter = arg.legacyDsFilter
		if (arg.hidedatasetexpression) {
			pa.hidedatasetexpression = true
		}
	}
	if (arg.hidegenecontrol) {
		pa.hidegenecontrol = true
	}
	if (arg.hidegenelegend) {
		pa.hidegenelegend = true
	}
	let hlaa = null
	if (arg.hlaachange) {
		hlaa = new Map()
		if (Array.isArray(arg.hlaachange)) {
			for (const s of arg.hlaachange) {
				if (s.name) {
					hlaa.set(s.name, s)
				}
			}
		} else {
			for (const s of arg.hlaachange.split(',')) {
				hlaa.set(s, false)
			}
		}
		if (hlaa.size) {
			pa.hlaachange = hlaa
		}
	}
	if (arg.hlvariants) {
		pa.hlvariants = arg.hlvariants
	}

	await blockinit(pa)
}

async function launchblock(arg, app) {
	/*
	launch genome browser, rather than gene-view
	may load a study file at same time, to add as .genome.tkset[]
	*/
	if (!arg.genome) {
		app.error0('Cannot embed: must specify reference genome')
		return
	}
	const genomeobj = app.genomes[arg.genome]
	if (!genomeobj) {
		app.error0('Invalid genome: ' + arg.genome)
		return
	}

	if (arg.study) {
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
			app
		)
	}
	if (arg.studyview) {
		// TODO
	}

	if (arg.tracks) {
		// tracks have to be labeled custom, even for smuggled native tracks
		for (const t of arg.tracks) {
			if (t.type == client.tkt.mds3 && t.dslabel) continue // is an official mds3, do not flag as custom

			if (t.mdsjsonfile || t.mdsjsonurl) {
				try {
					const tks = await init_mdsjson(t.mdsjsonfile, t.mdsjsonurl)
					arg.tracks = arg.tracks.filter(tk => tk != t)
					arg.tracks.push(...tks)
				} catch (e) {
					sayerror(app.holder0, e)
				}
			}
			t.iscustom = true
		}
	}

	// when "tkjsonfile" is defined, load all tracks as defined in the json file into tracks[]
	if (arg.tkjsonfile) {
		if (!arg.tracks) arg.tracks = []
		const urlp = new Map([['tkjsonfile', arg.tkjsonfile]])
		const lst = await parseurl.get_tklst(urlp, genomeobj)
		for (const i of lst) {
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
		legendimg: arg.legendimg
	}

	if (arg.width) {
		const v = Number.parseInt(arg.width)
		if (Number.isNaN(v)) return app.error0('browser width must be integer')
		blockinitarg.width = v
	}

	if (arg.subpanels) {
		if (!Array.isArray(arg.subpanels)) return app.error0('subpanels is not array')
		const lst = []
		for (const r of arg.subpanels) {
			if (!r.chr) {
				app.error0('missing chr in one subpanel')
				continue
			}
			if (!r.start || !r.stop) {
				app.error0('missing start or stop in one subpanel')
				continue
			}
			if (!r.width) {
				// may decide by screen size
				r.width = 400
			}
			if (!r.leftpad) {
				r.leftpad = 5
			}
			lst.push(r)
		}
		if (lst.length) {
			blockinitarg.subpanels = lst
		}
	}

	if (arg.nobox) {
		blockinitarg.nobox = true
	} else {
		// show box
		blockinitarg.dogtag = arg.dogtag || arg.genome
	}

	if (arg.chr && Number.isInteger(arg.start)) {
		// quick fix!!
		// as string2pos() will force minimum 400bp span, use {chr,start,stop} to avoid changing it
		blockinitarg.chr = arg.chr
		blockinitarg.start = arg.start
		blockinitarg.stop = Number.isInteger(arg.stop) ? arg.stop : arg.start + 1
	} else if (arg.position) {
		const pos = string2pos(arg.position, genomeobj)
		if (pos) {
			blockinitarg.chr = pos.chr
			blockinitarg.start = pos.start
			blockinitarg.stop = pos.stop
		}
	} else if (arg.positionbygene) {
		try {
			const gmlst = await findgenemodel_bysymbol(arg.genome, arg.positionbygene)
			if (gmlst && gmlst[0]) {
				const gm = gmlst[0]
				blockinitarg.chr = gm.chr
				blockinitarg.start = gm.start
				blockinitarg.stop = gm.stop
			}
		} catch (e) {
			app.error0(e)
		}
	}

	if (!blockinitarg.chr) {
		blockinitarg.chr = genomeobj.defaultcoord.chr
		blockinitarg.start = genomeobj.defaultcoord.start
		blockinitarg.stop = genomeobj.defaultcoord.stop
	}

	if (arg.datasetqueries) {
		/*
		each dataset comes with customization
		it will be appended as .customization{} to the tk object
		and parsed in makeTk() of svcnv track

		also for launching gene view
		*/
		blockinitarg.datasetqueries = arg.datasetqueries
	}

	if (arg.hlregions) {
		const lst = []
		for (const region of arg.hlregions) {
			const pos = string2pos(region, genomeobj, true)
			if (pos) lst.push(pos)
		}
		if (lst.length) blockinitarg.hlregions = lst
	}

	// apply url parameter
	const h = urlmap()
	if (h) {
		if (h.has('position')) {
			const pos = string2pos(h.get('position'), genomeobj)
			if (pos) {
				blockinitarg.chr = pos.chr
				blockinitarg.start = pos.start
				blockinitarg.stop = pos.stop
			}
		}
		if (h.has('hlregion')) {
			const lst = []
			for (const tmp of h.get('hlregion').split(',')) {
				const pos = string2pos(tmp, genomeobj, true)
				if (pos) {
					lst.push(pos)
				}
			}
			if (lst.length) {
				blockinitarg.hlregions = lst
			}
		}
		if (h.has('bedgraphdotfile')) {
			if (!blockinitarg.tklst) blockinitarg.tklst = []
			const lst = h.get('bedgraphdotfile').split(',')
			for (let i = 0; i < lst.length; i += 2) {
				if (lst[i] && lst[i + 1]) {
					blockinitarg.tklst.push({
						type: client.tkt.bedgraphdot,
						name: lst[i],
						file: lst[i + 1]
					})
				}
			}
		}
	}
	// return a promise resolving to block
	return import('./block').then(b => {
		app.block = new b.Block(blockinitarg)
		return app
	})
}

function launchfusioneditor(arg, app) {
	if (arg.fusioneditor.uionly) {
		// created seperate function in clinet for same page block div
		const [inputdiv, gselect, filediv, saydiv, visualdiv] = renderSandboxFormDiv(app.holder0, app.genomes)
		import('./svmr').then(p => {
			p.svmrui([null, inputdiv, gselect, filediv, saydiv, visualdiv], app.genomes, app.hostURL, arg.jwt)
		})
		return
	}
	const genomeobj = app.genomes[arg.genome]
	if (!genomeobj) {
		app.error0('Invalid genome: ' + arg.genome)
		return
	}
	import('./svmr').then(p => {
		p.svmrparseinput(arg.fusioneditor, app.error0, genomeobj, app.holder0, app.hostURL, arg.jwt)
	})
}

async function launchSelectGenomeWithTklst(arg, app) {
	const _ = await import('./selectGenomeWithTklst')
	await _.init(arg, app.holder0, app.genomes)
}

///////////////// gdc launchers ///////////////
async function launchGeneSearch4GDCmds3(arg, app) {
	const _ = await import('../gdc/lollipop.js')
	return await _.init(arg, app.holder0, app.genomes)
}
async function launchGdcMatrix(arg, app) {
	const _ = await import('../gdc/oncomatrix.js')
	return await _.init(arg, app.holder0, app.genomes)
}
async function launchGdcHierCluster(arg, app) {
	const _ = await import('../gdc/geneExpClustering.js')
	return await _.init(arg, app.holder0, app.genomes)
}
async function launchGdcScRNAseq(arg, app) {
	const _ = await import('../gdc/singlecell.js')
	return await _.init(arg, app.holder0, app.genomes)
}
async function launchGdcMaf(arg, app) {
	const _ = await import('../gdc/maf.js')
	return await _.gdcMAFui({
		holder: app.holder0,
		filter0: arg.filter0,
		callbacks: arg.callbacks || {},
		debugmode: arg.debugmode
	})
}
function launchgdcbamslice(arg, app) {
	return import('../gdc/bam.js').then(p => {
		return p.bamsliceui({
			genomes: app.genomes,
			holder: app.holder0,
			hideTokenInput: arg.gdcbamslice.hideTokenInput, // set to true in gdc react wrapper
			callbacks: arg.gdcbamslice.callbacks || {}, // for testing
			// react wrapper can supply this optional filter as bam ui is required to only search cases within a cohort user created in Analysis Tools Framework(ATF)
			filter0: arg.filter0,
			// react wrapper can set this to true and run it in "download mode", will not visualize file
			stream2download: arg.gdcbamslice.stream2download,
			// for testing
			inputValue: arg.gdcbamslice.inputValue
		})
	})
}
///////////////// end of gdc launchers ///////////////

function launchmavb(arg, app) {
	if (arg.mavolcanoplot.uionly) {
		import('./mavb').then(p => {
			p.mavbui(app.genomes, app.hostURL, arg.jwt, app.holder0, app.sandbox_header)
		})
		return
	}
	const genomeobj = app.genomes[arg.genome]
	if (!genomeobj) {
		app.error0('Invalid genome: ' + arg.genome)
		return
	}
	arg.mavolcanoplot.hostURL = app.hostURL
	arg.mavolcanoplot.genome = genomeobj
	import('./mavb').then(p => {
		p.mavbparseinput(arg.mavolcanoplot, app.error0, app.holder0, arg.jwt)
	})
}

function launch2dmaf(arg, app) {
	if (arg.twodmaf.uionly) {
		import('./2dmaf').then(p => {
			p.d2mafui(app.genomes, app.holder0)
		})
		return
	}
	const genomeobj = app.genomes[arg.genome]
	if (!genomeobj) {
		app.error0('Invalid genome: ' + arg.genome)
		return
	}
	arg.twodmaf.hostURL = app.hostURL
	arg.twodmaf.genome = genomeobj
	import('./2dmaf').then(d2maf => {
		d2maf.d2mafparseinput(arg.twodmaf, app.holder0)
	})
}

function launchmaftimeline(arg, app) {
	if (arg.maftimeline.uionly) {
		import('./maftimeline').then(p => {
			p.default(app.genomes, app.holder0, app.sandbox_header)
		})
	}
}

function launchJunctionbyMatrix(arg, app) {
	if (arg.junctionbymatrix.uionly) {
		import('./block.tk.junction.textmatrixui').then(p => {
			p.default(app.genomes, app.hostURL, arg.jwt, app.holder0)
		})
	}
}

async function launch_singlecell(arg, app) {
	try {
		const genome = app.genomes[arg.genome]
		if (!genome) throw 'Invalid genome: ' + arg.genome
		arg.genome = genome

		const _ = await import('./singlecell')
		await _.init(arg, app.holder0)
	} catch (e) {
		app.error0('Error launching single cell viewer: ' + e)
		if (e.stack) console.log(e.stack)
	}
}

async function launch_tkUIs(arg, app) {
	if (arg.tkui == 'bigwig') {
		const p = await import('./block.tk.bigwig.ui')
		p.bigwigUI(app.genomes, app.holder)
	}
	if (arg.tkui == 'databrowser') {
		const p = await import('./databrowser/databrowser.ui')
		p.init_databrowserUI(app.holder, app.debugmode)
	}
	if (arg.tkui == 'genefusion') {
		const p = await import('./genefusion/genefusion.ui')
		p.init_geneFusionUI(app.holder, app.genomes, app.debugmode)
	}
	if (arg.tkui == 'disco') {
		const p = await import('../plots/disco/Disco.UI')
		p.init_discoplotUI(app.holder, app.genomes, app.debugmode)
	}
}

async function launchtermdb(opts, app) {
	if (!opts.holder) opts.holder = app.holder0
	import('../termdb/app').then(_ => {
		_.appInit(opts)
	})
}

async function launch_genefusion(arg, app) {
	try {
		const genome = app.genomes[arg.genome]
		if (!genome) throw 'Invalid genome: ' + arg.genome

		const fusionParse = await import('./fusion.parse')
		const m = await fusionParse.parseFusion({
			line: arg.genefusion.text,
			genome,
			positionType: arg.genefusion.positionType
		})

		await getGm(m.pairlst[0].a, genome)
		await getGm(m.pairlst[0].b, genome)

		const _ = await import('./svgraph')
		_.default({
			pairlst: m.pairlst,
			genome,
			holder: app.holder
		})
	} catch (e) {
		app.error0(e)
	}
}

async function getGm(p, genome) {
	// p={isoform}
	const d = await dofetch3('genelookup', {
		body: { genome: genome.name, input: p.isoform, deep: 1 }
	})
	if (d.error) throw d.error
	if (!Array.isArray(d.gmlst)) throw 'gmlst not array'
	const u = d.gmlst.find(i => i.isoform == p.isoform)
	if (!u) throw 'no match to isoform'
	p.chr = u.chr
	p.name = u.name
	p.gm = { isoform: u.isoform }
}

async function launchmass(arg, app) {
	// arg is from runpp(arg)
	const opts = arg.mass
	if ('debugmode' in app) opts.debug = app.debugmode
	if (!opts.holder) opts.holder = app.holder0
	// if genome is defined, attach client-side genome object to opts to support gene search etc
	if (opts.state) {
		if (opts.state.genome) {
			// TODO verify when is "state.genome" defined. if not can take it out
			opts.genome = app.genomes[opts.state.genome]
		} else if (opts.state?.vocab?.genome) {
			opts.genome = app.genomes[opts.state.vocab.genome]
		}
	}
	opts.getDatasetAccessToken = arg.getDatasetAccessToken
	opts.addLoginCallback = arg.addLoginCallback
	const hostURL = sessionStorage.getItem('hostURL')
	if (window.opener && hostURL != window.location.origin) {
		// if this is a child window or tab, refreshing it will need previously hydrated session state,
		// in case the window.opener has already removed its message listener
		opts.embeddedSessionState = JSON.parse(sessionStorage.getItem('embeddedSessionState') || `{}`)
		const messageListener = event => {
			if (event.origin != window.location.origin && event.origin !== hostURL) return
			// !!! Potential race-condition
			// - assumes that the message event from the window.opener will be received
			//   before the storeInit() is triggered within the storeInit() call in mass/app.js
			// - low-risk(?) since the postMessage() between browser tabs should be faster than
			//   the dynamic code loading below and in mass/app
			// !!!
			if (event.data.state) {
				window.removeEventListener('message', messageListener)
				Object.assign(opts.embeddedSessionState, event.data.state)
				// see the comment above for when this stored embeddedState may be used
				sessionStorage.setItem('embeddedSessionState', JSON.stringify(opts.embeddedSessionState))
			}
		}
		window.addEventListener('message', messageListener, false)
		// limit the time to listen for the window.opener's message
		setTimeout(() => window.removeEventListener('message', messageListener), 1000)
		// the window.opener can be either
		// - an embedder site when clicking on `Open Session`
		// - a proteinpaint site when clicking on a shared URL link
		// accessing window.opener.location.origin may emit a CORS-related error,
		// so safer to send the message twice to cover both possibilities
		let origin
		try {
			if (window.opener.origin) {
				origin = window.opener.origin
			} else {
				origin = hostURL
			}
		} catch (e) {
			origin = hostURL
		}

		try {
			window.opener.postMessage('getActiveMassSession', origin)
		} catch (e) {
			console.log(e)
		}
	}
	const _ = await import('../mass/app')
	return await _.appInit(opts)
}

function initgenome(g) {
	g.tkset = []
	g.isoformcache = new Map()
	// k: upper isoform
	// v: [gm]
	g.junctionframecache = new Map()
	/*
	k: junction chr-start-stop
	v: Map
	   k: isoform
	   v: true/false for in-frame
	*/
	g.isoformmatch = (n2, chr, pos) => {
		if (!n2) return null
		const n = n2.toUpperCase()
		if (!g.isoformcache.has(n)) return null
		const lst = g.isoformcache.get(n)
		if (lst.length == 1) return lst[0]
		// multiple available
		if (!chr) {
			console.log('no chr provided for matching with ' + n)
			return lst[0]
		}
		let gm = null
		for (const m of lst) {
			if (m.chr.toUpperCase() == chr.toUpperCase() && m.start <= pos && m.stop >= pos) {
				gm = m
			}
		}
		if (gm) return gm
		for (const m of lst) {
			if (m.chr.toUpperCase() == chr.toUpperCase()) return m
		}
		return null
	}
	g.chrlookup = {}
	for (const nn in g.majorchr) {
		g.chrlookup[nn.toUpperCase()] = { name: nn, len: g.majorchr[nn], major: true }
	}
	if (g.minorchr) {
		for (const nn in g.minorchr) {
			g.chrlookup[nn.toUpperCase()] = { name: nn, len: g.minorchr[nn] }
		}
	}

	if (!g.tracks) {
		g.tracks = []
	}

	for (const t of g.tracks) {
		/*
		essential for telling if genome.tracks[] item is same as block.tklst[]
		*/
		t.tkid = Math.random().toString()
	}

	// validate ds info
	for (const dsname in g.datasets) {
		const ds = g.datasets[dsname]

		if (ds.isMds) {
		} else if (ds.isMds3) {
			if (!ds.label) return 'ds.label missing'
		}
	}
	return null
}

async function launchDisco(arg, app) {
	if (!arg.genome) throw '"genome" parameter missing'
	const genomeObj = app.genomes[arg.genome]
	if (!genomeObj) throw 'unknown genome'
	if (arg.disco.sample_id) {
		/** Opens a sample disco plot within a dataset
		 * Required in disco:{}
		 * .dslabel: dataset label
		 * .genome: genome name
		 * .sample_id: sample id
		 */
		const vocabApi = (await import('#termdb/vocabulary')).vocabInit({
			state: { genome: genomeObj.name, dslabel: arg.disco.dslabel }
		})
		const termdbConfig = await vocabApi.getTermdbConfig()
		await (
			await import('#plots/plot.disco.js')
		).default(termdbConfig, arg.disco.dslabel, { sample_id: arg.disco.sample_id }, app.holder, genomeObj)
		return
	} else {
		/** Used to parse custom data from the UI or runpp() */
		const _ = await import('#plots/disco/launch.adhoc.ts')
		return await _.launch(arg.disco, genomeObj, app.holder0)
	}
}
