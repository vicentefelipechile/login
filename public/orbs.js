(function () {
    const canvas = document.getElementById('orbs-canvas')
    const ctx = canvas.getContext('2d')

    let W = window.innerWidth
    let H = window.innerHeight

    function resize() {
        W = window.innerWidth
        H = window.innerHeight
        canvas.width = W
        canvas.height = H
    }
    resize()
    window.addEventListener('resize', resize)

    // Cada orbe tiene un hue de inicio bien separado entre sí
    // y deriva lentamente por el espectro HSL
    const START_HUES = [74, 74, 270, 174, 330, 200]  // lime, lime, purple, cyan, pink, blue

    const orbs = START_HUES.map((startHue) => ({
        x: Math.random() * W,
        y: Math.random() * H,
        radius: 200 + Math.random() * 200,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        t: Math.random() * 100,
        ts: 0.004 + Math.random() * 0.006,
        // color en HSL — hue deriva lentamente
        hue: startHue,
        hueSpeed: (Math.random() - 0.5) * 0.08,   // ±0.08 grados/frame → ciclo ~75 seg
        sat: 90 + Math.random() * 10,           // 90–100% saturación
        lit: 55 + Math.random() * 15,           // 55–70% luminosidad
    }))

    // Convierte HSL a rgb string para el gradiente canvas
    function hsl(h, s, l, a) {
        return `hsla(${h % 360},${s}%,${l}%,${a})`
    }

    function draw() {
        ctx.clearRect(0, 0, W, H)

        // == 1. Repulsión entre orbes (lava push) ==================
        for (let i = 0; i < orbs.length; i++) {
            for (let j = i + 1; j < orbs.length; j++) {
                const a = orbs[i], b = orbs[j]
                const dx = b.x - a.x
                const dy = b.y - a.y
                const dist = Math.sqrt(dx * dx + dy * dy) || 1
                const minDist = (a.radius + b.radius) * 0.15  // zona de repulsión

                if (dist < minDist) {
                    // fuerza inversamente proporcional a la distancia
                    const force = (minDist - dist) / minDist * 0.018
                    const nx = dx / dist
                    const ny = dy / dist
                    // se empujan mutuamente — suave y gradual
                    a.vx -= nx * force
                    a.vy -= ny * force
                    b.vx += nx * force
                    b.vy += ny * force
                }
            }
        }

        // == 2. Mover, rebotar y dibujar ==========================
        for (const o of orbs) {
            // avanzar tiempo de wobble y color
            o.t += o.ts
            o.hue += o.hueSpeed

            // wobble orgánico
            o.x += o.vx + Math.sin(o.t * 1.3) * 0.5
            o.y += o.vy + Math.cos(o.t) * 0.5

            // fricción muy leve — evita que se disparen por la repulsión
            o.vx *= 0.995
            o.vy *= 0.995

            // velocidad mínima para que nunca se detengan
            const speed = Math.sqrt(o.vx * o.vx + o.vy * o.vy)
            if (speed < 0.3) {
                o.vx += (Math.random() - 0.5) * 0.1
                o.vy += (Math.random() - 0.5) * 0.1
            }

            // bounce contra bordes
            const margin = o.radius * 0.25
            if (o.x - margin < 0) { o.x = margin; o.vx = Math.abs(o.vx) }
            if (o.x + margin > W) { o.x = W - margin; o.vx = -Math.abs(o.vx) }
            if (o.y - margin < 0) { o.y = margin; o.vy = Math.abs(o.vy) }
            if (o.y + margin > H) { o.y = H - margin; o.vy = -Math.abs(o.vy) }

            // gradiente denso con el color HSL actual
            const h = o.hue, s = o.sat, l = o.lit
            const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.radius)
            grad.addColorStop(0, hsl(h, s, l, 0.92))
            grad.addColorStop(0.25, hsl(h, s, l, 0.75))
            grad.addColorStop(0.55, hsl(h, s, l - 5, 0.40))
            grad.addColorStop(0.80, hsl(h, s, l - 10, 0.12))
            grad.addColorStop(1, hsl(h, s, l, 0))

            ctx.beginPath()
            ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2)
            ctx.fillStyle = grad
            ctx.fill()
        }

        requestAnimationFrame(draw)
    }

    draw()
})()