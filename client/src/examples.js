import { dofetch2, sayerror, newSandboxDiv, tab2box, tab_wait } from './client'
import { debounce } from 'debounce'
import { event, select } from 'd3-selection'
import { highlight } from 'highlight.js/lib/common'
import { deepFreeze } from './common/rx.core'

export async function init_examples(par) {
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
		const urls = track.media.urls
		const li = holder.append('li')
		li.attr('class', 'sjpp-track')
			.html(
				`${
					track.blurb
						? `<div class="sjpp-track-h" id="theader"><span style="font-size:14.5px;font-weight:500;cursor:pointer">${track.name}</span><span class="sjpp-track-blurb" style="cursor:default">  ${track.blurb}</span></div>`
						: `<div class="sjpp-track-h"><span style="font-size:14.5px;font-weight:500;">${track.name}</span></div>`
				}
				<span class="sjpp-track-image"><img src="${track.image}"></img></span>
				<div class='sjpp-track-links'>
				${urls
					.map(url => {
						if (!url) return ''
						if (url.link && !url.name) {
							return `<a style="cursor:pointer" onclick="event.stopPropagation();" href="${window.location.origin}${url.link}" target="_blank">URL</a>`
						}
						if (url.link && url.name) {
							return `<a style="cursor:pointer" onclick="event.stopPropagation();" href="${window.location.origin}${url.link}" target="_blank">${url.name}</a>`
						}
					})
					.join('')}
				${
					track.media.doc
						? `<a style="cursor:pointer" onclick="event.stopPropagation();" href="${track.media.doc}", target="_blank">Docs</a>`
						: ''
				}
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
		.style('left', '-23%')
		.style('font-size', '11.5px')
		.style('text-transform', 'uppercase')
		.style('text-align', 'center')
}

// ******* Create Sandbox Function ********* Opens a sandbox with track example(s) or app ui with links and other information

async function openSandbox(track, holder) {
	// create unique id for each app div
	const sandbox_div = newSandboxDiv(holder)
	sandbox_div.header_row.style('box-shadow', 'rgb(220 220 220) 5px -2px 5px').style('z-index', '99')
	sandbox_div.header.text(track.name).style('padding', '5px 10px 10px 10px')
	sandbox_div.body.style('box-shadow', 'rgb(220 220 220) 5px -2px 10px').style('z-index', '-1')

	// creates div for instructions or other messaging about the track
	addMessage(track.sandbox.intro, sandbox_div.body)

	// message explaining the update ribbon
	addUpdateMessage(track, sandbox_div.body)

	if (track.ppcalls.length == 1) {
		const call = track.ppcalls[0]

		const buttons_div = sandbox_div.body.append('div').style('border-bottom', '4px darkgray solid')
		const reuse_div = sandbox_div.body
			.append('div')
			.attr('id', 'reusable')
			.style('display', 'none')

		//Creates any custom buttons
		addButtons(track.sandbox.buttons, buttons_div)
		//Download data and show runpp() code at the top
		makeDataDownload(call.download, buttons_div)
		//Redirects to URL parameter of track
		showURLLaunch(call.urlparam, buttons_div)
		//Shows code used to create sandbox
		showCode(track, call.runargs, buttons_div)

		addArrowButtons(track.sandbox.arrowButtons, buttons_div)

		// template runpp() arg
		const runpp_arg = {
			holder: sandbox_div.body
				.append('div')
				.style('margin', '20px')
				.node(),
			sandbox_header: sandbox_div.header,
			host: window.location.origin
		}

		const callpp = JSON.parse(JSON.stringify(call.runargs))

		runproteinpaint(Object.assign(runpp_arg, callpp))
	} else if (track.ppcalls.length > 1) {
		addButtons(track.sandbox.buttons, sandbox_div.body)
		makeTabMenu(track, sandbox_div)
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
		.attr('class', 'sjpp-sandbox-btn')
		.style('background-color', '#cfe2f3')
		.style('margin', '20px')
		.style('padding', '8px')
		.style('border', 'none')
		.style('border-radius', '3px')
		.style('display', 'inline-block')
		.text(text)

	return button
}

function addButtons(arg, div) {
	const buttons = arg
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

function showURLLaunch(arg, div) {
	if (arg) {
		const URLbtn = makeButton(div, 'Run track from URL')
		URLbtn.on('click', () => {
			event.stopPropagation()
			window.open(`${arg}`, '_blank')
		})
	}
}

function makeDataDownload(arg, div) {
	if (arg) {
		const dataBtn = makeButton(div, 'Download Track File(s)')
		dataBtn.on('click', () => {
			event.stopPropagation()
			window.open(`${arg}`, '_self', 'download')
		})
	}
}

// Creates 'Show Code' button in Sandbox for all examples
async function showCode(track, arg, div) {
	if (track.sandbox.is_ui != true) {
		//Leave the weird spacing below. Otherwise the lines won't display the same identation in the sandbox.
		// 	const code = collapseDiv.append('div')
		// 		.append('pre')
		// 		.append('code')
		// 		.style('margin', '35px')
		// 		.style('font-size', '14px')
		// 		.style('border', '1px solid #aeafb0')
		// 		.style('display', 'none')
		// 		.html(highlight(`runproteinpaint({
		// host: "${window.location.origin}",
		// holder: document.getElementById('a'),` +
		// 	JSON.stringify(arg, '', 4).replaceAll(/"(.+)"\s*:/g, '$1:').slice(1,-1) +
		// 	`})`, {language:'javascript'}).value)

		const code = highlight(
			`runproteinpaint({
    host: "${window.location.origin}",
    holder: document.getElementById('a'),` +
				JSON.stringify(arg, '', 4)
					.replaceAll(/"(.+)"\s*:/g, '$1:')
					.slice(1, -1) +
				`})`,
			{ language: 'javascript' }
		).value

		const contents = `<pre style="border: 1px solid #aeafb0"><code style="font-size:14px; margin:35px;">${code}</code></pre>`

		makeArrowBtns(div, 'Code', contents)
	}
}

async function addArrowButtons(arg, div) {
	const arrows = arg
	if (arrows) {
		arrows.forEach(arrow => {
			const links = arrow.links
			const contents = `<div style="margin:10px">
				${arrow.message ? `<div>${arrow.message}</div>` : ''}
				${links
					.map(hyperlink => {
						if (!hyperlink) return ''
						if (hyperlink.download) {
							return `<a style="cursor:pointer; margin-left:20px;" onclick="event.stopPropagation();" href="${hyperlink.download}", target="_self" download>${hyperlink.name}</a>`
						}
						if (hyperlink.link) {
							return `<a style="cursor:pointer; margin-left:20px;" onclick="event.stopPropagation();" href="${hyperlink.link}", target="_blank">${hyperlink.name}</a>`
						}
					})
					.join('')}</div>`

			makeArrowBtns(div, arrow.name, contents)
		})
	}
}

async function makeArrowBtns(div, name, contents) {
	const collapse = document.getElementById('reusable')
	collapse.innerHTML = ''

	const arrowBtn = makeButton(div, name + ' ▼')
	arrowBtn.on('click', () => {
		if (collapse.style.display == 'none') {
			collapse.style.display = 'block'
			collapse.style.borderBottom = '4px darkgray solid'
			collapse.innerHTML = contents
			select(event.target)
				.text(name + ' ▲')
				.style('color', 'whitesmoke')
				.style('background-color', '#487ba8')
		} else {
			collapse.style.display = 'none'
			collapse.style.borderBottom = 'none'
			collapse.innerHTML = ''
			select(event.target)
				.text(name + ' ▼')
				.style('color', 'black')
				.style('background-color', '#cfe2f3')
		}
	})
}

// ******* Tab Menu Functions *********

function makeTabMenu(track, holder) {
	const tabs = []
	tabArray(tabs, track)
	tab2box(holder.body.style('box-shadow', 'rgb(220 220 220) 5px 5px 10px'), tabs, true, 'Examples')
}

function tabArray(tabs, track) {
	const calls = track.ppcalls
	calls.forEach(call => {
		tabs.push({
			label: call.label,
			callback: async div => {
				const wait = tab_wait(div)
				try {
					makeTab(track, call, div)
					wait.remove()
				} catch (e) {
					wait.text('Error: ' + (e.message || e))
				}
			}
		})
	})
}

function makeTab(track, arg, div) {
	addMessage(arg.message, div)

	const buttons_div = div.append('div').style('border-bottom', '4px darkgray solid')
	const reuse_div = div
		.append('div')
		.attr('id', 'reusable')
		.style('display', 'none')

	addButtons(arg.buttons, buttons_div)
	makeDataDownload(arg.download, buttons_div)
	showURLLaunch(arg.urlparam, buttons_div)
	showCode(track, arg.runargs, buttons_div, reuse_div)
	addArrowButtons(arg.arrowButtons, buttons_div, reuse_div)

	const runpp_arg = {
		holder: div
			.append('div')
			.style('margin', '20px')
			.node(),
		host: window.location.origin
	}

	const call = JSON.parse(JSON.stringify(arg.runargs))

	runproteinpaint(Object.assign(runpp_arg, call))
}
