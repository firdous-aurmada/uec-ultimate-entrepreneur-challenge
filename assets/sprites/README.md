# Baked fighter sprites

Generated offline by `lab/bake-all.html` from a rigged 3D model, then shipped
as plain PNG atlases. **The game never loads a GLB** — nothing here adds a 3D
dependency to the bundle.

Each state is one horizontal strip of equal-width frames. `manifest.json`
carries the frame size, the frame count and loop flag per state, and the
`anchor`: the fighter's ground point within a frame, so sprites are positioned
by the feet exactly as the procedural renderer was.

Regenerating: see `lab/jobs.json` for the animation clip ids, `lab/clip-map.json`
for why each was chosen, and `lab/glb.js` for the skinning and rasteriser.
