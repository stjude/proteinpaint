export function fileSize(v) {
	if (v > 1e9) return (v / 1e9).toFixed(2) + ' GB'
	if (v > 1e6) return (v / 1e6).toFixed(2) + ' MB'
	if (v > 1e3) return (v / 1e3).toFixed(2) + ' KB'
	return v + ' Bytes'
}
