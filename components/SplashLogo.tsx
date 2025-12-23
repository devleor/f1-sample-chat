"use client"

import React, { useEffect, useRef } from "react"
import { gsap } from "gsap"

interface SplashLogoProps {
    onComplete: () => void
}

export function SplashLogo({ onComplete }: SplashLogoProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const oldLogoRef = useRef<SVGSVGElement>(null)
    const newLogoRef = useRef<SVGSVGElement>(null)

    useEffect(() => {
        const tl = gsap.timeline({
            onComplete: () => {
                // Fade out container then trigger complete
                gsap.to(containerRef.current, {
                    opacity: 0,
                    duration: 0.8,
                    delay: 1, // hold the final state a bit
                    ease: "power2.inOut",
                    onComplete: onComplete
                })
            }
        })

        // Initial State
        gsap.set(newLogoRef.current, { autoAlpha: 0, scale: 0.8 })
        gsap.set(oldLogoRef.current, { autoAlpha: 1, scale: 1 })

        // Animation Sequence (Simulating Morph)
        // 1. Logo appears with a bit of scale pulse
        tl.fromTo(oldLogoRef.current, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 1, ease: "out" })

        // 2. Transition Old -> New
        tl.to(oldLogoRef.current, {
            duration: 0.6,
            opacity: 0,
            scale: 1.1,
            ease: "power2.in",
        }, "+=0.5")

        tl.to(newLogoRef.current, {
            duration: 0.8,
            autoAlpha: 1,
            scale: 1, // pop into place
            ease: "elastic.out(1, 0.5)",
        }, "-=0.4") // Start slightly before old finishes

    }, [onComplete])

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#212121]"
        >
            <div className="relative w-[246px] h-[62px]">
                {/* New Logo (Red) */}
                <svg
                    ref={newLogoRef}
                    id="new"
                    xmlns="http://www.w3.org/2000/svg"
                    height="61.56244"
                    width="246.69695"
                    viewBox="0 0 246.69695 61.56244"
                    className="absolute inset-0 w-full h-full"
                >
                    <path className="new-path" fill="#ff1e00" d="M184.588,61.56244,246.34914,0H207.64281L146.08037,61.56244ZM175.843,26.73171H97.98316c-20.71956,0-23.94923,1.59-33.29042,10.98087L40.7932,61.56244H73.13956L80.7914,53.9106c5.16746-5.16746,7.35369-5.61465,17.639-5.61465h55.84842ZM61.81089,35.07916l-27.328,26.48328H-.34781L42.97944,18.583C59.12777,2.58373,66.879,0,94.356,0H202.92253L179.37079,23.10454H97.4863C76.96547,23.10454,72.593,24.64485,61.81089,35.07916ZM207.49376,61.56244h1.29186V55.64966l2.18624,5.91278H212.065l2.18622-5.91278v5.91278h1.29187V53.9106h-1.9378l-2.03717,6.01216-2.13655-6.01216h-1.93779Zm-7.10528-6.509h2.43468v6.509h1.34155v-6.509h2.48436V53.9106h-6.26059Z" />
                </svg>

                {/* Old Logo (White/Red - split paths properly) */}
                <svg
                    ref={oldLogoRef}
                    id="old"
                    xmlns="http://www.w3.org/2000/svg"
                    width="246"
                    height="82" // Adjusted aspect ratio roughly to match wrapper but preserving scale
                    viewBox="0 0 175.123 81.874001"
                    className="absolute inset-0 top-[-10px] w-full h-full scale-75 origin-center" // Adjust scale to visual match
                >
                    <path className="old-path" fill="#ffffff" d="M57.214999.005l-45.292 64.693h23.797l12.862-18.377 16.88.005 12.269-17.529-16.883.02 8.456-12.089c14.24 0 24.867-8.243 33.286001-16.728L57.214999.005z" />
                    <path className="old-path" fill="#ed1f24" d="M139.555999 52.96l.111-.165-31.128-2.068.145-.172 34.112-2.223.116-.168-35.665-2.293-13.192 18.827 39.004-2.466.116-.16-31.169-2.073.119-.162 34.179-2.233.123-.181-31.133-2.056.098-.172zM152.483999 34.506l.115-.158-48.822-1.928.064-.16 51.862-2.346.088-.143-48.809-1.961.098-.142 51.839-2.351.098-.151-48.829-1.939.108-.151 51.842-2.36.111-.158-48.839-1.936.115-.161 51.83-2.327.106-.166-48.836-1.934.107-.151 51.853-2.364.112-.168-48.848-1.922.115-.165 51.831-2.333.111-.156-48.84-1.936.11-.154 51.824-2.339.123-.163-53.43-2.178-32.443 46.336 56.778-2.628.123-.168-48.83-1.945.122-.172 51.802-2.294.111-.156-48.814-1.97.117-.167z" />
                </svg>
            </div>
        </div>
    )
}
