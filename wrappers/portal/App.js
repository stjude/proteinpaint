import React from 'react'
import getPpComponent from 'pp-react'

const ProteinPaint = getPpComponent(React)

const message = 'This portal is using the pp-react wrapper to embed ProteinPaint.'
const style = {
	padding: '10px',
	color: '#666'
}

const btn_style = {
	margin: '2px 10px'
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
		this.state = {
			message,
			dataKey: 'abc123',
			host: 'http://localhost:3000',
			basepath: '/',
			genome: 'hg38',
			gene: genes[0].name,
			tracks: [
				{
					type: 'mds3',
					dslabel: 'GDC'
					// gdc customizations
					//set_id: 'set_id:DDw3QnUB_tcD1Zw3Af72'
				}
			],
			set_id: 'DDw3QnUB_tcD1Zw3Af72',
			set_id_flag: false,
			set_id_editing: false,
			lastUnrelatedUpdate: +new Date()
		}
		this.setidRef = React.createRef()
		this.data = {
			host: this.state.host,
			basepath: this.state.basepath,
			genome: this.state.genome,
			gene: genes.find(g => g.name == this.state.gene).transcript,
			tracks: this.state.tracks
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
		if (this.state.set_id_flag) delete this.state.tracks[0].set_id
		else this.state.tracks[0].set_id = 'set_id:' + this.state.set_id
		this.save({ tracks: [this.state.tracks[0]] })
		this.setState({ set_id_flag: !this.state.set_id_flag, tracks: [this.state.tracks[0]] })
	}
	editSetid() {
		this.setState({ set_id_editing: !this.state.set_id_editing })
	}
	submitSetid() {
		this.state.tracks[0].set_id = 'set_id:' + this.setidRef.current.value
		this.save({ tracks: [this.state.tracks[0]] })
		this.setState({
			set_id_flag: true,
			set_id_editing: false,
			tracks: [this.state.tracks[0]],
			set_id: this.setidRef.current.value
		})
	}
	updateTime() {
		this.setState({ lastUnrelatedUpdate: +new Date() })
	}
}
