import * as common from '../../src/common'
import { runproteinpaint } from '../../src/app'
import React, { useState } from 'react'
import { render } from 'react-dom'

console.log('.... test wrappers/react/index.jsx')
console.log(React)
console.log(common)

function PpReact() {
	console.log(11)
	const [state, setState] = useState("CLICK ME")
  return <button onClick={() => setState("CLICKED")}>{state}</button>;
}

export default {
	common,
	runproteinpaint,
	PpReact(holder) {
		console.log(19, 'react/index.jsx::PpReact')
		render(<Pp-React />, holder)
	}
}
