import { select } from 'd3-selection'

/*
holder: html dom
getDatasetAccessToken()
*/
export function init(arg) {
	const headerHolder = select(arg.holder)
	headerHolder
		.append('img')
		.attr('src', 'images/Button_Full_Version.png')
		.attr('width', '15%')
		.on('click', event => loadDataset(headerHolder, 'ProfileFull'))
	headerHolder
		.append('img')
		.attr('src', 'images/Button_Abbreviated_Version.png')
		.attr('width', '15%')
		.on('click', event => loadDataset(headerHolder, 'ProfileAbbrev'))
}

async function loadDataset(headerHolder, dslabel) {
	headerHolder.selectAll('*').remove()
	const appHolder = select(document.getElementById('aaa'))
	appHolder.selectAll('*').remove()
	const opts = {
		holder: appHolder,
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

	addButtons(headerHolder, app, dslabel)
	launchPlot(app, 'profilePolar', false)
}

function addButtons(headerHolder, app, dslabel) {
	const div = headerHolder
		.append('div')
		.style('display', 'inline-flex')
		.style('gap', '5px')
		.style('padding-left', '12px')

	div
		.append('button')
		.text(dslabel == 'ProfileFull' ? 'Abbreviated PrOFILE' : 'Full PrOFILE')
		.on('click', e =>
			dslabel == 'ProfileFull' ? loadDataset(headerHolder, 'ProfileAbbrev') : loadDataset(headerHolder, 'ProfileFull')
		)
	div
		.append('button')
		.text('Polar Graph')
		.on('click', e => launchPlot(app, 'profilePolar', preserveCheckbox.node().checked))
	div
		.append('button')
		.text('Barchart Graph')
		.on('click', e => launchPlot(app, 'profileBarchart', preserveCheckbox.node().checked))

	div
		.append('button')
		.text('Radar Graph 1')
		.on('click', e => launchRadarPlot(app, 'profileRadarFacility', 'plot1', preserveCheckbox.node().checked))
	if (dslabel == 'ProfileFull')
		div
			.append('button')
			.text('Radar Graph 3')
			.on('click', e => launchRadarPlot(app, 'profileRadar', 'plot1', preserveCheckbox.node().checked))

	if (dslabel == 'ProfileAbbrev')
		div
			.append('button')
			.text('Radar Graph 2')
			.on('click', e => launchRadarPlot(app, 'profileRadarFacility', 'plot1', preserveCheckbox.node().checked))

	div.append('label').attr('for', 'preservePlots').text('Preserve Plots')
	const preserveCheckbox = div.append('input').attr('id', 'preservePlots').attr('type', 'checkbox')
}

async function launchPlot(app, chartType, preserve) {
	if (!preserve) await deletePlots(app)
	const config = await app.dispatch({
		type: 'plot_create',
		config: {
			chartType
		}
	})
}

async function launchRadarPlot(app, chartType, plot, preserve) {
	if (!preserve) await deletePlots(app)
	const config = await app.dispatch({
		type: 'plot_create',
		config: {
			chartType,
			plot
		}
	})
}

async function deletePlots(app) {
	for (const plot of app.getState().plots) {
		await app.dispatch({
			type: 'plot_delete',
			id: plot.id
		})
	}
}
