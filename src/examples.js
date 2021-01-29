import { dofetch2 } from './client'
import { debounce } from 'debounce'

export async function init_examples(par) {
	const { holder } = par
	const re = await loadJson()
	let track_arg = {}
	if (re.error) {
		holder.append('div').text(re.error)
		return
	}

	const wrapper_div = make_examples_page(holder)
	// const header_div = wrapper_div.append('div')
	// make_intro(wrapper_div)
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
		.html('Tracks')
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
	// make_header(header_div, track_arg)
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
	return wrapper_div
}

// function make_header(div, args) {
// 	const header_div = div.append('div')
// 	header_div
// 		.style('padding', '10px')
// 		.style('margin', '0px')
// 		.style('height', '125px')
// 		.style('background-image', 'linear-gradient(to bottom right, #1b2646, #324870)')
// 		.style('display', 'grid')
// 		.style('grid-template-columns', '3fr 1fr 1fr')
// 		.style('grid-template-areas', '"htext contactBtn requestBtn" "htext searchBar searchBar"')
// 		.style('gap', '20px')

// 	const htext = header_div.append('div')
// 	htext
// 		.style('grid-area', 'htext')
// 		.style('top', '5%')
// 		.style('float', 'left')
// 		.style('font-family', 'Verdana, Geneva, Tahoma, sans-serif')
// 		.style('font-weight', 'lighter')
// 		.style('font-size', '30px')
// 		.style('letter-spacing', '2.5px')
// 		.style('align-items', 'left')
// 		.style('justify-items', 'center')
// 		.style('tab-size', '8')
// 		.style('margin-left', '40px')
// 		.style('color', 'white')
// 		.html('GenomePaint, Genome Browser,<br><span class="tab"><span>and Other App Examples')

// 	const contact_btn = header_div.append('button')
// 	contact_btn
// 		.attr('class', 'contact-btn')
// 		.style('grid-area', 'contactBtn')
// 		.style('font-family', 'Verdana, Geneva, Tahoma, sans-serif')
// 		.style('font-size', '14px')
// 		.style('height', '30px')
// 		.style('width', '220px')
// 		.style('text-align', 'center')
// 		.style('background-color', '#e6e7eb')
// 		.style('border-radius', '8px')
// 		.style('border', '1px solid black')
// 		.style('margin', '10px')
// 		.text('Contact Us')
// 		.on('mouseover', () => {
// 			contact_btn
// 				.style('background-color', 'white')
// 				.style('color', '#0d47ba')
// 				.style('border', '1px solid #adb7c9')
// 		})
// 		.on('mouseleave', () => {
// 			contact_btn
// 				.style('background-color', '#e6e7eb')
// 				.style('color', 'black')
// 				.style('border', '1px solid black')
// 		})
// 		.on('click', () => {
// 			window.location.href = 'mailto:PPTeam@STJUDE.ORG&subject=Inquiry from Examples Page'
// 		})

// 	const request_btn = header_div.append('button')
// 	request_btn
// 		.attr('class', 'request-btn')
// 		.style('grid-area', 'requestBtn')
// 		.style('font-family', 'Verdana, Geneva, Tahoma, sans-serif')
// 		.style('font-size', '14px')
// 		.style('height', '30px')
// 		.style('width', '220px')
// 		.style('text-align', 'center')
// 		.style('background-color', '#e6e7eb')
// 		.style('border-radius', '8px')
// 		.style('border', '1px black')
// 		.style('border-style', 'solid')
// 		.style('margin', '10px')
// 		.text('Request hpc:~/tp Access')
// 		.on('mouseover', () => {
// 			request_btn
// 				.style('background-color', 'white')
// 				.style('color', '#0d47ba')
// 				.style('border', '1px solid #adb7c9')
// 		})
// 		.on('mouseleave', () => {
// 			request_btn
// 				.style('background-color', '#e6e7eb')
// 				.style('color', 'black')
// 				.style('border', '1px solid black')
// 		})
// 		.on('click', () => {
// 			window.open('https://stjude.service-now.com/sn_portal', '_blank')
// 		})

// 	const searchBar_div = header_div.append('div')
// 	searchBar_div.style('grid-area', 'searchBar').property('position', 'relative')
// 	make_searchbar(searchBar_div, args)

// 	return [htext, request_btn, contact_btn, searchBar_div]
// }

function make_searchbar(div, args) {
	const bar_div = div.append('div')
	bar_div
		.style('display', 'flex')
		.style('flex-direction', 'column')
		.style('align-items', 'center')
		.style('justify-content', 'center')
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

//Creates intro header and paragraph with show/hide button before track grid
// function make_intro(div) {
// 	const intro_div = div.append('div')
// 	intro_div.append('div').style('padding', '10px')

// 	const intro_header = intro_div.append('div')
// 	intro_header
// 		.append('div')
// 		.style('margin', '10px')
// 		.style('font-family', 'Verdana, Geneva, Tahoma, sans-serif')
// 		.style('font-size', '20px')
// 		.style('font-weight', '525')
// 		.style('letter-spacing', '2px')
// 		.style('text-align', 'center')
// 		.style('border-radius', '4px')
// 		.style('color', '#324870')
// 		.text('Welcome to our Examples Page!')
// 		.attr('class', 'intro_div')

// 	const lists = intro_div.append('div')
// 	lists
// 		.append('div')
// 		.attr('class', 'intro_div')
// 		.style(
// 			'font-family',
// 			"'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, Verdana, sans-serif'"
// 		)
// 		.style('font-size', '14px')
// 		.style('text-align', 'left')
// 		.style('margin-left', '40px')
// 		.style('margin-right', '40px').html(`
//             <p style="font-family: Verdana, Geneva, Tahoma, sans-serif;font-size: 16px; font-style: oblique; font-weight: 500;color: #324870">Please note the following:
//                 <ul style="font-family: 'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, Verdana, sans-serif; margin-left: 40px">
//                     <li>To use your own files, you must have access to /research/rgs01/resgen/legacy/gb_customTracks/tp on the hpc. If you do not have access, click the button in the upper right-hand corner to request access in Service Now.</li>
//                     <li>Questions? Comments? Use the Contact Us button to email the ProteinPaint team.</li>
//                 </ul>
//             </p>
//             <p style="font-family: Verdana, Geneva, Tahoma, sans-serif;font-size: 16px; font-style: oblique; font-weight: 500;color: #324870">Links:
//                 <ul style="font-family: 'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, Verdana, sans-serif; margin-left: 40px">
//                     <li>Example: Opens a new tab of an embedded runproteinpaint() call in an html file.</li>
//                     <li>URL: Some tracks do not require creating a new html or json file. For these tracks, a parameterized URL accesses files from the hpc. The link opens a new tab with an example of a parameterized URL.</li>
//                     <li>Docs: Opens a new tab to the track's full documentation, such as: specifications and how to prepare data files for the tracks as well as the requirements for creating files for ProteinPaint. </li>
//                 </ul>
//             </p>`)

// 	const showHideBtn = div.append('button')
// 	showHideBtn
// 		.style('font-family', 'Verdana, Geneva, Tahoma, sans-serif')
// 		.style('font-size', '11px')
// 		.style('height', '30px')
// 		.style('width', '80px')
// 		.style('text-align', 'center')
// 		.style('background-color', '#e6e7eb')
// 		.style('border-radius', '8px')
// 		.style('border', 'none')
// 		.style('margin-left', '40px')
// 		.style('margin-top', '10px')
// 		.attr('id', 'showHide')
// 		.text('Show/Hide')
// 		.on('mouseover', () => {
// 			showHideBtn
// 				.style('background-color', 'white')
// 				.style('color', '#0d47ba')
// 				.style('border', '1px solid #adb7c9')
// 		})
// 		.on('mouseleave', () => {
// 			showHideBtn
// 				.style('background-color', '#e6e7eb')
// 				.style('color', 'black')
// 				.style('border', '1px solid black')
// 		})
// 		.on('click', () => {
// 			if (lists.style('display') == 'none' && intro_header.style('display') == 'none') {
// 				lists.style('display', 'block') && intro_header.style('display', 'block')
// 			} else {
// 				lists.style('display', 'none') && intro_header.style('display', 'none')
// 			}
// 		})

// 	return [intro_header, lists, showHideBtn]
// }

//Creates the two column outer grid
function make_main_track_grid(div) {
	const track_grid = div.append('div')
	track_grid
		.style('display', 'grid')
		.style('grid-template-columns', 'repeat(auto-fit, minmax(425px, 1fr))')
		.style('grid-template-areas', '"gbrowser otherapps"')
		.style('gap', '10px')
		.style('background-color', 'white')
		.style('padding', '10px 20px')
		.style('text-align', 'left')
		.style('margin', '15px')

	return track_grid
}

//Creates the outer Genome Browser column
function make_gBrowserCol(div) {
	const gBrowserCol = div.append('div')
	gBrowserCol
		.style('grid-area', 'gbrowser')
		.property('position', 'relative')
		.style('background-color', 'white')
		.style('border-radius', '20px')

	// make_gBrowserHeader(gBrowserCol)

	return gBrowserCol
}

// function make_gBrowserHeader(div) {
// 	const gBrowserHeader = div.append('div')
// 	gBrowserHeader
// 		.append('div')
// 		.style('padding', '10px')
// 		.style('margin', '10px')
// 		.style('color', 'white')
// 		.style('font-family', 'Verdana, Geneva, Tahoma, sans-serif')
// 		.style('font-size', '20px')
// 		.style('font-weight', '525')
// 		.style('letter-spacing', '2px')
// 		.style('text-align', 'center')
// 		.style('background', 'radial-gradient( #1b2646, #324870)')
// 		.style('border-radius', '4px')
// 		.text('Genome Browser')

// 	return gBrowserHeader
// }

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
		.style('font-size', '14px')
		.style('margin-top', '25px')
		.style('margin-bottom', '0px')
		.style('border-radius', '20px')
		.style('border', '1px solid #D3D3D3')
		.style('display', 'grid')
		.style('width', 'minmax(320px, auto)')
		.style('height', 'fit-content')
		.style('grid-template-columns', '1fr 4fr')
		.style('grid-template-areas', '"image header" "image link" "image citation"')
		.style('align-items', 'center')
		.style('justify-items', 'left')
		.style('text-align', 'left')
		.style('box-shadow', '0 1px 2px rgba(0, 0, 0, 0.1)')
		.style('-webkit-transition', 'all 0.6s cubic-bezier(0.165, 0.84, 0.44, 1)')
		.style('transition', 'all 0.6s cubic-bezier(0.165, 0.84, 0.44, 1)')
		.html(`<a href=https://genomepaint.stjude.cloud target="_blank" class="gpaint-img"><img src="https://pecan.stjude.cloud/static/examples/images/gpaint-square.png"></img>
		</a>
		<h6 id="gpaint-header">GenomePaint Home</h6>
        <a href=https://ppr.stjude.org/?mdsjsonform=1 target="_blank" id="gpaint-link">Create a Custom Track</a>
        <p id="gpaint-citation">Citation: Zhou, Xin, et al. “Exploration of Coding and Non-Coding Variants in Cancer Using GenomePaint.” Cancer Cell, vol. 39, no. 1, 11 Jan. 2021, pp. 83–95.e4., doi:10.1016/j.ccell.2020.12.011. <a href=https://pubmed.ncbi.nlm.nih.gov/33434514/ target="_blank">Link to paper</a></p>`)

	return gpaint_card_div
}

//Creates the outer Other App column
function make_appCol(div) {
	const otherAppsCol = div.append('div')
	otherAppsCol
		.style('grid-area', 'otherapps')
		.property('position', 'relative')
		.style('background-color', 'white')
		.style('border-radius', '20px')

	// make_otherAppHeader(otherAppsCol)

	return otherAppsCol
}

// function make_otherAppHeader(div) {
// 	const otherAppHeader = div.append('div')
// 	otherAppHeader
// 		.append('div')
// 		.style('padding', '10px')
// 		.style('margin', '10px')
// 		.style('color', 'white')
// 		.style('font-family', 'Verdana, Geneva, Tahoma, sans-serif')
// 		.style('font-size', '20px')
// 		.style('font-weight', '525')
// 		.style('letter-spacing', '2px')
// 		.style('text-align', 'center')
// 		.style('background', 'radial-gradient( #1b2646, #324870)')
// 		.style('border-radius', '4px')
// 		.text('Other Apps')

// 	return otherAppHeader
// }

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

function displayGPaintTracks(tracks, holder) {
	holder.selectAll('*').remove()
	const trackData = tracks.filter(track => {
		const app = `${track.app}`
		const subheading = `${track.subheading}`
		if (app == 'Genome Browser' && subheading == 'GenomePaint') {
			const li = holder.append('li')
			li.attr('class', 'track')
				.html(
					`<h6>${track.name}</h6>
						${track.blurb ? `<p id="track-blurb">${track.blurb}</p>` : ''}
						<span class="track-image"><img src="${track.image}"></img></span>
						<div class="track-btns">
						${
							track.buttons.url
								? `<button class="url-tooltip-outer" id="url-btn" onclick="window.open('${track.buttons.url}', '_blank')">URL<span class="url-tooltip-span">View a parameterized URL example of this track</span></button>`
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
						openNewTab(track)
					}
				})
			return JSON.stringify(li)
		}
	})
}

function displayBrowserTracks(tracks, holder) {
	holder.selectAll('*').remove()
	const trackData = tracks.filter(track => {
		const app = `${track.app}`
		const subheading = `${track.subheading}`
		if (app == 'Genome Browser' && subheading == 'Tracks') {
			const li = holder.append('li')
			li.attr('class', 'track')
				.html(
					`<h6>${track.name}</h6>
						${track.blurb ? `<p id="track-blurb">${track.blurb}</p>` : ''}
						<span class="track-image"><img src="${track.image}"></img></span>
						<div class="track-btns">
						${
							track.buttons.url
								? `<button class="url-tooltip-outer" id="url-btn" onclick="window.open('${track.buttons.url}', '_blank')">URL<span class="url-tooltip-span">View a parameterized URL example of this track</span></button>`
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
						openNewTab(track)
					}
				})
			return JSON.stringify(li)
		}
	})
}

function displayExperimentalTracks(tracks, holder) {
	holder.selectAll('*').remove()
	const trackData = tracks.filter(track => {
		const app = `${track.app}`
		const subheading = `${track.subheading}`
		if (app == 'Genome Browser' && subheading == 'Experimental Tracks') {
			const li = holder.append('li')
			li.attr('class', 'track')
				.html(
					`<h6>${track.name}</h6>
						${track.blurb ? `<p id="track-blurb">${track.blurb}</p>` : ''}
						<span class="track-image"><img src="${track.image}"></img></span>
						<div class="track-btns">
						${
							track.buttons.url
								? `<button class="url-tooltip-outer" id="url-btn" onclick="window.open('${track.buttons.url}', '_blank')">URL<span class="url-tooltip-span">View a parameterized URL example of this track</span></button>`
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
						openNewTab(track)
					}
				})
			return JSON.stringify(li)
		}
	})
}

async function displayAppTracks(tracks, holder) {
	holder.selectAll('*').remove()
	const trackData = tracks.filter(track => {
		const app = `${track.app}`
		const subheading = `${track.subheading}`
		if (app == 'Apps' && subheading == 'Tracks') {
			const li = holder.append('li')
			li.attr('class', 'track')
				.html(
					`<h6>${track.name}</h6>
						${track.blurb ? `<p id="track-blurb">${track.blurb}</p>` : ''}
						<span class="track-image"><img src="${track.image}"></img></span>
						<div class="track-btns">
						${
							track.buttons.url
								? `<button class="url-tooltip-outer" id="url-btn" onclick="window.open('${track.buttons.url}', '_blank')"  >URL<span class="url-tooltip-span">View a parameterized URL example of this track</span></button>`
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
						openNewTab(track)
					}
				})
			return JSON.stringify(li)
		}
	})
}

//TODO: Change function to load into container once the cascading container design is figured out.

async function openNewTab(track) {
	const strippedTrack = `${JSON.stringify(track.buttons.example)}`.slice(1, -1)
	const contents = `<!DOCTYPE html>
			<head>
				<meta charset="utf-8">
			</head>
			<body>
			<script src="${window.location.origin}/bin/proteinpaint.js" charset="utf-8"></script>
				<div class="header">
					<h1 id="track-example-header">${track.name} Example</h1>
				</div>
				<div id="aaa" style="margin:20px"</div>
				<script src="/examples.js"></script> <!--??? Not the right file path??? Does not load but maybe not needed?-->
			<script>
				runproteinpaint({
                    host: '${window.location.origin}',
                    holder: document.getElementById('aaa'),
                    ${strippedTrack}
                })
			</script>
			</body>
			</html>`
	const tab = window.open(`${track.shorthand},name=${track.shorthand} Example`)
	const script = tab.document.createElement('script')
	const tabName = `${track.shorthand}`
	script.type = 'text/javascript'
	tab.document.write(contents)
	tab.document.close()
	setTimeout(function() {
		tab.document.title = tabName
	}, 500)
}
