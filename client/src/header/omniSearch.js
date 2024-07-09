import { dofetch3 } from '#common/dofetch'
import { openSandbox } from '../../appdrawer/adSandbox'
import { throwMsgWithFilePathAndFnName } from '../../dom/sayerror.ts'
import { string2pos } from '../coord'
import { newSandboxDiv } from '../../dom/sandbox.ts'
import * as parseurl from '../app.parseurl'
import urlmap from '#common/urlmap'
import { first_genetrack_tolist } from '#common/1stGenetk'
import blockinit from '../block.init'
import { select as d3select } from 'd3-selection'

/*
----EXPORTED----
searchItems()
findgenelst()
findgene2paint()

----Internal----
findAppDrawerElements()
getExampleNames()
getFilteredElements()
*/

export async function searchItems(app, tip, help, publications, jwt) {
	const userInput = d3select('input').property('value').trim()
	const data = [
		{
			title: 'Genes',
			default: true,
			items: await findgenelst(userInput, app.selectgenome.property('value'), jwt),
			color: '#F2F2F2',
			callback: d => {
				app.drawer.dispatch({ type: 'is_apps_btn_active', value: false })
				tip.hide()
				findgene2paint(d, app, app.selectgenome.property('value'), jwt)
			}
		}
	]
	await findAppDrawerElements(app, userInput, data, tip)
	//Keep 'Help' section second last
	data.push({
		title: 'Help',
		default: false,
		items: help.filter(d => d.label.toLowerCase().includes(userInput.toLowerCase())),
		color: '#faebd9',
		callback: d => {
			window.open(d.link, d.label)
		}
	})
	data.push({
		title: 'Publications',
		default: false,
		items: publications.filter(
			d =>
				d.title.toLowerCase().includes(userInput.toLowerCase()) ||
				d.appHeaderTitle.toLowerCase().includes(userInput.toLowerCase())
		),
		color: '#E6E6FA',
		callback: d => {
			window.open(d.doi, d.title)
		}
	})
	return data
}

async function findAppDrawerElements(app, input, data, tip) {
	const re = await dofetch3(app.cardsPath + '/index.json')
	if (re.error) throwMsgWithFilePathAndFnName(`Problem retrieving ../cards/index.json`)
	const userInput = input.toLowerCase().trim()
	const elements = [...re.elements]
	let filteredElements
	if (userInput.length > 2) {
		/** Adding the examples to the search terms is expensive
		 * Limit when all card files are loaded based on user input
		 * Maybe timeout instead? or combination of the two?
		 */
		await getExampleNames(elements, app)
		filteredElements = getFilteredElements(elements, userInput)
	} else {
		filteredElements = getFilteredElements(elements, userInput)
	}

	const opts = {
		app: app.drawer.opts,
		sandboxDiv: app.drawer.opts.sandboxDiv,
		genomes: app.genomes,
		fromApp: true
	}

	data.push(
		{
			title: 'Tracks and Apps',
			items: filteredElements.filter(c => c.type == 'card'),
			color: '#e1edf7',
			callback: element => {
				app.drawer.dispatch({ type: 'is_apps_btn_active', value: false })
				tip.hide()
				openSandbox(element, opts)
			}
		},
		{
			title: 'Datasets',
			items: filteredElements.filter(c => c.type == 'dsButton'),
			color: '#e5f5e4',
			callback: element => {
				app.drawer.dispatch({ type: 'is_apps_btn_active', value: false })
				tip.hide()
				openSandbox(element, opts)
			}
		}
	)
	return data
}

async function getExampleNames(elements, app) {
	const promises = elements.map(async elem => {
		if (elem.hidden || elem.type != 'card' || !elem.sandboxJson) return elem
		const exs = await dofetch3(app.cardsPath + `/${elem.sandboxJson}.json`)
		if (exs?.ppcalls.length > 0) {
			for (const c of exs.ppcalls) {
				if (c.isUI) return
				if (c?.label) elem.searchterms.push(c.label)
			}
		}
	})

	await Promise.all(promises)
}

function getFilteredElements(elements, userInput) {
	return elements
		.filter(elem => {
			if (elem.hidden) return false
			let searchTermFound = (elem.searchterms || []).reduce((searchTermFound, searchTerm) => {
				if (searchTermFound) return true
				return searchTerm.toLowerCase().includes(userInput)
			}, false)
			return searchTermFound || elem.name.toLowerCase().includes(userInput)
		})
		.sort((a, b) => a.name.localeCompare(b.name))
}

export async function findgenelst(str, genome, jwt) {
	//TODO - including something here about if user input includes a special character to return rather than comment out catch
	if (str.length == 0) return
	try {
		const data = await dofetch3('/genelookup', {
			body: {
				input: str,
				genome,
				jwt
			}
		})

		if (data.error) throw data.error
		if (!data.hits) throw '.hits[] missing'
		return data.hits
	} catch (err) {
		// err is likely "invalid character in gene name". ignore and continue
		// if (err.stack) console.log(err.stack)
		// throw err
	}
}

export async function findgene2paint(str, app, genomename, jwt) {
	const g = app.genomes[genomename]
	if (!g) {
		console.error('unknown genome ' + genomename)
		return
	}
	const sandbox_div = newSandboxDiv(app.drawer.opts.sandboxDiv)
	sandbox_div.header.html(
		'<div style="display:inline-block;">' +
			str +
			'</div><div class="sjpp-output-sandbox-title">' +
			genomename +
			'</div>'
	)
	// may yield tklst from url parameters
	const urlp = urlmap()
	const tklst = await parseurl.get_tklst(urlp, g)

	const pos = string2pos(str, g)
	if (pos) {
		// input is coordinate, launch block
		const par = {
			hostURL: app.hostURL,
			jwt,
			holder: sandbox_div.body,
			genome: g,
			nobox: true,
			chr: pos.chr,
			start: pos.start,
			stop: pos.stop,
			dogtag: genomename,
			tklst,
			debugmode: app.debugmode
		}
		first_genetrack_tolist(g, par.tklst)

		import('../block.js')
			.then(b => new b.Block(par))
			.catch(err => {
				app.error0(err)
			})
		return
	}

	// input string is not coordinate, find gene match
	const par = {
		hostURL: app.hostURL,
		jwt,
		query: str,
		genome: g,
		holder: sandbox_div.body,
		variantPageCall_snv: app.variantPageCall_snv,
		samplecart: app.samplecart,
		tklst,
		debugmode: app.debugmode
	}

	// add svcnv tk from url param
	const tmp = sessionStorage.getItem('urlp_mds')
	if (tmp) {
		const l = tmp.split(',')
		if (l.length == 2) {
			par.datasetqueries = [{ dataset: l[0], querykey: l[1] }]
		}
	}

	await blockinit(par)
}
