import tape from 'tape'
import { pdfSafeText } from '../downloadMenu'

/*
	Tests:
	- pdfSafeText: characters jsPDF's fonts cannot encode
*/

tape('\n', function (test) {
	test.comment('-***- dom/downloadMenu -***-')
	test.end()
})

tape('pdfSafeText', test => {
	// the bug this exists for: a "Methylated (beta >= 0.5)" bin label printed as `"e0.5`
	test.equal(pdfSafeText('Methylated (beta ≥ 0.5)'), 'Methylated (beta >= 0.5)', 'spells out >=')
	test.equal(pdfSafeText('x ≤ 3'), 'x <= 3', 'spells out <=')
	test.equal(pdfSafeText('Δβ −0.5'), 'delta-beta -0.5', 'spells out the volcano axis, incl. the unicode minus')
	test.equal(pdfSafeText('log₁₀(p)'), 'log10(p)', 'subscripts become digits')
	test.equal(pdfSafeText('rho ρ'), 'rho rho', 'spells out greek used in labels')
	test.equal(pdfSafeText('plain ASCII (n=42)'), 'plain ASCII (n=42)', 'leaves encodable text alone')
	test.end()
})
