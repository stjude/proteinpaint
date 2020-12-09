import React from 'react'
import { runproteinpaint } from '../../src/app'

const btn_style = {
	display: 'inline-block',
	margin: '2px 10px'
}

const div_style = {
	display: 'block',
	padding: '2px 10px'
}

class ProteinPaint extends React.Component {
	constructor(props) {
		super(props)
		this.state = {
			noheader: true,
			genome: 'hg38',
			host: this.props.host,
			gene: 'ENST00000407796', // AKT1
			nobox: true,
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
			set_id_editing: false
		}
		this.ppHolderRef = React.createRef()
		this.setidRef = React.createRef()
	}
	componentDidMount() {
		const pp_holder = this.ppHolderRef.current
		this.init_pp(pp_holder)
	}
	componentDidUpdate() {
		if (this.state.set_id_editing) return
		const pp_holder = this.ppHolderRef.current
		pp_holder.querySelector('.sja_root_holder').remove()
		this.init_pp(pp_holder)
	}
	render() {
		return (
			<div style={{ display: 'block' }}>
				<div style={{ display: 'block' }}>
					<button
						style={btn_style}
						onClick={() => this.changeGene('ENST00000407796')}
						disabled={this.state.gene === 'ENST00000407796'}
					>
						AKT1
					</button>
					<button
						style={btn_style}
						onClick={() => this.changeGene('ENST00000269305')}
						disabled={this.state.gene === 'ENST00000269305'}
					>
						TP53
					</button>
					<button
						style={btn_style}
						onClick={() => this.changeGene('ENST00000389048')}
						disabled={this.state.gene === 'ENST00000389048'}
					>
						ALK
					</button>
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
				<div ref={this.ppHolderRef} />
			</div>
		)
	}

	init_pp(holder) {
		runproteinpaint({
			host: this.state.host,
			holder: holder,
			noheader: this.state.noheader,
			genome: this.state.genome,
			gene: this.state.gene,
			nobox: this.state.nobox,
			tracks: this.state.tracks
		})
	}
	changeGene(transcript) {
		this.setState({ gene: transcript, tracks: [this.state.tracks[0]] })
	}
	ApplySet() {
		if (this.state.set_id_flag) delete this.state.tracks[0].set_id
		else this.state.tracks[0].set_id = 'set_id:' + this.state.set_id
		this.setState({ set_id_flag: !this.state.set_id_flag, tracks: [this.state.tracks[0]] })
	}
	editSetid() {
		this.setState({ set_id_editing: !this.state.set_id_editing })
	}
	submitSetid() {
		this.state.tracks[0].set_id = 'set_id:' + this.setidRef.current.value
		this.setState({
			set_id_flag: true,
			set_id_editing: false,
			tracks: [this.state.tracks[0]],
			set_id: this.setidRef.current.value
		})
	}
}

export default ProteinPaint
