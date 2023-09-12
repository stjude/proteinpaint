async function serverDocsInit(opts) {
	if (!opts.extractsJson || !opts.apiJson) throw `missing opts.extractsJson and/or opts.apiJson`
	opts.port = opts.port ? `:${opts.port}` : ''
	if (!opts.basepath) opts.basepath = ''
	const extracts = await fetch(opts.extractsJson)
		.then(r => r.json())
		.catch(console.error)
	const sidebarLinks = d3.select('.tsd-small-nested-navigation')
	const contentDiv = d3.select('.col-content')
	const service = ['request', 'response']
	const routes = await fetch(opts.apiJson)
		.then(r => r.json())
		.catch(console.error)

	const hostOptions = [
		{ label: 'Specification', url: 'spec' },
		{ label: 'local', url: `http://localhost${opts.port}${opts.basepath}` },
		{ label: 'ppr', url: `https://ppr.stjude.org${opts.basepath}` },
		{ label: 'prp1', url: `https://proteinpaint.stjude.org${opts.basepath}` }
	]

	for (const api of routes) {
		api.id = api.endpoint.replace('/', '-')
		const section = contentDiv.append('div').attr('class', 'sjpp-endpoint-div')

		sidebarLinks.append('li').append('a').attr('href', `#${api.id}`).html(api.endpoint)

		section
			.append('h2')
			.attr('id', api.id)
			.attr('class', 'tsd-page-title')
			.style('cursor', 'pointer')
			.html(`<span style='color:#aaa; font-weight: 200; margin-right: 3px'>/</span>${api.endpoint}`)
			.on('click', () => {
				window.location.hash = `#${api.id}`
			})

		section
			.append('div')
			.html(
				`CLI test: from the <span class='code-snippet'>proteinpaint/server</span> dir, ` +
					`<span class='code-snippet'>exportsFilename=src/test/routes.unit.spec.ts npm run test:unit</span>`
			)

		for (const method in api.methods) {
			const m = api.methods[method]
			const Method = method.toUpperCase()
			if (m.description) {
				section.append('h3').html(`${Method}`)
				section.append('div').html(m.description)
			}
			if (m.alternativeFor) {
				section.append('h3').html(`${Method}`)
				section
					.append('div')
					.html(`Alternative method for ${m.alternativeFor.toUpperCase()}, for larger request payloads.`)
				continue
			}
			if (!m.examples) m.examples = [{ request: {}, response: {} }]
			for (const s of service) {
				const serv = m[s]
				if (!serv) continue
				const title = serv.typeId
				const x = title in extracts ? extracts[title] : {}
				const h3 = section.append('h3')
				h3.append('span').html(Method + ' ' + s[0].toUpperCase() + s.slice(1))
				if (title in extracts) {
					const url = `/docs/server/types/${title}.html`
					h3.append('span')
						.attr('class', 'sjpp-h3link')
						.html('typedoc')
						.on('click', () => {
							window.location = url
						})
				}
				if (x.comment) section.append('div').html(x.comment)
				const mainDiv = section.append('div').attr('class', 'sjpp-service-div').style('height', 'fit-content')
				serv.signatureWrapper = mainDiv.append('div').attr('class', 'sjpp-signature-wrapper')
				const toggle = setBtns(serv.signatureWrapper)
				serv.signature = serv.signatureWrapper.append('div')
				if (title in extracts) {
					//console.log(134, title)
					serv.signature.html(x.signature)
					toggle.clickables = serv.signature
						.selectAll('.tsd-kind-type-alias')
						//.attr('href', `#${title}`)
						.filter(function () {
							return this.innerHTML != title
						})
						.datum(toggle)
						.on('click', mayExpand)
					serv.signature.selectAll('.tsd-kind-property').style('cursor', 'pointer').on('click', handlePropClick)
				} else {
					serv.signature
						.append('div')
						.attr('class', 'tsd-signature')
						.append('div')
						.html(JSON.stringify(serv.typeId, null, '   '))
				}

				serv.payloadWrapper = mainDiv.append('div').attr('class', 'sjpp-payload-wrapper')
				serv.payloadPre = serv.payloadWrapper.append('pre').attr('contentEditable', true)
			}

			setHostSelection(api, method, m, section)
		}

		detectCopyable(section)
	}

	// must track the clicked and replaced DOM elements by DOM node;
	// tracking the string keys may not be unique if the same type ID is used
	// in multiple levels of a type declaration
	const clicked = new WeakMap()
	async function mayExpand(event) {
		const t = this.__data__
		const title = this.innerHTML
		const key = this
		if (!clicked.has(key)) {
			const url = `/docs/types/${title}.html`
			const x = extracts[title]
			const div = document.createElement('div')
			d3.select(div).style('display', 'inline-block').style('vertical-align', 'top').html(x.signature)
			const obj = { div, parentNode: this.parentNode, title, orig: this, expanded: false }
			clicked.set(key, obj)
		}
		const c = clicked.get(key)
		if (c.expanded) {
			if (t.inprogress != 'expand') {
				c.parentNode.replaceChild(c.orig, c.div)
				c.expanded = false
			}
		} else if (t.inprogress != 'collapse') {
			c.parentNode.replaceChild(c.div, c.orig)
			c.expanded = true
			const signature = d3.select(c.div)
			const span = signature.select('.tsd-kind-type-alias')
			span.style('font-style', 'italic').style('cursor', 'pointer').html(title)
			const ns = span.node().nextSibling
			if (ns.innerHTML == ':') ns.innerHTML = ''
			clicked.set(span.node(), c)
			signature
				.selectAll('.tsd-signature')
				.style('padding', 0)
				.style('position', 'relative')
				.style('top', 0)
				.style('border', 'none')
			const clickables = signature
				.selectAll('.tsd-kind-type-alias')
				.attr('href', `#${title}`)
				.datum(t)
				.on('click', mayExpand)
			if (t.inprogress) clickables.each(simulateClick)
			signature.selectAll('.tsd-kind-property').style('cursor', 'pointer').on('click', handlePropClick)
		}
		return false
	}

	async function setHostSelection(api, method, m, section) {
		const hostDivs = section
			.selectAll('.sjpp-service-div')
			.selectAll('.sjpp-host-div')
			.data([
				// TODO: enable the left side select, to compare host responses instead of against the spec
				// {hostOptions: structuredClone(hostOptions), x: 200, side: 'left'},
				{ hostOptions: structuredClone(hostOptions), x: 540, side: 'right' }
			])
			.enter()
			.insert('div', 'div')
			.attr('class', 'sjpp-host-div')
			.style('display', 'inline-block')
			.style('position', 'absolute')
			.style('top', '-10px')
			.style('left', d => d.x)
			.style('z-index', 20)

		const hostSelects = hostDivs
			.append('select')
			.attr('class', 'sjpp-host-select')
			.on('change', async function (selectData) {
				//console.log(211, d) //console.log(d, signatureWrapper.node(), payloadWrapper.node())
				const d = selectData.hostOptions[this.selectedIndex]
				selectData.selected = d
				if (d.url == 'spec') {
					section.selectAll('.sjpp-payload-wrapper').style('display', 'none')
					section.selectAll('.sjpp-signature-wrapper').style('width', '').style('display', 'block')
					m.exampleSelect.style('display', 'none')
				} else {
					await fetchData(api, d, method, m, section)
					section.selectAll('.sjpp-signature-wrapper').style('width', '450px').style('display', 'inline-block')
					section.selectAll('.sjpp-payload-wrapper').style('display', 'inline-block')
					m.exampleSelect.style('display', 'inline')
				}

				d3.selectAll('.sjpp-host-select').each(function (sd) {
					if (sd != selectData) return
					d3.select(this).property('value', d.url)
				})

				m.hostBtnsDiv.style('display', d.url == 'spec' ? 'none' : 'inline-block')
			})

		hostSelects
			.selectAll('option')
			.data(d => d.hostOptions)
			.enter()
			.append('option')
			.style('text-align', 'center')
			.attr('value', d => d.url)
			.html(d => d.label)

		m.exampleSelect = hostDivs.append('select').style('display', 'none')
		m.exampleSelect
			.selectAll('option')
			.data(m.examples)
			.enter()
			.append('option')
			.attr('value', (d, i) => i)
			.html((d, i) => `Example #${i}`)

		m.hostBtnsDiv = hostDivs.append('div').style('display', 'none')
		m.hostBtnsDiv
			.append('button')
			.attr('class', 'btn-sm')
			.style('position', 'relative')
			.style('top', '-2px')
			.html('refresh')
			.on('click', function (selectData) {
				const d = selectData.selected
				if (d?.url == 'spec') return
				fetchData(api, d, method, m, section)
			})
		m.hostBtnsDiv
			.append('button')
			.attr('class', 'btn-sm')
			.style('position', 'relative')
			.style('top', '-2px')
			.html('validate')
			.on('click', function (selectData) {
				const d = selectData.selected
				if (d?.url == 'spec') return
				fetchData(api, d, method, m, section, window.ppcheckers[`valid${m.response.typeId}`])
			})
	}

	async function fetchData(api, d, method, m, section, validate = null) {
		const url = d.url + '/' + api.endpoint
		const reqOpts = { method }
		const currExample = m.examples?.[Number(m.exampleSelect.property('value'))]
		const params = method == 'get' ? constructUrlParams(currExample.request?.body || {}) : ''
		if (m.method == 'POST') reqOpts.body = currExample.request.body
		const reqPayload = reqOpts.body //|| m.request.example
		await fetch(url + params, reqOpts)
			.then(r => r.json())
			.then(r => {
				section.selectAll('.sjpp-payload-wrapper pre').each(function (d, i) {
					const data = i % 2 === 0 ? reqPayload : validate ? validate(r) : r
					this.innerText = JSON.stringify(data, null, '  ')
					const sib = this.parentNode.previousSibling
					if (!sib) return
					const box = sib.getBoundingClientRect()
					this.style.height = box.height - 24 + 'px'
				})
			})
			.catch(e => {
				section.selectAll('.sjpp-payload-wrapper pre').each(function (d, i) {
					this.innerText = i === 0 ? JSON.stringify(reqPayload, null, '  ') : e.message || e
					const sib = this.parentNode.previousSibling
					if (!sib) return
					const box = sib.getBoundingClientRect()
					this.style.height = box.height - 24 + 'px'
				})
			})
	}

	function constructUrlParams(obj) {
		const params = []
		for (const [key, value] of Object.entries(obj)) {
			const v = typeof value == 'object' ? JSON.stringify(value) : value
			params.push(key + '=' + v)
		}
		return '?' + params.join('&')
	}

	function setBtns(holder) {
		// clickables to be assigned per signature div
		const toggle = { inprogress: '', clickables: undefined }
		const btnDiv = holder.append('div').attr('class', 'sjpp-signature-btndiv').style('position', 'relative')

		const toggleBtn = btnDiv
			.append('div')
			.style('position', 'absolute')
			.style('bottom', -22)
			.style('right', 0)
			.append('button')
			.attr(
				'title',
				'Click this button to toggle between expanding or collapsing all type signatures.' +
					' You may also click on individual signature IDs (red text) to toggle each type separately.'
			)
			.attr('class', 'btn-sm')
			.html('expand')
			.on('click', () => {
				toggle.inprogress = toggleBtn.text()
				if (toggle.clickables) toggle.clickables.each(simulateClick)
				toggle.inprogress = ''
				toggleBtn.text(toggleBtn.text() == 'expand' ? 'collapse' : 'expand')
				const wrapper = holder.node()
				const sib = wrapper.nextSibling
				if (!sib) return
				const box = wrapper.getBoundingClientRect()
				sib.firstChild.style.height = box.height - 24 + 'px'
			})

		return toggle
	}

	function simulateClick(event) {
		mayExpand.call(this, event)
	}

	const tip = getTip()

	function handlePropClick(target) {
		event.stopPropagation()
		const ns = event.target.nextSibling.nextSibling
		const xdiv = ns.firstChild?.firstChild
		const type = ns?.innerText.trim().split(':')[0].split(' ')[0]
		const typeLabel =
			d3.select(ns).attr('class')?.includes('-type') || (xdiv && d3.select(xdiv).attr('class')?.includes('-type'))
				? `<b>${type}</b>`
				: ''
		const comment = extracts[type]?.comment || '<p>(no parsable comment)</p>'
		tip.show(`${event.target.innerText}: ${typeLabel} ${comment}`)
	}
}

function getTip() {
	const tip = d3.select('body').append('div').attr('class', 'sjpp-tip')

	tip.head = tip
		.append('button')
		.style('position', 'absolute')
		.style('top', '1px')
		.style('right', '1px')
		.style('padding', '1px')
		.style('height', '14px')
		.style('width', '14px')
		.style('line-height', '8px')
		.style('font-size', '12px')
		.style('cursor', 'button')
		.html(`x`)
		.on('click', () => tip.style('display', 'none'))
	tip.body = tip.append('div')

	tip.show = html => {
		tip
			.style('display', '')
			.style('top', event.clientY + 8)
			.style('left', event.clientX + 8)
		tip.body.selectAll('*').remove()
		tip.body.html(html)
		tip.body.selectAll('p').style('margin', '0.5rem 0.25rem')
	}

	tip.hide = () => {
		tip.style('display', 'none')
	}

	d3.select('body').on('click', tip.hide)
	return tip
}
