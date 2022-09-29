import { json as d3json } from 'd3-fetch'
import * as client from './client'

/*
to call e2pca plots from study view

may apply patientannotation for sample color overlay

and gene expression boxplot for categorized samples

*/

export default function(cohort, folder) {
	for (const obj of cohort.e2pca.list) {
		const holder = folder
			.append('div')
			.style('display', 'inline-block')
			.style('margin', '20px')
			.style('vertical-align', 'top')
		if (cohort.e2pca.list.length > 1) {
			holder.style('border', 'solid 1px #ededed')
		}
		if (obj.name) {
			holder
				.append('div')
				.text(obj.name)
				.style('background-color', '#f1f1f1')
				.style('padding', '5px 10px')
		}

		/*
	top row contains
	- svg button
	- gene search box
	- sample metadata dropdown
	*/
		const toprow = holder.append('div').style('margin', '20px')

		d3json(cohort.hostURL + '/textfile').post(JSON.stringify({ file: obj.vectorfile, jwt: cohort.jwt }), data => {
			if (data.error) {
				client.sayerror(holder, 'Error getting vector file: ' + data.error)
				return
			}

			import('./e2pca').then(p => {
				const [err, numdata2plot] = p.e2pca_plot({
					holder: holder,
					toprow: toprow,
					text: data.text,
					mdanno: cohort.patientannotation,
					obj: obj
				})
				if (err) {
					client.sayerror(holder, 'Error: ' + err)
					return
				}

				// pca plot made

				p.e2pca_genesearchui({
					holder: toprow,
					numdata2plot: numdata2plot,
					hostURL: cohort.hostURL,
					jwt: cohort.jwt,
					obj: obj,
					callback: () => {
						boxplot4sampleannotation(cohort, obj)
					}
				})

				if (cohort.patientannotation) {
					/*
				has sample metadata
				- will draw expression boxplot for samples stratified by annotation, using gene expression
				- will color samples by annotation
				*/
					obj.boxplotdiv = holder.append('div')

					const div = toprow
						.append('div')
						.style('display', 'inline-block')
						.style('margin-left', '10px')
					metadataselector4pca(cohort, obj, div)
				}
			})
		})
	}
}

function boxplot4sampleannotation(cohort, obj) {
	/*
	after searching for expression data for a gene from a db
	may make boxplots showing expression distribution of samples
	by different annotation
	only do when cohort.patientannotation is available

	obj
		the e2pca object from cohort.e2pca
		.expressiondata[]
		.usetermkey
	*/
	if (!cohort.patientannotation) {
		return
	}
	if (!obj.expressiondata) {
		/*
		expression data is avaiable after searching for a gene in pca plot
		*/
		return
	}

	if (!obj.usetermkey) {
		// use first term
		obj.usetermkey = cohort.patientannotation.metadata[0].key
	}

	let term = null
	for (const t of cohort.patientannotation.metadata) {
		if (t.key == obj.usetermkey) {
			term = t
			break
		}
	}
	if (!term) {
		client.sayerror(obj.boxplotdiv, 'invalid term key ' + obj.usetermkey)
		return
	}

	const samplegroups = []
	// by obj.usetermkey, devide samples into groups
	for (const v of term.values) {
		samplegroups.push({
			valuekey: v.key,
			label: v.label,
			color: v.color,
			samples: []
		})
	}

	let minv = obj.expressiondata[0].value
	let maxv = obj.expressiondata[0].value

	const noattrsamples = []
	// collect those that are not annotated by obj.usetermkey, make last group

	// assign samples (with values) to groups
	for (const s of obj.expressiondata) {
		minv = Math.min(minv, s.value)
		maxv = Math.max(maxv, s.value)

		if (!cohort.patientannotation.annotation[s.sample]) {
			// unknown sample name
			noattrsamples.push(s)
			continue
		}
		const valuekey = cohort.patientannotation.annotation[s.sample][obj.usetermkey]
		if (valuekey == undefined) {
			noattrsamples.push(s)
			continue
		}
		for (const sg of samplegroups) {
			if (sg.valuekey == valuekey) {
				sg.samples.push(s)
				break
			}
		}
	}

	if (noattrsamples.length) {
		samplegroups.push({
			label: 'unannotated',
			color: '#858585',
			samples: noattrsamples
		})
	}

	obj.boxplotdiv.selectAll('*').remove()

	import('./old/plot.boxplot').then(p => {
		const err = p.default({
			list: samplegroups,
			holder: obj.boxplotdiv,
			axislabel: obj.searchedgene
		})
		if (err) {
			client.sayerror(obj.boxplotdiv, 'Boxplot: ' + err)
		}
	})
}

function metadataselector4pca(cohort, obj, holder) {
	/*
	list all metadata terms for selection
	once selected,
	use to color samples in pca
	and update boxplot if any
	*/
	const tip = new client.Menu({ border: '', padding: '' })
	const noannocolor = '#858585'

	holder
		.append('span')
		.text('Choose metadata')
		.attr('class', 'sja_clbtext')
		.on('click', event => {
			/*
		list all terms
		*/
			tip.clear()
			tip.showunder(event.target)
			for (const term of cohort.patientannotation.metadata) {
				tip.d
					.append('div')
					.attr('class', 'sja_menuoption')
					.text(term.label)
					.on('click', () => {
						/*
				a term has been selected
				*/
						obj.usetermkey = term.key

						tip.hide()
						obj.circles.attr('fill', d => {
							/*
					each d is a sample
					.sample
					*/
							const a = cohort.patientannotation.annotation[d.sample]
							if (!a) return noannocolor
							const valuekey = a[term.key]
							if (!valuekey) return noannocolor
							const b = cohort.patientannotation.mdh[term.key].values[valuekey]
							if (!b) {
								console.error('invalid value key: ' + valuekey + ' at term: ' + term.key)
								return noannocolor
							}
							return b.color
						})

						// legend
						obj.legendholder.selectAll('*').remove()
						obj.legendholder
							.append('div')
							.style('margin-bottom', '5px')
							.text(term.label)
							.style('font-weight', 'bold')
						for (const v of term.values) {
							const row = obj.legendholder.append('div').style('margin-bottom', '3px')
							row
								.append('span')
								.attr('class', 'sja_mcdot')
								.style('background-color', v.color)
								.style('margin-right', '5px')
								.html('&nbsp;')
							row.append('span').text(v.label)
						}

						if (obj.expressiondata) {
							/*
					gene expression data already loaded and boxplot must have already been shown
					update boxplot
					*/
							boxplot4sampleannotation(cohort, obj)
						}
					})
			}
		})
}
