/*
	Non-asserted type definition tests 

	manually tested in the client dir with
	
	npx tsc --esModuleInterop --noEmit --allowImportingTsExtensions types/test/d3.type.spec.ts
	
	(or ... types/test/*.type.spec.ts) 
*/

import { Selection, select } from 'd3-selection'
import * as Sel from '../d3'

// ------------
// Declarations
// ------------

// ok
const elem: Sel.Elem = select('body').append('div')
// ok
const div: Sel.Div = elem.append('div')
// ok
const span: Sel.Span = elem.append('span')
// @ts-expect-error, mismatched element tagName
const spanAsDiv: Sel.Div = elem.append('span')
// ok
const spanGen = <Sel.Span>elem.append('span')
// ok - should have caught this non-sensical syntax ???
const spanGen2: Sel.Span = <Sel.Div>elem.append('span')

const dom: Sel.Dom = {
	a: div,
	b: span,
	c: elem.append('svg'),
	// @ts-expect-error, not an HTML or svg selection
	d: 1
}

// ----------------
// Use in functions
// ----------------

function abc(arg: Sel.Div) {
	console.log(arg)
}
// ok
abc(div)
// @ts-expect-error, mismatched argument type
abc(span)
// ok, should be an error !!! this forced type syntax should not be used for generics !!!
abc(span as Sel.Div)
// ok - should have been prevented if the @ts-expect-error comment was removed above this variable's declaration
abc(spanAsDiv)
