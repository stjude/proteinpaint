import { dofetch, dofetch2, dofetch3, sayerror, tab_wait, appear } from '#src/client'
import { newSandboxDiv } from '#dom/sandbox'
import * as utils from './utils'
import { event, select, selectAll } from 'd3-selection'
// import { addGeneSearchbox } from '#dom/genesearch'
// import { Menu } from '#dom/menu'
// import { debounce } from 'debounce'

// js-only syntax highlighting for smallest bundle, see https://highlightjs.org/usage/
// also works in rollup and not just webpack, without having to use named imports
// import hljs from 'highlight.js/lib/core'
// import javascript from 'highlight.js/lib/languages/javascript'
// hljs.registerLanguage('javascript', javascript)
// import json from 'highlight.js/lib/languages/json'
// import { defaultcolor } from '../shared/common'
// hljs.registerLanguage('json', json)

export async function openSandbox(element, holder) {
	const res = element.sandboxJson
		? await dofetch3(`/cardsjson?jsonfile=${element.sandboxJson}`)
		: await dofetch3(`/cardsjson?file=${element.sandboxHtml}`)
	if (res.error) {
		sayerror(holder.append('div'), res.error)
		return
	}

	const sandboxDiv = newSandboxDiv(holder)
	sandboxDiv.header_row
	sandboxDiv.header.text(element.name)
	sandboxDiv.body.style('overflow', 'hidden')

	if (element.type == 'card' && element.sandboxJson) openCardSandbox(element, res, sandboxDiv)
}

function openCardSandbox(card, res, sandboxDiv) {
	const sandboxArgs = {
		intro: res.jsonfile.intro, //TODO change key to mainIntroduction
		ppcalls: res.jsonfile.ppcalls,
		buttons: res.jsonfile.buttons,
		arrowButtons: res.jsonfile.arrowButtons,
		update_message: res.jsonfile.update_message, //TODO change key to flagMessage
		citation: res.jsonfile.citation_id
	}

	// Main intro text above tabs - use for permanent text
	addHtmlText(sandboxArgs.intro, sandboxDiv.body)
	// Temporary text expiring with flags
	addHtmlText(sandboxArgs.update_message, sandboxDiv.body, card.flag)

	const mainButtonsDiv = sandboxDiv.body.append('div')
	const mainButtonsContentDiv = sandboxDiv.body.append('div')

	addButtons(sandboxArgs.buttons, mainButtonsDiv)
	//addArrowButtons() TODO, remove type argument
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
					const examplesOnly = ppcalls.filter(p => p.is_ui != true) //Fix to rm UIs from Examples tab
					// makeLeftsideTabMenu(ppcalls, div, examplesOnly)
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
			const sandboxButton = utils.makeButton(div, button.name)
			sandboxButton.on('click', () => {
				event.stopPropagation()
				if (button.download) window.open(`${button.download}`, '_self', 'download')
				else window.open(`${button.link}`, `${button.name}`)
			})
		})
	}
}

// ******* App Drawer Specific Helper Functions *********

function showURLLaunch(urlparam, div, section) {
	if (urlparam) {
		const URLbtn = utils.makeButton(div, section == 'apps' ? 'Run app from URL' : 'Run track from URL')
		URLbtn.on('click', () => {
			event.stopPropagation()
			window.open(`${urlparam}`, '_blank')
		})
	}
}

function makeDataDownload(download, div, section) {
	if (download) {
		const dataBtn = utils.makeButton(div, section == 'apps' ? 'Download App File(s)' : 'Download Track File(s)')
		dataBtn.on('click', () => {
			event.stopPropagation()
			window.open(`${download}`, '_self', 'download')
		})
	}
}
