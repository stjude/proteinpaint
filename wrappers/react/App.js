import React from 'react'
import ProteinPaint from './proteinpaint'

const message = 'ProteinPaint React wrapper is ready to roll!'
const style = {
	padding: '10px',
	color: '#666'
}

class App extends React.Component {
	constructor(props) {
		super(props)
		this.state = {
			message,
			host: this.props.serverdata.host,
			basepath: this.props.serverdata.basepath
		}
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
				<div>
					<ProteinPaint host={this.state.host} />
				</div>
			</div>
		)
	}
}

export default App
