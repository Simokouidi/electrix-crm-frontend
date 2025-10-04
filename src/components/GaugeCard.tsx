import React from 'react'

export type GaugeBand = { from: number; to: number; label: string }

/**
 * GaugeCard — Semi-circle gauge (0–100) with colored bands + needle.
 * Bottom semicircle (left → right), band overlap to avoid gaps.
 */
export default function GaugeCard({
	title,
	score,
	valueText,
	subtitle,
	bands = [
		{ from: 0, to: 20, label: 'Poor' },
		{ from: 20, to: 40, label: 'Fair' },
		{ from: 40, to: 60, label: 'Good' },
		{ from: 60, to: 80, label: 'Great' },
		{ from: 80, to: 100, label: 'Excellent' },
	],
	size = 280,
	compact = false,
}: {
	title: string
	score: number
	valueText?: string
	subtitle?: string
	bands?: GaugeBand[]
	size?: number
	compact?: boolean
}){
	const clamped = Math.max(0, Math.min(100, Math.round(score)))
	const effectiveSize = compact ? Math.min(size, 230) : size
	const radius = effectiveSize / 2 - (compact ? 12 : 14)
	const cx = effectiveSize / 2
	const cy = effectiveSize / 1.5

	// Bottom semicircle mapping (π → 2π)
	const pctToAngle = (p: number) => Math.PI + (Math.PI * (p / 100))

	const angleToPoint = (r: number, a: number) => ({
		x: cx + r * Math.cos(a),
		y: cy + r * Math.sin(a),
	})

	const endPctGreaterThanHalf = (startPct: number, endPct: number) => (endPct - startPct) > 50

	const arcPath = (r: number, startPct: number, endPct: number) => {
		const start = angleToPoint(r, pctToAngle(startPct))
		const end = angleToPoint(r, pctToAngle(endPct))
		const largeArc = endPctGreaterThanHalf(startPct, endPct) ? 1 : 0
		const sweepFlag = 1
		return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${end.x} ${end.y}`
	}

	const needleAngle = pctToAngle(clamped)
	const needleInner = { x: cx, y: cy }
	const needleTip = angleToPoint(radius, needleAngle)

	const bandColors = ['#ef4444','#f59e0b','#fbbf24','#86efac','#22c55e']
	const EPS = 0.25

	return (
		<div className={`bg-white rounded-2xl shadow-sm ${compact ? 'p-4' : 'p-5'}`}>
			<div className="text-sm text-slate-500 mb-1">{title}</div>
			<div className="w-full flex items-center justify-center">
				<svg width={effectiveSize} height={effectiveSize/1.35} viewBox={`0 0 ${effectiveSize} ${effectiveSize}`}>
					{bands.map((b, i) => (
						<path
							key={`${b.from}-${b.to}-${i}`}
							d={arcPath(
								radius,
								Math.max(0, b.from - EPS),
								Math.min(100, b.to + EPS)
							)}
							stroke={bandColors[i % bandColors.length]}
							strokeWidth={compact ? 18 : 22}
							fill="none"
							strokeLinecap="butt"
							strokeLinejoin="round"
							opacity={0.9}
						/>
					))}

					{/* Bottom arc cut-out for subtle rim */}
					<path
						d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
						stroke="#e5e7eb"
						strokeWidth={compact ? 16 : 20}
						fill="none"
						opacity={0.35}
					/>

					{/* Needle */}
					<line x1={needleInner.x} y1={needleInner.y} x2={needleTip.x} y2={needleTip.y} stroke="#111827" strokeWidth={3} strokeLinecap="round" />

					{/* Center value */}
					<text x={cx} y={cy + (compact ? 22 : 28)} textAnchor="middle" className="fill-slate-900" style={{ fontSize: compact ? 24 : 28, fontWeight: 700 }}>
						{valueText ?? `${clamped}%`}
					</text>
				</svg>
			</div>
			{subtitle && <div className="text-xs text-slate-500 text-center -mt-2">{subtitle}</div>}
		</div>
	)
}
