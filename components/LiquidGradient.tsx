"use client"

import * as React from "react"
import * as THREE from "three"

// --- TouchTexture Class ---
class TouchTexture {
    size: number
    width: number
    height: number
    maxAge: number
    radius: number
    speed: number
    trail: { x: number; y: number; age: number; force: number; vx: number; vy: number }[]
    last: { x: number; y: number } | null
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    texture: THREE.Texture

    constructor() {
        this.size = 64
        this.width = this.height = this.size
        this.maxAge = 64
        this.radius = 0.25 * this.size
        this.speed = 1 / this.maxAge
        this.trail = []
        this.last = null
        this.initTexture()
    }

    initTexture() {
        this.canvas = document.createElement("canvas")
        this.canvas.width = this.width
        this.canvas.height = this.height
        this.ctx = this.canvas.getContext("2d")!
        this.ctx.fillStyle = "black"
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
        this.texture = new THREE.Texture(this.canvas)
    }

    update() {
        this.clear()
        let speed = this.speed
        for (let i = this.trail.length - 1; i >= 0; i--) {
            const point = this.trail[i]
            let f = point.force * speed * (1 - point.age / this.maxAge)
            point.x += point.vx * f
            point.y += point.vy * f
            point.age++
            if (point.age > this.maxAge) {
                this.trail.splice(i, 1)
            } else {
                this.drawPoint(point)
            }
        }
        this.texture.needsUpdate = true
    }

    clear() {
        this.ctx.fillStyle = "black"
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    }

    addTouch(point: { x: number; y: number }) {
        let force = 0
        let vx = 0
        let vy = 0
        const last = this.last
        if (last) {
            const dx = point.x - last.x
            const dy = point.y - last.y
            if (dx === 0 && dy === 0) return
            const dd = dx * dx + dy * dy
            let d = Math.sqrt(dd)
            vx = dx / d
            vy = dy / d
            // Increased force multiplier significantly
            force = Math.min(dd * 10000, 1.0)
        }
        this.last = { x: point.x, y: point.y }
        this.trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy })
    }

    drawPoint(point: { x: number; y: number; age: number; force: number; vx: number; vy: number }) {
        const pos = {
            x: point.x * this.width,
            y: (1 - point.y) * this.height
        }

        let intensity = 1
        if (point.age < this.maxAge * 0.3) {
            intensity = Math.sin((point.age / (this.maxAge * 0.3)) * (Math.PI / 2))
        } else {
            const t = 1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7)
            intensity = -t * (t - 2)
        }
        intensity *= point.force

        const radius = this.radius
        let color = `${((point.vx + 1) / 2) * 255}, ${((point.vy + 1) / 2) * 255}, ${intensity * 255}`
        let offset = this.size * 5
        this.ctx.shadowOffsetX = offset
        this.ctx.shadowOffsetY = offset
        this.ctx.shadowBlur = radius * 1
        this.ctx.shadowColor = `rgba(${color},${0.2 * intensity})`

        this.ctx.beginPath()
        this.ctx.fillStyle = "rgba(255,0,0,1)"
        this.ctx.arc(pos.x - offset, pos.y - offset, radius, 0, Math.PI * 2)
        this.ctx.fill()
    }
}

// --- LiquidGradient Component ---
export default function LiquidGradient({ className }: { className?: string }) {
    const containerRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        if (!containerRef.current) return

        // --- Init Three.js ---
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance",
            alpha: false,
            stencil: false,
            depth: false
        })

        // Safety check for window presence
        if (typeof window === "undefined") return

        const container = containerRef.current
        const width = container.clientWidth
        const height = container.clientHeight

        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        container.appendChild(renderer.domElement)

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000)
        camera.position.z = 50

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x0a0e27) // Dark navy base

        const clock = new THREE.Clock()
        const touchTexture = new TouchTexture()

        // --- Shader Material ---
        const uniforms = {
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2(width, height) },
            uColor1: { value: new THREE.Vector3(0.945, 0.353, 0.133) }, // Orange
            uColor2: { value: new THREE.Vector3(0.039, 0.055, 0.153) }, // Navy
            uColor3: { value: new THREE.Vector3(0.945, 0.353, 0.133) },
            uColor4: { value: new THREE.Vector3(0.039, 0.055, 0.153) },
            uColor5: { value: new THREE.Vector3(0.945, 0.353, 0.133) },
            uColor6: { value: new THREE.Vector3(0.039, 0.055, 0.153) },
            uSpeed: { value: 1.5 },
            uIntensity: { value: 1.8 },
            uTouchTexture: { value: touchTexture.texture },
            uGrainIntensity: { value: 0.08 },
            uZoom: { value: 1.0 },
            uDarkNavy: { value: new THREE.Vector3(0.039, 0.055, 0.153) },
            uGradientSize: { value: 0.45 },
            uGradientCount: { value: 12.0 },
            uColor1Weight: { value: 0.5 },
            uColor2Weight: { value: 1.8 }
        }

        const vertexShader = `
      varying vec2 vUv;
      void main() {
        vec3 pos = position.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
        vUv = uv;
      }
    `

        const fragmentShader = `
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform vec3 uColor4;
      uniform vec3 uColor5;
      uniform vec3 uColor6;
      uniform float uSpeed;
      uniform float uIntensity;
      uniform sampler2D uTouchTexture;
      uniform float uGrainIntensity;
      uniform float uZoom;
      uniform vec3 uDarkNavy;
      uniform float uGradientSize;
      uniform float uGradientCount;
      uniform float uColor1Weight;
      uniform float uColor2Weight;
      
      varying vec2 vUv;
      
      #define PI 3.14159265359
      
      // Grain function
      float grain(vec2 uv, float time) {
        vec2 grainUv = uv * uResolution * 0.5;
        float grainValue = fract(sin(dot(grainUv + time, vec2(12.9898, 78.233))) * 43758.5453);
        return grainValue * 2.0 - 1.0;
      }
      
      vec3 getGradientColor(vec2 uv, float time) {
        float gradientRadius = uGradientSize;
        
        // Centers adapted from original code (Scheme 1 defaults)
        vec2 center1 = vec2(0.5 + sin(time * uSpeed * 0.4) * 0.4, 0.5 + cos(time * uSpeed * 0.5) * 0.4);
        vec2 center2 = vec2(0.5 + cos(time * uSpeed * 0.6) * 0.5, 0.5 + sin(time * uSpeed * 0.45) * 0.5);
        vec2 center3 = vec2(0.5 + sin(time * uSpeed * 0.35) * 0.45, 0.5 + cos(time * uSpeed * 0.55) * 0.45);
        vec2 center4 = vec2(0.5 + cos(time * uSpeed * 0.5) * 0.4, 0.5 + sin(time * uSpeed * 0.4) * 0.4);
        vec2 center5 = vec2(0.5 + sin(time * uSpeed * 0.7) * 0.35, 0.5 + cos(time * uSpeed * 0.6) * 0.35);
        vec2 center6 = vec2(0.5 + cos(time * uSpeed * 0.45) * 0.5, 0.5 + sin(time * uSpeed * 0.65) * 0.5);
        // ... simplistic version of 12 centers for performance, or full copy?
        // Copying full loop logic for fidelity:
        vec2 center7 = vec2(0.5 + sin(time * uSpeed * 0.55) * 0.38, 0.5 + cos(time * uSpeed * 0.48) * 0.42);
        vec2 center8 = vec2(0.5 + cos(time * uSpeed * 0.65) * 0.36, 0.5 + sin(time * uSpeed * 0.52) * 0.44);
        vec2 center9 = vec2(0.5 + sin(time * uSpeed * 0.42) * 0.41, 0.5 + cos(time * uSpeed * 0.58) * 0.39);
        vec2 center10 = vec2(0.5 + cos(time * uSpeed * 0.48) * 0.37, 0.5 + sin(time * uSpeed * 0.62) * 0.43);
        vec2 center11 = vec2(0.5 + sin(time * uSpeed * 0.68) * 0.33, 0.5 + cos(time * uSpeed * 0.44) * 0.46);
        vec2 center12 = vec2(0.5 + cos(time * uSpeed * 0.38) * 0.39, 0.5 + sin(time * uSpeed * 0.56) * 0.41);

        float dist1 = length(uv - center1);
        float dist2 = length(uv - center2);
        float dist3 = length(uv - center3);
        float dist4 = length(uv - center4);
        float dist5 = length(uv - center5);
        float dist6 = length(uv - center6);
        float dist7 = length(uv - center7);
        float dist8 = length(uv - center8);
        float dist9 = length(uv - center9);
        float dist10 = length(uv - center10);
        float dist11 = length(uv - center11);
        float dist12 = length(uv - center12);
        
        float influence1 = 1.0 - smoothstep(0.0, gradientRadius, dist1);
        float influence2 = 1.0 - smoothstep(0.0, gradientRadius, dist2);
        float influence3 = 1.0 - smoothstep(0.0, gradientRadius, dist3);
        float influence4 = 1.0 - smoothstep(0.0, gradientRadius, dist4);
        float influence5 = 1.0 - smoothstep(0.0, gradientRadius, dist5);
        float influence6 = 1.0 - smoothstep(0.0, gradientRadius, dist6);
        float influence7 = 1.0 - smoothstep(0.0, gradientRadius, dist7);
        float influence8 = 1.0 - smoothstep(0.0, gradientRadius, dist8);
        float influence9 = 1.0 - smoothstep(0.0, gradientRadius, dist9);
        float influence10 = 1.0 - smoothstep(0.0, gradientRadius, dist10);
        float influence11 = 1.0 - smoothstep(0.0, gradientRadius, dist11);
        float influence12 = 1.0 - smoothstep(0.0, gradientRadius, dist12);
        
        vec3 color = vec3(0.0);
        color += uColor1 * influence1 * (0.55 + 0.45 * sin(time * uSpeed)) * uColor1Weight;
        color += uColor2 * influence2 * (0.55 + 0.45 * cos(time * uSpeed * 1.2)) * uColor2Weight;
        color += uColor3 * influence3 * (0.55 + 0.45 * sin(time * uSpeed * 0.8)) * uColor1Weight;
        color += uColor4 * influence4 * (0.55 + 0.45 * cos(time * uSpeed * 1.3)) * uColor2Weight;
        color += uColor5 * influence5 * (0.55 + 0.45 * sin(time * uSpeed * 1.1)) * uColor1Weight;
        color += uColor6 * influence6 * (0.55 + 0.45 * cos(time * uSpeed * 0.9)) * uColor2Weight;

        // Extra centers
        color += uColor1 * influence7 * (0.55 + 0.45 * sin(time * uSpeed * 1.4)) * uColor1Weight;
        color += uColor2 * influence8 * (0.55 + 0.45 * cos(time * uSpeed * 1.5)) * uColor2Weight;
        color += uColor3 * influence9 * (0.55 + 0.45 * sin(time * uSpeed * 1.6)) * uColor1Weight;
        color += uColor4 * influence10 * (0.55 + 0.45 * cos(time * uSpeed * 1.7)) * uColor2Weight;
        
        color += uColor5 * influence11 * (0.55 + 0.45 * sin(time * uSpeed * 1.8)) * uColor1Weight;
        color += uColor6 * influence12 * (0.55 + 0.45 * cos(time * uSpeed * 1.9)) * uColor2Weight;

        return clamp(color, vec3(0.0), vec3(1.0)) * uIntensity;
      }
      
      void main() {
        vec2 uv = vUv;
        vec4 touchTex = texture2D(uTouchTexture, uv);
        float vx = -(touchTex.r * 2.0 - 1.0);
        float vy = -(touchTex.g * 2.0 - 1.0);
        float intensity = touchTex.b;
        
        uv.x += vx * 0.8 * intensity;
        uv.y += vy * 0.8 * intensity;
        
        vec3 color = getGradientColor(uv, uTime);
        float grainValue = grain(uv, uTime);
        color += grainValue * uGrainIntensity;
        
        // Removed aggressive navy enforcement
        // Ensure minimum brightness more naturally
        color = max(color, uDarkNavy * 0.5);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `

        // --- Mesh ---
        // We need to calculate view size at z=0 to fill screen
        const fovInRadians = (camera.fov * Math.PI) / 180
        const viewHeight = Math.abs(camera.position.z * Math.tan(fovInRadians / 2) * 2)
        const viewWidth = viewHeight * camera.aspect

        const geometry = new THREE.PlaneGeometry(viewWidth, viewHeight, 1, 1)
        const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader,
            fragmentShader
        })

        const mesh = new THREE.Mesh(geometry, material)
        scene.add(mesh)

        // --- Events ---
        const onMouseMove = (e: MouseEvent) => {
            touchTexture.addTouch({
                x: e.clientX / window.innerWidth,
                y: 1 - e.clientY / window.innerHeight
            })
        }
        const onTouchMove = (e: TouchEvent) => {
            const touch = e.touches[0]
            touchTexture.addTouch({
                x: touch.clientX / window.innerWidth,
                y: 1 - touch.clientY / window.innerHeight
            })
        }
        const onResize = () => {
            const w = container.clientWidth
            const h = container.clientHeight
            renderer.setSize(w, h)
            camera.aspect = w / h
            camera.updateProjectionMatrix()
            uniforms.uResolution.value.set(w, h)

            // Update geometry to fill new view
            const fovRad = (camera.fov * Math.PI) / 180
            const vH = Math.abs(camera.position.z * Math.tan(fovRad / 2) * 2)
            const vW = vH * camera.aspect

            mesh.geometry.dispose()
            mesh.geometry = new THREE.PlaneGeometry(vW, vH, 1, 1)
        }

        window.addEventListener("mousemove", onMouseMove)
        window.addEventListener("touchmove", onTouchMove)
        window.addEventListener("resize", onResize)

        // --- Anim Loop ---
        let reqId: number
        const animate = () => {
            reqId = requestAnimationFrame(animate)
            const delta = clock.getDelta()

            touchTexture.update()
            uniforms.uTime.value += Math.min(delta, 0.1)

            renderer.render(scene, camera)
        }
        animate()

        // --- Cleanup ---
        return () => {
            cancelAnimationFrame(reqId)
            window.removeEventListener("mousemove", onMouseMove)
            window.removeEventListener("touchmove", onTouchMove)
            window.removeEventListener("resize", onResize)

            renderer.dispose()
            geometry.dispose()
            material.dispose()
            renderer.domElement.remove()
        }
    }, [])

    return (
        <div ref={containerRef} className={`absolute inset-0 w-full h-full -z-10 bg-[#0a0e27] ${className}`} />
    )
}
