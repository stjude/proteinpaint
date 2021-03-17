import React from 'react'
import { PpLolliplot } from '../PpReact'

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

const gdcParamKeys = ['filters', 'gene']

export class AppProps extends React.Component {
	constructor(props) {
		super(props)
		this.filters = this.props.filters ? this.props.filters : null
		const set_filter = this.filters && this.filters.content.find(f => f.content && f.content.field == 'cases.case_id')
		const set_id =
			set_filter && set_filter.content.value[0].includes('set_id:')
				? set_filter.content.value[0].split(':').pop()
				: 'J4BW1HYBmqgBSxEihjaC'
		let gene = genes.find(g => g.ensembl_id == this.props.geneId)
		if (!gene) gene = this.props.ssm_id ? null : genes[0]

		this.state = {
			message,
			basepath: 'basepath' in this.props ? this.props.basepath : '/auth/api/custom/proteinpaint',
			gene: gene && gene.name,
			geneId: gene && gene.ensembl_id,
			set_id,
			set_id_flag: false,
			set_id_editing: false,
			token_flag: false,
			token_editing: true,
			filters: this.filters,
			lastUnrelatedUpdate: +new Date(),
			token: null,
			ssm_id: this.props.ssm_id
		}
		this.setidRef = React.createRef()
		this.tokenRef = React.createRef()
		this.ppRef = React.createRef()
		this.filterJsonRef = React.createRef()
	}
	render() {
		return (
			<div style={style}>
				{' '}
				{this.state.message}
				<p>
					... the API basepath is <i style={{ color: 'black' }}>"{this.state.basepath}"</i>
				</p>
				<p> Try some genes by clicking following buttons!</p>
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
					<div style={{ display: 'inline-block' }}>
						<div style={div_style}>Current filters (JSON)</div>
						<textarea ref={this.filterJsonRef} rows="4" cols="50"></textarea>
						<div style={Object.assign({}, div_style, { display: 'inline-block' }, align_top)}>
							<button style={Object.assign({}, btn_style, align_top)} onClick={() => this.submitFilter()}>
								Submit
							</button>
						</div>
					</div>
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
					<PpLolliplot
						ref={this.ppRef}
						basepath={this.state.basepath}
						geneId={this.state.geneId}
						filters={this.state.filters}
						ssm_id={this.state.ssm_id}
					/>
				</div>
				<div>
					<span>Last unrelated update: {this.state.lastUnrelatedUpdate} </span>
					<button onClick={() => this.updateTime()}>Trigger Unrelated Update</button>
				</div>
			</div>
		)
	}
	componentDidMount() {
		this.filterJsonRef.current.value = this.filters ? JSON.stringify(this.filters, null, '    ') : ''
	}
	changeGene(gene) {
		const ensembl_id = genes.find(d => d.name == gene).ensembl_id
		this.setState({ geneId: ensembl_id })
	}
	ApplySet() {
		const set_id_flag = !this.state.set_id_flag
		this.setFilters(this.state.set_id)
		this.setState({ filters: this.filters, set_id_flag, set_id_editing: true })
	}
	editSetid() {
		this.setState({ set_id_editing: !this.state.set_id_editing })
	}
	submitSetid() {
		console.log(178, 'submitSetid')
		const set_id = this.setidRef.current.value
		setFilters(set_id)
		this.setState({
			set_id_flag: true,
			set_id_editing: false,
			set_id,
			filters: this.filters
		})
	}
	submitFilter() {
		try {
			this.filters = this.filterJsonRef.current.value ? JSON.parse(this.filterJsonRef.current.value) : ''
		} catch (e) {
			const message = 'invalid filter JSON: ' + e
			alert(message)
			throw message
		}
		const set_filter = this.filters && this.filters.content.find(f => f.content && f.content.field == 'cases.case_id')
		const newState = { filters: this.filters, set_id_flag: set_filter ? true : false }
		if (set_filter && set_filter.content.value[0].includes('set_id:')) {
			newState.set_id = set_filter.content.value[0].split(':').pop()
		}
		this.setState(newState)
	}
	ApplyFilter() {
		const filter_flag = !this.state.filter_flag
		const filter_url = filter_flag ? this.state.filter_url : null
		this.setState({ filter_flag })
	}
	editFilter() {
		this.setState({ filter_editing: !this.state.filter_editing })
	}
	async submitToken(tokenval = '', action = '') {
		const token = tokenval ? tokenval : this.tokenRef.current.value
		const response = await fetch('/gdc/ssid', {
			method: 'POST',
			body: JSON.stringify({ token, action })
		})
		if (!response || !response) {
			console.error(response.body, response)
		}
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
	async ApplyToken() {
		const token_flag = !this.state.token_flag
		const token = token_flag ? this.state.token : null
		await this.submitToken(this.state.token, token_flag ? '' : 'delete')
	}
	updateTime() {
		// simulate app state changes that should NOT cause
		// the PpReact wrapper to re-render
		this.setState({ lastUnrelatedUpdate: +new Date() })
	}
	getUrlParams() {
		return {}
	}
	setFilters(set_id) {
		if (!this.filters) {
			this.filters = {
				op: 'AND',
				content: []
			}
		}
		if (!set_id) return

		let set_filter = this.filters.content.find(f => f.content && f.content.field == 'cases.case_id') //.includes('set_id:')
		if (!set_id) {
			if (set_filter) {
				const i = this.filters.content.findIndex(f => f === set_filter)
				this.filters.content.splice(i, 1)
			}
			if (!this.filters.content.length) {
				this.filters = ''
				return this.nonGdcParams + this.urlhash
			}
		}
		if (!set_filter) {
			set_filter = {
				content: { field: 'cases.case_id', value: [] },
				op: 'IN'
			}
			this.filters.content.push(set_filter)
		}
		set_filter.content.value = ['set_id:' + set_id]
	}
}
