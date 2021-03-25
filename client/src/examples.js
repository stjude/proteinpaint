import { dofetch2 } from './client'
import { debounce } from 'debounce'

export async function init_examples(par) {
	const { holder } = par
	const re = await loadJson()
	let track_arg = {}
	if (re.error) {
		holder
			.append('div')
			.text(re.error)
			.style('background-color', '#f2f2f2')
		return
	}
	const wrapper_div = make_examples_page(holder)
	const searchbar_div = wrapper_div.append('div')
	const track_grid = make_main_track_grid(wrapper_div)
	const gbrowswer_col = make_gBrowserCol(track_grid)
	const app_col = make_appCol(track_grid)

	// genomepaint panel
	// subgrid
	// top card followed by additional tiles
	gbrowswer_col
		.append('h5')
		.html('GenomePaint')
		.append('hr')
	make_gpaint_card(gbrowswer_col)
	const gpaintList = gbrowswer_col.append('ul')
	gpaintList
		.attr('class', 'track-list')
		.style('display', 'grid')
		.style('grid-template-columns', 'repeat(auto-fit, minmax(320px, 1fr))')
		.style('gap', '10px')
		.style('padding', '10px')
		.style('border-radius', '8px')

	// tracks panel
	// subgrid
	gbrowswer_col
		.append('h5')
		.html('Genome Browser Tracks')
		.append('hr')
	const browserList = gbrowswer_col.append('ul')
	browserList
		.attr('class', 'track-list')
		.style('display', 'grid')
		.style('grid-template-columns', 'repeat(auto-fit, minmax(320px, 1fr))')
		.style('gap', '10px')
		.style('padding', '10px')
		.style('border-radius', '8px')

	// experimental tracks panel
	// subgrid
	gbrowswer_col
		.append('h5')
		.html('Experimental Tracks')
		.append('hr')
	const experimentalList = gbrowswer_col.append('ul')
	experimentalList
		.attr('class', 'track-list')
		.style('display', 'grid')
		.style('grid-template-columns', 'repeat(auto-fit, minmax(320px, 1fr))')
		.style('gap', '10px')
		.style('padding', '10px')
		.style('border-radius', '8px')

	// otherapps track panel
	// subgrid
	app_col
		.append('h5')
		.html('Apps')
		.append('hr')
	const appList = app_col.append('ul')
	appList
		.attr('class', 'track-list')
		.style('display', 'grid')
		.style('grid-template-columns', 'repeat(auto-fit, minmax(320px, 1fr))')
		.style('gap', '10px')
		.style('padding', '10px')
		.style('border-radius', '8px')

	track_arg = {
		tracks: re.examples,
		gpaintList,
		browserList,
		experimentalList,
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
		.style('background-color', '#f2f2f2')
	return wrapper_div
}
//Makes search bar and functionality to search tracks
function make_searchbar(div, args) {
	const bar_div = div.append('div')
	bar_div
		.style('display', 'flex')
		.style('flex-direction', 'column')
		.style('align-items', 'center')
		.style('justify-content', 'center')
		.style('background-color', '#f2f2f2')
	const searchBar = bar_div.append('div')
	searchBar
		.append('div')
		.append('input')
		.attr('type', 'text')
		.style('width', '500px')
		.style('height', '24px')
		.style('border-radius', '3px')
		.style('border', '2px solid #dbdbdb')
		.style('font-size', '12px')
		.property('placeholder', 'Search apps, tracks, or features')
		.on(
			'keyup',
			debounce(async () => {
				const data = await loadJson()
				const searchInput = searchBar
					.select('input')
					.node()
					.value.toLowerCase()
				const filteredTracks = data.examples.filter(track => {
					let searchTermFound = (track.searchterms || []).reduce((searchTermFound, searchTerm) => {
						if (searchTermFound) {
							return true
						}
						return searchTerm.toLowerCase().includes(searchInput)
					}, false)
					return searchTermFound || track.name.toLowerCase().includes(searchInput)
				})
				displayGPaintTracks(filteredTracks, args.gpaintList)
				displayBrowserTracks(filteredTracks, args.browserList)
				displayExperimentalTracks(filteredTracks, args.experimentalList)
				displayAppTracks(filteredTracks, args.appList)
			}),
			700
		)

	return searchBar
}

//Creates the two column outer grid
function make_main_track_grid(div) {
	const track_grid = div.append('div')
	track_grid
		.style('display', 'grid')
		.style('grid-template-columns', 'repeat(auto-fit, minmax(425px, 1fr))')
		.style('grid-template-areas', '"gbrowser otherapps"')
		.style('gap', '10px')
		.style('background-color', '#f2f2f2')
		.style('padding', '10px 20px')
		.style('text-align', 'left')

	return track_grid
}

//Creates the outer Genome Browser column
function make_gBrowserCol(div) {
	const gBrowserCol = div.append('div')
	gBrowserCol
		.style('grid-area', 'gbrowser')
		.property('position', 'relative')
		.style('background-color', '#f2f2f2')

	return gBrowserCol
}

//Standalone card for GenomePaint
function make_gpaint_card(div) {
	const gpaint_card_div = div.append('div')
	gpaint_card_div
		.attr('class', 'gpaint-card')
		.style('background-color', 'white')
		.style(
			'font-family',
			"'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, Verdana, sans-serif"
		)
		.style('margin', '25px 10px -15px 10px')
		.html(`<a href=https://genomepaint.stjude.cloud target="_blank" class="gpaint-img"><img src="https://pecan.stjude.cloud/static/examples/images/gpaint-square.png"></img>
		</a>
		<h6 id="gpaint-header">GenomePaint</h6>
        <a href=https://ppr.stjude.org/?mdsjsonform=1 target="_blank" id="gpaint-link">Create a Custom Track</a>
        <p id="gpaint-citation"><a href=https://pubmed.ncbi.nlm.nih.gov/33434514/ target="_blank">Link to paper</a></p>`)

	return gpaint_card_div
}

//Creates the outer Other App column
function make_appCol(div) {
	const otherAppsCol = div.append('div')
	otherAppsCol
		.style('grid-area', 'otherapps')
		.property('position', 'relative')
		.style('background-color', '#f2f2f2')

	return otherAppsCol
}

async function loadJson() {
	const json = await dofetch2('/examples', { method: 'POST', body: JSON.stringify({ getexamplejson: true }) })
	return json
}

async function loadTracks(args) {
	try {
		displayGPaintTracks(args.tracks, args.gpaintList)
		displayBrowserTracks(args.tracks, args.browserList)
		displayExperimentalTracks(args.tracks, args.experimentalList)
		displayAppTracks(args.tracks, args.appList)
	} catch (err) {
		console.error(err)
	}
}
//TODO: ?? Styling difference between clickable tiles and not clickable tiles (which ones have examples and which don't)??

//For all display functions: If example is available, the entire tile is clickable. If url and/or doc links are provided, buttons appear and open a new tab

//Displays tracks under the GenomePaint subheader.
function displayGPaintTracks(tracks, holder) {
	holder.selectAll('*').remove()
	const trackData = tracks.filter(track => {
		const app = `${track.app}`
		const subheading = `${track.subheading}`
		if (app == 'Genome Browser' && subheading == 'GenomePaint') {
			const li = holder.append('li')
			li.attr('class', 'track')
				.html(
					`
						${
							track.blurb
								? `<h6 class="track-name">${track.name},</h6><p class="track-name" id="track-blurb"> ${track.blurb}</p>`
								: `<h6 class="track-name">${track.name}</h6>`
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
		}
	})
}

//Displays tracks under the Genome Browser subheader
function displayBrowserTracks(tracks, holder) {
	holder.selectAll('*').remove()
	const trackData = tracks.filter(track => {
		const app = `${track.app}`
		const subheading = `${track.subheading}`
		if (app == 'Genome Browser' && subheading == 'Tracks') {
			const li = holder.append('li')
			li.attr('class', 'track')
				.html(
					`
					${track.blurb ? `<h6>${track.name},</h6><p id="track-blurb"> ${track.blurb}</p>` : `<h6>${track.name}</h6>`}
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
		}
	})
}

//Displays tracks under the Experimental Tracks subheader
function displayExperimentalTracks(tracks, holder) {
	holder.selectAll('*').remove()
	const trackData = tracks.filter(track => {
		const app = `${track.app}`
		const subheading = `${track.subheading}`
		if (app == 'Genome Browser' && subheading == 'Experimental Tracks') {
			const li = holder.append('li')
			li.attr('class', 'track')
				.html(
					`
					${track.blurb ? `<h6>${track.name},</h6><p id="track-blurb"> ${track.blurb}</p>` : `<h6>${track.name}</h6>`}
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
		}
	})
}

//Displays tracks under the Apps subheader
async function displayAppTracks(tracks, holder) {
	holder.selectAll('*').remove()
	const trackData = tracks.filter(track => {
		const app = `${track.app}`
		const subheading = `${track.subheading}`
		if (app == 'Apps' && subheading == 'Tracks') {
			const li = holder.append('li')
			li.attr('class', 'track')
				.html(
					`
					${track.blurb ? `<h6>${track.name},</h6><p class="track-blurb"> ${track.blurb}</p>` : `<h6>${track.name}</h6>`}
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
		}
	})
}

//TODO: styling for the container
//Opens example of app in landing page container
async function openExample(track, holder) {
	holder.selectAll('*').remove()
	const strippedTrack = `${JSON.stringify(track.buttons.example)}`.slice(1, -1)
	const contents = `<script src="${window.location.origin}/bin/proteinpaint.js" charset="utf-8"></script>
				<div id="aaa" style="margin:20px">
				<button type="submit" onclick="window.open('${window.location.origin}', '_self')">Go Back</button>
				<h2 class="header" id="track-example-header">${track.name} Example</h2>
				</div>
			<script>
				runproteinpaint({
                    host: '${window.location.origin}',
                    holder: document.getElementById('aaa'),
                    ${strippedTrack}
                })
			</script>`
	holder.append('div').html(contents)

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
