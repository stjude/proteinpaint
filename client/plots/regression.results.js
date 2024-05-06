import { sayerror } from '../dom/sayerror.ts'
import { scaleLinear, scaleLog } from 'd3-scale'
import { axisBottom, axisTop } from 'd3-axis'
import { axisstyle } from '#dom/axisstyle'
import { first_genetrack_tolist } from '#common/1stGenetk'
import { interpolateRgb } from 'd3-interpolate'
import { drawBoxplot } from '#dom/boxplot'
import { makeSsmLink } from '../dom/ssmLink.ts'

/*************
can dynamically add following attributes

- this.snplocusBlock:
	for snplocus term
	display in this.dom.snplocusBlockDiv
- this.hasUnsubmittedEdits_nullify_singleuse:
	to negate hasUnsubmittedEdits and keep running analysis

**************** R result object
result.data: {}
	warnings
	sampleSize: int
	headerRow: { k:str, v:str }
	residuals: { header[], rows[], label:str }
	coefficients: { header[], intercept[], terms{}, interactions[], label }
	type3: {header[], intercept[], terms{}, interactions[], label }
	totalSnpEffect: {header[], intercept[], snp, interactions[], lst, label }
	other: {header[], rows[], label}


*************** function cascade
main
	displayResult
		createGenomebrowser
			getMtooltipValues
			mayCheckLD
				showLDlegend
		updateMds3Tk
			make_mds3_variants
		show_genomebrowser_snplocus
		displayResult_oneset
			mayshow_warn
			mayshow_splinePlots
			mayshow_residuals
			mayshow_coefficients
			mayshow_totalSnpEffect
			mayshow_type3
			mayshow_other
			mayshow_fisher
			mayshow_wilcoxon
			mayshow_cuminc
*/

const refGrp_NA = 'NA' // refGrp value is not applicable, hardcoded for R
const forestcolor = '#126e08' // forest plot color
const boxplotcolor = forestcolor

export class RegressionResults {
	constructor(opts) {
		this.opts = opts
		this.app = opts.app
		// reference to the parent component's mutable instance (not its API)
		this.parent = opts.parent
		this.type = 'regression'
		setInteractivity(this)
		setRenderers(this)

		const holder = this.opts.holder
		holder
			.append('div')
			.style('margin-top', '10px')
			.style('padding-top', '20px')
			.style('font-size', '1.2em')
			.style('opacity', 0.3)
			.html('Results')

		this.dom = {
			holder,
			err_div: holder.append('div'),
			snplocusBlockDiv: holder.append('div'),
			// is where newDiv() and displayResult_oneset() writes to
			oneSetResultDiv: holder.append('div').style('margin', '10px')
		}
	}

	async main() {
		try {
			this.parent.inputs.dom.submitBtn.text('Running...')
			// share the writable config copy
			this.config = this.parent.config
			this.state = this.parent.state
			if (
				!this.state.formIsComplete ||
				this.parent.inputs.hasError ||
				(this.config.hasUnsubmittedEdits && !this.hasUnsubmittedEdits_nullify_singleuse)
			) {
				// no result to show
				this.dom.holder.style('display', 'none')
				return
			}
			delete this.hasUnsubmittedEdits_nullify_singleuse // single-use, delete

			if (this.snplocusBlock) {
				// if a block instance is already made, cloak it
				this.snplocusBlock.cloakOn()
			}

			// submit server request to run analysis
			const data = await this.app.vocabApi.getRegressionData(this.getDataRequestOpts())
			if (data.error) throw data.error
			this.dom.err_div.style('display', 'none')
			this.dom.oneSetResultDiv.selectAll('*').remove()
			this.dom.holder.style('display', 'block')
			await this.displayResult(data)

			// scroll to results
			const results_y = this.dom.holder.node().getBoundingClientRect().top + window.scrollY
			const nav_height = document.querySelector('.sjpp-nav').getBoundingClientRect().height
			window.scroll({ behavior: 'smooth', top: results_y - nav_height })
		} catch (e) {
			this.hasError = true
			this.dom.holder.style('display', 'block')
			this.dom.err_div.style('display', 'block')
			sayerror(this.dom.err_div, 'Error: ' + (e.error || e))
			this.parent.inputs.dom.submitBtn.property('disabled', true)
			console.error(e)
		}
	}

	// creates an opts object for the vocabApi.getRegressionData()
	getDataRequestOpts() {
		const c = this.config
		const opts = {
			regressionType: c.regressionType,
			outcome: c.outcome,
			independent: c.independent
		}
		opts.filter = this.parent.filter
		return opts
	}

	getIndependentInput(tid) {
		/* arg is independent term id
		return input instance
		for accessing input.orderedLabels and input.term{refGrp, term{}, q{}} which is term-wrapper

		in order to reliably access refGrp,
		must use termwrapper from Input instance but not this.state.config
		due to a specific condition when refGrp is set in self.config, but is missing from state
		this happens when launching from a parameterized url that's missing refgrp for the term
		and the refGrp is dynamically filled by input.updateTerm() but not propagated to state
		*/
		for (const i of this.parent.inputs.independent.inputLst) {
			if (!i.term) continue
			if (i.term.term.id == tid) return i
			if (i.term.term && i.term.term.snps) {
				// is a snplst or snplocus term with .snps[]
				for (const snp of i.term.term.snps) {
					if (snp.snpid == tid) {
						// tid matches with a snpid
						// make up an object looking like an Input instance for this snp/variant
						const tw = {
							id: tid,
							q: {
								geneticModel: i.term.q.geneticModel
							},
							term: {
								id: tid,
								name: tid
							},
							effectAllele: i.term.q.snp2effAle[tid]
						}
						if (i.term.q.snp2refGrp) {
							tw.refGrp = i.term.q.snp2refGrp[tid]
						}
						if (snp.mlst) {
							// try to update tw.term.name
							const m = snp.mlst.find(j => j.alt == i.term.q.snp2effAle[tid])
							if (m) {
								tw.term.name = m.mname
							} else {
								tw.term.name = snp.mlst[0].mname
							}
						}
						return { term: tw }
					}
				}
			}
		}
		// given tid does not match with an Input
		// can be an ancestry PC which is automatically added by serverside and not recorded on client
		// quick fix: return dummy tw so it won't break
		return {
			term: {
				id: tid,
				q: {},
				term: { name: tid }
			}
		}
		//throw 'cannot find Input for a tid: ' + tid
	}
}

function setInteractivity(self) {}

function setRenderers(self) {
	self.displayResult = async result => {
		/*
		result {
			resultLst [
				{ data: { err, splinePlots, residuals, ... }, id:'snp1' },
				{ data: { err, splinePlots, residuals, ... }, id:'snp2' },
				...
			]
		}
		*/

		// if there is a snplocus Input
		const snplocusInput = self.parent.inputs.independent.inputLst.find(i => i.term && i.term.term.type == 'snplocus')
		if (snplocusInput) {
			/* has a snploucs term
			in result[], there's one set of result for each variant, identified by id
			show a genome browser and a mds3 tk to show dots for the variants from snplocus term
			clicking on a dot in browser tk will call displayResult_oneset() to display its results
			*/
			if (!self.snplocusBlock) {
				self.dom.snplocusBlockDiv
					.append('div')
					.style('margin-top', '30px')
					.style('opacity', 0.3)
					.text('Click on a variant within the browser to view its regression results')
				self.snplocusBlock = await createGenomebrowser(self, snplocusInput, result.resultLst)
			} else {
				await updateMds3Tk(self, snplocusInput, result.resultLst)
			}
			return
		}

		// no snplocus, clear things if had it before
		delete self.snplocusBlock
		self.dom.snplocusBlockDiv.selectAll('*').remove()
		// resultLst[] has only one set of result, from analyzing one model
		if (!result.resultLst[0] || !result.resultLst[0].data) throw 'result is not [ {data:{}} ]'

		self.displayResult_oneset(result.resultLst[0].data)
	}

	self.displayResult_oneset = result => {
		self.dom.oneSetResultDiv.selectAll('*').remove()

		// may be used when clicking snplocus dot
		self.dom.LDresultDiv = self.dom.oneSetResultDiv.append('div')

		self.mayshow_warn(result)
		if (result.sampleSize) self.newDiv('Sample size:', result.sampleSize)
		if (result.eventCnt) self.newDiv('Number of events:', result.eventCnt)
		self.mayshow_headerRow(result)
		self.mayshow_splinePlots(result)
		self.mayshow_residuals(result)
		self.mayshow_coefficients(result)
		self.mayshow_totalSnpEffect(result)
		self.mayshow_type3(result)
		self.mayshow_tests(result)
		self.mayshow_other(result)
		self.mayshow_fisher(result)
		self.mayshow_wilcoxon(result)
		self.mayshow_cuminc(result)
	}

	self.newDiv = (label, label2, getrow) => {
		// create div to show a section of the result
		// label is required, label2 is optional
		// specify getrow=true to return row instead of div
		const div = self.dom.oneSetResultDiv.append('div').style('margin', '20px 0px 10px 0px').attr('name', label) //For integration testing
		const row = div.append('div')
		row.append('span').style('text-decoration', 'underline').text(label)
		if (label2) {
			row.append('span').html(label2).style('margin-left', '5px')
		}
		return getrow ? row : div.append('div').style('margin-left', '20px')
	}

	self.mayshow_warn = result => {
		if (!result.warnings) return
		const div = self.newDiv('Warnings')
		const warnings = new Set(result.warnings)
		for (const line of warnings) {
			div.append('p').style('margin', '5px').text(line)
		}
	}

	self.mayshow_headerRow = result => {
		if (!result.headerRow) return
		const k = result.headerRow.k
		const v = result.headerRow.v
		const snplocusInput = self.parent.inputs.independent.inputLst.find(i => i.term && i.term.term.type == 'snplocus')
		if (snplocusInput) {
			// header row is for snplocus results
			// variant label
			const snp = snplocusInput.term.term.snps.find(snp => snp.snpid == v.snpid)
			const m = snp.mlst[0]
			m.chr = snp.chr
			const row = self.newDiv(k, null, true)
			const snpLabelDom = row
				.append('span')
				.text(`${m.chr}:${m.pos + 1} ${m.ref && m.alt ? m.ref + '>' + m.alt : ''}`)
				.style('margin-left', '5px')
			const urlConfig =
				self.app.vocabApi.termdbConfig.urlTemplates?.ssm || self.app.vocabApi.termdbConfig.queries?.snvindel?.ssmUrl
			if (urlConfig) {
				// add urls to snp label
				const separateUrls = makeSsmLink(urlConfig, m, snpLabelDom, self.parent.genomeObj.name)
				if (separateUrls?.length) {
					row.append('span').style('margin-left', '10px').html(separateUrls.join(' '))
				}
			}
			// gt label
			let labels
			const gt_label = `Genotypes: ${v.gtcounts.join(', ')}`
			if (v.monomorphic) {
				labels = [gt_label]
			} else {
				// effect allele label
				const effale_label = `Effect allele: ${v.effAle}`
				// allel frequency label
				const af_label = `Allele frequency: ${v.af}`
				labels = [effale_label, af_label, gt_label]
			}
			row.append('span').html(`&nbsp;&#65372;&nbsp;${labels.join('&nbsp;&#65372;&nbsp;')}`)
		} else {
			// header row is not for snplocus results
			self.newDiv(k, v)
		}
	}

	self.mayshow_splinePlots = result => {
		if (!result.splinePlots) return
		const div = self.newDiv('Cubic spline plots')
		for (const plot of result.splinePlots) {
			div.append('img').attr('src', plot.src).style('width', plot.size.width).style('height', plot.size.height)
		}
	}

	self.mayshow_residuals = result => {
		if (!result.residuals) return
		const div = self.newDiv(result.residuals.label)
		const table = div.append('table').style('border-spacing', '8px').attr('name', 'sjpp-residuals-table') //For integration tests
		const tr1 = table.append('tr').style('opacity', 0.4)
		const tr2 = table.append('tr')
		for (let i = 0; i < result.residuals.header.length; i++) {
			tr1.append('td').text(result.residuals.header[i])
			tr2.append('td').text(result.residuals.rows[i])
		}
	}

	self.mayshow_cuminc = async result => {
		if (!result.cuminc) return
		const holder = self.newDiv('Cumulative incidence test:' /*, 'p-value = ' + result.cuminc.pvalue*/)
		const _ = await import('./cuminc')
		const plotter = new _.Cuminc({
			holder,
			config: {
				term: self.config.outcome,
				term2: {
					term: {
						name: 'Variant',
						values: {
							1: { key: 1, label: 'Has minor allele' },
							2: { key: 2, label: 'No minor allele' }
						}
					}
				}
			}
		})

		if (result.cuminc.ci_data) {
			plotter.main(result.cuminc.ci_data)
		} else {
			holder.append('div').style('margin', '20px').text(result.cuminc.msg)
		}
	}

	self.mayshow_wilcoxon = result => {
		if (!result.wilcoxon) return
		const div = self.newDiv('Wilcoxon rank sum test:', 'p-value = ' + result.wilcoxon.pvalue)
		if (result.wilcoxon.boxplots) {
			const bs = result.wilcoxon.boxplots
			// {hasEff{}, noEff{}, minv, maxv}

			const boxplotHeight = 20,
				boxplotWidth = 400,
				leftLabelWidth = 160, // hardcoded number, must fit the boxplot labels
				axisheight = 40,
				labpad = 20,
				vpad = 10

			const scale = scaleLinear().domain([bs.minv, bs.maxv]).range([0, boxplotWidth])

			const svg = div
				.append('svg')
				.style('margin-top', '10px')
				.attr('width', leftLabelWidth + labpad + boxplotWidth + 10)
				.attr('height', vpad * 3 + boxplotHeight * 2 + axisheight)
			// anchor
			const g = svg.append('g').attr('transform', `translate(${leftLabelWidth + labpad},${vpad})`)
			drawBoxplot({
				g: g.append('g'),
				bp: bs.hasEff,
				scale,
				rowheight: boxplotHeight,
				color: boxplotcolor,
				labpad
			})
			drawBoxplot({
				g: g.append('g').attr('transform', `translate(0,${boxplotHeight + vpad})`),
				bp: bs.noEff,
				scale,
				rowheight: boxplotHeight,
				color: boxplotcolor,
				labpad
			})
			// axis
			{
				const axisg = g.append('g').attr('transform', `translate(0,${boxplotHeight * 2 + vpad * 2})`)
				const axis = axisBottom().scale(scale)
				axisstyle({
					axis: axisg.call(axis),
					color: boxplotcolor,
					showline: true
				})
				axisg
					.append('text')
					.text(self.config.outcome.term.name)
					.attr('font-size', 15)
					.attr('x', boxplotWidth / 2)
					.attr('y', axisheight - 5)
					.attr('text-anchor', 'middle')
					.attr('fill', boxplotcolor)
			}
		}
	}

	self.mayshow_fisher = result => {
		if (!result.fisher) return
		const div = self.newDiv(
			result.fisher.isChi ? 'Chi-square test:' : "Fisher's exact test:",
			'p-value = ' + result.fisher.pvalue
		)
		const table = div
			.append('table')
			.style('margin', '20px')
			.style('border-spacing', '5px')
			.style('border-collapse', 'separate')
		for (const r of result.fisher.rows) {
			const tr = table.append('tr')
			for (const c of r) {
				tr.append('td').text(c)
			}
		}
	}

	self.mayshow_coefficients = result => {
		if (!result.coefficients) return
		const div = self.newDiv(result.coefficients.label)
		const table = div
			.append('table')
			.style('border-spacing', '0px')
			.attr('data-testid', 'sjpp_regression_resultCoefficientTable')

		// padding is set on every <td>. need a better solution

		// header row
		{
			const tr = table.append('tr').style('opacity', 0.4)
			result.coefficients.header.forEach((v, i) => {
				tr.append('td').text(v).style('padding', '8px')
				if (i === 1) tr.append('td') // column 3 will be for forest plot
			})
		}

		// intercept row (only for linear/logistic)
		if (self.config.regressionType != 'cox') {
			const tr = table.append('tr').style('background', '#eee')
			result.coefficients.intercept.forEach((v, i) => {
				tr.append('td').text(v).style('padding', '8px')
				if (i === 1) tr.append('td') // column 3 will be for forest plot
			})
		}

		/* term rows:
		for each independent terms, show 1 or multiple rows
		these rows do not cover interactions, which are rendered afterwards

		* forest plot *
		shown for both interacting and non-interacting rows
		a plot is added to 3rd column of each row
		plotter can be a blank function if there's no valid value for plotting
		*/
		const forestPlotter = self.getForestPlotter(result.coefficients.terms, result.coefficients.interactions)
		let rowcount = self.config.regressionType == 'cox' ? 1 : 0
		for (const tid in result.coefficients.terms) {
			const termdata = result.coefficients.terms[tid]
			const tw = self.getIndependentInput(tid).term
			let tr = table.append('tr').style('background', rowcount++ % 2 ? '#eee' : 'none')

			// col 1: term name
			const termNameTd = tr.append('td').style('padding', '8px')
			fillCoefficientTermname(tw, termNameTd)

			if (termdata.fields) {
				// create only 1 row for this term in coefficients table, as it doesn't have categories

				// col 2: category column
				{
					const td = tr.append('td').style('padding', '8px')
					fillColumn2coefficientsTable(td, tw)
				}

				// col 3
				forestPlotter(tr.append('td'), termdata.fields)
				// rest of columns
				for (const v of termdata.fields) {
					tr.append('td').text(v).style('padding', '8px')
				}
			} else if (termdata.categories) {
				// term has categories, create one sub-row for each category in coefficient tables

				const orderedCategories = []
				const input = self.getIndependentInput(tid)
				if (input.orderedLabels) {
					// reorder rows by predefined order
					for (const k of input.orderedLabels) {
						if (termdata.categories[k]) orderedCategories.push(k)
					}
				}
				for (const k in termdata.categories) {
					if (!orderedCategories.includes(k)) orderedCategories.push(k)
				}

				// multiple categories
				// show first category as full row, with first cell spanning rest of categories
				termNameTd.attr('rowspan', orderedCategories.length).style('vertical-align', 'top')

				let isfirst = true
				for (const k of orderedCategories) {
					if (isfirst) {
						isfirst = false
					} else {
						// create new row starting from 2nd category
						tr = table.append('tr').style('background', rowcount++ % 2 ? '#eee' : 'none')
					}

					// col 2
					const td = tr.append('td').style('padding', '8px')
					fillColumn2coefficientsTable(td, tw, k)

					// col 3
					forestPlotter(tr.append('td'), termdata.categories[k])

					// rest of columns
					for (const v of termdata.categories[k]) {
						tr.append('td').text(v).style('padding', '8px')
					}
				}
			} else {
				tr.append('td').text('ERROR: no .fields[] or .categories{}')
			}
		}

		// interactions
		for (const row of result.coefficients.interactions) {
			const tr = table.append('tr').style('background', rowcount++ % 2 ? '#eee' : 'none')

			const term1 = self.getIndependentInput(row.term1).term
			const term2 = self.getIndependentInput(row.term2).term

			// col 1: variable
			{
				const td = tr.append('td').style('padding', '8px')
				fillTdName(td.append('div'), term1 ? term1.term.name + ' : ' : row.term1 + ' : ')
				fillTdName(td.append('div'), term2 ? term2.term.name : row.term2)
			}
			// col 2: category
			{
				const td = tr.append('td').style('padding', '8px')
				fillColumn2coefficientsTable(td.append('div'), term1, row.category1)
				fillColumn2coefficientsTable(td.append('div'), term2, row.category2)
			}
			// col 3
			forestPlotter(tr.append('td'), row.lst)
			// rest of columns
			for (const v of row.lst) {
				tr.append('td').text(v).style('padding', '8px')
			}
		}

		// last row to show forest plot axis (call function without data)
		const tr = table.append('tr')
		tr.append('td') // col 1
		tr.append('td') // col 2
		forestPlotter(tr.append('td')) // col 3, axis
		for (const v of result.coefficients.header) tr.append('td')
	}

	self.mayshow_totalSnpEffect = result => {
		if (!result.totalSnpEffect) return
		const div = self.newDiv(result.totalSnpEffect.label)
		const table = div.append('table').style('border-spacing', '0px')

		// header row
		{
			const tr = table.append('tr').style('opacity', 0.4)
			for (const v of result.totalSnpEffect.header) {
				tr.append('td').text(v).style('padding', '8px')
			}
		}

		// total snp effect row
		const tr = table.append('tr').style('background', '#eee')
		for (const v of result.totalSnpEffect.lst) {
			tr.append('td').text(v).style('padding', '8px')
		}
		const snp = self.getIndependentInput(result.totalSnpEffect.snp).term
		const interactions = result.totalSnpEffect.interactions.map(interaction => {
			return {
				t1: self.getIndependentInput(interaction.term1).term,
				t2: self.getIndependentInput(interaction.term2).term
			}
		})
		const bottomInfo = `Total: total effect of removing the snp (${snp.term.name}) and its interactions (${interactions
			.map(interaction => interaction.t1.term.name + ' : ' + interaction.t2.term.name)
			.join(' ; ')}) from the model`
		div
			.append('div')
			.style('margin', '20px 0px 20px 10px')
			.style('font-size', '.8em')
			.style('text-align', 'left')
			.style('color', '#999')
			.text(bottomInfo)
	}

	self.mayshow_type3 = result => {
		if (!result.type3) return
		const div = self.newDiv(result.type3.label)
		const table = div.append('table').style('border-spacing', '0px')

		// header row
		{
			const tr = table.append('tr').style('opacity', 0.4)
			for (const v of result.type3.header) {
				tr.append('td').text(v).style('padding', '8px')
			}
		}

		// intercept row
		if (self.config.regressionType != 'cox') {
			const tr = table.append('tr').style('background', '#eee')
			for (const v of result.type3.intercept) {
				tr.append('td').text(v).style('padding', '8px')
			}
		}

		// term rows
		// independent terms (no interaction)
		let rowcount = self.config.regressionType == 'cox' ? 1 : 0
		for (const tid in result.type3.terms) {
			// get term data
			const termdata = result.type3.terms[tid]
			const tw = self.getIndependentInput(tid).term
			let tr = table.append('tr').style('background', rowcount++ % 2 ? '#eee' : 'none')
			// col 1: variable
			const termNameTd = tr.append('td').style('padding', '8px')
			fillTdName(termNameTd, tw.term.name)
			// rest of columns
			for (const v of termdata) {
				tr.append('td').text(v).style('padding', '8px')
			}
		}
		// interactions
		for (const row of result.type3.interactions) {
			const tr = table.append('tr').style('background', rowcount++ % 2 ? '#eee' : 'none')
			const t1 = self.getIndependentInput(row.term1).term
			const t2 = self.getIndependentInput(row.term2).term
			// col 1: variable
			const td = tr.append('td').style('padding', '8px')
			fillTdName(td.append('div'), t1.term.name + ' : ')
			fillTdName(td.append('div'), t2.term.name)
			// rest of columns
			for (const v of row.lst) {
				tr.append('td').text(v).style('padding', '8px')
			}
		}
	}

	self.mayshow_tests = result => {
		if (!result.tests) return
		const div = self.newDiv(result.tests.label)
		const table = div.append('table').style('border-spacing', '0px')
		const header = table.append('tr').style('opacity', 0.4)
		for (const cell of result.tests.header) {
			header.append('td').text(cell).style('padding', '8px')
		}
		let rowcount = 0
		for (const row of result.tests.rows) {
			const tr = table.append('tr').style('background', rowcount++ % 2 ? 'none' : '#eee')
			for (const cell of row) {
				tr.append('td').text(cell).style('padding', '8px')
			}
		}
	}

	self.mayshow_other = result => {
		if (!result.other) return
		const div = self.newDiv(result.other.label)
		const table = div.append('table').style('border-spacing', '8px')
		for (let i = 0; i < result.other.header.length; i++) {
			const tr = table.append('tr')
			tr.append('td').style('opacity', 0.4).text(result.other.header[i])
			tr.append('td').text(result.other.rows[i])
		}
	}

	/*
	the function takes all data rows (except intercept) from coefficients table, and return a callback
	the callback closures the axis range of all data
	run callback on each coefficient table row to plot the forest plot

	collect all numeric data points from terms/interactons
	to derive forest plot axis range
	sort numbers in an array
	in logistic, if array[i]=0 then cannot use log(0) as axis min,
	in that case should use array[i+1] or next to find the smallest real number as axis min
	an arbitary cap is used to guard against extreme estimate values
	*/
	self.getForestPlotter = (terms, interactions) => {
		// array indices are the same for both non-interacting and interacting rows
		let midIdx, // array index of the beta/odds ratio
			CIlow, // array(column) index of low end of confidence interval of midIdx
			CIhigh, // array index of high end of confidence interval
			axislab, // data type to show as axis label
			baselineValue, // baseline value to show a vertical line
			// min/max value capping the axis, to guard against extreme estimates
			// only used for logistic odds ratio
			// for linear, will use actual range from estimates and confidence interval
			capMin,
			capMax
		if (self.config.regressionType == 'linear') {
			midIdx = 0
			CIlow = 1
			CIhigh = 2
			axislab = 'Beta value'
			baselineValue = 0
			capMin = null
			capMax = null
		} else if (self.config.regressionType == 'logistic') {
			midIdx = 0
			CIlow = 1
			CIhigh = 2
			axislab = 'Odds ratio'
			baselineValue = 1
			capMin = 0.1
			capMax = 10
		} else if (self.config.regressionType == 'cox') {
			midIdx = 0
			CIlow = 1
			CIhigh = 2
			axislab = 'Hazard ratio'
			baselineValue = 1
			capMin = 0.1
			capMax = 10
		} else {
			throw 'unknown regressionType'
		}

		// collect mid/CIlow/CIhigh numeric values into a flat array
		const values = []
		for (const tid in terms) {
			const d = terms[tid]
			if (d.fields) {
				numbers2array(d.fields)
			} else {
				for (const k in d.categories) {
					numbers2array(d.categories[k])
				}
			}
		}
		for (const i of interactions) {
			numbers2array(i.lst)
		}

		if (values.length == 0) {
			// no valid estimates
			// return blank function for inability to make plot
			return () => {}
		}

		// all valid numbers are collected into values[]
		values.sort((a, b) => a - b) // ascending

		if (capMin == null) {
			// use actual range as cap; all values are valid numbers
			capMin = values[0]
			capMax = values[values.length - 1]
		}

		// graph dimension
		const width = 150 // plottable dimension
		const height = 20
		const xleftpad = 10,
			xrightpad = 10 // leave space for axis

		const scale = get_scale(values)

		// todo: logistic, add center line; linear: 0 value
		return (td, lst) => {
			if (!scale) {
				// scale is not built, do not plot
				return
			}

			// lst is data from a row from either terms or interactions

			const svg = td
				.append('svg')
				.attr('width', width + xleftpad + xrightpad)
				.attr('height', height)
			const g = svg.append('g').attr('transform', 'translate(' + xleftpad + ',0)')

			if (!lst) {
				//////////////////////////////
				// no data; render axis instead

				// do not apply this format for linear regression,
				// had encountered a bug that '.1r' will print "20" at the tick of "15"
				const tickFormat = self.config.regressionType == 'logistic' ? '.1r' : undefined

				const axis = axisBottom().ticks(4, tickFormat).scale(scale)
				axisstyle({
					axis: g.call(axis),
					color: forestcolor,
					showline: true
				})
				const fontsize = 12
				g.append('text')
					.attr('fill', forestcolor)
					.text(axislab)
					.attr('x', width / 2)
					.attr('y', height + fontsize)
				svg.attr('height', height + fontsize)
				return
			}

			{
				// vertical baseline
				const x = scale(baselineValue)
				g.append('line').attr('x1', x).attr('y1', 0).attr('x2', x).attr('y2', height).attr('stroke', '#ccc')
			}

			const mid = Number(lst[midIdx]),
				cilow = Number(lst[CIlow]),
				cihigh = Number(lst[CIhigh])
			if (Number.isNaN(mid)) {
				// not plottable
				return
			}

			g.append('circle')
				.attr('cx', scale(Math.min(Math.max(mid, capMin), capMax)))
				.attr('cy', height / 2)
				.attr('r', 3)
				.attr('fill', forestcolor)

			if (Number.isNaN(cilow) || Number.isNaN(cihigh)) {
				// cannot plot confidence interval
				return
			}

			// confidence interval
			g.append('line')
				.attr('x1', scale(Math.min(Math.max(cilow, capMin), capMax)))
				.attr('y1', height / 2)
				.attr('x2', scale(Math.min(Math.max(cihigh, capMin), capMax)))
				.attr('y2', height / 2)
				.attr('stroke', forestcolor)
		}
		///////// helpers
		function numbers2array(lst) {
			const m = Number(lst[midIdx])
			if (!Number.isNaN(m)) values.push(m)
			const l = Number(lst[CIlow]),
				h = Number(lst[CIhigh])
			if (!Number.isNaN(l) && !Number.isNaN(h)) {
				// if either low/high is NA, do not use
				// this prevent the case of low=NA, high=3e+41 (somehow high is extremely large value)
				values.push(l)
				values.push(h)
			}
		}
		function get_scale(values) {
			if (self.config.regressionType == 'logistic') {
				// apply log to odds ratio
				// iterate to find a non-0 value
				let i = 0
				while (values[i] <= 0) {
					i++
				}
				if (i >= values.length || values[i] <= 0) {
					// no valid value, won't build scale
					return
				}
				const min = values[i]
				const max = values[values.length - 1]
				return scaleLog()
					.domain([Math.max(min, capMin), Math.min(max, capMax)])
					.range([0, width])
					.nice()
			}
			if (self.config.regressionType == 'linear' || self.config.regressionType == 'cox') {
				return scaleLinear()
					.domain([Math.max(values[0], capMin), Math.min(values[values.length - 1], capMax)])
					.range([0, width])
			}
			throw 'unknown type'
		}
	}
}

function fillTdName(td, name) {
	if (name.length < 40) {
		td.text(name)
	} else {
		td.text(name.substring(0, 35) + ' ...').attr('title', name)
	}
}
function fillCoefficientTermname(tw, td) {
	// fill column 1 <td> using term name, may also show refGrp and reference allele
	fillTdName(td, tw.term.name || tid)

	if (tw.q.mode != 'spline' && 'refGrp' in tw && tw.refGrp != refGrp_NA) {
		// do not display ref for spline variable
		td.append('div')
			.style('font-size', '.8em')
			.style('opacity', 0.6)
			.html(
				'<span style="padding:1px 5px;border:1px solid #aaa;border-radius:10px;font-size:.7em">REF</span> ' +
					(tw.term.values && tw.term.values[tw.refGrp] ? tw.term.values[tw.refGrp].label : tw.refGrp) +
					'</span>'
			)
	}

	if (tw.effectAllele) {
		// only for snplst term
		td.append('div')
			.style('font-size', '.8em')
			.style('opacity', 0.6)
			.html(
				'<span style="padding:1px 5px;border:1px solid #aaa;border-radius:10px;font-size:.7em">EFFECT ALLELE</span> ' +
					tw.effectAllele +
					'</span>'
			)
	}
}

function make_mds3_variants(tw, resultLst) {
	/* return a list of variants as mds3 client-side custom data
	tw:
		term:
			snps[ {} ]
				snpid
				mlst[]
					element: {alt/class/dt/mname}
		q{}
			snp2effAle:{}

	resultLst: [{data,id},{data,id},...]
	*/
	const mlst = []
	for (const snp of tw.term.snps) {
		const m = {
			chr: snp.chr,
			pos: snp.pos,
			ssm_id: snp.snpid // needed for highlighting dot
		}
		mlst.push(m)
		// decide class/mname for this based on effect allele
		const effAle = tw.q.snp2effAle[snp.snpid]
		const m2 = snp.mlst.find(i => i.alt == effAle)
		if (m2) {
			// eff ale is an alt allele, transfer its class to m
			Object.assign(m, m2)
		} else {
			// eff allele is not an alterative allele!
			// just use the class of the first alt allele
			Object.assign(m, snp.mlst[0])
		}

		// set default values as missing, to be able to show all variants in track
		// overwrite with real values if found in result
		m.regressionPvalue = 'NA'
		m.mlpv = 0 // display the dot at the bottom

		const thisresult = resultLst.find(i => i.id == snp.snpid)
		if (!thisresult) {
			// missing result for this variant, caused by variable-skipping in R
			m.regressionResult = {
				data: {
					err: ['No result for this variant at ' + snp.snpid]
				}
			}
			continue
		}
		// reg result is found for this snp; can call displayResult_oneset
		m.regressionResult = thisresult // for displaying via click_snvindel()

		const d = thisresult.data
		if (!d) throw '.data{} missing'

		if (d.type3) {
			/* result has type3 section, this variant has AF>cutoff and used for model-fitting
			show this variant as a dot, do not set .shapeTriangle=true
			find p-value in regression results
			*/
			const v = getSnpPvalueFromRegressionResults(d, snp.snpid)
			if (v == undefined) {
				// no valid pvalue from regression results
			} else {
				// has valid pvalue from regression results
				m.regressionPvalue = v
				m.mlpv = -Math.log10(v)
			}

			// assign estimate, for tooltip display
			if (!d.coefficients || !d.coefficients.terms) throw '.data.coefficients.terms{} missing'
			const r = d.coefficients.terms[snp.snpid]
			if (!r) throw 'snp missing from data.coefficients.terms{}'
			if (Array.isArray(r.fields)) {
				// has fields[], snp is used as additive/dominant/recessive
				m.regressionEstimate = r.fields[0]
			} else if (r.categories) {
				// has categories{}: {C/T: Array(6), T/T: Array(6)}
				// snp is used by genotype
				const lst = []
				for (const gt in r.categories) {
					lst.push(gt + ':' + r.categories[gt][0])
				}
				m.regressionEstimate = ' ' + lst.join(' ')
			} else {
				throw 'unknown way to get snp estimates from coefficients table'
			}
		} else if (d.fisher) {
			/* { pvalue:float, table:[] }
			this variant is tested by fisher, show as triangle
			*/
			m.regressionPvalue = d.fisher.pvalue
			m.mlpv = -Math.log10(d.fisher.pvalue)
			m.shapeTriangle = true
		} else if (d.wilcoxon) {
			/* { pvalue:float }
			this variant is tested by wilcoxon, show as triangle
			*/
			m.regressionPvalue = d.wilcoxon.pvalue
			m.mlpv = -Math.log10(d.wilcoxon.pvalue)
			m.shapeTriangle = true
		} else if (d.cuminc) {
			/* { pvalue:float }
			this variant is tested by cuminc, show as triangle
			*/
			m.regressionPvalue = d.cuminc.pvalue
			m.mlpv = -Math.log10(d.cuminc.pvalue)
			m.shapeTriangle = true
		} else {
			// none of above. is monomorphic, show as hollow circle
			m.shapeCircle = true
		}
	}
	return mlst
}

async function createGenomebrowser(self, input, resultLst) {
	// create block instance that harbors the mds3 track for showing variants from the snplocus term
	// input is the snplocus Input instance
	const arg = {
		holder: self.dom.snplocusBlockDiv,
		genome: self.parent.genomeObj,
		chr: input.term.q.chr,
		start: input.term.q.start,
		stop: input.term.q.stop,
		nobox: true,
		tklst: [],
		onCoordinateChange: async rglst => {
			// at the mds3 track, clear highlights added before
			// so that nothing is highlighted by default in updated data
			for (const t of self.snplocusBlock.tklst) {
				if (t.type == 'mds3') delete t.skewer.hlssmid
			}

			const { chr, start, stop } = rglst[0]
			// temporary tw as override for pill.runCallback()
			const overrideTw = {
				term: {
					id: input.term.term.id,
					type: 'snplocus'
				},
				q: JSON.parse(JSON.stringify(input.term.q))
			}
			overrideTw.q.chr = chr
			overrideTw.q.start = start
			overrideTw.q.stop = stop
			// call fillTW of snplocus.js to recompute tw.term.snps[] and cache file
			const _ = await import('../termsetting/handlers/snplocus')
			await _.fillTW(overrideTw, self.app.vocabApi)
			/*
			updated term info (term.snps[] and q.cacheid etc) are now in overrideTw
			call pill.runCallback() with this override
			which in turn calls editConfig() and
			dispatch action and write the updated tw into state;
			state change will trigger pill.main()
			to propagate updated data to termsetting instance

			* Note *
			it is incorrect to call pill.main() or inputs.editConfig() here

			action dispatch will contain hasUnsubmittedEdits=true,
			effect of which is to hide result UI and require user to click submit button to rerun analysis
			set a single-use flag to nullify it so results.js can automatically run analysis
			so user can continuously look at genome browser
			without break/interruption to user experience
			*/
			self.hasUnsubmittedEdits_nullify_singleuse = true
			input.pill.runCallback(overrideTw)
		}
	}

	// add mds3 tk
	arg.tklst.push({
		type: 'mds3', // tkt.mds3
		name: 'Variants',
		skewerModes: [
			{
				type: 'numeric',
				byAttribute: 'mlpv', // corresponds to the "mlpv" attribute in m{}, can be anything
				label: '-log10 p-value',
				inuse: true,
				tooltipPrintValue: m => getMtooltipValues(m, self.config.regressionType)
			}
		],
		custom_variants: make_mds3_variants(input.term, resultLst),
		variantShapeName: {
			dot: 'common variants analyzed by model-fitting',
			triangle:
				'rare variants analyzed by ' +
				(self.config.regressionType == 'linear'
					? 'Wilcoxon rank sum test'
					: self.config.regressionType == 'logistic'
					? "Fisher's exact test"
					: 'Cumulative incidence test'),
			circle: 'monomorphic variants skipped'
		},
		click_snvindel: async m => {
			self.displayResult_oneset(m.regressionResult.data)
			await mayCheckLD(m, input, self)
			const result_y = self.dom.oneSetResultDiv.node().getBoundingClientRect().top + window.scrollY
			const nav_height = document.querySelector('.sjpp-nav').getBoundingClientRect().height
			window.scroll({ behavior: 'smooth', top: result_y - nav_height })
		}
	})

	first_genetrack_tolist(self.parent.genomeObj, arg.tklst)
	const _ = await import('../src/block')
	return new _.Block(arg)
}

async function updateMds3Tk(self, input, resultLst) {
	// browser is already created
	// find the mds3 track
	const tk = self.snplocusBlock.tklst.find(i => i.type == 'mds3')
	// apply new sets of variants and results to track and render
	tk.custom_variants = make_mds3_variants(input.term, resultLst)
	// if user changes position using termsetting ui,
	// input.term.q{} will hold different chr/start/stop than block
	// and block will need to update coord
	const r = self.snplocusBlock.rglst[0]
	if (r.chr == input.term.q.chr && r.start == input.term.q.start && r.stop == input.term.q.stop) {
		// coord is the same between input and block
		// only need to rerender tk
		tk.load()
	} else {
		await self.snplocusBlock.jump_1basedcoordinate(input.term.q)
	}
	self.snplocusBlock.cloakOff()
}

const LDcolor0 = '#2E6594',
	LDcolor1 = '#ff0000',
	LDcolorScale = interpolateRgb(LDcolor0, LDcolor1)

async function mayCheckLD(m, input, self) {
	/*
	m: the mutation data object for the clicked dot in mds3 tk
		{chr, pos, ref, alt}
	input: the snplocus Input instance
	self: result instance
	*/
	if (!input.term.q.restrictAncestry) {
		// requires restrictAncestry
		// may also support ld overlay without specifying an ancestry
		return
	}
	const tk = self.snplocusBlock.tklst.find(i => i.type == 'mds3')
	if (!tk || !tk.skewer || !tk.skewer.nmg) return

	// clear old result
	for (const m of tk.custom_variants) delete m.regressionR2

	const wait = self.dom.LDresultDiv.append('span').text('Loading LD data...')

	try {
		const data = await self.app.vocabApi.getLDdata(input.term.q.restrictAncestry.name, m)
		if (data.error) throw data.error

		if (data.nodata || !data.lst || data.lst.length == 0) {
			// either dataset does not have ld tracks, or no ld track found by name
			// or no ld data retrieved using given variant
			// restore color in case dots have been colored by ld in a prior click
			wait.text('No LD data')
			tk.skewer.nmg.selectAll('.sja_aa_disk_fill').attr('fill', m => (m.shapeCircle ? 'none' : tk.color4disc(m)))
			return
		}
		tk.skewer.nmg.selectAll('.sja_aa_disk_fill').attr('fill', m2 => {
			if (m2.pos == m.pos && m2.ref == m.ref && m2.alt == m.alt) {
				// same as m
				return LDcolor1
			}
			for (const i of data.lst) {
				if (i.pos == m2.pos && i.alleles == m2.ref + '.' + m2.alt) {
					// matched, record new result for displaying in hover tooltip
					m2.regressionR2 = i.r2
					return LDcolorScale(i.r2)
				}
			}
			return LDcolorScale(0)
		})

		wait.html(input.term.q.restrictAncestry.name + ' LD r<sup>2</sup>')
		showLDlegend(self.dom.LDresultDiv, LDcolorScale)
	} catch (e) {
		wait.text('Error: ' + (e.message || e))
	}
}

export function showLDlegend(div, colorScale) {
	const colorbardiv = div.append('span').style('margin-left', '10px')
	const colorlst = []
	for (let i = 0; i <= 1; i += 0.1) {
		colorlst.push(colorScale(i))
	}
	const svg = colorbardiv.append('svg')
	const axisheight = 20
	const barheight = 15
	const xpad = 10
	const axiswidth = 150
	axisstyle({
		axis: svg
			.append('g')
			.attr('transform', 'translate(' + xpad + ',' + axisheight + ')')
			.call(
				axisTop()
					.scale(scaleLinear().domain([0, 1]).range([0, axiswidth]))
					.ticks(4)
			),
		fontsize: 12
	})

	const id = 'grad' + Math.random()
	const grad = svg.append('defs').append('linearGradient').attr('id', id)
	grad.append('stop').attr('offset', '0%').attr('stop-color', colorlst[0])
	grad
		.append('stop')
		.attr('offset', '100%')
		.attr('stop-color', colorlst[colorlst.length - 1])
	svg
		.append('rect')
		.attr('x', xpad)
		.attr('y', axisheight)
		.attr('width', axiswidth)
		.attr('height', barheight)
		.attr('fill', `url(#${id})`)

	svg.attr('width', xpad * 2 + axiswidth).attr('height', axisheight + barheight)
}

function getMtooltipValues(m, regressionType) {
	const lst = [{ k: 'p-value', v: m.regressionPvalue }]
	if (m.regressionResult.AFstr) {
		lst.push({ k: 'AF', v: m.regressionResult.AFstr })
	}
	if (m.regressionEstimate) {
		if (regressionType == 'linear') lst.push({ k: 'beta', v: m.regressionEstimate })
		else if (regressionType == 'logistic') lst.push({ k: 'odds ratio', v: m.regressionEstimate })
		else if (regressionType == 'cox') lst.push({ k: 'hazard ratio', v: m.regressionEstimate })
		else throw 'unknown regression type'
	}
	if (m.regressionR2) {
		lst.push({ k: 'LD r2', v: m.regressionR2 })
	}
	return lst
}

function getSnpPvalueFromRegressionResults(d, snpid) {
	let str
	if (d.totalSnpEffect) {
		// snp has interactions
		// use p-value from total snp effect table
		str = d.totalSnpEffect.lst[d.totalSnpEffect.lst.length - 1]
	} else {
		// snp has no interactions
		// use p-value from type3 stats table
		if (!d.type3.terms) throw '.data{type3:{terms}} missing'
		if (!d.type3.terms[snpid]) throw snpid + ' missing in type3.terms{}'
		if (!Array.isArray(d.type3.terms[snpid])) throw `type3.terms[${snp.snpid}] not array`
		str = d.type3.terms[snpid][d.type3.terms[snpid].length - 1]
	}
	const v = Number(str) // p-value string can be 'NA'
	if (Number.isFinite(v)) {
		return v
	}
	return undefined
}

function fillColumn2coefficientsTable(div, tw, categoryKey) {
	if (categoryKey) {
		div.text(tw && tw.term.values && tw.term.values[categoryKey] ? tw.term.values[categoryKey].label : categoryKey)
		return
	}
	// the term doesn't have category, so indicate helpful status
	div.style('opacity', 0.3) // also gray out text to differentiate it from a category
	if ('geneticModel' in tw.q) {
		const v = tw.q.geneticModel
		div.text(v == 0 ? '(additive)' : v == 1 ? '(dominant)' : '(recessive)')
		return
	}
	if (tw.q.mode) {
		div.text('(' + tw.q.mode + ')')
		return
	}
}
