# Asteroid Flight & Landing

## What it proves

You can build a satisfying flight + landing core loop in a single HTML file — thrust-based movement, gravity wells, collision response (bounce/crash/land), and surface-sticking — all with enough visual polish to feel like a game, not a tech demo.

## Concepts involved

- 2D physics: thrust, inertia, gravitational attraction (inverse-square)
- Collision detection (circle-circle, circle-rect) with response branches (land, bounce, crash)
- Ship state machine (flying → landed → crashed → respawn)
- Fixed-timestep game loop with `requestAnimationFrame`
- Camera system with lerp smoothing + screen shake
- Canvas rendering: gradients, shadows/glow, compositing modes, particle systems
- Keyboard input via boolean key-state flags

## Mental model

Flying should feel like classic Asteroids — rotate and thrust with inertia, no friction. Gravity should create a subtle pull you have to account for, not an unavoidable death trap. Landing should require intention: slow down, orient correctly, approach gently. The gap between "too fast to land" and "crash" should give room for bouncing, which is both forgiving and fun.

The hardest part will probably be getting the physics constants to feel right — gravity strong enough to notice but not frustrating, landing thresholds strict enough to require skill but loose enough to not be punishing.

## How to run

Open `index.html` in any browser. That's it — no build step, no dependencies.

**Controls:**
- **Arrow Up / W** — Thrust forward
- **Arrow Left / A** — Rotate counter-clockwise
- **Arrow Right / D** — Rotate clockwise

**Goal:** Launch from the base, fly to an asteroid, and land on it. Then launch off and fly to another one. Return to base when you're done exploring.
