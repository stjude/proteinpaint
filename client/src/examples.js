import { dofetch2 } from './client'
import { debounce } from 'debounce'

export async function init_examples(par) {
	const { holder, new_div } = par
	const re = await dofetch2('/examples', { method: 'POST', body: JSON.stringify({ getexamplejson: true }) })
	if (re.error) {
		holder
			.append('div')
			.text(re.error)
			.style('background-color', '#f5f5f5')
		return
	}
	const wrapper_div = make_examples_page(holder)
	const track_grid = make_main_track_grid(wrapper_div)
	const gbrowser_col = make_col(track_grid, 'gbrowser')
	const app_col = make_col(track_grid, 'otherapps')

	// top of apps column followed by subheader
	const holddiv = make_top_fnDiv(gbrowser_col)
	const searchbar_div = app_col.append('div')

	// subheaders
	const gpaintList = make_subheader_contents(gbrowser_col, 'GenomePaint')
	const browserList = make_subheader_contents(gbrowser_col, 'Genome Browser Tracks')
	const experimentalList = make_subheader_contents(gbrowser_col, 'Experimental Tracks')
	const launchList = make_subheader_contents(app_col, 'Launch Apps')
	const appList = make_subheader_contents(app_col, 'Apps')

	const track_arg = {
		tracks: re.examples,
		gpaintList,
		browserList,
		experimentalList,
		launchList,
		appList
	}
	make_searchbar(searchbar_div, track_arg)
	await loadTracks(track_arg)
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
		.html(sub_name)
		.append('hr')
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
function make_searchbar(div, args) {
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
				const data = args.tracks
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
				await loadTracks(args, filteredTracks)
			}),
			700
		)

	return searchBar
}

async function loadTracks(args, filteredTracks) {
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
		displayTracks(GPaintTracks, args.gpaintList)
		displayTracks(BrowserTracks, args.browserList)
		displayTracks(ExperimentalTracks, args.experimentalList)
		displayTracks(LaunchApps, args.launchList)
		displayTracks(AppTracks, args.appList)
	} catch (err) {
		console.error(err)
	}
}
//TODO: ?? Styling difference between clickable tiles and not clickable tiles (which ones have examples and which don't)??

//For all display functions: If example is available, the entire tile is clickable. If url and/or doc links are provided, buttons appear and open a new tab

function displayTracks(tracks, holder) {
	holder.selectAll('*').remove()
	tracks.forEach(track => {
		const li = holder.append('li')
		li.attr('class', 'track')
			.html(
				`
						${
							track.blurb
								? `<div class="track-h" id="theader"><span style="font-size:14.5px;font-weight:500;">${track.name}</span><span id="track-blurb">  ${track.blurb}</span></div>`
								: `<div class="track-h"><span style="font-size:14.5px;font-weight:500;">${track.name}</span></div>`
						}
					<span class="track-image"><img src="${track.image}"></img></span>
					<div class="track-btns">
					${
						track.buttons.url
							? `<button class="url-tooltip-outer" id="url-btn" onclick="window.open('${window.location.origin}${track.buttons.url}', '_blank')">URL<span class="url-tooltip-span">View a parameterized URL example of this track</span></button>`
							: ''
					}
					${
						track.buttons.doc
							? `<button id="doc-btn" onclick="window.open('${track.buttons.doc}', '_blank')" type="button">Docs</button>`
							: ''
					}
					</div>`
			)
			.on('click', async () => {
				if (track.buttons.example) {
					openExample(track, holder)
				}
			})
		return JSON.stringify(li)
	})
}

//TODO: styling for the container
//Opens example of app in landing page container
async function openExample(track, new_div) {
	new_div.selectAll('*').remove()

	// const strippedTrack = `${JSON.stringify(track.buttons.example)}`.slice(1, -1)

	// const contents = `<script src="${window.location.origin}/bin/proteinpaint.js" charset="utf-8"></script>
	// 			<div id="aaa" style="margin:20px">
	// 			<button type="submit" onclick="window.open('${window.location.origin}', '_self')">Go Back</button>
	// 			<h2 class="header" id="track-example-header">${track.name} Example</h2>
	// 			</div>
	// 		<script>
	// 			runproteinpaint({
	//                 host: '${window.location.origin}',
	//                 holder: document.getElementById('aaa'),
	//                 ${strippedTrack}
	//             })
	// 		</script>`
	// new_div.append('div').html(contents)
	new_div.append('div').text('This Worked')

	// const tab = window.open('${window.location.origin}','_self')
	// const tab = window.open(`${track.shorthand},name=${track.shorthand} Example`)
	// const script = tab.document.createElement('script')
	// const tabName = `${track.shorthand}`
	// script.type = 'text/javascript'
	// tab.document.write(contents)
	// tab.document.close()
	// setTimeout(function() {
	// 	tab.document.title = tabName
	// }, 500)
}
