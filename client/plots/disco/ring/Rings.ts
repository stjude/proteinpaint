import Label from '../label/Label.ts'
import Ring from './Ring.ts'
import Chromosome from '../chromosome/Chromosome.ts'
import Labels from '../label/Labels.ts'
import SnvArc from '../snv/SnvArc.ts'
import CnvArc from '../cnv/CnvArc.ts'
import LohArc from '../loh/LohArc.ts'

export default class Rings {
	labelsRing: Labels<Label>
	chromosomesRing: Ring<Chromosome>
	nonExonicArcRing?: Ring<SnvArc>
	snvArcRing?: Ring<SnvArc>
	cnvArcRing?: Ring<CnvArc>
	lohArcRing?: Ring<LohArc>

	constructor(
		labelsRing: Labels<Label>,
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
