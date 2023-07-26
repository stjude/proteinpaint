import Ring from './Ring.ts'
import Chromosome from '#plots/disco/chromosome/Chromosome.ts'
import Labels from '#plots/disco/label/Labels.ts'
import SnvArc from '#plots/disco/snv/SnvArc.ts'
import CnvArc from '#plots/disco/cnv/CnvArc.ts'
import LohArc from '#plots/disco/loh/LohArc.ts'

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
