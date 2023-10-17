import { dofetch3 } from '#common/dofetch'
import { openSandbox } from '../appdrawer/adSandbox'

//TODO: eventually move all functions involving input here

export async function findAppDrawerElements(app, input, data, tip) {
	const re = await dofetch3(app.cardsPath + '/index.json')
	if (re.error) throw `Problem retrieving cards index.json`
	const userInput = input.toLowerCase()
	const filteredElements = re.elements
		.filter(elem => {
			if (elem.hidden) return false
			let searchTermFound = (elem.searchterms || []).reduce((searchTermFound, searchTerm) => {
				if (searchTermFound) return true
				return searchTerm.toLowerCase().includes(userInput)
			}, false)
			return searchTermFound || elem.name.toLowerCase().includes(userInput)
		})
		.sort((a, b) => a.name.localeCompare(b.name))

	const opts = {
		app: app.drawer.opts,
		sandboxDiv: app.drawer.opts.sandboxDiv,
		genomes: app.genomes,
		fromApp: true
	}

	data.push(
		{
			title: 'Tracks and Apps',
			items: filteredElements.filter(c => c.type == 'card'),
			color: '#e1edf7',
			callback: element => {
				app.drawer.dispatch({ type: 'is_apps_btn_active', value: false })
				tip.hide()
				openSandbox(element, opts)
			}
		},
		{
			title: 'Datasets',
			items: filteredElements.filter(c => c.type == 'dsButton'),
			color: '#e5f5e4',
			callback: element => {
				app.drawer.dispatch({ type: 'is_apps_btn_active', value: false })
				tip.hide()
				openSandbox(element, opts)
			}
		}
	)
	return data
}

export async function findgenelst(str, genome, jwt) {
	try {
		const data = await dofetch3('/genelookup', {
			body: {
				input: str,
				genome,
				jwt
			}
		})

		if (data.error) throw data.error
		if (!data.hits) throw '.hits[] missing'
		return data.hits
	} catch (err) {
		// err is likely "invalid character in gene name". ignore and continue
		// if (err.stack) console.log(err.stack)
		// throw err
	}
}
