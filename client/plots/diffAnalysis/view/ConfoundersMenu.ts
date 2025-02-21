import { termsettingInit } from '#termsetting'

export function confoundersMenu(tip: any, interactions: any) {
	const holder = tip.d.append('div').style('padding', '10px')
	addConfounderLine('Confounder 1', holder)
	addConfounderLine('Confounder 2', holder)

	// tip.hide()
}

function addConfounderLine(text, div) {}
