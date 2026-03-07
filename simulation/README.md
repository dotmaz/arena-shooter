# Life in the Machine — Evolutionary Simulation

A C++ simulation of naturally evolving life, inspired by the story *"The Life in the Machine"*. Life starts from nothing but physics and energy. No pre-scripted behaviours. No shortcuts.

---

## What happens

| Phase | What you'll see |
|---|---|
| **Minutes 1–5** | 200 simple photosynthetic cells multiply and fill the world |
| **~10 min** | Genome diversity explodes. First predators appear (red cells spraying toxins) |
| **~20 min** | Prey evolve toxin resistance, flee sensors, and warning signals |
| **~30 min** | Adhesion genes cause cells to stick together — first multicellular colonies |
| **~1 hour** | Complex ecosystems: plant-like sessile feeders, mobile predators, symbiotic colonies |

---

## Build

```bash
# Dependencies (Ubuntu/Debian)
sudo apt-get install -y libsfml-dev cmake build-essential

# Build
cd simulation
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j4

# Run
./life_sim
```

---

## Controls

### Camera
| Key | Action |
|---|---|
| `W A S D` or Arrow keys | Pan camera |
| Scroll wheel | Zoom in/out |

### Simulation
| Key | Action |
|---|---|
| `Space` | Pause / Resume |
| `+` / `-` | Speed up / slow down (up to 64x) |
| `R` | Reset simulation from scratch |

### View Modes
| Key | What it shows |
|---|---|
| `1` | Organisms (default) |
| `2` | Energy heatmap (where the sun shines) |
| `3` | Toxin heatmap (predator zones, waste) |
| `4` | Nutrient heatmap (food sources) |
| `5` | Temperature map |

### God Tools — press key, then **click** anywhere on the world
| Key | Tool | Effect |
|---|---|---|
| `M` | **Meteor** | Drops a meteor — kills organisms, scorches land, adds nutrients |
| `N` | **Mountain** | Raises solid rock — splits populations, forces divergent evolution |
| `F` | **Nutrients** | Dumps food — triggers population explosion in that area |
| `T` | **Toxin** | Poisons an area — drives toxin resistance evolution |
| `O` | **Spawn** | Places a new organism at cursor |
| `K` | **Kill** | Kills all organisms in a radius |
| `Esc` | Cancel tool | |

### UI
| Key | Action |
|---|---|
| `H` | Toggle help overlay |
| `G` | Toggle population/predator graph |

---

## Organism colours

| Colour | Dominant trait |
|---|---|
| **Green** | Photosynthesis (plant-like) |
| **Red** | Toxin production (predator) |
| **Blue** | Chemosynthesis / adhesion (colony) |
| **White flash** | Just reproduced |
| **Dim/faded** | Low energy, near death |

---

## What the HUD shows

```
TICK: 14200   POP: 3847   PRED: 142   PHOTO: 3201   MULTI: 88
AVG GENOME: 5.3   AVG ENERGY: 1.24   WORLD TOXIN: 12.4
TIMESCALE: 2.0   MODE: ORGANISMS   TOOL: METEOR
```

- **TICK** — simulation steps elapsed
- **POP** — total living organisms
- **PRED** — organisms with dominant toxin-production gene
- **PHOTO** — photosynthesisers
- **MULTI** — organisms in multicellular colonies
- **AVG GENOME** — average number of genes per organism (grows with evolution)
- **WORLD TOXIN** — total toxin in the environment

---

## How evolution actually works (no shortcuts)

Every organism has a real **genome** — a list of genes, each encoding a protein behaviour:

- `PHOTOSYNTHESIS` — absorbs light energy from the world grid
- `CHEMOSYNTHESIS` — absorbs dissolved nutrients
- `FERMENTATION` — produces energy without light, but creates waste toxin
- `WASTE_EXPORT` — pumps internal toxins out
- `TOXIN_RESISTANCE` — reduces toxin damage
- `TOXIN_PRODUCTION` — sprays toxins onto neighbours (predation)
- `FLAGELLUM` — enables movement
- `LIGHT_SENSOR` / `TOXIN_SENSOR` / `NUTRIENT_SENSOR` — biases movement
- `ADHESION` — causes cells to stick together (multicellularity)
- `NEURAL_NODE` / `NEURAL_WEIGHT` — grows and tunes the organism's neural network
- `SIGNAL_EMIT` / `SIGNAL_RECEIVE` — chemical communication between kin

When an organism reproduces, its genome is **copied with random mutations** — gene expression levels shift, parameters drift, genes duplicate or are deleted, and the mutation rate itself evolves. The environment does the rest.

---

## Tips

- **Let it run for 20+ minutes** before expecting predators and colonies
- Use `+` to speed up to 8x or 16x when waiting for evolution
- Drop a **Mountain** (`N`) through a population to split it — watch the two sides evolve differently
- Drop **Nutrients** (`F`) to cause a population explosion, then drop **Toxin** (`T`) to drive resistance evolution
- Use **Meteor** (`M`) for extinction events — watch life recover
