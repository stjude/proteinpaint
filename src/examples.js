import { dofetch2 } from './client'
// import { check } from 'prettier'

export async function init_examples(par) {
	const { holder } = par
	const re = await dofetch2('examples', { method: 'POST', body: JSON.stringify({ getexamplejson: true }) })
	if (re.error) {
		holder.append('div').text(re.error)
		return
	}

	const wrapper_div = make_examples_page(holder)
	make_header(wrapper_div)
	make_intro(wrapper_div)
	const track_grid = make_main_track_grid(wrapper_div)
	const gbrowswer_col = make_gbrowser_col(track_grid)
	const otherapp_col = make_otherapp_col(track_grid)

	// tracks panel
	gbrowswer_col.append('h5').html('Tracks')
	const browserList = gbrowswer_col.append('ul').attr('class', 'track-list')

	// experimental tracks panel
	gbrowswer_col.append('h5').html('Experimental Tracks')
	const experimentalList = gbrowswer_col.append('ul').attr('class', 'track-list')

	// apps track panel
	// otherapp_col.append('h5').html('Other Apps')
	const appList = otherapp_col.append('ul').attr('class', 'track-list')

	const track_arg = {
		tracks: re.examples,
		browserList,
		experimentalList,
		appList
	}
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

function make_header(div) {
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

	const contact_btn = header_div.append('div')
	contact_btn
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

	const request_btn = header_div.append('div')
	request_btn
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
		.html('<a href="mailto:PPTeam@STJUDE.ORG" subject="Inquiry from ppr Examples Page">Contact Us</a>')

	const searchBar_div = header_div.append('div')
	searchBar_div.style('grid-area', 'searchBar').property('position', 'relative')
	make_searchbar(searchBar_div)

	return header_div
}

function make_searchbar(div) {
	const searchBar = div.append('div')
	searchBar
		.append('div')
		.append('input')
		.attr('type', 'text')
		.attr('size', 55)
		.attr('id', 'searchBar')
		.style('border-radius', '3px')
		.style('border', '1px solid #eaeaea')
		.style('padding', '5px 10px')
		.style('font-size', '12px')
		.property('placeholder', 'Search tracks or features')
		.on('keyup', async e => {
			const searchInput = e.target.value.toLowerCase()
			const filteredTracks = tracks.filter(track => {
				let searchTermFound = (track.searchterms || []).reduce((searchTermFound, searchTerm) => {
					if (searchTermFound) {
						return true
					}
					return searchTerm.toLowerCase().includes(searchInput)
				}, false)
				return searchTermFound || track.name.toLowerCase().includes(searchInput)
			})
			displayBrowserTracks(filteredTracks)
			displayExperimentalTracks(filteredTracks)
			displayAppTracks(filteredTracks)
		})
	return searchBar
}

function make_intro(div) {
	const intro_div = div.append('div')
	intro_div.append('div').style('padding', '10px')
	// .style('display', 'block')

	const intro_header = intro_div.append('div')
	intro_header
		.append('div')
		.style('margin', '10px')
		.style('font-family', 'Verdana, Geneva, Tahoma, sans-serif')
		.style('font-size', '20px')
		.style('text-align', 'center')
		.style('border-radius', '4px')
		.style('color', '#324870')
		.text('Welcome to our Examples Page!')
		.attr('class', 'intro_div')
	// .style('display', 'block')

	const lists = intro_div.append('div')
	// .style('display', 'block')
	lists.append('div').attr('class', 'intro_div').html(`
        <p>Please note the following:
            <ul>
                <li>To use your own files, you must have access to /research/rgs01/resgen/legacy/gb_customTracks/tp on the hpc. If you do not have access, click the button in the upper right-hand corner to request access in Service Now.</li>
                <li>Questions? Comments? Use the Contact Us button to email the ProteinPaint team.</li>
            </ul>
        </p>
        <p>Links:
            <ul>
                <li>Example: Opens a new tab of an embedded runproteinpaint() call in an html file.</li>
                <li>URL: Some tracks do not require creating a new html or json file. For these tracks, a parameterized URL accesses files from the hpc. The link opens a new tab with an example of a parameterized URL.</li>
                <li>Docs: Opens a new tab to the track's full documentation, such as: specifications and how to prepare data files for the tracks as well as the requirements for creating files for ProteinPaint. </li>
            </ul>
        </p>`)

	const showHideBtn = div.append('div')
	showHideBtn
		.append('button') //TODO renders but doesn't work
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

// function make_showHideBtn(div) {
// 	const showHideBtn = div.append('div')
// 	const intro = document.getElementsByClassName('intro_div')
// 	showHideBtn
// 		.append('button') //TODO renders but doesn't work
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
// 		.text('Show/Hide')
// 		.on('click', () => {
// 			if (intro.style('display') == 'none') {
// 				intro.style('display', 'block')
// 			} else {
// 				intro.style('display', 'none')
// 			}
//         })
//     return showHideBtn
// }

//Creates the two column outer grid
function make_main_track_grid(div) {
	const track_grid = div.append('div')
	track_grid
		.append('div')
		.style('display', 'grid')
		.style('grid-template-columns', 'repeat(auto-fit, minmax(425px, 1fr)')
		.style('grid-template-areas', '"gbrowser otherapps"')
		.style('gap', '10px')
		.style('background-color', 'white')
		.style('padding', '10px 20px')
		.style('text-align', 'left')
		.style('margin', '15px')

	return track_grid
}

function make_gbrowser_col(div) {
	const gBrowserCol = div.append('div')
	gBrowserCol
		.style('grid-area', 'gbrowser')
		.property('position', 'relative')
		.style('background-color', 'white')
		.style('border-radius', '20px')

	return gBrowserCol
}

function make_otherapp_col(div) {
	const otherAppsCol = div.append('div')
	otherAppsCol
		.style('grid-area', 'otherapps')
		.property('position', 'relative')
		.style('background-color', 'white')
		.style('border-radius', '20px')

	return otherAppsCol
}

/******Copied over js from here down - leave be until incorporated into working code*****/

// searchBar.addEventListener('keyup', (e) => {
// 	const searchInput = e.target.value.toLowerCase()
// 	const filteredTracks = tracks.filter(track => {
// 		let searchTermFound = (track.searchterms || []).reduce((searchTermFound, searchTerm) => {
// 			if (searchTermFound) {
// 				return true
// 			}
// 			return searchTerm.toLowerCase().includes(searchInput)
// 		}, false)
// 		return searchTermFound || track.name.toLowerCase().includes(searchInput)
// 	})
// 	displayBrowserTracks(filteredTracks)
// 	displayExperimentalTracks(filteredTracks)
// 	displayAppTracks(filteredTracks)
// })

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
