import Label from '#plots/disco/label/Label'
import Ring from './Ring'
import Chromosome from '#plots/disco/chromosome/Chromosome'
import Labels from '#plots/disco/label/Labels'
import SnvArc from '#plots/disco/snv/SnvArc'
import CnvArc from '#plots/disco/cnv/CnvArc'
import LohArc from '#plots/disco/loh/LohArc'

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
