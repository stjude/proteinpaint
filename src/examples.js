import dofetch2 from './client'

export async function init_examples(par) {
	const { holder } = par
	{
		const re = await dofetch2('examples', { method: 'POST', body: '{}' })
		if (re.error) {
			holder.append('div').text(re.error)
			return
		}
	}
	const [wrapper_div] = make_examples_page(holder)
	make_header(wrapper_div)
	make_intro(wrapper_div)
	make_main_grid(wrapper_div)
}

function make_examples_page(holder) {
	const wrapper_div = holder.append('div')
	wrapper_div.append('div')
	return wrapper_div
}

function make_header(div) {
	const header_div = div.append('div')
	header_div
		.append('div')
		.style('padding', '10px')
		.style('margin', '0px')
		.style('background-image', 'linear-gradient(to bottom right, #1b2646, #324870)')
		.style('display', 'grid')
		.style('grid-template-columns', '3fr 1fr 1fr')
		.style('grid-template-areas', '"htext contact-button request-button" "htext searchbar searchbar"')
		.style('gap', '20px')

	const htext = header_div.append('div')
	htext
		.append('div')
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
		.append('div')
		.style('grid-area', 'contact-button')
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
		.html(
			'<a href="https://stjude.service-now.com/sn_portal" target="_blank"<button>Request hpc:~/tp Access</button></a>'
		)

	const request_btn = header_div.append('div')
	request_btn
		.append('div')
		.style('grid-area', 'request-button')
		.style('font-family', 'Verdana, Geneva, Tahoma, sans-serif')
		.style('font-size', '14px')
		.style('height', '30px')
		.style('width', '220px')
		.style('text-align', 'center')
		.style('background-color', '#e6e7eb')
		.style('border-radius', '8px')
		.style('border', '1px solid black')
		.style('margin', '10px')
		.html('<a href="mailto:PPTeam@STJUDE.ORG" subject="Inquiry from ppr Examples Page"><button>Contact Us</button></a>')

	const searchBar = header_div.append('div')
	searchBar
		.append('div')
		.append('input')
		.attr('type', 'text')
		.property('position', 'relative')
		.style('grid-area', 'searchbar')
		.style('height', '24px')
		.style('width', '500px')
		.style('border-radius', '3px')
		.style('border', '1px solid #eaeaea')
		.style('padding', '5px 10px')
		.style('font-size', '12px')
		.property('placeholder', 'Search tracks or features')
}

function make_intro(div) {
	const intro = div.append('div')
	intro.append('div')
}

function make_main_grid(div) {}

const link1List = document.getElementById('browserList')
const experimentalList = document.getElementById('experimentalList')
const appList = document.getElementById('appList')
const searchBar = document.getElementById('searchBar')
let trackInfo = []

searchBar.addEventListener('keyup', e => {
	const searchInput = e.target.value.toLowerCase()
	const filteredTracks = trackInfo.filter(track => {
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

async function loadTracks() {
	try {
		const res = await fetch('https://ppr.stjude.org/examples/feature.json')
		trackInfo = await res.json()
		displayBrowserTracks(trackInfo)
		displayExperimentalTracks(trackInfo)
		displayAppTracks(trackInfo)
	} catch (err) {
		console.error(err)
	}
}

function displayBrowserTracks(tracks) {
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
	link1List.innerHTML = htmlString
}

function displayExperimentalTracks(tracks) {
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
								}                ${
					track.buttons.doc ? `<a id="doc-url" href="${track.buttons.doc}" target="_blank">Docs</a>` : ''
				}
                </div>
                </li>`
			}
		})
		.join('')
	experimentalList.innerHTML = htmlString
}

function displayAppTracks(tracks) {
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
								}                ${
					track.buttons.doc ? `<a id="doc-url" href="${track.buttons.doc}" target="_blank">Docs</a>` : ''
				}
                </div>
                </li>`
			}
		})
		.join('')
	appList.innerHTML = htmlString
}

loadTracks()

function collapseContent() {
	const intro = document.getElementById('intro-div')
	if (intro.style.display === 'none') {
		intro.style.display = 'block'
	} else {
		intro.style.display = 'none'
	}
}
