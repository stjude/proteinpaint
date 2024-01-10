import { select } from 'd3-selection'

/*
holder: html dom
getDatasetAccessToken()
*/
export function init(arg) {
	const holder = select(arg.holder)
	holder
		.append('img')
		.attr('src', 'images/Button_Full_Version.png')
		.attr('width', '15%')
		.on('click', event => loadDataset(holder, 'ProfileFull'))
	holder
		.append('img')
		.attr('src', 'images/Button_Abbreviated_Version.png')
		.attr('width', '15%')
		.on('click', event => loadDataset(holder, 'ProfileAbbreviated'))
}

async function loadDataset(holder, dslabel) {
	holder.selectAll('*').remove()
	const opts = {
		holder,
		state: {
			nav: {
				header_mode: 'hidden'
			},
			vocab: {
				dslabel,
				genome: 'hg38'
			}
		}
	}
	const _ = await import('./mass/app')
	const app = await _.appInit(opts)

	const div = holder.append('div')
	div
		.append('button')
		.text(dslabel == 'ProfileFull' ? 'Abbreviated PrOFILE' : 'Full PrOFILE')
		.on('click', e =>
			dslabel == 'ProfileFull' ? loadDataset(holder, 'ProfileAbbrev') : loadDataset(holder, 'ProfileFull')
		)
	div
		.append('button')
		.text('Polar Graph')
		.on('click', e => launchPlot(app, 'profilePolar'))
	div.append('button').text('Barchart Graph')
	div.append('button').text('Radar Graph 1')
	div
		.append('input')
		.attr('type', 'checkbox')
		.on('change', e => console.log(e))
}

async function launchPlot(app, chartType) {
	await deletePlots(app)
	await app.dispatch({
		type: 'plot_create',
		config: {
			chartType
		}
	})
}

async function deletePlots(app) {
	//const preservePlots = document.getElementById('preservePlots').checked
	//if (!preservePlots)
	for (const plot of app.getState().plots) {
		await app.dispatch({
			type: 'plot_delete',
			id: plot.id
		})
	}
}
