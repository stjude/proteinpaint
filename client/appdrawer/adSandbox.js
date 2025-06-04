import { dofetch, dofetch3, sayerror, tab_wait, appear } from '#src/client'
import { newSandboxDiv } from '../dom/sandbox.ts'
import * as utils from './utils'
import { addGeneSearchbox } from '../dom/genesearch.ts'
import { Menu } from '#dom/menu'
import { Tabs } from '../dom/toggleButtons'
import { BreadcrumbTrail } from '#dom/breadcrumbs'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
hljs.registerLanguage('javascript', javascript)
import json from 'highlight.js/lib/languages/json'
hljs.registerLanguage('json', json)

/*
---------Exported---------
openSandbox()

---------Internal---------
openNestedCardSandbox()
openCardSandbox()
openDatasetButtonSandbox()


TODOs: 
- ***Removed the nested card back button for now
- fix nestcard background not in margins when sandbox called from ?appcard=

*/

export async function openSandbox(element, pageArgs) {
	const sandboxDiv = newSandboxDiv(pageArgs.sandboxDiv)
	sandboxDiv.header_row
	sandboxDiv.header
		.append('span')
		.html(
			element.type != 'nestedCard'
				? `<a href="${sessionStorage.getItem('hostURL')}/?appcard=${element.sandboxJson || element.sandboxHtml}">${
						element.name
				  }</a>`
				: element.name
		)
	sandboxDiv.body.style('overflow', 'hidden').style('background-color', 'white')

	if (element.type == 'nestedCard') return openNestedCardSandbox(element, sandboxDiv, pageArgs)

	const res = element.sandboxJson
		? await dofetch3(`${pageArgs.app.cardsPath}/${element.sandboxJson}.json`)
		: await dofetch3(`${pageArgs.app.cardsPath}/${element.sandboxHtml}.txt`)

	if (res.error) {
		sayerror(sandboxDiv.body.insert('div', 'div'), res.error)
		return
	}

	if (element.type == 'card') return openCardSandbox(element, res, sandboxDiv, pageArgs)
	if (element.type == 'dsButton') return openDatasetButtonSandbox(element, pageArgs, res, sandboxDiv) //only for .sandboxJson
}

/********** Nested Card Functions  **********/

async function openNestedCardSandbox(nestedCard, sandboxDiv, pageArgs) {
	sandboxDiv.body.style('justify-content', 'center').style('background-color', '#f2ebdc')

	const ucList = sandboxDiv.body
		.append('ul')
		.style('list-style', 'none')
		.style('display', 'grid')
		.style('grid-template-columns', '40vw 40vw')
		.style('grid-template-rows', 'repeat(1, auto)')
		.style('gap', '5px')

	const filteredChildren = nestedCard.children.filter(e => !e.hidden)
	sandboxDiv.header.trail = new BreadcrumbTrail({
		holder: sandboxDiv.header,
		crumbs: filteredChildren
	})
	//joins together all the use cases objects from index.json and displays them as cards in a newly created sandbox.
	filteredChildren.forEach(child => {
		const uc = ucList.append('li')
		uc.attr('class', 'sjpp-app-drawer-card')
			.style('padding', '10px')
			.style('margin', '5px')
			.html(
				`<p style="margin-left: 12px; font-size:14.5px;font-weight:500; display: block;">${child.name}</p>
			<p style="display: block; font-size: 13px; font-weight: 300; margin-left: 20px; justify-content: center; font-style:oblique; color: #403f3f;">${child.description}</p>`
			)
			.on('click', async event => {
				event.stopPropagation()
				ucList.selectAll('*').remove()

				const res = child.sandboxJson
					? await dofetch3(`${pageArgs.app.cardsPath}/${child.sandboxJson}.json`)
					: await dofetch3(`${pageArgs.app.cardsPath}/${child.sandboxHtml}.txt`)

				if (res.error) {
					sayerror(sandboxDiv.body.insert('div', 'div'), res.error)
					return
				}

				if (child.type == 'card') {
					sandboxDiv.header.trail.main()
					openCardSandbox(child, res, sandboxDiv, pageArgs)
					const crumbIndex = filteredChildren.findIndex(c => c == child)
					sandboxDiv.header.trail.update(crumbIndex)
				}
				if (child.type == 'dsButton') return openDatasetButtonSandbox(child, pageArgs.app.opts, res, sandboxDiv)
			})
		return JSON.stringify(uc)
	})
}

/********** Card Functions  **********/

async function openCardSandbox(card, res, sandboxDiv, pageArgs) {
	//Handles html content from .txt file
	if (card.sandboxHtml) {
		const renderHtml = await res.text()
		return sandboxDiv.body
			.append('div')
			.style('padding', '0vw 0vw 2vw 0vw')
			.append('div')
			.style('background-color', 'white')
			.style('margin', '0vw 10vw')
			.style('padding', '10px')
			.append('div')
			.style('margin', '0vw 5vw')
			.html(renderHtml)
	}

	//Configures the sandbox per .sandboxJson
	sandboxDiv.body.style('background-color', 'white') //Quick fix for nested card tan background persisting

	const sandboxArgs = {
		intro: res.intro,
		ppcalls: res.ppcalls.filter(e => !e.hidden),
		buttons: res.buttons,
		arrowButtons: res.arrowButtons,
		ribbonMessage: res.ribbonMessage,
		citation: res.citation_id
	}

	// Main intro text above tabs - use for permanent text
	addHtmlText(sandboxArgs.intro, sandboxDiv.body)
	// Temporary text expiring with ribbons
	if (card.ribbon) addHtmlText(sandboxArgs.ribbonMessage, sandboxDiv.body, card.ribbon)

	const mainButtonsDiv = sandboxDiv.body.append('div')
	const mainButtonsContentDiv = sandboxDiv.body.append('div')

	addButtons(sandboxArgs.buttons, mainButtonsDiv)
	addArrowBtns(sandboxArgs, 'main', mainButtonsDiv, mainButtonsContentDiv, pageArgs)
	if (card.disableTopTabs) renderContent(sandboxArgs.ppcalls[0], sandboxDiv.body, card, pageArgs)
	else {
		const topTabsDiv = sandboxDiv.body
			.append('div')
			.style('display', 'flex')
			.style('align-content', 'end')
			.style('justify-content', 'center')
			.style('border', 'none')
			.style('border-bottom', '1px solid lightgray')
			.style('width', '100%')
			.style('font-size', '20px')
		const tabsContentDiv = sandboxDiv.body.append('div')

		makeParentTabsMenu(sandboxArgs.ppcalls, card, topTabsDiv, tabsContentDiv, sandboxDiv, pageArgs)
	}
}

function renderContent(ppcalls, div, card, pageArgs) {
	addHtmlText(ppcalls.message, div)

	const buttonsDiv = div.append('div').style('margin-bottom', '20px')
	const buttonsContentDiv = div.append('div')

	addButtons(ppcalls.buttons, buttonsDiv)
	//Proteinpaint app drawer specific rendering
	makeDataDownload(ppcalls.download, buttonsDiv, card.section)
	showURLLaunch(ppcalls.urlparam, buttonsDiv, card.section)
	addArrowBtns(ppcalls, 'call', buttonsDiv, buttonsContentDiv, pageArgs)

	if (!card.disableTopTabs) {
		div.append('hr').style('border', '0').style('border-top', '1px dashed #e3e3e6').style('width', '100%')
	}

	const runpp_arg = {
		holder: div.append('div').style('margin', '20px').node(),
		/* Do not use window.location.origin
		Will break the embedder (/genomes will be requested from https:/embedder.site.org/genomes, 
		for example). It's very rare for an embedder to want to show this default "portal" header 
		because external portals usually have their own headers, but it will affect simple html 
		pages that embed a runpp() call where the app header is not hidden. */
		host: ppcalls.runargs.host || sessionStorage.getItem('hostURL')
	}

	const callpp = JSON.parse(JSON.stringify(ppcalls.runargs))

	runproteinpaint(Object.assign(runpp_arg, callpp))
}

//********* Tab Menu Functions *********

function makeTopTabs(ppcalls, card, sandboxDiv, pageArgs) {
	const tabs = []
	const ui = ppcalls.findIndex(t => t.isUi == true)
	const notui = ppcalls.findIndex(t => t.isUi == (false || undefined))
	const uiPresent = ui != -1 ? true : false
	if (uiPresent == true) {
		tabs.push({
			label: 'Add Your Data',
			active: false,
			callback: async (event, tab) => {
				try {
					const runpp_arg = {
						holder: tab.contentHolder.append('div').style('margin', '20px').node(),
						sandbox_header: tab.contentHolder,
						host: sessionStorage.getItem('hostURL')
					}

					const callpp = JSON.parse(JSON.stringify(ppcalls[ui].runargs))

					runproteinpaint(Object.assign(runpp_arg, callpp))
					delete tab.callback
				} catch (e) {
					if (e.stack) console.error(e.stack)
					else throw e
				}
			}
		})
	}
	if ((ppcalls.length == 1 && uiPresent != true) || (ppcalls.length == 2 && uiPresent == true)) {
		tabs.push({
			label: 'Example',
			active: false,
			callback: async (event, tab) => {
				try {
					renderContent(ppcalls[notui], tab.contentHolder, card, pageArgs)
					delete tab.callback
				} catch (e) {
					if (e.stack) console.error(e.stack)
					else throw e
				}
			}
		})
	}
	if ((ppcalls.length > 1 && uiPresent == false) || (ppcalls.length > 2 && uiPresent == true)) {
		tabs.push({
			label: 'Examples',
			active: pageArgs?.example ? true : false,
			callback: async (event, tab) => {
				try {
					const examplesOnly = ppcalls.filter(p => p.isUi != true) //Fix to rm UIs from Examples tab
					makeLeftsideTabMenu(card, tab.contentHolder, examplesOnly, sandboxDiv, pageArgs)
					delete tab.callback
				} catch (e) {
					if (e.stack) console.error(e.stack)
					else throw e
				}
			}
		})
	}
	return tabs
}
//Creates the main tab menu over the examples and/or app uis
function makeParentTabsMenu(ppcalls, card, topTabsDiv, tabsContentDiv, sandboxDiv, pageArgs) {
	const tabs = makeTopTabs(ppcalls, card, sandboxDiv, pageArgs)
	new Tabs({ holder: topTabsDiv, contentHolder: tabsContentDiv, tabs }).main()
}

//Creates left side tabs when >1 example available
async function makeLeftsideTabMenu(card, contentHolder, examplesOnly, sandboxDiv, pageArgs) {
	const tabs = examplesOnly.map((p, index) => getTabData(p, index, card.section))

	sandboxDiv.header.trail = await new BreadcrumbTrail({
		holder: sandboxDiv.header,
		crumbs: tabs
	})

	function getTabData(ppcalls, i, section) {
		const active = pageArgs?.example ? pageArgs.example.toUpperCase() == ppcalls.label.toUpperCase() : i === 0
		return {
			active,
			inTrail: active,
			link: `${sessionStorage.getItem('hostURL')}/?appcard=${card.sandboxJson || card.sandboxHtml}&example=${
				ppcalls.label
			}`,
			label: ppcalls.label,
			callback: async (event, tab) => {
				const wait = tab_wait(tab.contentHolder)
				try {
					if (!tab.rendered) {
						appear(tab.contentHolder)
						renderContent(ppcalls, tab.contentHolder, section, pageArgs)
						wait.remove()
					}
					tab.rendered = true
					const crumbIndex = tabs.findIndex(t => t == tab)
					sandboxDiv.header.trail.update(crumbIndex)
					wait.remove()
				} catch (e) {
					wait.text('Error: ' + (e.message || e))
				}
			}
		}
	}

	sandboxDiv.header.trail.main()

	const wrapper = contentHolder
		.append('div')
		.style('display', 'grid')
		.style('grid-template-columns', 'minmax(min-content, 10vw) minmax(60vw, 1fr)')
		.classed('sjpp-vertical-tab-menu', true)
		.style('word-break', 'break-word')
	const tabsDiv = wrapper.append('div').classed('sjpp-tabs-div', true).style('border-right', '1px solid lightgray')
	// .style('min-width', '150px') //Fixes the unsightly problem of tabs dramatically changing size on click.
	const tabsContentDiv = wrapper.append('div').classed('sjpp-content-div', true)

	new Tabs({
		holder: tabsDiv,
		contentHolder: tabsContentDiv,
		tabs,
		linePosition: 'right',
		tabsPosition: 'vertical',
		gap: '10px'
	}).main()
}

// ******* Helper Functions *********

function addHtmlText(text, div, ribbon) {
	//Tie together ribbons and sandbox messages
	if (ribbon && ribbon.expireDate) {
		const today = new Date()
		const expire = new Date(ribbon.expireDate)
		if (expire > today && text != undefined && text) {
			function boldedText() {
				const str = ribbon.text.toLowerCase()
				return str[0].toUpperCase() + str.slice(1)
			}
			div
				.append('div')
				.style('margin', '20px')
				.html(`<p style="display:inline-block;font-weight:bold">${boldedText()}: &nbsp</p>${text}`)
		}
	} else if (text != undefined && text) {
		//For simple messages
		div.append('div').style('margin', '20px').html(text)
	}
}

function addButtons(buttons, div) {
	if (buttons) {
		buttons.forEach(button => {
			const sandboxButton = utils.makeButton({ div, text: button.name })
			sandboxButton.on('click', event => {
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

async function addArrowBtns(args, type, bdiv, rdiv, pageArgs) {
	//Creates arrow buttons from every .arrowButtons object as well as `Code`, `View Data`, and `Citation`.
	let btns = []
	if (type == 'call') showCode(args, btns) //Only show Code for examples, not in top div
	const genome = args?.runargs?.genome
	if (args.datapreview && genome) showViewData(btns, args.datapreview, genome)
	if (args.citation || args.data_source) {
		//Show citation for the entire card
		//Or data_source for individual examples
		const res = await dofetch3(`/${pageArgs.app.cardsPath}/citations.json`)
		if (res.error) {
			console.error(`Error: ${res.error}`)
			return
		}
		for (const pub of res.publications) {
			if (args.citation == pub.id || args.data_source == pub.id) {
				const label = args.data_source ? 'Data Source' : 'Citation'
				showCitation(btns, pub, label)
			}
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
	if (!urlparam) return
	const URLbtn = utils.makeButton({ div, text: section == 'apps' ? 'Run app from URL' : 'Run track from URL' })
	URLbtn.on('click', event => {
		const hostURL = getHostURL()
		event.stopPropagation()
		window.open(`${hostURL}${urlparam}`, '_blank')
	})
}

function makeDataDownload(download, div, section) {
	if (!download) return
	const dataBtn = utils.makeButton({
		div,
		text: section == 'apps' ? 'Download App File(s)' : 'Download Track File(s)'
	})
	dataBtn.on('click', event => {
		event.stopPropagation()
		window.open(`${download}`, '_self', 'download')
	})
}

async function showCode(ppcalls, btns) {
	//Push 'Code' and div callback to `btns`. Create button in addArrowButtons
	if (ppcalls.isUi == true) return

	//Leave the weird spacing below. Otherwise the lines won't display the same identation in the sandbox
	const runppCode = hljs.highlight(
		`runproteinpaint({
    host: "${sessionStorage.getItem('hostURL')}",
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
					grid.append('div').style('display', 'block').html(includeJson)
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

function showCitation(btns, pub, label) {
	//Push 'Citation' or 'Data Source' button and div callback to `btns`. Create button in addArrowButtons
	btns.push({
		name: label,
		callback: async rdiv => {
			try {
				rdiv
					.append('div')
					.style('margin-left', '5w')
					.html(
						`<span style="display: inline-block;">${pub.title}. <em>${pub.journal}</em>, ${pub.year}.
						${
							pub.pmid
								? ` PMID: <a href="${pub.pmidURL}" target="${pub.pmid}">${pub.pmid}</a>`
								: ` doi: <a href="${pub.doi}" target="${pub.doi}">${pub.doi}</a>`
						}</span>`
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

async function showViewData(btns, data, genome) {
	// Push 'View Data' and div callback to `btns`.
	// Create button in addArrowButtons
	btns.push({
		name: 'View Data',
		callback: async rdiv => {
			try {
				for (const file of data) {
					//Genome arg required for validation check
					const res = await dofetch3(
						`/cardsjson?datafile=${file.file}&genome=${genome}&tabixCoord=${file.tabixQueryCoord}`
					)
					if (res.error) {
						console.error(`Error: ${res.error}`)
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

async function openDatasetButtonSandbox(elem, pageArgs, res, sandboxDiv) {
	if (elem.sandboxHtml) {
		const renderHtml = await res.text()
		return sandboxDiv.body
			.append('div')
			.style('line-height', '1.5em')
			.style('padding', '1.5em 1.5em 2em 1.5em')
			.html(renderHtml)
	}

	const genome = pageArgs?.fromApp
		? pageArgs.genomes[res.button.availableGenomes[0]]
		: pageArgs.app.opts.genomes[res.button.availableGenomes[0]]

	let genomes
	if (res.button.runargs.host) {
		genomes = await getGenomes(res.button.runargs.host)
	} else genomes = pageArgs?.fromApp ? pageArgs.genomes : pageArgs.app.opts.genomes

	const par = {
		// First genome in .availableGenomes is the default
		availableGenomes: res.button.availableGenomes,
		genome,
		intro: res.button.intro,
		name: res.button.name,
		runargs: res.button.runargs,
		searchBar: res.button.searchBar,
		dsURLparam: res.button.dsURLparam,
		citation: res.citation_id
	}

	const mainDiv = sandboxDiv.body
		// Intro, gene toggle, and gene search box
		.append('div')
		.style('padding', '1em')
		.style('border-bottom', '1px solid #d0e3ff')

	//Add arrow button for citation
	if (par.citation) {
		const buttonsDiv = mainDiv.append('div').style('margin-bottom', '20px')
		const buttonsContentDiv = mainDiv.append('div')
		await addArrowBtns(par, 'main', buttonsDiv, buttonsContentDiv, pageArgs)
	}

	// Introduction div
	if (par.intro) {
		mainDiv.append('div').style('line-height', '1.5em').style('padding', '0.5em 0.5em 1em 0.5em').html(par.intro)
	}

	if (par.searchBar == 'none') {
		//save to reset the hostURL if changes after runpp()
		const originalURL = sessionStorage.getItem('hostURL')
		// Call mass UI without search bar
		const runppArg = {
			holder: sandboxDiv.body.append('div').style('margin', '20px').style('overflow-x', 'auto').node(),
			host: par.runargs.host || originalURL
		}

		const callpp = JSON.parse(JSON.stringify(par.runargs))

		await runproteinpaint(Object.assign(runppArg, callpp))
		//Reset the host if changed
		if (originalURL != sessionStorage.getItem('hostURL')) sessionStorage.setItem('hostURL', originalURL)

		return
	}

	if (par.availableGenomes.length > 1) addDatasetGenomeBtns(mainDiv, genomes)
	else {
		//Show the default genome to the left of the search bar
		mainDiv
			.append('div')
			.style('display', 'inline-block')
			// .style('padding', '0.5em')
			.style('margin-left', '20px')
			.style('color', 'rgb(117, 115, 115)')
			.text(par.availableGenomes[0])
	}
	// Create the gene search bar last (text flyout on keyup prevents placing elements to the right)
	const searchBarDiv = mainDiv.append('div').style('display', 'inline-block').style('padding', '0.5em')

	const allResultsDiv = sandboxDiv.body.append('div').style('max-width', '90vw')

	const coords = addGeneSearchbox({
		genome: par.genome,
		tip: new Menu({ padding: '' }),
		row: searchBarDiv,
		searchOnly: par.searchBar == 'gene' ? 'gene' : '',
		focusOff: true,
		callback: async div => {
			//Creates search results as tracks, last to first
			const resultDiv = allResultsDiv.insert('div', ':first-child').style('max-width', '90vw').style('margin', '1vw')
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
					//Closes the whole window
					// if (typeof close === 'function') close()
				})
			// Create 'Run Dataset from URL' btn specific to each applied search
			makeURLbutton(resultDiv, coords, par)
			// Render the search parameters as a track
			const runppArg = {
				holder: resultDiv.append('div').style('margin', '20px').node(),
				host: sessionStorage.getItem('hostURL'),
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

	function addDatasetGenomeBtns(div, genomes) {
		div.append('div').style('display', 'inline-block').style('padding', '10px 10px 0px 20px')
		const btns = []
		// if (par.availableGenomes.length == 1) {
		// 	// Show default genome as a non-functional button left of the search bar
		// 	btns.push({
		// 		label: par.availableGenomes[0],
		// 		disabled: () => true,
		// 		isVisible: () => true
		// 	})
		// } else {
		par.availableGenomes.forEach(genome => {
			btns.push({
				label: genome,
				callback: (event, tab) => {
					par.genome = genomes[genome]
				}
			})
		})
		// }
		new Tabs({ holder: div, tabs: btns, noContent: true }).main()
	}
}

function makeURLbutton(div, coords, par) {
	const URLbtn = utils.makeButton({ div, text: 'Run Result from URL' })
	// Use position for genome browser and gene for protein view
	const blockOn =
		par.runargs.block == true ? `position=${coords.chr}:${coords.start}-${coords.stop}` : `gene=${coords.geneSymbol}`
	URLbtn.on('click', event => {
		event.stopPropagation()
		const hostURL = getHostURL()
		window.open(`${hostURL}/?genome=${par.genome.name}&${blockOn}&${par.dsURLparam}`, '_blank')
	})
}

function getHostURL() {
	/*
	 - Genomes, datasets, etc. are different on internal and external proteinpaint servers
	but consistent on external servers (e.g. vizcom, embedded sites). 
	 - Return the domain for dev and SJ servers. All other sites, query against proteinpaint.stjude.org
	*/
	const hostURL = sessionStorage.getItem('hostURL')
	if (hostURL.startsWith('http://localhost') || hostURL.startsWith('https://pp')) {
		return hostURL
	} else return 'https://proteinpaint.stjude.org'
}

async function getGenomes(host) {
	//Get genomes from a specified host if it's different than the embedder.
	const genomeURL = `${host}/genomes?embedder=${sessionStorage.getItem('hostURL').replace(/^https?:\/\//, '')}`
	try {
		const response = await fetch(genomeURL)
		if (!response.ok) throw new Error(`HTTP Response error for genomes url ${response.status}`)
		const data = await response.json()
		return data
	} catch (e) {
		console.error(`Error fetching genomes: ${e} from ${genomeURL}`)
		return null
	}
}
