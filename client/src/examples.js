import { dofetch2, sayerror, newSandboxDiv } from './client'
import { debounce } from 'debounce'
import { event } from 'd3-selection'

export async function init_examples(par) {
	const { holder, apps_sandbox_div, apps_off, show_gdcbamslice } = par
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

	// subheaders
	// TODO: termporarily hiding 'genomepaint' and 'Experimental tracks' headings, enable once more card are visible under this
	// const gpaintList = make_subheader_contents(gbrowser_col, 'GenomePaint')
	const browserList = make_subheader_contents(gbrowser_col, 'Genome Browser Tracks')
	// const experimentalList = make_subheader_contents(gbrowser_col, 'Experimental Tracks')
	const launchList = make_subheader_contents(app_col, 'Launch Apps')
	// Quick fix: hide gdcbamslice if serverconfig.gdcbamslice is false or missing
	re.examples.find(track => track.name == 'GDC BAM Slice').hidden = !show_gdcbamslice
	// if(track.name == 'GDC BAM Slice' && !page_args.show_gdcbamslice)
	const track_args = {
		tracks: re.examples.filter(track => !track.hidden),
		// gpaintList,
		browserList,
		// experimentalList,
		launchList
	}
	const page_args = {
		apps_sandbox_div,
		apps_off,
		allow_mdsform: re.allow_mdsform
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
		.style('color', 'rgb(100, 122, 152)')
		.html(sub_name)
	const list = div.append('ul')
	list
		.attr('class', 'track-list')
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
	const GPaintTracks = (filteredTracks || args.tracks).filter(
		track => track.app == 'Genome Browser' && track.subheading == 'GenomePaint'
	)
	const BrowserTracks = (filteredTracks || args.tracks).filter(
		track => track.app == 'Genome Browser' && track.subheading == 'Tracks'
	)
	const ExperimentalTracks = (filteredTracks || args.tracks).filter(
		track => track.app == 'Genome Browser' && track.subheading == 'Experimental Tracks'
	)
	const LaunchApps = (filteredTracks || args.tracks).filter(
		track => track.app == 'Apps' && track.subheading == 'Launch App'
	)
	const AppTracks = (filteredTracks || args.tracks).filter(track => track.app == 'Apps' && track.subheading == 'Apps')

	try {
		// displayTracks(GPaintTracks, args.gpaintList, page_args)
		displayTracks(BrowserTracks, args.browserList, page_args)
		// displayTracks(ExperimentalTracks, args.experimentalList, page_args)
		displayTracks(LaunchApps, args.launchList, page_args)
	} catch (err) {
		console.error(err)
	}
}
//TODO: ?? Styling difference between clickable tiles and not clickable tiles (which ones have examples and which don't)??

//For all display functions: If example is available, the entire tile is clickable. If url and/or doc links are provided, buttons appear and open a new tab

function displayTracks(tracks, holder, page_args) {
	holder.selectAll('*').remove()
	tracks.forEach(track => {
		const li = holder.append('li')
		li.attr('class', 'track')
			.html(
				`${
					track.blurb
						? `<div class="track-h" id="theader"><span style="font-size:14.5px;font-weight:500;cursor:pointer">${track.name}</span><span id="track-blurb" style="cursor:default">  ${track.blurb}</span></div>`
						: `<div class="track-h"><span style="font-size:14.5px;font-weight:500;">${track.name}</span></div>`
				}
			<span class="track-image"><img src="${track.image}"></img></span>
			<span class="track-tag"></span>
			<div class="track-btns">
			${
				track.buttons.url
					? `<a id="url-btn" style="cursor:pointer; padding:7.75px" onclick="event.stopPropagation()" href="${window.location.origin}${track.buttons.url}" target="_blank">URL</a>`
					: ''
			}
			${
				track.buttons.doc
					? `<button id="doc-btn" style="cursor:pointer" onclick="event.stopPropagation(); window.open('${track.buttons.doc}', '_blank')" type="button">Docs</button>`
					: ''
			}
			</div>`
			)
			.on('click', async () => {
				event.stopPropagation()
				page_args.apps_off()
				if (track.clickcard2url) {
					window.open(track.clickcard2url, '_blank')
				} else if (track.buttons.example) {
					openExample(track)
				}
			})

		// add Beta tag for experimental tracks
		if (track.isbeta) li.select('.track-tag').text('Beta')

		// create custom track button for genomepaint card
		// TODO: rightnow only custom button is for genomepaint card,
		// if more buttons are added, this code will need to be changed as needed
		if (track.custom_buttons) {
			for (const button of track.custom_buttons) {
				if (button.check_mdsjosonform && !page_args.allow_mdsform) continue
				li.select('.track-btns')
					.append('button')
					.attr('class', 'landing-page-a')
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
							openExample(btn_args)
						}
						// TODO: Add logic if custom button has url or some other link
					})
			}
		}

		return JSON.stringify(li)
	})
}

//TODO: styling for the container
//Opens example of app in landing page container
async function openExample(track) {
	// crate unique id for each app div
	const sandbox_div = newSandboxDiv()
	sandbox_div.header.text(track.name + (track.subheading && track.subheading != 'Launch App' ? ' Example' : ''))

	// template runpp() arg
	const runpp_arg = {
		holder: sandbox_div.body
			.append('div')
			.style('margin', '20px')
			.node(),
		sandbox_header: sandbox_div.header,
		host: window.location.origin
	}

	runproteinpaint(Object.assign(runpp_arg, track.buttons.example))
}
