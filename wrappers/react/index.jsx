import * as common from '../../src/common'
import { runproteinpaint } from '../../src/app'
import React, { useState } from 'react'
import { render } from 'react-dom'

console.log('.... test wrappers/react/index.jsx')
console.log(common)

function PpReact() {
	const [state, setState] = useState("CLICK ME")
  return (
  	<div style={{width:'100%', textAlign: 'center'}}>
  		<button onClick={() => setState(state == "CLICKED" ? "unclicked" : "CLICKED")}>{state}</button>
  	</div>
  )
}


export default {
	common,
	runproteinpaint,
	PpReact(holder) {
		const elem = render(<PpReact />, holder)
		console.log(23, elem)
	}
}
