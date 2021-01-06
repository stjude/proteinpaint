import React from 'react'
import { getPpReact, getLolliplotTrack } from '../PpReact'

const PpReact = getPpReact(React, getLolliplotTrack)

const message = 'This portal is using the pp-react wrapper to embed ProteinPaint.'
const style = {
	padding: '10px',
	color: '#666'
}

const btn_style = {
	margin: '2px 10px'
}

const align_top = {
	verticalAlign: 'top'
}

const div_style = {
	display: 'block',
	padding: '2px 10px'
}

const genes = [
	{ name: 'KRAS', ensembl_id: 'ENSG00000133703' },
	{ name: 'AKT1', ensembl_id: 'ENSG00000142208' },
	{ name: 'TP53', ensembl_id: 'ENSG00000141510' },
	{ name: 'ALK', ensembl_id: 'ENSG00000171094' }
]

const primary_sites = [{ name: 'brain' }, { name: 'kidney' }]

const programs = [{ name: 'TCGA' }, { name: 'TARGET' }]

const projects = [{ name: 'TCGA-BRCA' }, { name: 'TCGA-GBM' }]

const disease_types = [{ name: 'gliomas' }, { name: 'plasma cell tumors' }]

const sample_types = [{ name: 'primary tumor' }, { name: 'blood derived normal' }, { name: 'solid tissue normal' }]

export class App extends React.Component {
	constructor(props) {
		super(props)
		this.window = this.props.window ? this.props.window : window
		this.urlpathname = this.window.location.pathname
		// need to remember any existing URL search parameters and hash,
		// to propagate along with any applicable filters
		this.urlsearch = this.window.location.search
		this.urlhash = this.window.location.hash
		this.urlparams = ''
		this.filter_params = { set_id: null, primary_site: [] }
		const params = this.getUrlParams()
		let set_id
		if (params.filters && params.filters.content[0].content.value[0].includes('set_id:')) {
			set_id = params.filters.content[0].content.value[0].split(':').pop()
		}
		let gene = genes.find(g => g.ensembl_id == params.gene)
		if (!gene) gene = genes[0]

		const localStorage = this.window.localStorage
		this.state = {
			message,
			dataKey: this.props.dataKey ? this.props.dataKey : Math.random(),
			host: localStorage.getItem('pphost')
				? localStorage.getItem('pphost')
				: params.hosturl
				? decodeURIComponent(params.hosturl)
				: params.hostport
				? `http://localhost:${params.hostport}`
				: 'http://localhost:3000',
			basepath: localStorage.getItem('ppbasepath') ? localStorage.getItem('ppbasepath') : '',
			gene: gene.name,
			primary_site: [],
			// primary_site_flag: false,
			set_id: set_id ? set_id : 'J4BW1HYBmqgBSxEihjaC',
			set_id_flag: set_id != null, // false,
			set_id_editing: false,
			token_flag: false,
			token_editing: true,
			lastUnrelatedUpdate: +new Date(),
			token: null
		}
		this.setidRef = React.createRef()
		this.tokenRef = React.createRef()
		this.data = {
			host: this.state.host,
			basepath: this.state.basepath,
			token: this.state.token
		}
		this.save()
	}
	render() {
		return (
			<div style={style}>
				{' '}
				{this.state.message}
				<p>
					... hosted at <i style={{ color: 'black' }}>{this.state.host}</i>
				</p>
				<p>
					... and API basepath is <i style={{ color: 'black' }}>{this.state.basepath}</i>
				</p>
				<p> Try some parameters by clicking following buttons!</p>
				{/* genes */}
				<div style={div_style}>
					<div style={{ display: 'inline-block' }}> Genes </div>
					{genes.map((gene, index) => {
						return (
							<button
								key={index}
								style={btn_style}
								onClick={() => this.changeGene(gene.name)}
								disabled={this.state.gene === gene.name}
							>
								{gene.name}
							</button>
						)
					})}
				</div>
				{/* primary sites */}
				<div style={div_style}>
					<div style={{ display: 'inline-block' }}> Primary Sites </div>
					{primary_sites.map((site, index) => {
						return (
							<button
								key={index}
								style={btn_style}
								onClick={() => this.changeSite(site.name)}
								disabled={this.state.primary_site.includes(site.name)}
							>
								{site.name}
							</button>
						)
					})}
				</div>
				<div style={div_style}>
					<input type="checkbox" id={'set_switch'} checked={this.state.set_id_flag} onChange={() => this.ApplySet()} />
					<label htmlFor={'set_switch'}>
						<span style={btn_style}>Apply set_id</span>
					</label>
					<input
						ref={this.setidRef}
						type="text"
						defaultValue={this.state.set_id}
						size="25"
						disabled={!this.state.set_id_editing}
					></input>
					<button style={btn_style} onClick={() => this.editSetid()} disabled={this.state.set_id_editing}>
						Edit
					</button>
					<button style={btn_style} onClick={() => this.submitSetid()} disabled={!this.state.set_id_editing}>
						Submit
					</button>
				</div>
				<div style={div_style}>
					<input
						type="checkbox"
						style={align_top}
						id={'token_switch'}
						checked={this.state.token_flag}
						onChange={() => this.ApplyToken()}
					/>
					<label style={align_top} htmlFor={'token_switch'}>
						<span style={btn_style}>Apply token</span>
					</label>
					<textarea
						ref={this.tokenRef}
						rows="4"
						cols="50"
						disabled={!this.state.token_editing}
						type="password"
					></textarea>
					<button
						style={Object.assign({}, btn_style, align_top)}
						onClick={() => this.editToken()}
						disabled={this.state.token_editing}
					>
						Edit
					</button>
					<button
						style={Object.assign({}, btn_style, align_top)}
						onClick={() => this.submitToken()}
						disabled={!this.state.token_editing}
					>
						Submit
					</button>
				</div>
				<div>
					<PpReact dataKey={this.state.dataKey} window={this.window} />
				</div>
				<div>
					<span>Last unrelated update: {this.state.lastUnrelatedUpdate} </span>
					<button onClick={() => this.updateTime()}>Trigger Update</button>
				</div>
			</div>
		)
	}
	save(data = {}) {
		Object.assign(this.data, data)
		this.window.localStorage.setItem(this.state.dataKey, JSON.stringify(this.data))
	}
	replaceURLHistory() {
		this.window.history.replaceState('', null, this.urlpathname + this.urlparams)
	}
	changeGene(gene) {
		const ensembl_id = genes.find(d => d.name == gene).ensembl_id
		this.urlpathname = `/genes/${ensembl_id}`
		this.filter_params.set_id = this.state.set_id_flag ? this.state.set_id : null
		this.urlparams = this.createUrlFilters()
		this.replaceURLHistory()
		this.setState({ gene })
	}
	changeSite(site) {
		// const primary_site_flag = !this.state.primary_site_flag
		const sites = this.state.primary_site.length ? this.state.primary_site.push(site) : [site]
		this.filter_params.primary_site = sites
		this.urlparams = this.createUrlFilters()
		this.replaceURLHistory()
		this.setState({ primary_site: sites })
	}
	ApplySet() {
		const set_id_flag = !this.state.set_id_flag
		this.filter_params.set_id = set_id_flag ? this.state.set_id : null
		this.urlparams = this.createUrlFilters()
		this.replaceURLHistory()
		this.setState({ set_id_flag })
	}
	editSetid() {
		this.setState({ set_id_editing: !this.state.set_id_editing })
	}
	submitSetid() {
		const set_id = this.setidRef.current.value
		this.filter_params.set_id = set_id
		this.urlparams = this.createUrlFilters()
		this.replaceURLHistory()
		this.setState({
			set_id_flag: true,
			set_id_editing: false,
			set_id
		})
	}
	submitToken() {
		const token = this.tokenRef.current.value
		this.save({ token })
		this.setState({
			token_flag: true,
			token_editing: false,
			token
		})
		//replace actual token with password char
		this.tokenRef.current.value = '●'.repeat(token.length)
	}
	editToken() {
		this.setState({ token_editing: !this.state.token_editing })
	}
	ApplyToken() {
		const token_flag = !this.state.token_flag
		const token = token_flag ? this.state.token : null
		this.save({ token })
		this.setState({ token_flag })
	}
	updateTime() {
		// simulate app state changes that should NOT cause
		// the PpReact wrapper to re-render
		this.setState({ lastUnrelatedUpdate: +new Date() })
	}
	getUrlParams() {
		const loc = this.window.location
		const params = {}
		loc.search
			.substr(1)
			.split('&')
			.forEach(kv => {
				const [key, value] = kv.split('=')
				params[key] = value
			})
		if (params.filters) {
			params['filters'] = JSON.parse(decodeURIComponent(params.filters))
		}
		if (loc.pathname) {
			const url_split = loc.pathname.split('/')
			// do not hardcode the position of /genes/ in the pathname
			const i = url_split.findIndex(d => d === 'genes')
			if (i !== -1) params.gene = url_split[i + 1]
		}
		return params
	}
	createUrlFilters() {
		if (!this.filter_params.set_id && !this.filter_params.primary_site) return this.urlsearch + this.urlhash

		const filter_obj = {
			op: 'AND',
			content: []
		}

		if (this.filter_params.set_id) {
			filter_obj.content.push({
				content: { field: 'cases.case_id', value: ['set_id:' + this.filter_params.set_id] },
				op: 'IN'
			})
		}

		if (this.filter_params.primary_site) {
			filter_obj.content.push({
				content: { field: 'cases.primary_site', value: this.filter_params.primary_site },
				op: 'IN'
			})
		}
		const encoded_filter = encodeURIComponent(JSON.stringify(filter_obj))
		return (this.urlsearch ? this.urlsearch + '&' : '?') + 'filters=' + encoded_filter + this.urlhash
	}
}
