import React from 'react'
import { runproteinpaint } from '../../src/app'

const btn_style = {
	margin: '2px 10px'
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
			]
		}
		this.myRef = React.createRef()
	}
	componentDidMount() {
		const pp_holder = this.myRef.current
		this.init_pp(pp_holder)
	}
	componentDidUpdate() {
		const pp_holder = this.myRef.current
		pp_holder.querySelector('.sja_root_holder').remove()
		this.init_pp(pp_holder)
	}
	render() {
		return (
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
				<div ref={this.myRef} />
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
}

export default ProteinPaint
