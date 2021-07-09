import { dofetch2, sayerror, newSandboxDiv, to_textfile } from './client'
import { debounce } from 'debounce'
import { event, select } from 'd3-selection'
import { highlight } from 'highlight.js/lib/common';
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
	for (const example of re.examples){
		if (example.buttons && example.buttons.example) deepFreeze(example.buttons.example)
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

//Preserves alignment for search bar and launch button whilst aligning the first subheaders in each col
function make_top_fnDiv(div) {
	const top = div.append('div')
	top
		.style('display', 'flex')
		.style('flex-direction', 'column')
		.style('align-items', 'center')
		.style('justify-content', 'center')
		.style('background-color', '#f5f5f5')
		.style('height', '35px')
		.style('width', '550px')

	return top
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
				`${track.blurb ? `<div class="sjpp-track-h" id="theader"><span style="font-size:14.5px;font-weight:500;cursor:pointer">${track.name}</span><span class="sjpp-track-blurb" style="cursor:default">  ${track.blurb}</span></div>`: `<div class="sjpp-track-h"><span style="font-size:14.5px;font-weight:500;">${track.name}</span></div>`}
				<span class="sjpp-track-image"><img src="${track.image}"></img></span>
				<div class='sjpp-track-links'>
				${track.buttons.url ? `<a style="cursor:pointer" onclick="event.stopPropagation();" href="${window.location.origin}${track.buttons.url}" target="_blank">URL</a>`: ''}
				${track.buttons.doc ? `<a style="cursor:pointer" onclick="event.stopPropagation();" href="${track.buttons.doc}", target="_blank">Docs</a>`: ''}
				</div>`
			)
			.on('click', async () => {
				event.stopPropagation()
				page_args.apps_off()
				if (track.clickcard2url) {
					window.open(track.clickcard2url, '_blank')
				} else if (track.buttons.example) {
					openExample(track, page_args.apps_sandbox_div)
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
							openExample(btn_args, page_args.apps_sandbox_div)
						}
						// TODO: Add logic if custom button has url or some other link
					})
			}
		}

		return JSON.stringify(li)
	})
}

function makeRibbon(e, text, color) {
	const ribbonDiv = e.append('div')
	.attr('class', 'sjpp-track-ribbon')
	.style('align-items','center')
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

//TODO: styling for the container
//Opens example of app in landing page container
async function openExample(track, holder) {
	// create unique id for each app div
	const sandbox_div = newSandboxDiv(holder)
	sandbox_div.header.text(
		track.name + (track.sandbox.is_ui != undefined && track.sandbox.is_ui == false ? ' Example' : '')
	)

	//Download data and show runpp() code at the top
	// makeDataDownload(track, sandbox_div)
	showCode(track, sandbox_div)

	// creates div for instructions or other messaging about the track
	if (track.sandbox.intro) {
		sandbox_div.body
			.append('div')
			.style('margin', '20px')
			.html(track.sandbox.intro)
	}
	// message explaining the update ribbon
	addUpdateMessage(track, sandbox_div)

	// template runpp() arg
	const runpp_arg = {
		holder: sandbox_div.body
			.append('div')
			.style('margin', '20px')
			.node(),
		sandbox_header: sandbox_div.header,
		host: window.location.origin
	}

	const example = JSON.parse(JSON.stringify(track.buttons.example))

	runproteinpaint(Object.assign(runpp_arg, example))
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
			const message = div.body
				.append('div')
				.style('margin', '20px')
				.html('<p style="display:inline-block;font-weight:bold">Update:&nbsp</p>' + track.sandbox.update_message)
		}
	}
}

// Creates 'Show Code' button in Sandbox for all examples
async function showCode(track, div) {
	if (track.sandbox.is_ui != true) {
		const codeBtn = div.body
			.append('button')
			.attr('class', 'sja_menuoption')
			.style('margin', '20px')
			.style('padding', '8px')
			.style('border', 'none')
			.style('border-radius', '3px')
			.style('font-size', '12.75x')
			.text('Show Code')
			.style('display', 'inline-block')
			.on('click', () => {
				if (code.style('display') == 'none') {
					code.style('display', 'block') //TODO fadein fn
					select(event.target).text('Hide')
				} else {
					code.style('display', 'none') //TODO fadeout fn
					select(event.target).text('Show Code')
				}
			})

	//Leave the weird spacing below. Otherwise the lines won't display the same identation in the sandbox.
	const code = div.body
		.append('pre')
		.append('code')
		.style('display', 'none')
		.style('margin', '35px')
		.style('font-size', '14px')
		.style('border', '1px solid #aeafb0')
		.html(highlight(`runproteinpaint({
   host: "${window.location.origin}",
   holder: document.getElementById('a'),` +
			JSON.stringify(track.buttons.example, '', 4).replaceAll(/"(.+)"\s*:/g, '$1:').slice(1,-1) +
			`})`, {language:'javascript'}).value)
	}
}

async function makeDataDownload(track, div) {
	if (track.sandbox.datadownload) {
		const dataBtn = div.body
		.append('button')
		.attr('class', 'sja_menuoption')
		.attr('id','sjpp-data-btn')
		.style('margin', '20px')
		.style('padding', '8px')
		.style('border', 'none')
		.style('border-radius', '3px')
		.style('font-size', '12.75px')
		.style('display', 'inline-block')
		.text('Download Data')
		.on('click', () => {
			to_textfile(track.sandbox.datadownload, track.name)
		})
	}
}
