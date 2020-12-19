import React from 'react'
import { getGDCLolliplot } from 'pp-react'

const ProteinPaint = getGDCLolliplot(React)

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
	{ name: 'AKT1', transcript: 'ENST00000407796' },
	{ name: 'TP53', transcript: 'ENST00000269305' },
	{ name: 'ALK', transcript: 'ENST00000389048' }
]

export default class App extends React.Component {
	constructor() {
		super()
		const params = getUrlParams()
		let set_id
		if (params.filters && params.filters.content[0].content.value[0].includes('set_id:'))
			set_id = params.filters.content[0].content.value[0].split(':').pop()
		this.state = {
			message,
			dataKey: 'abc123',
			host: localStorage.getItem('pphost') ? localStorage.getItem('pphost') : 'http://localhost:3000',
			basepath: '/',
			genome: 'hg38',
			gene: genes[0].name,
			set_id: set_id ? set_id : 'DDw3QnUB_tcD1Zw3Af72',
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
			genome: this.state.genome,
			gene: genes.find(g => g.name == this.state.gene).transcript,
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
				<p> Try some gene by clicking following buttons!</p>
				<div style={{ display: 'block' }}>
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
						style={{ ...btn_style, ...align_top }}
						onClick={() => this.editToken()}
						disabled={this.state.token_editing}
					>
						Edit
					</button>
					<button
						style={{ ...btn_style, ...align_top }}
						onClick={() => this.submitToken()}
						disabled={!this.state.token_editing}
					>
						Submit
					</button>
				</div>
				<div>
					<ProteinPaint dataKey={this.state.dataKey} />
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
		localStorage.setItem(this.state.dataKey, JSON.stringify(this.data))
	}
	changeGene(gene) {
		this.save({ gene: genes.find(d => d.name == gene).transcript })
		this.setState({ gene })
	}
	ApplySet() {
		const set_id_flag = !this.state.set_id_flag
		if (!set_id_flag) window.history.replaceState(null, '', `/portal/`)
		else {
			const encoded_filter = createUrlFilters(this.state.set_id)
			window.history.replaceState(null, '', `/portal/?filters=${encoded_filter}`)
		}
		this.setState({ set_id_flag })
	}
	editSetid() {
		this.setState({ set_id_editing: !this.state.set_id_editing })
	}
	submitSetid() {
		const set_id = this.setidRef.current.value
		window.history.replaceState(null, '', `/portal/?set_id=${set_id}`)
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
		this.setState({ lastUnrelatedUpdate: +new Date() })
	}
}

function getUrlParams() {
	const params = {}
	window.location.search
		.substr(1)
		.split('&')
		.forEach(kv => {
			const [key, value] = kv.split('=')
			params[key] = value
		})
	if (params.filters) {
		params['filters'] = JSON.parse(decodeURIComponent(params.filters))
	}
	return params
}

function createUrlFilters(set_id) {
	const filter_obj = {
		op: 'AND',
		content: [
			{
				content: { field: 'cases.case_id', value: ['set_id:' + set_id] },
				op: 'IN'
			}
		]
	}
	const encoded_filter = encodeURIComponent(JSON.stringify(filter_obj))
	return encoded_filter
}
