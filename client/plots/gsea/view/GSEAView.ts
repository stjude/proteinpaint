// import * as d3axis from 'd3-axis'
// import { scaleLinear } from 'd3-scale'
// import { renderTable, table2col, axisstyle, sayerror } from '#dom'
// import { dofetch3 } from '#common/dofetch'
// import { roundValueAuto } from '#shared/roundValue.js'

// async function renderPathwayDropdown(self) {
// 	const settings = structuredClone(self.settings)
// 	const pathwayOpts = structuredClone(self.app.opts.genome.termdbs.msigdb.analysisGenesetGroups) // duplicate to avoid repeated insertion on each app launch

// 	if (JSON.parse(sessionStorage.getItem('optionalFeatures') || '{}')?.gsea_test && self.settings.gsea_method == 'blitzgsea') {
// 		// This contains geneset groups that are specific to blitzgsea itself
// 		// TEMPORARY FIX to test this library that will trigger auto download support files in python
// 		// NEVER ENABLE ON PROD especially gdc prod, where container has firewall and it crashes..
// 		// delete this if library is replaced
// 		pathwayOpts.push(
// 			{ label: 'REACTOME (blitzgsea)', value: 'REACTOME--blitzgsea' },
// 			{ label: 'KEGG (blitzgsea)', value: 'KEGG--blitzgsea' },
// 			{ label: 'WikiPathways (blitzgsea)', value: 'WikiPathways--blitzgsea' }
// 		)
// 	}

// 	if (settings.pathway) {
// 		pathwayOpts.shift()
// 		pathwayOpts.find(opt => opt.value == settings.pathway).selected = true
// 	}

// 	self.dom.actionsDiv
// 		.append('span')
// 		.attr('data-testid', 'sjpp-gsea-pathway')
// 		.style('margin-right', '10px')
// 		.text('Select a gene set group:')

// 	const dropdown = self.dom.actionsDiv.append('select').on('change', event => {
// 		if (!settings.pathway) {
// 			//Remove placeholder from dropdown on first change
// 			const placeholder = dropdown.select('option[value="-"]')
// 			placeholder.remove()
// 			pathwayOpts.shift()
// 		}

// 		const idx = event.target.selectedIndex
// 		settings.pathway = pathwayOpts[idx].value
// 		self.app.dispatch({
// 			type: 'plot_edit',
// 			id: self.id,
// 			config: {
// 				//Need to clear the gsea_params completely
// 				gsea_params: {
// 					geneset_name: null,
// 					pathway: pathwayOpts[idx].value
// 				},
// 				highlightGenes: [],
// 				settings: {
// 					gsea: settings
// 				}
// 			}
// 		})
// 	})
// 	for (const opt of pathwayOpts) {
// 		dropdown
// 			.append('option')
// 			.text(opt.label)
// 			.attr('value', opt.value)
// 			.attr('selected', opt.selected ? true : null)
// 	}
// }

// async function render_gsea(self) {
// 	/*
// m {}
// - gene
// - logfoldchange
// - averagevalue
// - pvalue

// add:
// - vo_circle
// 	*/

// 	//Render the dropdown if launched from state
// 	//Otherwise will persist on load
// 	self.dom.actionsDiv.selectAll('*').remove()
// 	renderPathwayDropdown(self)
// 	if (self.settings.pathway == '-' || self.settings.pathway == undefined) return
// 	self.dom.detailsDiv.selectAll('*').remove()
// 	self.dom.holder.selectAll('*').remove()
// 	self.dom.tableDiv.selectAll('*').remove()
// 	self.config.gsea_params.geneSetGroup = self.settings.pathway
// 	self.config.gsea_params.filter_non_coding_genes = self.settings.filter_non_coding_genes
// 	self.config.gsea_params.num_permutations = self.settings.num_permutations

// 	let output
// 	try {
// 		const p = self.config.gsea_params
// 		const body: any = {
// 			genome: p.genome,
// 			geneSetGroup: self.settings.pathway,
// 			filter_non_coding_genes: self.settings.filter_non_coding_genes,
// 			method: self.settings.gsea_method
// 		}
// 		if (p.cacheId) {
// 			body.cacheId = p.cacheId
// 			// Sending the DE request snapshot lets the server regenerate the
// 			// cache on miss (farm node without the file, TTL-expired).
// 			if (p.daRequest) body.daRequest = p.daRequest
// 			// Top-level dslabel makes the global auth middleware populate
// 			// clientAuthResult so the server can re-apply the same
// 			// auth-filter injection to daRequest before hashing.
// 			if (p.dslabel) body.dslabel = p.dslabel
// 		} else if (p.dapParams) {
// 			body.dapParams = p.dapParams
// 			body.dslabel = p.dslabel
// 		} else {
// 			body.genes = p.genes
// 			body.fold_change = p.fold_change
// 		}

// 		if (self.settings.gsea_method == 'blitzgsea') {
// 			body.num_permutations = self.settings.num_permutations
// 		}
// 		output = await rungsea(body, self.dom)
// 		if (output.error) {
// 			throw Object.assign(new Error(output.error), { code: output.code })
// 		}
// 	} catch (e: any) {
// 		// Inline error block instead of alert(). Mirror the detail-plot
// 		// branch below so the GSEA pane shows the failure in-context (e.g.
// 		// blitzgsea calibration failures on small/degenerate signatures
// 		// from gsea.py's _safe_blitz_gsea, or daCacheMissing on a
// 		// stale-session cache regen).
// 		self.dom.holder.selectAll('*').remove()
// 		const msg = String(e?.message || e)
// 		if (e?.code === 'CACHE_BUSY') {
// 			if (window.confirm(msg)) render_gsea(self)
// 			return
// 		}
// 		const userMsg = /daCacheMissing|ENOENT|no such file/i.test(msg)
// 			? 'The differential-analysis cache for this GSEA is no longer available. Reopen the volcano plot to regenerate it.'
// 			: msg
// 		sayerror(self.dom.holder, userMsg)
// 		return
// 	}

// 	//Ensure the image renders when toggling between tabs
// 	if (self.config.gsea_params.geneset_name != null) {
// 		try {
// 			if (self.settings.gsea_method == 'blitzgsea') {
// 				self.config.gsea_params.method = self.settings.gsea_method
// 				const image = await rungsea(self.config.gsea_params, self.dom)
// 				// //render_gsea_plot(self, plot_data)
// 				if (image.error) throw image.error
// 				self.imageUrl = URL.createObjectURL(image)
// 				const png_width = 600
// 				const png_height = 400
// 				self.dom.holder.append('img').attr('width', png_width).attr('height', png_height).attr('src', self.imageUrl)
// 			} else if (self.settings.gsea_method == 'cerno') {
// 				if (!self.rankedDE && (self.config.gsea_params.cacheId || self.config.gsea_params.dapParams)) {
// 					const fetchBody: any = {
// 						genome: self.config.gsea_params.genome,
// 						dslabel: self.config.gsea_params.dslabel,
// 						fetchDE: true,
// 						geneSetGroup: '-',
// 						filter_non_coding_genes: false,
// 						method: 'cerno'
// 					}
// 					if (self.config.gsea_params.cacheId) {
// 						fetchBody.cacheId = self.config.gsea_params.cacheId
// 						fetchBody.daRequest = self.config.gsea_params.daRequest
// 					} else if (self.config.gsea_params.dapParams) {
// 						fetchBody.dapParams = self.config.gsea_params.dapParams
// 					}
// 					const deResp = await dofetch3('genesetEnrichment', {
// 						body: fetchBody
// 					})
// 					if (deResp.error) throw Object.assign(new Error(deResp.error), { code: deResp.code })
// 					self.rankedDE = deResp.data
// 				}
// 				render_cerno_plot(self, output)
// 			} else {
// 				throw 'Unknown method:' + self.settings.gsea_method
// 			}
// 		} catch (e: any) {
// 			self.dom.holder.selectAll('*').remove()
// 			const msg = String(e?.message || e)
// 			if (e?.code === 'CACHE_BUSY') {
// 				if (window.confirm(msg)) render_gsea(self)
// 				return
// 			}
// 			const userMsg = /daCacheMissing|ENOENT|no such file/i.test(msg)
// 				? 'The differential-analysis cache for this GSEA is no longer available. Reopen the volcano plot to regenerate it.'
// 				: msg
// 			sayerror(self.dom.holder, userMsg)
// 			return
// 		}
// 	}

// 	const table_stats = table2col({ holder: self.dom.detailsDiv.attr('data-testid', 'sjpp-gsea-stats') })
// 	const [t1, t2] = table_stats.addRow()
// 	t2.style('text-align', 'center').style('font-size', '0.8em').style('opacity', '0.8').text('COUNT')
// 	let addStats
// 	if (self.settings.gsea_method == 'blitzgsea') {
// 		addStats = [
// 			{
// 				label: 'Gene sets analyzed',
// 				values: Object.keys(output.data).length
// 			}
// 		]
// 	} else if (self.settings.gsea_method == 'cerno') {
// 		addStats = [
// 			{
// 				label: 'Gene sets analyzed',
// 				values: Object.keys(output).length
// 			}
// 		]
// 	} else {
// 		throw 'Unknown method:' + self.settings.gsea_method
// 	}

// 	for (const dataRow of addStats) {
// 		const [td1, td2] = table_stats.addRow()
// 		td1.text(dataRow.label)
// 		td2.style('text-align', 'end').text(dataRow.values)
// 	}

// 	// Generating the table
// 	self.gsea_table_rows = []
// 	let output_keys
// 	if (self.settings.gsea_method == 'blitzgsea') {
// 		output_keys = Object.entries(output.data).map(([key, value]) => {
// 			return { key, value } // Convert to an array of objects
// 		})
// 	} else if (self.settings.gsea_method == 'cerno') {
// 		output_keys = Object.entries(output).map(([key, value]) => {
// 			return { key, value } // Convert to an array of objects
// 		})
// 	} else {
// 		throw 'Unknown method:' + self.settings.gsea_method
// 	}

// 	if (self.settings.fdr_or_top == 'top') {
// 		// Sorting the top (top_genesets) genesets in decreasing order
// 		output_keys.sort((i, j) => Number(i.value.fdr) - Number(j.value.fdr))
// 		const top_genesets = Math.min(self.settings.top_genesets, output_keys.length) // If the length of the table is less than the top cutoff, only iterate till the end of the table
// 		for (let iter = 0; iter < top_genesets; iter++) {
// 			if (
// 				self.settings.max_gene_set_size_cutoff >= output_keys[iter].value.geneset_size &&
// 				self.settings.min_gene_set_size_cutoff <= output_keys[iter].value.geneset_size
// 			) {
// 				setResultsRows(output_keys, iter, self)
// 			}
// 		}
// 	} else if (self.settings.fdr_or_top == 'fdr') {
// 		for (let iter = 0; iter < output_keys.length; iter++) {
// 			if (
// 				self.settings.fdr_cutoff >= output_keys[iter].value.fdr &&
// 				self.settings.max_gene_set_size_cutoff >= output_keys[iter].value.geneset_size &&
// 				self.settings.min_gene_set_size_cutoff <= output_keys[iter].value.geneset_size
// 			) {
// 				setResultsRows(output_keys, iter, self)
// 			}
// 		}
// 	}

// 	self.dom.tableDiv.selectAll('*').remove()
// 	const d_gsea = self.dom.tableDiv.append('div')
// 	// table columns showing analysis results for each gene set
// 	self.gsea_table_cols = []
// 	if (self.settings.gsea_method == 'blitzgsea') {
// 		self.gsea_table_cols = [
// 			{ label: 'Gene Set', sortable: true },
// 			//{ label: 'Enrichment Score' },
// 			{ label: 'Normalized Enrichment Score', barplot: { axisWidth: 200 }, sortable: true },
// 			{ label: 'Gene Set Size', sortable: true },
// 			{ label: 'P value', sortable: true },
// 			//{ label: 'Sidak' },
// 			{ label: 'FDR', sortable: true },
// 			{ label: 'Leading Edge' }
// 		]
// 	} else if (self.settings.gsea_method == 'cerno') {
// 		self.gsea_table_cols = [
// 			{ label: 'Gene Set', sortable: true },
// 			{ label: 'Area Under Curve', barplot: { axisWidth: 200 }, sortable: true },
// 			{ label: 'Enrichment Score', barplot: { axisWidth: 200 }, sortable: true },
// 			{ label: 'Total Gene Set Size', sortable: true },
// 			{ label: 'P value', sortable: true },
// 			{ label: 'FDR', sortable: true },
// 			{ label: 'Gene Set Hits' }
// 		]
// 	} else {
// 		throw 'Unknown method:' + self.settings.gsea_method
// 	}
// 	const download = {
// 		fileName: ''
// 	}

// 	if (self.config.chartType == 'differentialAnalysis') {
// 		//Highlight genes button
// 		self.dom.detailsDiv
// 			.append('button')
// 			.style('margin-left', '10px')
// 			.style(
// 				'display',
// 				self.config.chartType == 'differentialAnalysis' && self.config.gsea_params.geneset_name == null
// 					? 'none'
// 					: 'block'
// 			)
// 			.attr('aria-label', 'Highlight genes in the volcano plot')
// 			.text('Highlight genes')
// 			.on('click', () => {
// 				self.app.dispatch({
// 					type: 'plot_edit',
// 					id: self.id,
// 					config: {
// 						childType: 'volcano',
// 						highlightedData: self.config.highlightGenes
// 					}
// 				})
// 			})
// 	}

// 	if (self.state.config.downloadFilename) download.fileName = self.state.config.downloadFilename

// 	//Table rerenders when main is called
// 	//Fix to show which gene set is selected after rerender
// 	const geneSetIdx = self.gsea_table_rows.findIndex(row => row[0].value == self.config.gsea_params.geneset_name)
// 	const selectedRows = geneSetIdx > -1 ? [geneSetIdx] : []

// 	renderTable({
// 		download,
// 		columns: self.gsea_table_cols,
// 		rows: self.gsea_table_rows,
// 		div: d_gsea,
// 		showLines: true,
// 		maxHeight: '30vh',
// 		singleMode: true,
// 		resize: true,
// 		header: { allowSort: true },
// 		selectedRows: selectedRows,
// 		noButtonCallback: async index => {
// 			const config: any = {
// 				gsea_params: {
// 					geneset_name: self.gsea_table_rows[index][0].value
// 				}
// 			}
// 			if (self.config.chartType == 'differentialAnalysis') {
// 				//Saves the data to highlight in the volcano plot
// 				let genes
// 				if (self.settings.gsea_method == 'blitzgsea') {
// 					genes = [...self.gsea_table_rows[index][5].value.split(',')]
// 				} else if (self.settings.gsea_method == 'cerno') {
// 					genes = [...self.gsea_table_rows[index][6].value.split(',')]
// 				} else {
// 					throw 'Unknown method:' + self.settings.gsea_method
// 				}
// 				if (genes) config.highlightGenes = genes
// 			}
// 			await self.app.dispatch({
// 				type: 'plot_edit',
// 				id: self.id,
// 				config
// 			})
// 		}
// 	})
// }

// function setResultsRows(output_keys, iter, self) {
// 	const pathway_name = output_keys[iter].key
// 	const pval = output_keys[iter].value.pval
// 		? roundValueAuto(output_keys[iter].value.pval)
// 		: output_keys[iter].value.pval
// 	const fdr = output_keys[iter].value.fdr ? roundValueAuto(output_keys[iter].value.fdr) : output_keys[iter].value.fdr
// 	if (self.settings.gsea_method == 'blitzgsea') {
// 		const nes = output_keys[iter].value.nes ? roundValueAuto(output_keys[iter].value.nes) : output_keys[iter].value.nes
// 		// const sidak = output_keys[iter].value.sidak
// 		// 	? roundValueAuto(output_keys[iter].value.sidak)
// 		// 	: output_keys[iter].value.sidak
// 		self.gsea_table_rows.push([
// 			{ value: pathway_name },
// 			{ value: nes },
// 			{ value: output_keys[iter].value.geneset_size },
// 			{ value: pval },
// 			//{ value: sidak },
// 			{ value: fdr },
// 			{ value: output_keys[iter].value.leading_edge }
// 		])
// 	} else if (self.settings.gsea_method == 'cerno') {
// 		const auc = output_keys[iter].value.auc ? roundValueAuto(output_keys[iter].value.auc) : output_keys[iter].value.auc
// 		const es = output_keys[iter].value.es ? roundValueAuto(output_keys[iter].value.es) : output_keys[iter].value.es
// 		self.gsea_table_rows.push([
// 			{ value: pathway_name },
// 			{ value: auc },
// 			{ value: es },
// 			{ value: output_keys[iter].value.geneset_size },
// 			{ value: pval },
// 			{ value: fdr },
// 			{ value: output_keys[iter].value.leading_edge }
// 		])
// 	} else {
// 		throw 'Unknown method:' + self.settings.gsea_method
// 	}
// }

// function render_cerno_plot(self, cerno_output) {
// 	const holder = self.dom.holder
// 	holder.selectAll('*').remove()
// 	const svg_width = 400
// 	const svg_height = 400
// 	const svg = holder.append('svg').attr('width', svg_width).attr('height', svg_height)
// 	const toppad = 20
// 	const rightpad = 5
// 	//Not in use. Comment out for now.
// 	// const yaxisw = 50 //Math.max(50, svg_width / 8)
// 	// const xaxish = 50 //Math.max(50, svg_height / 8)
// 	const yaxisg = svg.append('g')
// 	const xaxisg = svg.append('g')
// 	const xpad = 50
// 	const ypad = 100

// 	const rankedDE = self.rankedDE || self.config.gsea_params
// 	const DE_output: {gene: string, fold_change: number}[] = []
// 	for (let i = 0; i < rankedDE.genes.length; i++) {
// 		const item = { gene: rankedDE.genes[i], fold_change: rankedDE.fold_change[i] }
// 		DE_output.push(item)
// 	}
// 	DE_output.sort((i, j) => j.fold_change - i.fold_change) // Sorting genes in descending order of fold change

// 	const xscale = scaleLinear()
// 		.domain([0, DE_output.length])
// 		.range([xpad, svg_width - rightpad])
// 	const yscale = scaleLinear()
// 		.domain([100, 0])
// 		.range([toppad, svg_height - ypad])

// 	yaxisg.attr('transform', 'translate(' + xpad + ',' + 0 + ')')
// 	xaxisg.attr('transform', 'translate(' + 0 + ',' + (svg_height - ypad) + ')')
// 	const xlab = svg
// 		.append('text')
// 		.text('Gene list')
// 		.attr('fill', 'black')
// 		.attr('text-anchor', 'start')
// 		.attr('transform', 'translate(' + xscale(DE_output.length / 3) + ',' + (svg_height - ypad + 2 * toppad) + ')')
// 	const ylab = svg
// 		.append('text')
// 		.text('Percentage of gene set')
// 		.attr('fill', 'black')
// 		.attr('text-anchor', 'middle')
// 		.attr('y', xpad / 2)
// 		.attr('x', -svg_width / 2.5)
// 		.attr('transform', 'rotate(-90)')
// 	let fontSize = 30
// 	const title = svg
// 		.append('text')
// 		.text(self.config.gsea_params.geneset_name)
// 		.attr('fill', 'black')
// 		.attr('text-anchor', 'start')
// 		.attr('font-size', fontSize + 'px')
// 		.attr('transform', 'translate(' + xpad + ',' + toppad / 2 + ')')

// 	// Check to see if the text fits into the svg width and toppad dimensions. If not, decrease the font size until the text fits into these dimensions
// 	let title_bbox = title.node().getBBox()
// 	while (title_bbox.width > svg_width - xpad || title_bbox.height > (toppad * 3.5) / 5) {
// 		fontSize -= 1 // Decrease font size
// 		title.node().setAttribute('font-size', fontSize + 'px')
// 		title_bbox = title.node().getBBox() // Measure again
// 	}

// 	const auc = cerno_output[self.config.gsea_params.geneset_name].auc
// 	if (typeof auc === 'number') {
// 		let auc_pos
// 		if (auc >= 0.5) {
// 			// The position of the text changes depending upon the value of auc so as to avoid the auc curve overlapping with the text
// 			auc_pos = xscale((DE_output.length * 3) / 3.5) + ',' + (svg_height - ypad * 1.5)
// 		} else {
// 			auc_pos = xscale((DE_output.length * 0.8) / 4.5) + ',' + (svg_height - ypad * 3)
// 		}
// 		const auc_text = svg
// 			.append('text')
// 			.text('AUC=' + roundValueAuto(auc))
// 			.attr('fill', 'black')
// 			.attr('text-anchor', 'middle')
// 			.attr('transform', 'translate(' + auc_pos + ')')
// 	} else {
// 		// Should not happen
// 		throw 'AUC not a number:' + auc
// 	}

// 	axisstyle({
// 		axis: yaxisg.call(d3axis.axisLeft(yscale)),
// 		color: 'black',
// 		showline: true,
// 		fontsize: '10'
// 	})
// 	axisstyle({
// 		axis: xaxisg.call(d3axis.axisBottom(xscale)),
// 		color: 'black',
// 		showline: true,
// 		fontsize: '10'
// 	})

// 	// Find genes that were found from cerno output
// 	if (Object.keys(cerno_output).includes(self.config.gsea_params.geneset_name)) {
// 		const hit_genes = cerno_output[self.config.gsea_params.geneset_name].leading_edge.split(',')
// 		const y_increment = 100 / hit_genes.length
// 		const lines = svg.append('g')

// 		let y_iter = 100
// 		for (let i = 0; i < DE_output.length; i++) {
// 			const y_old = y_iter
// 			// Increment y only when gene is found in geneset
// 			if (hit_genes.includes(DE_output[i].gene)) {
// 				y_iter = y_iter - y_increment
// 				lines
// 					.append('line') // attach a line
// 					.style('stroke', 'red') // colour the line
// 					.attr('x1', xscale(i)) // x position of the first end of the line
// 					.attr('y1', svg_height) // y position of the first end of the line
// 					.attr('x2', xscale(i)) // x position of the second end of the line
// 					.attr('y2', svg_height - ypad + 2.5 * toppad) // y position of the second end of the line
// 			}
// 			lines
// 				.append('line') // attach a line
// 				.style('stroke', 'red') // colour the line
// 				.attr('x1', xscale(i)) // x position of the first end of the line
// 				.attr('y1', yscale(100 - y_old)) // y position of the first end of the line
// 				.attr('x2', xscale(i + 1)) // x position of the second end of the line
// 				.attr('y2', yscale(100 - y_iter)) // y position of the second end of the line
// 		}
// 	} else {
// 		// Should not happen
// 		throw '${self.config.gsea_params.geneset_name} not found'
// 	}

// 	//console.log('cerno_output:', cerno_output)

// 	// Find the genes that were found in the clicked geneset
// 	//const genes_found
// }

// // function render_gsea_plot(self, plot_data) {
// // 	// This function is for client side rendering of the gsea plot. This is not currently used. May be used later if client side rendering is later desired.
// // 	console.log('self.dom.holder:', self.dom.holder)
// // 	const holder = self.dom.holder
// // 	console.log('plot_data:', plot_data)
// // 	holder.selectAll('*').remove()
// // 	const running_sum = plot_data.running_sum.split(',').map(x => parseFloat(x))
// // 	const es = parseFloat(plot_data.es)
// // 	console.log('running_sum:', running_sum)
// // 	const svg_width = 400
// // 	const svg_height = 400
// // 	const svg = holder.append('svg').attr('width', svg_width).attr('height', svg_height)
// // 	const toppad = 50
// // 	const rightpad = 50
// // 	const yaxisw = Math.max(50, svg_width / 8)
// // 	const xaxish = Math.max(50, svg_height / 8)
// // 	const yaxisg = svg.append('g')
// // 	const xaxisg = svg.append('g')
// // 	const xpad = svg_width / 50
// // 	const ypad = svg_height / 50
// // 	yaxisg.attr('transform', 'translate(' + (yaxisw + xpad) + ',' + (toppad - ypad) + ')')
// // 	xaxisg.attr('transform', 'translate(' + (yaxisw + xpad) + ',' + (svg_height - ypad) + ')')
// // 	const xlab = xaxisg.append('text').text('Rank').attr('fill', 'black').attr('text-anchor', 'middle') //.attr('transform', 'translate(' + 200 + ',' + 200 + ')')
// // 	const ylab = yaxisg
// // 		.append('text')
// // 		.text('ES')
// // 		.attr('fill', 'black')
// // 		.attr('text-anchor', 'middle')
// // 		.attr('transform', 'rotate(-90)')
// // 	const xscale = scaleLinear().domain(running_sum).range([0, svg_width])
// // 	const yscale = scaleLinear().domain([0, 100]).range([0, svg_height])
// // 	//const xscale = scaleLinear().domain([Math.min(running_sum), Math.max(running_sum)]).range([0, 100])
// // 	axisstyle({
// // 		axis: yaxisg.call(d3axis.axisLeft().scale(yscale)),
// // 		color: 'black',
// // 		showline: true,
// // 		fontsize: '10'
// // 	})
// // 	axisstyle({
// // 		axis: xaxisg.call(d3axis.axisBottom().scale(xscale)),
// // 		color: 'black',
// // 		showline: true,
// // 		fontsize: '10'
// // 	})
// // 	//xscale.range([0, svg_width])
// // 	//yscale.range([svg_height, 0])
// // 	const lines = svg.append('g')
// // 	//svg.selectAll(".axis text").style("font-size", "100px")
// // 	let gene_number = 0
// // 	let y1 = 0
// // 	for (const rs of running_sum) {
// // 		lines
// // 			.append('line') // attach a line
// // 			.style('stroke', 'green') // colour the line
// // 			.attr('x1', xscale(gene_number)) // x position of the first end of the line
// // 			.attr('y1', yscale(y1)) // y position of the first end of the line
// // 			.attr('x2', xscale(gene_number)) // x position of the second end of the line
// // 			.attr('y2', yscale(Math.abs(rs))) // y position of the second end of the line
// // 		gene_number += 1
// // 		y1 = Math.abs(rs)
// // 	}
// // }

// async function rungsea(body, dom) {
// 	//Only show the loading div as the gsea is running
// 	dom.actionsDiv.style('display', 'none')
// 	dom.loadingDiv.style('display', 'block')
// 	const data = await dofetch3('genesetEnrichment', { body })
// 	dom.loadingDiv.style('display', 'none')
// 	dom.actionsDiv.style('display', 'block')
// 	return data
// }
