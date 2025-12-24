"use client"

import * as React from "react"

export function OrganicBorder({ children, className }: { children: React.ReactNode; className?: string }) {
    const containerRef = React.useRef<HTMLDivElement>(null)
    const patternRef = React.useRef<HTMLSpanElement>(null)
    const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 })
    const [patternWidth, setPatternWidth] = React.useState(0)

    React.useEffect(() => {
        if (!containerRef.current) return

        // Measure pattern width
        if (patternRef.current) {
            setPatternWidth(patternRef.current.offsetWidth)
        }

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height,
                })
            }
        })

        observer.observe(containerRef.current)
        return () => observer.disconnect()
    }, [])

    // Calculate rounded rect path
    const r = 32 // Radius matching rounded-[2rem]
    const w = dimensions.width
    const h = dimensions.height

    // Safe default path if not measured yet
    const pathData = w > 0 && h > 0
        ? `M ${r},0 L ${w - r},0 A ${r},${r} 0 0 1 ${w},${r} L ${w},${h - r} A ${r},${r} 0 0 1 ${w - r},${h} L ${r},${h} A ${r},${r} 0 0 1 0,${h - r} L 0,${r} A ${r},${r} 0 0 1 ${r},0 Z`
        : ""

    return (
        <div ref={containerRef} className={`relative ${className}`}>

            {/* Rotating Text SVG Overlay */}
            <svg
                className="absolute -inset-[20px] w-[calc(100%+40px)] h-[calc(100%+40px)] pointer-events-none z-0"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <path id="borderPath" d={pathData} transform="translate(20, 20)" />
                </defs>

                <text className="font-bold text-[10px] tracking-[3px] uppercase fill-white/80" style={{ textShadow: '0 0 5px rgba(255,255,255,0.5)' }}>
                    {patternWidth > 0 && (
                        <textPath href="#borderPath" startOffset="0">
                            {/* Repeat enough times to cover widely. 
                         If pattern is ~300px and perimeter ~2000px, we need ~7. Use 20 for safety. */}
                            {Array(24).fill("F1 INTELLIGENCE • DRIVEN BY PASSION • ").join("")}
                            <animate attributeName="startOffset" from="0" to={-patternWidth} dur="5s" repeatCount="indefinite" />
                        </textPath>
                    )}
                </text>
            </svg>
            {/* Hidden measurement element */}
            <span ref={patternRef} className="absolute opacity-0 pointer-events-none font-bold text-[10px] tracking-[3px] uppercase whitespace-nowrap">
                F1 INTELLIGENCE • DRIVEN BY PASSION •
            </span>
            {/* Content */}
            <div className="relative z-10">
                {children}
            </div>


        </div>
    )
}
