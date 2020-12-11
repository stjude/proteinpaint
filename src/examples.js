import { dofetch2 } from './client'
// import { check } from 'prettier'

export async function init_examples(par) {
	const { holder } = par
	// const re = await dofetch2('examples', { method: 'POST', body: JSON.stringify({ getexamplejson: true }) })
	const re = await loadJson()
	let track_arg = {}
	console.log(re)
	if (re.error) {
		holder.append('div').text(re.error)
		return
	}

	const wrapper_div = make_examples_page(holder)
	const header_div = wrapper_div.append('div')
	make_intro(wrapper_div)
	const track_grid = make_main_track_grid(wrapper_div)
	const gbrowswer_col = make_gbrowser_col(track_grid)
	const otherapp_col = make_otherapp_col(track_grid)

	// genomepaint panel
	gbrowswer_col
		.append('h5')
		.html('GenomePaint')
		.append('hr')
	make_gpaint_card(gbrowswer_col)

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
	const appList = otherapp_col.append('ul')
	appList
		.attr('class', 'track-list')
		.style('display', 'grid')
		.style('grid-template-columns', 'repeat(auto-fit, minmax(320px, 1fr))')
		.style('gap', '10px')
		.style('padding', '10px')
		.style('border-radius', '8px')

	track_arg = {
		tracks: re.examples,
		browserList,
		experimentalList,
		appList
	}
	make_header(header_div, track_arg)
	await loadTracks(track_arg)
	console.log(track_arg)
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

function make_header(div, args) {
	const header_div = div.append('div')
	header_div
		.style('padding', '10px')
		.style('margin', '0px')
		.style('height', '125px')
		.style('background-image', 'linear-gradient(to bottom right, #1b2646, #324870)')
		.style('display', 'grid')
		.style('grid-template-columns', '3fr 1fr 1fr')
		.style('grid-template-areas', '"htext contactBtn requestBtn" "htext searchBar searchBar"')
		.style('gap', '20px')

	const htext = header_div.append('div')
	htext
		.style('grid-area', 'htext')
		.style('top', '5%')
		.style('float', 'left')
		.style('font-family', 'Verdana, Geneva, Tahoma, sans-serif')
		.style('font-weight', 'lighter')
		.style('font-size', '30px')
		.style('letter-spacing', '2.5px')
		.style('text-align', 'left')
		.style('tab-size', '8')
		.style('margin-left', '40px')
		.style('color', 'white')
		.html('GenomePaint, Genome Browser,<br>and Other App Examples') //TODO add in tab or new line?

	const request_btn = header_div.append('div')
	request_btn
		.append('button')
		.style('grid-area', 'contactBtn')
		.style('font-family', 'Verdana, Geneva, Tahoma, sans-serif')
		.style('font-size', '14px')
		.style('height', '30px')
		.style('width', '220px')
		.style('text-align', 'center')
		.style('background-color', '#e6e7eb')
		.style('border-radius', '8px')
		.style('border', '1px black')
		.style('border-style', 'solid')
		.style('margin', '10px')
		.text('Request hpc:~/tp Access')
		.on('click', () => {
			window.open('https://stjude.service-now.com/sn_portal', '_blank')
		})

	const contact_btn = header_div.append('div')
	contact_btn
		.append('button')
		.style('grid-area', 'requestBtn')
		.style('font-family', 'Verdana, Geneva, Tahoma, sans-serif')
		.style('font-size', '14px')
		.style('height', '30px')
		.style('width', '220px')
		.style('text-align', 'center')
		.style('background-color', '#e6e7eb')
		.style('border-radius', '8px')
		.style('border', '1px solid black')
		.style('margin', '10px')
		.text('Contact Us')
		.on('click', () => {
			window.location.href = 'mailto:PPTeam@STJUDE.ORG&subject=Inquiry from Examples Page'
		})

	const searchBar_div = header_div.append('div')
	searchBar_div.style('grid-area', 'searchBar').property('position', 'relative')
	make_searchbar(searchBar_div, args)

	return [htext, request_btn, contact_btn, searchBar_div]
}

function make_searchbar(div, args) {
	const searchBar = div.append('div')
	searchBar
		.append('div')
		.append('input')
		.attr('type', 'text')
		.style('width', '500px')
		.style('height', '24px')
		.attr('id', 'searchBar')
		.style('border-radius', '3px')
		.style('border', '1px solid #eaeaea')
		.style('padding', '5px 10px')
		.style('font-size', '12px')
		.property('placeholder', 'Search tracks or features')
		.on('keyup', async () => {
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
			displayBrowserTracks(filteredTracks, args.browserList)
			displayExperimentalTracks(filteredTracks, args.experimentalList)
			displayAppTracks(filteredTracks, args.appList)
		})

	return searchBar
}

//Creates intro header and paragraph with show/hide button before track grid
function make_intro(div) {
	const intro_div = div.append('div')
	intro_div.append('div').style('padding', '10px')

	const intro_header = intro_div.append('div')
	intro_header
		.append('div')
		.style('margin', '10px')
		.style('font-family', 'Verdana, Geneva, Tahoma, sans-serif')
		.style('font-size', '20px')
		.style('font-weight', '525')
		.style('letter-spacing', '2px')
		.style('text-align', 'center')
		.style('border-radius', '4px')
		.style('color', '#324870')
		.text('Welcome to our Examples Page!')
		.attr('class', 'intro_div')

	const lists = intro_div.append('div')
	lists
		.append('div')
		.attr('class', 'intro_div')
		.style(
			'font-family',
			"'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, Verdana, sans-serif'"
		)
		.style('font-size', '14px')
		.style('text-align', 'left')
		.style('margin-left', '65px')
		.style('margin-right', '40px').html(`
            <p style="font-family: Verdana, Geneva, Tahoma, sans-serif;font-size: 16px; font-style: oblique; font-weight: 500;color: #324870">Please note the following:
                <ul>
                    <li>To use your own files, you must have access to /research/rgs01/resgen/legacy/gb_customTracks/tp on the hpc. If you do not have access, click the button in the upper right-hand corner to request access in Service Now.</li>
                    <li>Questions? Comments? Use the Contact Us button to email the ProteinPaint team.</li>
                </ul>
            </p>
            <p style="font-family: Verdana, Geneva, Tahoma, sans-serif;font-size: 16px; font-style: oblique; font-weight: 500;color: #324870">Links:
                <ul>
                    <li>Example: Opens a new tab of an embedded runproteinpaint() call in an html file.</li>
                    <li>URL: Some tracks do not require creating a new html or json file. For these tracks, a parameterized URL accesses files from the hpc. The link opens a new tab with an example of a parameterized URL.</li>
                    <li>Docs: Opens a new tab to the track's full documentation, such as: specifications and how to prepare data files for the tracks as well as the requirements for creating files for ProteinPaint. </li>
                </ul>
            </p>`)

	const showHideBtn = div.append('div')
	showHideBtn
		.append('button')
		.style('font-family', 'Verdana, Geneva, Tahoma, sans-serif')
		.style('font-size', '11px')
		.style('height', '30px')
		.style('width', '80px')
		.style('text-align', 'center')
		.style('background-color', '#e6e7eb')
		.style('border-radius', '8px')
		.style('border', 'none')
		.style('margin-left', '40px')
		.style('margin-top', '10px')
		.attr('id', 'showHide')
		.text('Show/Hide')
		.on('click', () => {
			if (lists.style('display') == 'none' && intro_header.style('display') == 'none') {
				lists.style('display', 'block') && intro_header.style('display', 'block')
			} else {
				lists.style('display', 'none') && intro_header.style('display', 'none')
			}
		})

	return [intro_header, lists, showHideBtn]
}

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
function make_gbrowser_col(div) {
	const gBrowserCol = div.append('div')
	gBrowserCol
		.style('grid-area', 'gbrowser')
		.property('position', 'relative')
		.style('background-color', 'white')
		.style('border-radius', '20px')

	make_gbrowser_header(gBrowserCol)

	return gBrowserCol
}

function make_gbrowser_header(div) {
	const gBrowserHeader = div.append('div')
	gBrowserHeader
		.append('div')
		.style('padding', '10px')
		.style('margin', '10px')
		.style('color', 'white')
		.style('font-family', 'Verdana, Geneva, Tahoma, sans-serif')
		.style('font-size', '20px')
		.style('font-weight', '525')
		.style('letter-spacing', '2px')
		.style('text-align', 'center')
		.style('background', 'radial-gradient( #1b2646, #324870)')
		.style('border-radius', '4px')
		.text('Genome Browser')

	return gBrowserHeader
}

//Standalone card for GenomePaint
function make_gpaint_card(div) {
	const gpaint_card_div = div.append('div')
	gpaint_card_div
		.attr('class', 'gpaint-card')
		.style('background-color', 'white')
		.style('padding', '10px')
		.style('margin', '5px')
		.style('height', '125px')
		.style('border-radius', '20px')
		.style('border', '1px solid #D3D3D3')
		.style('display', 'grid')
		.style('width', 'minmax(320px, auto)')
		.style('height', 'fit-content')
		.style('grid-template-columns', '1fr 4fr')
		.style('grid-template-areas', '"image link" "image citation"')
		.style('align-items', 'center')
		.style('justify-items', 'left')
		.style('text-align', 'left')
		.style('box-shadow', '0 1px 2px rgba(0, 0, 0, 0.1)')
		.style('-webkit-transition', 'all 0.6s cubic-bezier(0.165, 0.84, 0.44, 1)')
		.style('transition', 'all 0.6s cubic-bezier(0.165, 0.84, 0.44, 1)')
		.html(`<a href=https://genomepaint.stjude.cloud target="_blank" class="gpaint-img"><img class="gpaint-img" src="https://pecan.stjude.cloud/static/examples/images/gpaint-square.png"></img>
        </a>
        <a href=https://ppr.stjude.org/?mdsjsonform=1 target="_blank" id="gpaint-link">Create a Custom Track</a>
        <p id="gpaint-citation">Citation: Zhou et. al. Cancer Cell, in press</p>`)

	return gpaint_card_div
}

//Creates the outer Other App column
function make_otherapp_col(div) {
	const otherAppsCol = div.append('div')
	otherAppsCol
		.style('grid-area', 'otherapps')
		.property('position', 'relative')
		.style('background-color', 'white')
		.style('border-radius', '20px')

	make_otherapp_header(otherAppsCol)

	return otherAppsCol
}

function make_otherapp_header(div) {
	const otherAppHeader = div.append('div')
	otherAppHeader
		.append('div')
		.style('padding', '10px')
		.style('margin', '10px')
		.style('color', 'white')
		.style('font-family', 'Verdana, Geneva, Tahoma, sans-serif')
		.style('font-size', '20px')
		.style('font-weight', '525')
		.style('letter-spacing', '2px')
		.style('text-align', 'center')
		.style('background', 'radial-gradient( #1b2646, #324870)')
		.style('border-radius', '4px')
		.text('Other Apps')

	return otherAppHeader
}

async function loadJson() {
	const json = dofetch2('examples', { method: 'POST', body: JSON.stringify({ getexamplejson: true }) })
	return json
}

async function loadTracks(args) {
	try {
		displayBrowserTracks(args.tracks, args.browserList)
		displayExperimentalTracks(args.tracks, args.experimentalList)
		displayAppTracks(args.tracks, args.appList)
	} catch (err) {
		console.error(err)
	}
}

function displayBrowserTracks(tracks, holder) {
	const htmlString = tracks
		.map(track => {
			const app = `${track.app}`
			const subheading = `${track.subheading}`
			if (app == 'Genome Browser' && subheading == 'Tracks') {
				return `
                <li class="track">
                <h6>${track.name}</h6>
                ${track.blurb ? `<p id="track-blurb">${track.blurb}</p>` : ''}
                ${
									track.buttons.example
										? `<a class="track-image" href="${track.buttons.example}" target="_blank"><img src="${track.image}"></img></a>`
										: `<span class="track-image"><img src="${track.image}"></img></span>`
								}
                <div class="track-btns">
                ${
									track.buttons.example
										? `<a id="example-url" href="${track.buttons.example}" target="_blank">Example</a>`
										: ''
								}
                ${
									track.buttons.url
										? `<a class="url-tooltip-outer" id="url-url" href="${track.buttons.url}" target="_blank">URL<span class="url-tooltip-span">View a parameterized URL example of this track</span></a>`
										: ''
								}
                ${track.buttons.doc ? `<a id="doc-url" href="${track.buttons.doc}" target="_blank">Docs</a>` : ''}
                </div>
                </li>`
			}
		})
		.join('')

	holder.html(htmlString)
}

function displayExperimentalTracks(tracks, holder) {
	const htmlString = tracks
		.map(track => {
			const app = `${track.app}`
			const subheading = `${track.subheading}`
			if (app == 'Genome Browser' && subheading == 'Experimental Tracks') {
				return `
                <li class="track">
                <h6>${track.name}</h6>
                ${track.blurb ? `<p id="track-blurb">${track.blurb}</p>` : ''}
                ${
									track.buttons.example
										? `<a class="track-image" href="${track.buttons.example}" target="_blank"><img src="${track.image}"></img></a>`
										: `<span class="track-image"><img src="${track.image}"></img></span>`
								}
                <div class="track-btns">
                ${
									track.buttons.example
										? `<a id="example-url" href="${track.buttons.example}" target="_blank">Example</a>`
										: ''
								}
                ${
									track.buttons.url
										? `<a class="url-tooltip-outer" id="url-url" href="${track.buttons.url}" target="_blank">URL<span class="url-tooltip-span">View a parameterized URL example of this track</span></a>`
										: ''
								}
                ${track.buttons.doc ? `<a id="doc-url" href="${track.buttons.doc}" target="_blank">Docs</a>` : ''}
                </div>
                </li>`
			}
		})
		.join('')
	holder.html(htmlString)
}

function displayAppTracks(tracks, holder) {
	const htmlString = tracks
		.map(track => {
			const app = `${track.app}`
			const subheading = `${track.subheading}`
			if (app == 'Other Apps' && subheading == 'Tracks') {
				return `
                <li class="track">
                <h6>${track.name}</h6>
                ${track.blurb ? `<p id="track-blurb">${track.blurb}</p>` : ''}
                ${
									track.buttons.example
										? `<a class="track-image" href="${track.buttons.example}" target="_blank"><img src="${track.image}"></img></a>`
										: `<span class="track-image"><img src="${track.image}"></img></span>`
								}
                <div class="track-btns">
                ${
									track.buttons.example
										? `<a id="example-url" href="${track.buttons.example}" target="_blank">Example</a>`
										: ''
								}
                ${
									track.buttons.url
										? `<a class="url-tooltip-outer" id="url-url" href="${track.buttons.url}" target="_blank">URL<span class="url-tooltip-span">View a parameterized URL example of this track</span></a>`
										: ''
								}
                ${track.buttons.doc ? `<a id="doc-url" href="${track.buttons.doc}" target="_blank">Docs</a>` : ''}
                </div>
                </li>`
			}
		})
		.join('')
	holder.html(htmlString)
}
