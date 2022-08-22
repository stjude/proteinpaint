import { dofetch, dofetch3, sayerror, tab_wait, appear } from '#src/client'
import { newSandboxDiv } from '#dom/sandbox'
import * as utils from './utils'
import { event } from 'd3-selection'
import { addGeneSearchbox } from '#dom/genesearch'
import { Menu } from '#dom/menu'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
hljs.registerLanguage('javascript', javascript)
import json from 'highlight.js/lib/languages/json'
hljs.registerLanguage('json', json)

export async function openSandbox(element, pageArgs) {
	const sandboxDiv = newSandboxDiv(pageArgs.apps_sandbox_div)
	sandboxDiv.header_row
	sandboxDiv.header.text(element.name)
	sandboxDiv.body.style('overflow', 'hidden').style('background-color', 'white')

	if (element.type == 'nestedCard') return openNestedCardSandbox(element, sandboxDiv)

	const res = element.sandboxJson
		? await dofetch3(`/cardsjson?jsonfile=${element.sandboxJson}`)
		: await dofetch3(`/cardsjson?file=${element.sandboxHtml}`)
	if (res.error) {
		sayerror(holder.append('div'), res.error)
		return
	}

	if (element.type == 'card') return openCardSandbox(element, res, sandboxDiv) //only for .sandboxJson
	if (element.type == 'dsButton') return openDatasetSandbox(pageArgs, element, res, sandboxDiv) //only for .sandboxJson
}

/********** Nested Card Functions  **********/

function openNestedCardSandbox(nestedCard, sandboxDiv) {
	sandboxDiv.body.style('justify-content', 'center').style('background-color', '#f2ebdc')

	const ucList = sandboxDiv.body
		.append('ul')
		.style('list-style', 'none')
		.style('display', 'grid')
		.style('grid-template-columns', '40vw 40vw')
		.style('grid-template-rows', 'repeat(1, auto)')
		.style('gap', '5px')

	const ucContent = sandboxDiv.body.append('div').style('padding', '0vw 0vw 2vw 0vw')

	function displayUseCases(nestedCard, listDiv, contentDiv) {
		//joins together all the use cases objects from index.json and displays them as cards in a newly created sandbox.
		nestedCard.children.forEach(child => {
			const uc = listDiv.append('li')
			uc.attr('class', 'sjpp-app-drawer-card')
				.style('padding', '10px')
				.style('margin', '5px')
				.html(
					`<p style="margin-left: 12px; font-size:14.5px;font-weight:500; display: block;">${child.name}</p>
				<p style="display: block; font-size: 13px; font-weight: 300; margin-left: 20px; justify-content: center; font-style:oblique; color: #403f3f;">${child.description}</p>`
				)
				.on('click', () => {
					event.stopPropagation()
					listDiv.selectAll('*').remove()
					showUseCaseContent(child, contentDiv)
				})
			return JSON.stringify(uc)
		})
	}

	displayUseCases(nestedCard, ucList, ucContent)

	async function showUseCaseContent(child, div) {
		//Fetches html from use case .txt file, applies a 'back' button at the top, and renders to client
		const res = await dofetch3(`/cardsjson?file=${child.sandboxHtml}`) //only HTML files enabled at the moment
		if (res.error) {
			sayerror(holder.append('div'), res.error)
			return
		}

		const content_div = div
			.append('div')
			.style('background-color', 'white')
			.style('margin', '0vw 10vw')
			.style('padding', '10px')

		const backBtn = utils.makeButton({ div: content_div, text: '<' }).style('background-color', '#d0e3ff')
		backBtn.style('font-size', '20px').on('click', () => {
			div.selectAll('*').remove()
			displayUseCases(nestedCard, ucList, ucContent)
		})

		content_div
			.append('div')
			.style('margin', '0vw 5vw')
			.html(res.file)
	}
}

/********** Card Functions  **********/

function openCardSandbox(card, res, sandboxDiv) {
	const sandboxArgs = {
		intro: res.jsonfile.intro, //TODO change key to mainIntroduction
		ppcalls: res.jsonfile.ppcalls,
		buttons: res.jsonfile.buttons,
		arrowButtons: res.jsonfile.arrowButtons,
		ribbonMessage: res.jsonfile.ribbonMessage,
		citation: res.jsonfile.citation_id
	}

	// Main intro text above tabs - use for permanent text
	addHtmlText(sandboxArgs.intro, sandboxDiv.body)
	// Temporary text expiring with flags
	if (card.flag) addHtmlText(sandboxArgs.ribbonMessage, sandboxDiv.body, card.flag)

	const mainButtonsDiv = sandboxDiv.body.append('div')
	const mainButtonsContentDiv = sandboxDiv.body.append('div')

	addButtons(sandboxArgs.buttons, mainButtonsDiv)
	addArrowBtns(sandboxArgs, 'main', mainButtonsDiv, mainButtonsContentDiv)
	if (card.disableTopTabs) renderContent(sandboxArgs.ppcalls[0], sandboxDiv.body, card)
	else {
		const topTabsDiv = sandboxDiv.body
			.append('div')
			.style('display', 'flex')
			.style('align-content', 'end')
			.style('justify-content', 'center')
			.style('border', 'none')
			.style('border-bottom', '1px solid lightgray')
			.style('width', '100%')
		const tabsContentDiv = sandboxDiv.body.append('div')

		makeParentTabsMenu(sandboxArgs.ppcalls, card, topTabsDiv, tabsContentDiv)
	}
}

function renderContent(ppcalls, div, card) {
	addHtmlText(ppcalls.message, div)

	const buttonsDiv = div.append('div').style('margin-bottom', '20px')
	const buttonsContentDiv = div.append('div')

	addButtons(ppcalls.buttons, buttonsDiv)
	//Proteinpaint app drawer specific rendering
	makeDataDownload(ppcalls.download, buttonsDiv, card.section)
	showURLLaunch(ppcalls.urlparam, buttonsDiv, card.section)
	addArrowBtns(ppcalls, 'call', buttonsDiv, buttonsContentDiv)

	if (!card.disableTopTabs) {
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

function makeTopTabs(ppcalls, card) {
	const tabs = []
	const ui = ppcalls.findIndex(t => t.isUi == true)
	const notui = ppcalls.findIndex(t => t.isUi == (false || undefined))
	const uiPresent = ui != -1 ? true : false
	if (uiPresent == true) {
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

					const callpp = JSON.parse(JSON.stringify(ppcalls[ui].runargs))

					runproteinpaint(Object.assign(runpp_arg, callpp))
				} catch (e) {
					alert('Error: ' + (e.message || e))
				}
			}
		})
	}
	if ((ppcalls.length == 1 && uiPresent != true) || (ppcalls.length == 2 && uiPresent == true)) {
		tabs.push({
			name: 'Example',
			active: false,
			callback: async div => {
				try {
					renderContent(ppcalls[notui], div, card)
				} catch (e) {
					alert('Error: ' + (e.message || e))
				}
			}
		})
	}
	if ((ppcalls.length > 1 && uiPresent == false) || (ppcalls.length > 2 && uiPresent == true)) {
		tabs.push({
			name: 'Examples',
			active: false,
			callback: async div => {
				try {
					const examplesOnly = ppcalls.filter(p => p.isUi != true) //Fix to rm UIs from Examples tab
					makeLeftsideTabMenu(card, div, examplesOnly)
				} catch (e) {
					alert('Error: ' + (e.message || e))
				}
			}
		})
	}
	return tabs
}
//Creates the main tab menu over the examples and/or app uis
function makeParentTabsMenu(ppcalls, card, tabsDiv, contentDiv) {
	const tabs = makeTopTabs(ppcalls, card)

	for (const tab of tabs) {
		tabs[0].active = true

		tab.tab = tabsDiv
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

		tab.content = contentDiv.append('div').style('display', tab.active ? 'block' : 'none')

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

async function makeLeftsideTabMenu(card, div, examplesOnly) {
	const tabs = examplesOnly.map((p, index) => getTabData(p, index, card.section))

	const menuWrapper = div.append('div').classed('sjpp-vertical-tab-menu', true)
	const tabsDiv = menuWrapper
		.append('div')
		.classed('sjpp-tabs-div', true)
		.style('min-width', '150px') //Fixes the unsightly problem of tabs dramatically changing size on click.
	const tabsContentDiv = menuWrapper.append('div').classed('sjpp-content-div', true)

	for (const tab of tabs) {
		tab.tab = tabsDiv
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

		tab.content = tabsContentDiv.append('div').style('display', tab.active ? 'block' : 'none')

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

// ******* Helper Functions *********

function addHtmlText(text, div, flag) {
	//Tie together flags and sandbox messages
	if (flag && flag.expireDate) {
		const today = new Date()
		const expire = new Date(flag.expireDate)
		if (expire > today && (text != undefined && text)) {
			function boldedText() {
				const str = flag.text.toLowerCase()
				return str[0].toUpperCase() + str.slice(1)
			}
			div
				.append('div')
				.style('margin', '20px')
				.html(`<p style="display:inline-block;font-weight:bold">${boldedText()}: &nbsp</p>${text}`)
		}
	} else if (text != undefined && text) {
		//For simple messages
		div
			.append('div')
			.style('margin', '20px')
			.html(text)
	}
}

function addButtons(buttons, div) {
	if (buttons) {
		buttons.forEach(button => {
			const sandboxButton = utils.makeButton({ div, text: button.name })
			sandboxButton.on('click', () => {
				event.stopPropagation()
				if (button.download) window.open(`${button.download}`, '_self', 'download')
				else window.open(`${button.link}`, `${button.name}`)
			})
		})
	}
}

function makeArrowButtons(arrows, btns) {
	if (arrows) {
		arrows.forEach(arrow => {
			const contents = `<div style="margin:10px;" class="sjpp-arrow-content">
				${arrow.message ? `<div style="margin: 1vw;">${arrow.message}</div>` : ''}
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

async function addArrowBtns(args, type, bdiv, rdiv) {
	//Creates arrow buttons from every .arrowButtons object as well as `Code`, `View Data`, and `Citation`.
	let btns = []
	if (type == 'call') showCode(args, btns) //Only show Code for examples, not in top div
	if (args.datapreview) showViewData(btns, args.datapreview)
	if (type == 'main' && args.citation) {
		//Only show citation in top div
		const res = await dofetch3('/cardsjson?jsonfile=citations')
		if (res.error) {
			console.log(`Error: ${res.error}`)
			return
		}
		const pubs = res.jsonfile.publications
		for (const pub of pubs) {
			if (args.citation == pub.id) showCitation(btns, pub)
		}
	}
	makeArrowButtons(args.arrowButtons, btns)

	const active_btn = btns.findIndex(b => b.active) == -1 ? false : true

	for (let i = 0; i < btns.length; i++) {
		const btn = btns[i]

		btn.btn = utils.makeButton({ div: bdiv, text: btn.name + ' ▼' })

		btn.c = rdiv
			.append('div')
			.style('margin', '20px 0px 10px 20px')
			.style('display', (active_btn && i == 0) || btn.active ? 'block' : 'none')

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

// ******* App Drawer Specific Helper Functions *********

function showURLLaunch(urlparam, div, section) {
	if (urlparam) {
		const URLbtn = utils.makeButton({ div, text: section == 'apps' ? 'Run app from URL' : 'Run track from URL' })
		URLbtn.on('click', () => {
			event.stopPropagation()
			window.open(`${urlparam}`, '_blank')
		})
	}
}

function makeDataDownload(download, div, section) {
	if (download) {
		const dataBtn = utils.makeButton({
			div,
			text: section == 'apps' ? 'Download App File(s)' : 'Download Track File(s)'
		})
		dataBtn.on('click', () => {
			event.stopPropagation()
			window.open(`${download}`, '_self', 'download')
		})
	}
}

async function showCode(ppcalls, btns) {
	//Push 'Code' and div callback to `btns`. Create button in addArrowButtons
	if (ppcalls.isUi == true) return

	//Leave the weird spacing below. Otherwise the lines won't display the same identation in the sandbox
	const runppCode = hljs.highlight(
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

	const runppContents = `<pre style="border: 1px solid #d7d7d9; align-items: center; justify-content: center; margin: 0px 10px 5px 30px; overflow:auto; max-height:400px; ${
		ppcalls.jsonpath ? `min-height:400px;` : `min-height: auto;`
	}">
	<code style="font-size:14px; display:block;">${runppCode}</code></pre>`

	btns.push({
		name: 'Code',
		callback: async rdiv => {
			try {
				if (ppcalls.jsonpath) {
					const includeJson = await showJsonCode(ppcalls)
					const runppHeader = "<p style='margin:20px 5px 20px 25px;'>ProteinPaint JS code</p>"
					const grid = rdiv
						.append('div')
						.style('display', 'grid')
						.style('grid-template-columns', 'repeat(auto-fit, minmax(100px, 1fr))')
						.style('gap', '5px')
					grid
						.append('div')
						.style('display', 'block')
						.html(runppHeader + runppContents)
					grid
						.append('div')
						.style('display', 'block')
						.html(includeJson)
				} else {
					rdiv.append('div').html(runppContents)
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
		<pre style="border: 1px solid #d7d7d9; align-items: center; justify-content: center; margin: 0px 10px 5px 10px; max-height:400px; min-height:400px; overflow:auto;">
			<code class="sjpp-json-code" style="font-size:14px; display:block;">${
				slicedjson == true
					? `${code} ...<br><p style='margin:20px 25px; justify-content:center;'>Showing first 100 lines. To see the entire JSON, download ${filename} from the button above.</p>`
					: `${code}`
			}
			</code>
		</pre>`

	return json_contents
}

function showCitation(btns, pub) {
	//Push 'Citation' and div callback to `btns`. Create button in addArrowButtons
	btns.push({
		name: 'Citation',
		callback: async rdiv => {
			try {
				rdiv
					.append('div')
					.style('margin-left', '5w')
					.html(
						`<p style="display: inline-block;">${pub.title}. <em>${pub.journal}</em>, ${pub.year}. </p>
						${
							pub.pmid
								? `<p style="display: inline-block;">PMID: <a href="${pub.pmidURL}" target="_blank">${pub.pmid}</a></p>`
								: `<p>doi: <a href="${pub.doi}" target="_blank style="display: inline-block;">${pub.doi}</a></p>`
						}`
					)
			} catch (e) {
				alert('Error: ' + e)
			}
		}
	})
}

function makeDataPreviewDiv(content, contLength, div, filename, message) {
	//Create collapsible div displaying, if available, HTML message, file name, and 10 lines of data
	div.append('div').html(`
		${message ? `<p style="display:block;">${message}<p>` : ''}
		<p style="display: inline-block;">Data preview <span style="color: #696969; font-style:oblique;"> 
		${contLength > 10 ? `(first ${content.length} rows of ${filename})</span></p>` : `(content of ${filename})</span></p>`} 
	`)
	const bedjContent_div = div
		.append('div')
		.style('display', 'grid')
		.style('grid-template-columns', '1fr')
		.style('max-width', '80%')
		.style('margin-left', '10px')
		.style('border', '1px solid rgb(227, 227, 230)')
		.style('white-space', 'pre')
		.style('overflow-x', 'scroll')
		.style('opacity', '0.65')
		.style('padding', '1vw')
	content.forEach(c => {
		bedjContent_div.append('code').html(c)
	})
}

async function showViewData(btns, data) {
	//Push 'View Data' and div callback to `btns`. Create button in addArrowButtons
	btns.push({
		name: 'View Data',
		callback: async rdiv => {
			try {
				for (const file of data) {
					const res = await dofetch3(`/cardsjson?datafile=${file.file}&tabixCoord=${file.tabixQueryCoord}`)
					if (res.error) {
						console.log(`Error: ${res.error}`)
						return
					}
					const returnedContent = res.file
					const contLength = returnedContent.length
					//Limit to only the first 10 rows
					const content = returnedContent.slice(0, 10)

					//Parse file path for file name to show above content
					const splitpath = file.file.split('/')
					const filename = splitpath[splitpath.length - 1]

					makeDataPreviewDiv(content, contLength, rdiv, filename, file.message)
				}
			} catch (e) {
				alert('Error: ' + e)
			}
		}
	})
}

/********** Dataset Button Functions  **********/

async function openDatasetSandbox(pageArgs, element, res, sandboxDiv) {
	const par = {
		// First genome in .availableGenomes is the default
		availableGenomes: res.jsonfile.button.availableGenomes,
		genome: pageArgs.genomes[res.jsonfile.button.availableGenomes[0]],
		intro: res.jsonfile.button.intro,
		name: res.jsonfile.button.name,
		runargs: res.jsonfile.button.runargs,
		searchBar: res.jsonfile.button.searchBar,
		dsURLparam: res.jsonfile.button.dsURLparam
	}

	const mainDiv = sandboxDiv.body
		// Intro, gene toggle, and gene search box
		.append('div')
		.style('padding', '1em')
		.style('border-bottom', '1px solid #d0e3ff')

	// Introduction div
	if (par.intro) {
		mainDiv
			.append('div')
			.style('line-height', '1.5em')
			.style('padding', '0.5em 0.5em 1em 0.5em')
			.html(par.intro)
	}

	if (par.searchBar == 'none') {
		// Call mass UI without search bar
		const runppArg = {
			holder: sandboxDiv.body
				.append('div')
				.style('margin', '20px')
				.style('overflow-x', 'auto')
				.node(),
			host: window.location.origin
		}

		const callpp = JSON.parse(JSON.stringify(par.runargs))

		runproteinpaint(Object.assign(runppArg, callpp))
		return
	}

	addDatasetGenomeBtns(mainDiv, par, pageArgs.genomes)
	// Create the gene search bar last (text flyout on keyup prevents placing elements to the right)
	const searchBarDiv = mainDiv
		.append('div')
		.style('display', 'inline-block')
		.style('padding', '0.5em')

	const allResultsDiv = sandboxDiv.body.append('div').style('max-width', '90vw')

	const coords = addGeneSearchbox({
		genome: par.genome,
		tip: new Menu({ padding: '' }),
		row: searchBarDiv.append('div'),
		row: mainDiv
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '0.5em'),
		geneOnly: par.searchBar == 'gene' ? true : false,
		focusOff: true,
		callback: async div => {
			//Creates search results as tracks, last to first
			const resultDiv = allResultsDiv
				.insert('div', ':first-child')
				.style('max-width', '90vw')
				.style('margin', '1vw')
			resultDiv
				// Destroy track on `x` button click
				.append('div')
				.style('display', 'inline-block')
				.style('cursor', 'default')
				.style('margin', '0px')
				.style('font-size', '1.5em')
				.html('&times;')
				.on('click', () => {
					// clear event handlers
					resultDiv.selectAll('*').remove()
					if (typeof close === 'function') close()
				})
			// Create 'Run Dataset from URL' btn specific to each applied search
			makeURLbutton(resultDiv, coords, par)
			// Render the search parameters as a track
			const runppArg = {
				holder: resultDiv
					.append('div')
					.style('margin', '20px')
					.node(),
				host: window.location.origin,
				genome: par.genome.name
			}
			// Return only position or gene; avoid returning undefined values to runpp()
			par.runargs.block == true
				? (runppArg.position = `${coords.chr}:${coords.start}-${coords.stop}`) && (runppArg.nativetracks = 'Refgene')
				: (runppArg.gene = coords.geneSymbol)

			const callpp = JSON.parse(JSON.stringify(par.runargs))

			runproteinpaint(Object.assign(runppArg, callpp))
		}
	})
}

function addDatasetGenomeBtns(div, par, genomes) {
	// Dynamically creates genome marker or buttons
	div
		.append('div')
		.style('display', 'inline-block')
		.style('padding', '10px 0px 10px 10px')

	if (par.availableGenomes.length == 1) {
		// Show default genome as a non-functional button left of the search bar
		div
			.append('div')
			.style('padding', '8px')
			.style('color', '#a6a6a6')
			.style('border', '1px solid #a6a6a6')
			.style('display', 'inline-block')
			.style('width', 'auto')
			.style('height', 'auto')
			.style('cursor', 'not-allowed')
			.text(par.availableGenomes[0])
	} else {
		const btns = []

		par.availableGenomes.forEach(genome => {
			btns.push({
				name: genome,
				active: false,
				btn: utils.makeButton({ div, text: genome }),
				callback: par => {
					par.genome = genomes[genome]
				}
			})
		})

		for (const btn of btns) {
			btns[0].active = true

			btn.btn
				.style('margin', '0px')
				.style('color', btn.active ? 'white' : 'black')
				.style('background-color', btn.active ? '#0b5394ff' : '#bfbfbf')
				.style('border-radius', '0px')
				.style('cursor', 'pointer')

			if (btn.active) {
				btn.callback(par)
			}

			btn.btn.on('click', () => {
				for (const b of btns) {
					b.active = b === btn
					b.btn.style('color', b.active ? 'white' : 'black')
					b.btn.style('background-color', b.active ? '#0b5394ff' : '#bfbfbf')
				}
				if (btn.active) {
					btn.callback(par)
				}
			})
		}
	}
}

function makeURLbutton(div, coords, par) {
	const URLbtn = utils.makeButton({ div, text: 'Run Result from URL' })
	// Use position for genome browser and gene for protein view
	const blockOn =
		par.runargs.block == true ? `position=${coords.chr}:${coords.start}-${coords.stop}` : `gene=${coords.geneSymbol}`
	URLbtn.on('click', () => {
		event.stopPropagation()
		window.open(`?genome=${par.genome.name}&${blockOn}&${par.dsURLparam}`, '_blank')
	})
}
