import Label from '../label/Label'
import Ring from './Ring'
import Chromosome from '../chromosome/Chromosome'
import Labels from '../label/Labels'
import SnvArc from '../snv/SnvArc'
import CnvArc from '../cnv/CnvArc'
import LohArc from '../loh/LohArc'

export default class Rings {
	labelsRing: Labels
	chromosomesRing: Ring<Chromosome>
	nonExonicArcRing?: Ring<SnvArc>
	snvArcRing?: Ring<SnvArc>
	cnvArcRing?: Ring<CnvArc>
	lohArcRing?: Ring<LohArc>

	constructor(
		labelsRing: Labels,
		chromosomesRing: Ring<Chromosome>,
		nonExonicArcRing?: Ring<SnvArc>,
		snvArcRing?: Ring<SnvArc>,
		cnvArcRing?: Ring<CnvArc>,
		lohArcRing?: Ring<LohArc>
	) {
		this.labelsRing = labelsRing
		this.chromosomesRing = chromosomesRing
		this.nonExonicArcRing = nonExonicArcRing
		this.snvArcRing = snvArcRing
		this.cnvArcRing = cnvArcRing
		this.lohArcRing = lohArcRing
	}
}
