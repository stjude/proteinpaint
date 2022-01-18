import { dofetch, dofetch2, sayerror, tab_wait, appear } from './client'
import { newSandboxDiv } from './dom/sandbox'
import { debounce } from 'debounce'
import { event, select } from 'd3-selection'
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

-------Internal-------
make_examples_page
make_main_track_grid
make_col
make_subheader_contents
make_searchbar (disabled until further notice)
loadTracks
displayTracks
makeRibbon
openSandbox
renderContent
makeSandboxTabs
sandboxTabMenu
makeLeftsideTabMenu
getTabData
addMessage
addUpdateMessage
makeButton
addButtons
showURLLaunch
makeDataDownload
makeArrowButtons
addArrowBtns

Documentation: https://docs.google.com/document/d/18sQH9KxG7wOUkx8kecptElEjwAuJl0xIJqDRbyhahA4/edit#heading=h.jwyqi1mhacps
*/

export async function init_appDrawer(par) {
	const { holder, apps_sandbox_div, apps_off } = par
	const re = await dofetch2('/examplejson')
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

	const browserList = make_subheader_contents(gbrowser_col, 'Genome Browser Tracks')
	const launchList = make_subheader_contents(app_col, 'Launch Apps')
	const track_args = {
		tracks: re.examples.filter(track => !track.hidden),
		browserList,
		launchList
	}
	const page_args = {
		apps_sandbox_div,
		apps_off,
		allow_mdsform: re.allow_mdsform
	}
	//Creates error when obj is modified to avoid issues when using the same obj or stringifying it.
	for (const example of re.examples) {
		if (example.buttons && example.media.example) deepFreeze(example.media.example)
	}
	// make_searchbar(track_args, page_args, searchbar_div)
	await loadTracks(track_args, page_args)
}

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

//For all display functions: If example is available, the entire tile is clickable. If url and/or doc links are provided, buttons appear and open a new tab

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
				if (track.ppcalls) {
					openSandbox(track, page_args.apps_sandbox_div)
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

			if (update > today && !track.sandbox.update_message) {
				console.log(
					'No update message for sandbox div provided. Both the update_expire and sandbox.update_message are required'
				)
			}
			if (update > today && track.sandbox.update_message) {
				makeRibbon(li, 'UPDATED', '#e67d15')
			}
			if (newtrack > today) {
				makeRibbon(li, 'NEW', '#1ba176')
			}
		}

		// create custom track button for genomepaint card
		// TODO: rightnow only custom button is for genomepaint card,
		// if more buttons are added, this code will need to be changed as needed
		if (track.custom_buttons) {
			for (const button of track.custom_buttons) {
				if (button.check_mdsjosonform && !page_args.allow_mdsform) continue
				li.select('.track-btns')
					.append('button')
					.attr('class', 'sjpp-landing-page-a')
					.style('padding', '7px')
					.style('cursor', 'pointer')
					.text(button.name)
					.on('click', () => {
						event.stopPropagation()
						page_args.apps_off()
						if (button.example) {
							const btn_args = {
								name: button.name,
								buttons: {
									example: button.example
								}
							}
							openSandbox(btn_args, page_args.apps_sandbox_div)
						}
						// TODO: Add logic if custom button has url or some other link
					})
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

/******* Create Sandbox Function ********* 
 	Opens a sandbox with track example(s) or app ui with links and other information
*/

async function openSandbox(track, holder) {
	// create unique id for each app div
	const sandbox_div = newSandboxDiv(holder)
	sandbox_div.header_row
	sandbox_div.header.text(track.name)

	sandbox_div.body.style('overflow', 'hidden')

	// creates div for instructions or other messaging about the track
	addMessage(track.sandbox.intro, sandbox_div.body)

	// message explaining the update ribbon
	addUpdateMessage(track, sandbox_div.body)
	// buttons for links and/or downloads for the entire track/app
	addButtons(track.sandbox.buttons, sandbox_div.body)
	// arrow buttons for the entire track/app that open a new div underneath
	addArrowBtns(track.sandbox.arrowButtons, '', sandbox_div.body, sandbox_div.body)

	//Disables top, horizontal tabs for api queries or other special circumstances
	if (track.disable_topTabs == true) {
		renderContent(track.ppcalls[0], sandbox_div.body, track.app)
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

		sandboxTabMenu(track, toptab_div, maincontent_div)
	}
}

// Single content layout for examples only - buttons not used for UIs
function renderContent(ppcalls, div, app) {
	addMessage(ppcalls.message, div)

	const buttons_div = div.append('div').style('margin-bottom', '20px')
	const reuse_div = div.append('div')

	addButtons(ppcalls.buttons, buttons_div)
	makeDataDownload(ppcalls.download, buttons_div, app)
	showURLLaunch(ppcalls.urlparam, buttons_div, app)
	addArrowBtns(ppcalls.arrowButtons, ppcalls, buttons_div, reuse_div)

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
function makeSandboxTabs(track) {
	const tabs = []
	const ui = track.ppcalls.findIndex(t => t.is_ui == true)
	const notui = track.ppcalls.findIndex(t => t.is_ui == (false || undefined))
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

					const callpp = JSON.parse(JSON.stringify(track.ppcalls[ui].runargs))

					runproteinpaint(Object.assign(runpp_arg, callpp))
				} catch (e) {
					alert('Error: ' + (e.message || e))
				}
			}
		})
	}
	if ((track.ppcalls.length == 1 && ui_present != true) || (track.ppcalls.length == 2 && ui_present == true)) {
		tabs.push({
			name: 'Example',
			active: false,
			callback: async div => {
				try {
					renderContent(track.ppcalls[notui], div, track.app)
				} catch (e) {
					alert('Error: ' + (e.message || e))
				}
			}
		})
	}
	if ((track.ppcalls.length > 1 && ui_present == false) || (track.ppcalls.length > 2 && ui_present == true)) {
		tabs.push({
			name: 'Examples',
			active: false,
			callback: async div => {
				try {
					const examplesOnly = track.ppcalls.filter(p => p.is_ui != true) //Fix to rm UIs from Examples tab
					makeLeftsideTabMenu(track, div, examplesOnly)
				} catch (e) {
					alert('Error: ' + (e.message || e))
				}
			}
		})
	}
	return tabs
}
//Creates the main tab menu over the examples and/or app uis
function sandboxTabMenu(track, tabs_div, content_div) {
	const tabs = makeSandboxTabs(track)

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
		const message = div
			.append('div')
			.style('margin', '20px')
			.html(arg)
	}
}

// Update message corresponding to the update ribbon. Expires on the same date as the ribbon
async function addUpdateMessage(track, div) {
	if (track.sandbox.update_message != undefined && !track.update_expire) {
		console.log('Must provide expiration date: track.update_expire')
	}
	if (track.sandbox.update_message != undefined && track.update_expire) {
		const today = new Date()
		const update = new Date(track.update_expire)
		if (update > today) {
			const message = div
				.append('div')
				.style('margin', '20px')
				.html('<p style="display:inline-block;font-weight:bold">Update:&nbsp</p>' + track.sandbox.update_message)
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

	const runpp_contents = `<pre style="border: 1px solid #d7d7d9; align-items: center; justify-content: center; margin: 0px 10px 5px 30px; max-height:400px; min-height:400px; overflow-x: auto; overflow-y:auto;">
		<code style="font-size:14px; display:block; ">${runpp_code}</code>
	</pre>`

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
		<pre style="border: 1px solid #d7d7d9; align-items: center; justify-content: center; margin: 0px 10px 5px 10px; max-height:400px; min-height:400px; overflow-x: auto; overflow-y:auto;">
			<code class="sjpp-json-code" style="font-size:14px; display:block;">${
				slicedjson == true
					? `${code} ...<br><p style='margin:20px 25px; justify-content:center;'>Showing first 100 lines. To see the entire JSON, download ${filename} from the button above.</p>`
					: `${code}`
			}
			</code>
		</pre>`

	return json_contents
}

function makeArrowButtons(arrows, btns) {
	if (arrows) {
		arrows.forEach(arrow => {
			const contents = `<div style="margin:10px;" class="sjpp-arrow-content">
				${arrow.message ? `<div>${arrow.message}</div>` : ''}
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

function addArrowBtns(arg, ppcalls, bdiv, rdiv) {
	let btns = []
	if (ppcalls) {
		showCode(ppcalls, btns)
	}
	makeArrowButtons(arg, btns)

	const active_btn = btns.findIndex(b => b.active) == -1 ? false : true

	for (let i = 0; i < btns.length; i++) {
		const btn = btns[i]

		btn.btn = makeButton(bdiv, btn.name + ' ▼')

		btn.c = rdiv.append('div').style('display', (active_btn && i == 0) || btn.active ? 'block' : 'none')

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
