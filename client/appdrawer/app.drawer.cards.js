import { dofetch, dofetch2, dofetch3, sayerror, tab_wait, appear } from '#src/client'
import { newSandboxDiv } from '#dom/sandbox'
import { addGeneSearchbox } from '#dom/genesearch'
import { Menu } from '#dom/menu'
import { debounce } from 'debounce'
import { event, select, selectAll } from 'd3-selection'
// js-only syntax highlighting for smallest bundle, see https://highlightjs.org/usage/
// also works in rollup and not just webpack, without having to use named imports
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
hljs.registerLanguage('javascript', javascript)
import json from 'highlight.js/lib/languages/json'
hljs.registerLanguage('json', json)

/*

-------EXPORTED-------
init_appDrawer
	- creates the app drawer
openSandbox
	- opens track or app card sandboxes
	- works internally by clicking on a card or externally 
		by using `appcard=` URL parameter

-------Internal-------
*** App Drawer ***
make_examples_page
 - make_main_track_grid
 - make_col
 - make_subheader_contents
 - make_searchbar (disabled until further notice)
 - loadTracks
	- displayTracks
		- makeRibbon
		- openSandbox

*** Sandbox ***
openSandbox
	- renderContent
		- showURLLaunch
		- makeDataDownload
	- sandboxTabMenu
		- makeSandboxTabs
		- makeLeftsideTabMenu
			- getTabData
	- addMessage
	- addUpdateMessage
	- makeButton
	- addButtons
	- addArrowBtns
		- showCode
		- makeArrowButtons
		- showCitation
 
*** Use Cases ***
make_useCasesCard
	- openUseCasesSandbox
		- displayUseCases
		- showUseCaseContent

*** DNAnexus ***
makeDNAnexusFileViewerCard
	- openDNAnexusSandbox

*** Featured Datasets ***
makeDatasetButtons
	- openDatasetSandbox
		- addDatasetGenomeBtns
		- makeURLbutton

Documentation: https://docs.google.com/document/d/18sQH9KxG7wOUkx8kecptElEjwAuJl0xIJqDRbyhahA4/edit#heading=h.jwyqi1mhacps
*/

export async function init_appDrawer(par) {
	const { holder, apps_sandbox_div, apps_off, genomes } = par
	const re = await dofetch2('/cardsjson')
	if (re.error) {
		sayerror(holder.append('div'), re.error)
		return
	}
	const wrapper_div = make_examples_page(holder)
	const track_grid = make_main_track_grid(wrapper_div)
	const gbrowser_col = make_col(track_grid, 'gbrowser')
	const app_col = make_col(track_grid, 'otherapps')

	// top of apps column followed by subheader
	// TODO: hiding searchbox for now, need to discuss
	// const holddiv = make_top_fnDiv(gbrowser_col)
	// const searchbar_div = app_col.append('div')

	const topCards_div = gbrowser_col
		.append('div')
		.style('display', 'grid')
		.style('grid-template-columns', '1fr 1fr')
		.style('gap', '5px')

	const browserList = make_subheader_contents(gbrowser_col, 'Genome Browser Tracks')
	const datasetBtns_div = app_col.append('div')
	const launchList = make_subheader_contents(app_col, 'Launch Apps')
	const track_args = {
		tracks: re.examples.filter(track => !track.hidden),
		usecases: re.usecases,
		datasets: re.datasets,
		browserList,
		launchList
	}
	const page_args = {
		apps_sandbox_div,
		apps_off,
		allow_mdsform: re.allow_mdsform,
		genomes
	}
	// make_searchbar(track_args, page_args, searchbar_div)
	make_useCasesCard(topCards_div, track_args, page_args)
	makeDNAnexusFileViewerCard(topCards_div, page_args)
	makeDatasetButtons(datasetBtns_div, track_args.datasets, page_args)
	await loadTracks(track_args, page_args)
}

/*  ********* Main Page Layout Functions  ********* */
function make_examples_page(holder) {
	const wrapper_div = holder.append('div')
	wrapper_div
		.append('div')
		.style('margins', '5px')
		.style('position', 'relative')
		.style('padding', '10px')
		.style('background-color', '#f5f5f5')
	return wrapper_div
}

//Creates the two column outer grid
function make_main_track_grid(div) {
	const track_grid = div.append('div')
	track_grid
		.style('display', 'grid')
		.style('grid-template-columns', 'repeat(auto-fit, minmax(425px, 1fr))')
		.style('grid-template-areas', '"gbrowser otherapps"')
		.style('gap', '10px')
		.style('background-color', '#f5f5f5')
		.style('padding', '10px 20px')
		.style('text-align', 'left')

	return track_grid
}

function make_col(div, area_name) {
	const col = div.append('div')
	col
		.style('grid-area', area_name)
		.property('position', 'relative')
		.style('background-color', '#f5f5f5')

	return col
}

function make_subheader_contents(div, sub_name) {
	div
		.append('div')
		.append('h5')
		.attr('class', 'sjpp-track-cols')
		.style('color', 'rgb(100, 122, 152)')
		.html(sub_name)
	const list = div.append('ul')
	list
		.attr('class', 'sjpp-track-list')
		.style('display', 'grid')
		.style('grid-template-columns', 'repeat(auto-fit, minmax(320px, 1fr))')
		.style('gap', '10px')
		.style('padding', '10px')

	return list
}

//Makes search bar and functionality to search tracks
function make_searchbar(track_args, page_args, div) {
	const bar_div = make_top_fnDiv(div)

	const searchBar = bar_div.append('div')
	searchBar
		.append('div')
		.append('input')
		.attr('type', 'text')
		.style('width', '300px')
		.style('height', '24px')
		.style('border-radius', '3px')
		.style('border', '2px solid #dbdbdb')
		.style('font-size', '12px')
		.property('placeholder', 'Search apps, tracks, or features')
		.on(
			'keyup',
			debounce(async () => {
				const data = track_args.tracks
				const searchInput = searchBar
					.select('input')
					.node()
					.value.toLowerCase()
				const filteredTracks = data.filter(track => {
					let searchTermFound = (track.searchterms || []).reduce((searchTermFound, searchTerm) => {
						if (searchTermFound) {
							return true
						}
						return searchTerm.toLowerCase().includes(searchInput)
					}, false)
					return searchTermFound || track.name.toLowerCase().includes(searchInput)
				})
				await loadTracks(track_args, page_args, filteredTracks)
			}),
			700
		)

	return searchBar
}

/*  ********* Create Track/App Cards Functions ********* */
async function loadTracks(args, page_args, filteredTracks) {
	const BrowserTracks = (filteredTracks || args.tracks).filter(track => track.app == 'Genome Browser')
	const LaunchApps = (filteredTracks || args.tracks).filter(track => track.app == 'Apps')
	try {
		displayTracks(BrowserTracks, args.browserList, page_args)
		displayTracks(LaunchApps, args.launchList, page_args)
	} catch (err) {
		console.error(err)
	}
}

function displayTracks(tracks, holder, page_args) {
	holder.selectAll('*').remove()
	tracks.forEach(track => {
		const li = holder.append('li')
		li.attr('class', 'sjpp-track')
			.html(
				`<div class="sjpp-track-h"><span style="font-size:14.5px;font-weight:500;">${track.name}</span></div>
				${track.blurb ? `<span class="sjpp-track-blurb" style="cursor:default">${track.blurb}</span></div>` : ''}
				<span class="sjpp-track-image"><img src="${track.image}"></img></span>
				</div>`
			)
			.on('click', async () => {
				event.stopPropagation()
				page_args.apps_off()
				if (track.sandboxjson) {
					await openSandbox(track, page_args.apps_sandbox_div)
				}
			})

		// add Beta tag for experimental tracks
		if (track.isbeta == true) {
			makeRibbon(li, 'BETA', '#418cb5')
		}

		if (track.update_expire || track.new_expire) {
			const today = new Date()
			const update = new Date(track.update_expire)
			const newtrack = new Date(track.new_expire)

			// if (update > today && !track.sandbox.update_message) {
			// 	console.log(
			// 		'No update message for sandbox div provided. Both the update_expire and sandbox.update_message are required'
			// 	)
			// }
			// if (update > today && track.sandbox.update_message) {
			// 	makeRibbon(li, 'UPDATED', '#e67d15')
			// }
			if (update > today) {
				makeRibbon(li, 'UPDATED', '#e67d15')
			}
			if (newtrack > today) {
				makeRibbon(li, 'NEW', '#1ba176')
			}
		}

		return JSON.stringify(li)
	})
}

function makeRibbon(e, text, color) {
	const ribbonDiv = e
		.append('div')
		.attr('class', 'sjpp-track-ribbon')
		.style('align-items', 'center')
		.style('justify-content', 'center')

	const ribbon = ribbonDiv
		.append('span')
		.text(text)
		.style('color', 'white')
		.style('background-color', color)
		.style('height', 'auto')
		.style('width', '100%')
		.style('top', '15%')
		.style('left', '-30%')
		.style('font-size', '11.5px')
		.style('text-transform', 'uppercase')
		.style('text-align', 'center')
}

/******* Track/App Sandbox Functions ********* 
 	Opens a sandbox with track example(s) or app ui with links and other information
*/

export async function openSandbox(track, holder) {
	//queries relevant json file with sandbox args
	const res = await dofetch3(`/cardsjson?jsonfile=${track.sandboxjson}`) //Fix for loading the sandbox json only once
	if (res.error) {
		sayerror(holder.append('div'), res.error)
		return
	}

	const sandbox_args = {
		intro: res.jsonfile.intro,
		ppcalls: res.jsonfile.ppcalls,
		buttons: res.jsonfile.buttons,
		arrowButtons: res.jsonfile.arrowButtons,
		update_message: res.jsonfile.update_message,
		citation: res.jsonfile.citation_id
	}
	// create unique id for each app div
	const sandbox_div = newSandboxDiv(holder)
	sandbox_div.header_row
	sandbox_div.header.text(track.name)
	sandbox_div.body.style('overflow', 'hidden')

	// creates div for instructions or other messaging about the track
	addMessage(sandbox_args.intro, sandbox_div.body)

	// message explaining the update ribbon
	addUpdateMessage(track, sandbox_args.update_message, sandbox_div.body)

	const mainBtn_div = sandbox_div.body.append('div')
	const reuse_div = sandbox_div.body.append('div')

	// buttons for links and/or downloads for the entire track/app
	addButtons(sandbox_args.buttons, mainBtn_div)
	// arrow buttons for the entire track/app that open a new div underneath
	addArrowBtns(sandbox_args, 'main', mainBtn_div, reuse_div)

	//Disables top, horizontal tabs for api queries or other special circumstances
	if (track.disable_topTabs == true) {
		renderContent(sandbox_args.ppcalls[0], sandbox_div.body, track.app)
	} else {
		// Creates the overarching tab menu and subsequent content
		const toptab_div = sandbox_div.body
			.append('div')
			.style('display', 'flex')
			.style('align-content', 'end')
			.style('justify-content', 'center')
			.style('border', 'none')
			.style('border-bottom', '1px solid lightgray')
			.style('width', '100%')
		const maincontent_div = sandbox_div.body.append('div')

		sandboxTabMenu(sandbox_args.ppcalls, track, toptab_div, maincontent_div)
	}
}

// Single content layout - buttons not used for UIs
function renderContent(ppcalls, div, app) {
	addMessage(ppcalls.message, div)

	const buttons_div = div.append('div').style('margin-bottom', '20px')
	const reuse_div = div.append('div')

	addButtons(ppcalls.buttons, buttons_div)
	makeDataDownload(ppcalls.download, buttons_div, app)
	showURLLaunch(ppcalls.urlparam, buttons_div, app)
	// addArrowBtns(ppcalls.arrowButtons, ppcalls, buttons_div, reuse_div)
	addArrowBtns(ppcalls, 'calls', buttons_div, reuse_div)

	if (!ppcalls.nodashedline) {
		div
			.append('hr')
			.style('border', '0')
			.style('border-top', '1px dashed #e3e3e6')
			.style('width', '100%')
	}

	const runpp_arg = {
		holder: div
			.append('div')
			.style('margin', '20px')
			.node(),
		host: window.location.origin
	}

	const callpp = JSON.parse(JSON.stringify(ppcalls.runargs))

	runproteinpaint(Object.assign(runpp_arg, callpp))
}

//********* Tab Menu Functions *********

//Creates the larger tabs above all examples and uis
function makeSandboxTabs(ppcalls, track) {
	const tabs = []
	const ui = ppcalls.findIndex(t => t.is_ui == true)
	const notui = ppcalls.findIndex(t => t.is_ui == (false || undefined))
	const ui_present = ui != -1 ? true : false
	if (ui_present == true) {
		tabs.push({
			name: 'Add Your Data',
			active: false,
			callback: async div => {
				try {
					const runpp_arg = {
						holder: div
							.append('div')
							.style('margin', '20px')
							.node(),
						sandbox_header: div,
						host: window.location.origin
					}

					const callpp = JSON.parse(JSON.stringify(ppcalls[ui].runargs))

					runproteinpaint(Object.assign(runpp_arg, callpp))
				} catch (e) {
					alert('Error: ' + (e.message || e))
				}
			}
		})
	}
	if ((ppcalls.length == 1 && ui_present != true) || (ppcalls.length == 2 && ui_present == true)) {
		tabs.push({
			name: 'Example',
			active: false,
			callback: async div => {
				try {
					renderContent(ppcalls[notui], div, track.app)
				} catch (e) {
					alert('Error: ' + (e.message || e))
				}
			}
		})
	}
	if ((ppcalls.length > 1 && ui_present == false) || (ppcalls.length > 2 && ui_present == true)) {
		tabs.push({
			name: 'Examples',
			active: false,
			callback: async div => {
				try {
					const examplesOnly = ppcalls.filter(p => p.is_ui != true) //Fix to rm UIs from Examples tab
					makeLeftsideTabMenu(ppcalls, div, examplesOnly)
				} catch (e) {
					alert('Error: ' + (e.message || e))
				}
			}
		})
	}
	return tabs
}
//Creates the main tab menu over the examples and/or app uis
function sandboxTabMenu(ppcalls, track, tabs_div, content_div) {
	const tabs = makeSandboxTabs(ppcalls, track)

	for (const tab of tabs) {
		tabs[0].active = true

		tab.tab = tabs_div
			.append('button')
			.attr('type', 'submit')
			.text(tab.name)
			.style('display', 'inline-block')
			.style('font', 'Arial')
			.style('font-size', '20px')
			.style('padding', '6px')
			.style('color', '#1575ad')
			.style('background-color', 'transparent')
			.style('border', 'none')
			.style('border-radius', 'unset')
			.style('border-bottom', tab.active ? '8px solid #1575ad' : 'none')
			.style('margin', '5px 10px 0px 10px')

		tab.content = content_div.append('div').style('display', tab.active ? 'block' : 'none')

		if (tab.active) {
			tab.callback(tab.content)
			delete tab.callback
		}

		tab.tab.on('click', () => {
			for (const t of tabs) {
				t.active = t === tab
				t.tab.style('border-bottom', t.active ? '8px solid #1575ad' : 'none')
				t.content.style('display', t.active ? 'block' : 'none')
			}
			if (tab.callback) {
				tab.callback(tab.content)
				delete tab.callback
			}
		})
	}
}

//Creates the subtab menu for pursing through examples, on the left-hand side of the sandbox, below the main tabs
async function makeLeftsideTabMenu(track, div, examplesOnly) {
	const tabs = examplesOnly.map((p, index) => getTabData(p, index, track.app))

	const menu_wrapper = div.append('div').classed('sjpp-vertical-tab-menu', true)
	const tabs_div = menu_wrapper
		.append('div')
		.classed('sjpp-tabs-div', true)
		.style('min-width', '150px') //Fixes the unsightly problem of tabs dramatically changing size on click.
	const content_div = menu_wrapper.append('div').classed('sjpp-content-div', true)

	for (const tab of tabs) {
		tab.tab = tabs_div
			.append('button')
			.attr('type', 'submit')
			.text(tab.label)
			.style('font', 'Arial')
			.style('font-size', '16px')
			.style('padding', '6px')
			.style('color', tab.active ? '#1575ad' : '#757373') //#1575ad: blue color, same as the top tab. #757373: default darker gray color
			.style('background-color', 'transparent')
			.style('border', 'none')
			.style('border-right', tab.active ? '8px solid #1575ad' : 'none')
			.style('border-radius', 'unset')
			.style('width', '100%')
			.style('text-align', 'right')
			.style('margin', '10px 0px 10px 0px')

		tab.content = content_div.append('div').style('display', tab.active ? 'block' : 'none')

		if (tab.active) {
			tab.callback(tab.content)
			delete tab.callback
		}

		tab.tab.on('click', () => {
			for (const t of tabs) {
				t.active = t === tab
				t.tab.style('border-right', t.active ? '8px solid #1575ad' : 'none')
				t.tab.style('color', t.active ? '#1575ad' : '#757373')
				t.content.style('display', t.active ? 'block' : 'none')
			}
			if (tab.callback) {
				tab.callback(tab.content)
				delete tab.callback
			}
		})
	}
}

function getTabData(ppcalls, i, app) {
	return {
		label: ppcalls.label,
		active: i === 0,
		callback: async div => {
			const wait = tab_wait(div)
			try {
				renderContent(ppcalls, div, app)
				wait.remove()
			} catch (e) {
				wait.text('Error: ' + (e.message || e))
			}
		}
	}
}

// ******* Sandbox Message Functions *********

function addMessage(arg, div) {
	if (arg != undefined && arg) {
		div
			.append('div')
			.style('margin', '20px')
			.html(arg)
	}
}

// Update message corresponding to the update ribbon. Expires on the same date as the ribbon
async function addUpdateMessage(track, update_message, div) {
	if (update_message != undefined && !track.update_expire) {
		console.log('Must provide expiration date: track.update_expire')
	}
	if (update_message != undefined && track.update_expire) {
		const today = new Date()
		const update = new Date(track.update_expire)
		if (update > today) {
			div
				.append('div')
				.style('margin', '20px')
				.html('<p style="display:inline-block;font-weight:bold">Update:&nbsp</p>' + update_message)
		}
	}
}

// ******* Sandbox Button Functions *********

function makeButton(div, text) {
	const button = div
		.append('button')
		.attr('type', 'submit')
		.style('background-color', '#cfe2f3')
		.style('margin', '20px 20px 0px 20px')
		.style('padding', '8px')
		.style('border', 'none')
		.style('border-radius', '3px')
		.style('display', 'inline-block')
		.text(text)

	return button
}

function addButtons(buttons, div) {
	if (buttons) {
		buttons.forEach(button => {
			const sandboxButton = makeButton(div, button.name)
			sandboxButton.on('click', () => {
				if (button.download) {
					event.stopPropagation()
					window.open(`${button.download}`, '_self', 'download')
				} else {
					event.stopPropagation()
					window.open(`${button.link}`, '_blank')
				}
			})
		})
	}
}

function showURLLaunch(urlparam, div, app) {
	if (urlparam) {
		const URLbtn = makeButton(div, app == 'Apps' ? 'Run app from URL' : 'Run track from URL')
		URLbtn.on('click', () => {
			event.stopPropagation()
			window.open(`${urlparam}`, '_blank')
		})
	}
}

function makeDataDownload(download, div, app) {
	if (download) {
		const dataBtn = makeButton(div, app == 'Apps' ? 'Download App File(s)' : 'Download Track File(s)')
		dataBtn.on('click', () => {
			event.stopPropagation()
			window.open(`${download}`, '_self', 'download')
		})
	}
}

async function showCode(ppcalls, btns) {
	//Push 'Code' and div callback to `btns`. Create button in addArrowButtons
	if (ppcalls.is_ui == true) return

	//Leave the weird spacing below. Otherwise the lines won't display the same identation in the sandbox
	const runpp_code = hljs.highlight(
		`runproteinpaint({
    host: "${window.location.origin}",
    holder: document.getElementById('a'),
    ` + // Fix for first argument not properly appearing underneath holder
			JSON.stringify(ppcalls.runargs, '', 4)
				.replaceAll(/"(.+)"\s*:/g, '$1:')
				.replaceAll(/\\t/g, '	')
				.replaceAll(/\\n/g, '\r\t')
				.slice(1, -1)
				.trim() +
			`\r})`,
		{ language: 'javascript' }
	).value

	const runpp_contents = `<pre style="border: 1px solid #d7d7d9; align-items: center; justify-content: center; margin: 0px 10px 5px 30px; overflow:auto; max-height:400px; ${
		ppcalls.jsonpath ? `min-height:400px;` : `min-height: auto;`
	}">
	<code style="font-size:14px; display:block;">${runpp_code}</code></pre>`

	btns.push({
		name: 'Code',
		callback: async rdiv => {
			try {
				if (ppcalls.jsonpath) {
					const include_json = await showJsonCode(ppcalls)
					const runpp_header = "<p style='margin:20px 5px 20px 25px;'>ProteinPaint JS code</p>"
					const grid = rdiv
						.append('div')
						.style('display', 'grid')
						.style('grid-template-columns', 'repeat(auto-fit, minmax(100px, 1fr))')
						.style('gap', '5px')
					grid
						.append('div')
						.style('display', 'block')
						.html(runpp_header + runpp_contents)
					grid
						.append('div')
						.style('display', 'block')
						.html(include_json)
				} else {
					rdiv.append('div').html(runpp_contents)
				}
			} catch (e) {
				alert('Error: ' + e)
			}
		}
	})
}

async function showJsonCode(ppcalls) {
	const jsondata = await dofetch('textfile', { file: ppcalls.jsonpath })
	const json_code = JSON.parse(jsondata.text)

	const splitpath = ppcalls.jsonpath.split('/')
	const filename = splitpath[splitpath.length - 1]

	let lines = JSON.stringify(json_code, '', 4).split('\n')
	let slicedjson
	if (lines.length > 120) {
		lines = lines.slice(0, 100)
		slicedjson = true
	}
	const code = hljs.highlight(lines.join('\n'), { language: 'json' }).value

	const json_contents = `<div>
			<p style="margin: 20px 5px 20px 25px; display: inline-block;">JSON code </p>
			<p style="display: inline-block; color: #696969; font-style:oblique;"> (contents of ${filename})</p>
		</div> 
		<pre style="border: 1px solid #d7d7d9; align-items: center; justify-content: center; margin: 0px 10px 5px 10px; max-height:400px; min-height:400px; overflow:auto;">
			<code class="sjpp-json-code" style="font-size:14px; display:block;">${
				slicedjson == true
					? `${code} ...<br><p style='margin:20px 25px; justify-content:center;'>Showing first 100 lines. To see the entire JSON, download ${filename} from the button above.</p>`
					: `${code}`
			}
			</code>
		</pre>`

	return json_contents
}

function showCitation(btns, pub) {
	//Push 'Citation' and div callback to `btns`. Create button in addArrowButtons
	btns.push({
		name: 'Citation',
		callback: async rdiv => {
			try {
				rdiv
					.append('div')
					.style('margin-left', '5w')
					.html(
						`<p style="display: inline-block;">${pub.title}. <em>${pub.journal}</em>, ${pub.year}. </p>
						${
							pub.pmid
								? `<p style="display: inline-block;">PMID: <a href="${pub.pmidURL}" target="_blank">${pub.pmid}</a></p>`
								: `<p>doi: <a href="${pub.doi}" target="_blank style="display: inline-block;">${pub.doi}</a></p>`
						}`
					)
			} catch (e) {
				alert('Error: ' + e)
			}
		}
	})
}

function makeDataPreviewDiv(content, contLength, div, filename, message) {
	//Create collapsible div displaying, if available, HTML message, file name, and 10 lines of data
	div.append('div').html(`
		${message ? `<p style="display:block;">${message}<p>` : ''}
		<p style="display: inline-block;">Data preview <span style="color: #696969; font-style:oblique;"> 
		${contLength > 10 ? `(first ${content.length} rows of ${filename})</span></p>` : `(content of ${filename})</span></p>`} 
	`)
	const bedjContent_div = div
		.append('div')
		.style('display', 'grid')
		.style('grid-template-columns', '1fr')
		.style('max-width', '80%')
		.style('margin-left', '10px')
		.style('border', '1px solid rgb(227, 227, 230)')
		.style('white-space', 'pre')
		.style('overflow-x', 'scroll')
		.style('opacity', '0.65')
		.style('padding', '1vw')
	content.forEach(c => {
		bedjContent_div.append('code').html(c)
	})
}

async function showViewData(btns, data) {
	//Push 'View Data' and div callback to `btns`. Create button in addArrowButtons
	btns.push({
		name: 'View Data',
		callback: async rdiv => {
			try {
				for (const file of data) {
					const res = await dofetch3(`/cardsjson?datafile=${file.file}&tabixCoord=${file.tabixQueryCoord}`)
					if (res.error) {
						console.log(`Error: ${res.error}`)
						return
					}
					const returnedContent = res.file
					const contLength = returnedContent.length
					//Limit to only the first 10 rows
					const content = returnedContent.slice(0, 10)

					//Parse file path for file name to show above content
					const splitpath = file.file.split('/')
					const filename = splitpath[splitpath.length - 1]

					makeDataPreviewDiv(content, contLength, rdiv, filename, file.message)
				}
			} catch (e) {
				alert('Error: ' + e)
			}
		}
	})
}

function makeArrowButtons(arrows, btns) {
	if (arrows) {
		arrows.forEach(arrow => {
			const contents = `<div style="margin:10px;" class="sjpp-arrow-content">
				${arrow.message ? `<div style="margin: 1vw;">${arrow.message}</div>` : ''}
				${
					arrow.links
						? arrow.links
								.map(hyperlink => {
									if (!hyperlink) return ''
									if (hyperlink.download) {
										return `<a style="cursor:pointer; margin-left:20px;" onclick="event.stopPropagation();" href="${hyperlink.download}", target="_self" download>${hyperlink.name}</a>`
									}
									if (hyperlink.link) {
										return `<a style="cursor:pointer; margin-left:20px;" onclick="event.stopPropagation();" href="${hyperlink.link}", target="_blank">${hyperlink.name}</a>`
									}
								})
								.join('')
						: ''
				}</div>`

			btns.push({
				name: arrow.name,
				callback: async rdiv => {
					try {
						rdiv.append('div').html(contents)
					} catch (e) {
						alert('Error: ' + e)
					}
				}
			})
		})
	}
}

async function addArrowBtns(args, type, bdiv, rdiv) {
	//Creates arrow buttons from every .arrowButtons object as well as `Code`, `View Data`, and `Citation`.
	let btns = []
	if (type == 'calls') showCode(args, btns) //Only show Code for examples, not in top div
	if (args.datapreview) {
		showViewData(btns, args.datapreview)
	}
	if (type == 'main' && args.citation) {
		//Only show citation in top div
		const res = await dofetch3('/cardsjson?jsonfile=citations')
		if (res.error) {
			console.log(`Error: ${res.error}`)
			return
		}
		const pubs = res.jsonfile.publications
		for (const pub of pubs) {
			if (args.citation == pub.id) showCitation(btns, pub)
		}
	}
	makeArrowButtons(args.arrowButtons, btns)

	const active_btn = btns.findIndex(b => b.active) == -1 ? false : true

	for (let i = 0; i < btns.length; i++) {
		const btn = btns[i]

		btn.btn = makeButton(bdiv, btn.name + ' ▼')

		btn.c = rdiv
			.append('div')
			.style('margin', '20px 0px 10px 20px')
			.style('display', (active_btn && i == 0) || btn.active ? 'block' : 'none')

		if ((active_btn && i == 0 && btn.callback) || btn.active) {
			btn.callback(btn.c)
			delete btn.callback
		}

		btn.btn.on('click', () => {
			if (btn.c.style('display') != 'none') {
				btn.btn
					.text(btn.name + ' ▼')
					.style('color', 'black')
					.style('background-color', '#cfe2f3')
				btn.c.style('display', 'none')
			} else {
				btn.btn
					.text(btn.name + ' ▲')
					.style('color', 'whitesmoke')
					.style('background-color', '#487ba8')
				appear(btn.c)
				for (let j = 0; j < btns.length; j++) {
					if (i != j) {
						btns[j].btn
							.text(btns[j].name + ' ▼')
							.style('color', 'black')
							.style('background-color', '#cfe2f3')
						btns[j].c.style('display', 'none')
					}
				}
			}
			if (btn.callback) {
				btn.callback(btn.c)
				delete btn.callback
			}
		})
	}
}

/********** 'Use Cases' Card and Functions  **********/
function make_useCasesCard(div, track_args, page_args) {
	const usecases_div = div
		.append('div')
		// .style('grid-area', 'gbrowser')
		.style('width', '90%')
		.style('margin', '20px 10px')
		.style('padding', '5px')
		// .attr('class', 'sjpp-app-drawer-card')
		.attr('class', 'sjpp-app-drawer-card')
		.html(
			`<p style="margin-left: 12px; font-size:14.5px;font-weight:500; display: block;">Use Cases</p>
		<p style="display: block; font-size: 13px; font-weight: 300; margin-left: 20px; justify-content: center; font-style:oblique; color: #403f3f;">find workflows and processes for specific needs</p>`
		)
		.on('click', async () => {
			event.stopPropagation()
			page_args.apps_off()
			openUseCasesSandbox(track_args.usecases, page_args.apps_sandbox_div)
		})

	return usecases_div
}

//Clicking on the 'use cases' card opens to a sandbox with another set of cards. Clicking on a use case card removes all other cards and opens static content of the selected card.
function openUseCasesSandbox(usecases, holder) {
	// holder.selectAll('*').remove()
	const sandbox_div = newSandboxDiv(holder)
	sandbox_div.header_row
	sandbox_div.header.text('Use Cases')
	sandbox_div.body.style('justify-content', 'center').style('background-color', '#f2ebdc')

	const uc_list = sandbox_div.body
		.append('ul')
		.style('list-style', 'none')
		.style('display', 'grid')
		.style('grid-template-columns', '40vw 40vw')
		.style('grid-template-rows', 'repeat(1, auto)')
		.style('gap', '5px')

	const uc_content = sandbox_div.body.append('div').style('padding', '0vw 0vw 2vw 0vw')

	function displayUseCases(usecases, list_div, content_div) {
		//joins together all the use cases objects from index.json and displays them as cards in a newly created sandbox.
		usecases.forEach(usecase => {
			const uc = list_div.append('li')
			uc.attr('class', 'sjpp-app-drawer-card')
				.style('padding', '10px')
				.style('margin', '5px')
				.html(
					`<p style="margin-left: 12px; font-size:14.5px;font-weight:500; display: block;">${usecase.title}</p>
				<p style="display: block; font-size: 13px; font-weight: 300; margin-left: 20px; justify-content: center; font-style:oblique; color: #403f3f;">${usecase.describe}</p>`
				)
				.on('click', () => {
					event.stopPropagation()
					list_div.selectAll('*').remove()
					showUseCaseContent(usecase, content_div)
				})
			return JSON.stringify(uc)
		})
	}

	displayUseCases(usecases, uc_list, uc_content)

	async function showUseCaseContent(usecase, div) {
		//Fetches html from use case .txt file, applies a 'back' button at the top, and renders to client
		const res = await dofetch3(`/cardsjson?file=${usecase.file}`)
		if (res.error) {
			sayerror(holder.append('div'), res.error)
			return
		}

		const content_div = div
			.append('div')
			.style('background-color', 'white')
			.style('margin', '0vw 10vw')
			.style('padding', '10px')

		const backBtn = makeButton(content_div, '<').style('background-color', '#d0e3ff')
		backBtn.style('font-size', '20px').on('click', () => {
			div.selectAll('*').remove()
			displayUseCases(usecases, uc_list, uc_content)
		})

		content_div
			.append('div')
			.style('margin', '0vw 5vw')
			.html(res.file)
	}
}

/********** DNAnexus Card and Functions  **********/
function makeDNAnexusFileViewerCard(div, page_args) {
	//Clicking on DNAnexus File Viewer card reveals instructions on how to launch a track from the file viewer
	const dnanexus_div = div
		.append('div')
		.style('width', '90%')
		.style('margin', '20px 10px')
		.style('padding', '5px')
		.attr('class', 'sjpp-app-drawer-card')
		.html(
			`<p style="margin-left: 12px; font-size:14.5px;font-weight:500; display: block;">DNAnexus File Viewer</p>
		<p style="display: block; font-size: 13px; font-weight: 300; margin-left: 20px; justify-content: center; font-style:oblique; color: #403f3f;">Instructions on launching ProteinPaint from DNAnexus</p>`
		)
		.on('click', async () => {
			event.stopPropagation()
			page_args.apps_off()
			openDNAnexusSandbox(page_args.apps_sandbox_div)
		})

	return dnanexus_div
}

async function openDNAnexusSandbox(holder) {
	// fetches HTML from dnanexus.txt and creates sandbox
	const res = await dofetch3(`/cardsjson?file=dnanexus`)
	if (res.error) {
		sayerror(holder.append('div'), res.error)
		return
	}
	const sandbox_div = newSandboxDiv(holder)
	sandbox_div.header.text('DNAnexus FileViewer')
	sandbox_div.body.style('justify-content', 'center').style('background-color', '#f2ebdc')

	sandbox_div.body
		.append('div')
		.style('padding', '2vw 0vw')
		.append('div')
		.style('background-color', 'white')
		.style('margin', '0vw 10vw')
		.style('padding', '10px')
		.html(res.file)
}

/********** Dataset Functions  **********/
function makeDatasetButtons(div, datasets, page_args) {
	div
		.append('div')
		.append('h5')
		.attr('class', 'sjpp-track-cols')
		.style('color', 'rgb(100, 122, 152)')
		.html('Featured Datasets')

	const datasetBtns_div = div.append('div').style('padding', '10px')

	for (const ds of datasets) {
		//Fix for feature datasets loading on page load
		const btn = makeButton(datasetBtns_div, ds.name)
		btn.attr('class', 'sjpp-dataset-btn').on('click', async () => {
			event.stopPropagation()
			page_args.apps_off()
			await openDatasetSandbox(page_args, ds)
		})
	}
}

async function openDatasetSandbox(page_args, ds) {
	const res = await dofetch3(`/cardsjson?jsonfile=featuredDatasets`)
	if (res.error) {
		sayerror(page_args.apps_sandbox_div.append('div'), res.error)
		return
	}

	const fds = res.jsonfile.datasets.filter(fd => fd.id == ds.id)

	// First genome fds.availableGenomes is the default
	const par = {
		fds: fds[0]
	}
	par.genome = page_args.genomes[par.fds.availableGenomes[0]]

	const sandbox_div = newSandboxDiv(page_args.apps_sandbox_div)
	sandbox_div.header_row
	sandbox_div.header.text(par.fds.name)
	sandbox_div.body

	const main_div = sandbox_div.body
		// Intro, gene toggle, and gene search box
		.append('div')
		.style('padding', '1em')
		.style('border-bottom', '1px solid #d0e3ff')

	// Introduction div
	if (par.fds.intro) {
		main_div
			.append('div')
			.style('line-height', '1.5em')
			.style('padding', '0.5em 0.5em 1em 0.5em')
			.html(par.fds.intro)
	}

	if (par.fds.searchbar == 'none') {
		// Call mass UI without search bar
		const runpp_arg = {
			holder: sandbox_div.body
				.append('div')
				.style('margin', '20px')
				.style('overflow-x', 'auto')
				.node(),
			host: window.location.origin
		}

		const callpp = JSON.parse(JSON.stringify(par.fds.runargs))

		runproteinpaint(Object.assign(runpp_arg, callpp))
		return
	}

	addDatasetGenomeBtns(main_div, par, page_args.genomes)
	// Create the gene search bar last (text flyout on keyup prevents placing elements to the right)
	const searchbar_div = main_div
		.append('div')
		.style('display', 'inline-block')
		.style('padding', '0.5em')

	const allResults_div = sandbox_div.body.append('div').style('max-width', '90vw')

	const coords = addGeneSearchbox({
		genome: par.genome,
		tip: new Menu({ padding: '' }),
		row: searchbar_div.append('div'),
		row: main_div
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '0.5em'),
		geneOnly: par.fds.searchbar == 'gene' ? true : false,
		focusOff: true,
		callback: async div => {
			//Creates search results as tracks, last to first
			const result_div = allResults_div
				.insert('div', ':first-child')
				.style('max-width', '90vw')
				.style('margin', '1vw')
			result_div
				// Destroy track on `x` button click
				.append('div')
				.style('display', 'inline-block')
				.style('cursor', 'default')
				.style('margin', '0px')
				.style('font-size', '1.5em')
				.html('&times;')
				.on('click', () => {
					// clear event handlers
					result_div.selectAll('*').remove()
					if (typeof close === 'function') close()
				})
			// Create 'Run Dataset from URL' btn specific to each applied search
			makeURLbutton(result_div, coords, par)
			// Render the search parameters as a track
			const runpp_arg = {
				holder: result_div
					.append('div')
					.style('margin', '20px')
					.node(),
				host: window.location.origin,
				genome: par.genome.name
			}
			// Return only position or gene; avoid returning undefined values to runpp()
			par.fds.runargs.block == true
				? (runpp_arg.position = `${coords.chr}:${coords.start}-${coords.stop}`) && (runpp_arg.nativetracks = 'Refgene')
				: (runpp_arg.gene = coords.geneSymbol)

			const callpp = JSON.parse(JSON.stringify(par.fds.runargs))

			runproteinpaint(Object.assign(runpp_arg, callpp))
		}
	})
}

function addDatasetGenomeBtns(div, par, genomes) {
	// Dynamically creates genome marker or buttons
	div
		.append('div')
		.style('display', 'inline-block')
		.style('padding', '10px 0px 10px 10px')

	if (par.fds.availableGenomes.length == 1) {
		// Show default genome as a non-functional button left of the search bar
		div
			.append('div')
			.style('padding', '8px')
			.style('color', '#a6a6a6')
			.style('border', '1px solid #a6a6a6')
			.style('display', 'inline-block')
			.style('width', 'auto')
			.style('height', 'auto')
			.style('cursor', 'not-allowed')
			.text(par.fds.availableGenomes[0])
	} else {
		const btns = []

		par.fds.availableGenomes.forEach(genome => {
			btns.push({
				name: genome,
				active: false,
				btn: makeButton(div, genome),
				callback: par => {
					par.genome = genomes[genome]
				}
			})
		})

		for (const btn of btns) {
			btns[0].active = true

			btn.btn
				.style('margin', '0px')
				.style('color', btn.active ? 'white' : 'black')
				.style('background-color', btn.active ? '#0b5394ff' : '#bfbfbf')
				.style('border-radius', '0px')
				.style('cursor', 'pointer')

			if (btn.active) {
				btn.callback(par)
			}

			btn.btn.on('click', () => {
				for (const b of btns) {
					b.active = b === btn
					b.btn.style('color', b.active ? 'white' : 'black')
					b.btn.style('background-color', b.active ? '#0b5394ff' : '#bfbfbf')
				}
				if (btn.active) {
					btn.callback(par)
				}
			})
		}
	}
}

function makeURLbutton(div, coords, par) {
	const URLbtn = makeButton(div, 'Run Result from URL')
	// Use position for genome browser and gene for protein view
	const blockOn =
		par.fds.runargs.block == true
			? `position=${coords.chr}:${coords.start}-${coords.stop}`
			: `gene=${coords.geneSymbol}`
	URLbtn.on('click', () => {
		event.stopPropagation()
		window.open(`?genome=${par.genome.name}&${blockOn}&${par.fds.dsURLparam}`, '_blank')
	})
}
