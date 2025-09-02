import type { Selection } from 'd3-selection'

/*
	Below are aliased d3 generic types, so that the type annotation 
	in other code that use d3-related variables/arguments/returns
	will not be overly verbose or cluttered. 

	See the usage in d3.type.spec.ts, or for example: 
		
	import * as Sel from '../types/d3.d.ts'
	const holder: Sel.Elem = ...
	
	vs 

	import { Selection } from '../types/d3.d.ts'
	const holder: Sel.Div = ...
*/

// most code can use these general element selection types,
// it has the most used methods like .attr(), .style(), .on(), .node(), etc
export type _Element_ = Selection<Element, any, any, any>
export type Elem = Selection<HTMLElement, any, any, any>
export type Div = Selection<HTMLDivElement, any, any, any>
export type Svg = Selection<SVGElement, any, any, any>
export type SvgCircle = Selection<SVGCircleElement, any, any, any>
export type SvgG = Selection<SVGGElement, any, any, any>
export type SvgLine = Selection<SVGLineElement, any, any, any>
export type SvgRect = Selection<SVGRectElement, any, any, any>
export type SvgSvg = Selection<SVGSVGElement, any, any, any>
export type SvgText = Selection<SVGTextElement, any, any, any>

// this is meant to easily type all properties of the this.dom object in an rx component
export type Dom = {
	[selectionName: string]: Div | Svg | SvgG | SvgSvg | Span | Input
}

/*
	Usually, the name of the variable or argument already clearly indicates 
	the expected Element tagName when it is declared as a general Elem type.

	However, more specific DOM element types may used:
	
	- (give examples of commonly experienced d3-related errors due to incorrect 
	  variable/argument types, that could have been detected statically by typescript)

	- (if that is not a common experience, then maybe it's not a priority to 
		annotate d3-related variables, arguments, returns with types 
		-- unless it has the benefit of removing the need to document arguments)

	- (There are lots of other code that cause errors that should be caught statically, 
		such as
		- when a server response changes shape and the client code does not get updated
		- when a dataset js file gets reshaped but validation code does not get updated
		- etc)
*/

export type Span = Selection<HTMLSpanElement, any, any, any>
export type Button = Selection<HTMLButtonElement, any, any, any>
export type Input = Selection<HTMLInputElement, any, any, any>
export type Pane = { header: Div; body: Selection<any, any, any, any> }
export type Table = Selection<HTMLTableElement, any, any, any>
export type Th = Selection<HTMLTableHeaderCellElement, any, any, any>
export type Tr = Selection<HTMLTableRowElement, any, any, any>
export type Td = Selection<HTMLTableDataCellElement, any, any, any>
export type H2 = Selection<HTMLHeadingElement, any, any, any>
