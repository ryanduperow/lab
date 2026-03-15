# Walkthrough: Asteroid Flight & Landing

Two files in this experiment. `README.md` documents the experiment. `index.html` is the entire game.

---

## index.html

A single self-contained HTML file (~600 lines) with embedded CSS and JavaScript. No external dependencies. Structured into clearly labeled sections:

### HTML + CSS (lines 1–12)

Minimal boilerplate. Full-screen canvas, no scrollbars, dark background, crosshair cursor. The `<canvas id="game">` element is the only DOM element.

### CONSTANTS (lines 16–32)

Every tunable value in one place at the top. Physics feel is entirely determined by these numbers — `THRUST_POWER`, `ROTATION_SPEED`, `GRAVITY_CONSTANT`, `LANDING_SPEED`, etc. Changing these changes how the game feels without touching any logic.

### CANVAS SETUP (lines 34–43)

Gets the 2D context, sets up resize handling so the canvas always fills the window.

### UTILITY (lines 45–51)

Five small helper functions: `rand`, `randInt`, `dist`, `lerp`, `clamp`. Used throughout.

### GAME STATE (lines 53–75)

A single `state` object holds everything: ship (position, velocity, angle, status), base, asteroids, stars, nebulae, particles, camera, input keys, screen shake, and time. Exposed globally as `window.gameState` for debugging and testing.

### INITIALIZATION (lines 77–140)

`init()` creates the world:
- **Asteroids**: 8 hand-placed positions spreading upward from the base (closest at ~400 units away, farthest at ~1600). Each gets randomly-generated jagged polygon vertices and crater positions.
- **Stars**: 800 random positions with three size tiers (dim 1px, medium 2px with twinkle, rare bright 3px with glow).
- **Nebulae**: 3 large semi-transparent radial gradients for atmospheric depth.
- **Ship**: Placed on the base platform in `landed` state.

### INPUT (lines 142–167)

Keyboard handling via `keydown`/`keyup` listeners that set boolean flags in `state.keys`. Uses `e.code` (physical key position) so WASD works regardless of keyboard layout. A `blur` listener resets all keys when the window loses focus to prevent stuck keys.

### PARTICLES (lines 169–225)

Three particle effects:
- **Exhaust**: Spawned behind the ship when thrusting. 3 particles per frame with random spread. Hot color gradient (white → yellow → orange → red) using additive blending.
- **Crash/bounce sparks**: Burst of particles in random directions on collision.
- **Landing rings**: Expanding green circle on successful landing.

`updateParticles()` moves particles, decrements life, and removes expired ones.

### PHYSICS UPDATE (lines 227–334)

`update(dt)` is the heart of the simulation, running at fixed 60Hz. Three state branches:

**Flying**: Apply rotation from input, apply thrust (acceleration in facing direction), compute gravity from all asteroids (inverse-square, range-limited), cap velocity, integrate position. Then check collisions against all asteroids (circle-circle) and the base (rectangular). Each collision branches:
- Speed < 55 + angle < 30° from normal → **land** (stick to surface, zero velocity)
- Speed > 160 → **crash** (freeze, spawn sparks, respawn after 2s)
- Otherwise → **bounce** (reflect velocity with 0.3 restitution, spawn sparks)

**Landed**: If thrust pressed → launch (impulse along surface normal). Otherwise → stick to surface. For asteroids, the ship position is recalculated each frame from the asteroid center + surface offset, and orientation is set to face outward using `atan2(cos(landedAngle), -sin(landedAngle))`.

**Crashed**: Count down timer, then respawn at base in landed state.

After state logic: update particles, lerp camera toward ship, decay screen shake.

### RENDERING (lines 336–570)

Each draw function handles one visual layer:

- **drawBackground**: Radial gradient from deep purple center to navy edges.
- **drawNebulae**: Large semi-transparent radial gradients at fixed world positions.
- **drawStars**: Dots with size-dependent twinkle (oscillating alpha). Bright stars get a glow halo.
- **drawAsteroid**: Radial gradient fill (brown-gray), jagged polygon outline, darker crater circles, rim lighting arc on the top-left edge, ambient shadow glow.
- **drawBase**: Green platform with vertical supports, pulsing landing pad lights, "H" marking.
- **drawShip**: 5-point hull polygon with cyan gradient fill and neon glow outline. Cockpit dot. When thrusting: 3-layer engine flame (red outer, yellow mid, white core) with jittering vertices and orange shadow glow. When landed: pulsing glow.
- **drawParticles**: Additive blending (`globalCompositeOperation: 'lighter'`) for bright-over-dark effect.
- **drawGravityWells**: Dashed concentric rings around asteroids when the ship is within gravity range. Ring color reflects landing feasibility: green (safe), yellow (marginal), red (too fast or bad angle).
- **drawVelocityIndicator**: Cyan line from ship in velocity direction, length proportional to speed.
- **drawHUD**: Semi-transparent panels with status label (color-coded), velocity readout, fading controls hint.
- **drawMinimap**: Circular minimap centered on the ship showing relative positions of asteroids and base.

### Main render function

Clears canvas, applies camera transform (translate to center viewport on camera position, add screen shake offset), draws all world-space layers, restores transform, draws screen-space HUD.

### GAME LOOP (lines 572–588)

Fixed timestep accumulator pattern:
1. Compute real-time delta (capped at 50ms to handle tab-away)
2. Accumulate into physics budget
3. Drain budget in fixed 1/60s steps calling `update()`
4. Call `render()` once per animation frame
5. `requestAnimationFrame(loop)`

This keeps physics deterministic regardless of display refresh rate.

### START (lines 590–592)

Calls `init()` then kicks off the loop.

---

## How the pieces connect

Input → State → Physics → Rendering is a clean one-way data flow each frame:

1. `keydown`/`keyup` set boolean flags in `state.keys`
2. `update()` reads those flags to apply thrust/rotation
3. `update()` computes gravity, integrates position, checks collisions, updates particles
4. `render()` reads the entire `state` object and draws everything
5. The camera lerps toward the ship position, creating smooth following

The ship state machine (`flying`/`landed`/`crashed`) gates which physics and input logic runs. Collision response is the most complex branch — it determines whether a surface contact becomes a landing, bounce, or crash based on speed and orientation.
