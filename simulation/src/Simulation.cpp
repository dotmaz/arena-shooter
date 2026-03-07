#include "Simulation.h"
#include <algorithm>
#include <cmath>
#include <numeric>

// ──────────────────────────────────────────────────────────────────────────────
//  SpatialHash
// ──────────────────────────────────────────────────────────────────────────────
void SpatialHash::clear() { cells_.clear(); }

void SpatialHash::insert(uint64_t id, float x, float y) {
    int cx = (int)x / cellSize_;
    int cy = (int)y / cellSize_;
    cells_[key(cx,cy)].push_back(id);
}

void SpatialHash::query(float x, float y, float radius,
                        std::vector<uint64_t>& out) const {
    int r  = (int)(radius / cellSize_) + 1;
    int cx = (int)x / cellSize_;
    int cy = (int)y / cellSize_;
    for (int dy = -r; dy <= r; ++dy)
        for (int dx = -r; dx <= r; ++dx) {
            auto it = cells_.find(key(cx+dx, cy+dy));
            if (it != cells_.end())
                for (auto id : it->second)
                    out.push_back(id);
        }
}

// ──────────────────────────────────────────────────────────────────────────────
//  Simulation
// ──────────────────────────────────────────────────────────────────────────────
Simulation::Simulation() : rng_(std::random_device{}()) {
    seedLife();
}

void Simulation::reset() {
    organisms_.clear();
    statsHistory_.clear();
    tick_ = 0;
    world_ = World();
    seedLife();
}

void Simulation::seedLife() {
    // Seed 200 minimal organisms scattered across the world
    std::uniform_real_distribution<float> rx(10, WORLD_W - 10);
    std::uniform_real_distribution<float> ry(10, WORLD_H - 10);

    for (int i = 0; i < 200; ++i) {
        Organism o;
        o.id     = newId();
        o.x      = rx(rng_);
        o.y      = ry(rng_);
        o.genome = Genome::minimal(rng_);
        o.energy = 1.0f;
        o.born   = 0;
        o.buildFromGenome(rng_);
        organisms_.push_back(std::move(o));
    }
}

// ──────────────────────────────────────────────────────────────────────────────
void Simulation::update(float dt) {
    dt *= timeScale;
    tick_++;

    // Update world physics
    world_.update(dt, tick_);

    // Rebuild spatial hash
    spatial_.clear();
    for (const auto& o : organisms_)
        if (o.alive)
            spatial_.insert(o.id, o.x, o.y);

    // Build id→index map for interaction lookups
    std::unordered_map<uint64_t, int> idxMap;
    idxMap.reserve(organisms_.size());
    for (int i = 0; i < (int)organisms_.size(); ++i)
        idxMap[organisms_[i].id] = i;

    // Update each organism
    std::vector<Organism> newborns;
    newborns.reserve(64);

    for (auto& o : organisms_) {
        if (!o.alive) continue;
        o.age++;
        updateOrganism(o, dt);
        handleReproduction(o, dt, newborns);
    }

    // Organism–organism interactions (predation, signalling, adhesion)
    handleInteractions(dt);

    // Remove dead organisms, release nutrients
    for (auto& o : organisms_) {
        if (!o.alive) handleDeath(o);
    }
    organisms_.erase(
        std::remove_if(organisms_.begin(), organisms_.end(),
                       [](const Organism& o){ return !o.alive; }),
        organisms_.end());

    // Add newborns (cap population)
    for (auto& nb : newborns) {
        if ((int)organisms_.size() < maxOrganisms)
            organisms_.push_back(std::move(nb));
    }

    // Record stats every 100 ticks
    if (tick_ % 100 == 0) recordStats();
}

// ──────────────────────────────────────────────────────────────────────────────
void Simulation::updateOrganism(Organism& o, float dt) {
    handleMetabolism(o, dt);
    handleMovement(o, dt);

    // Ageing: very old organisms lose health slowly
    float lifespan = 5000.0f + o.maxEnergy * 2000.0f;
    if (o.age > lifespan) {
        o.health -= 0.0001f * dt * (o.age / lifespan);
    }

    // Die if energy or health depleted
    if (o.energy <= 0.0f || o.health <= 0.0f)
        o.alive = false;
}

// ──────────────────────────────────────────────────────────────────────────────
void Simulation::handleMetabolism(Organism& o, float dt) {
    Tile& tile = world_.safe((int)o.x, (int)o.y);

    // ── Energy gain ──────────────────────────────────────────────────────────
    // Photosynthesis: absorb visible + UV light
    float lightEnergy = tile.energy[VISIBLE] * 0.6f + tile.energy[UV] * 0.3f;
    float photoGain   = o.photoRate * lightEnergy * 0.15f * dt;
    tile.energy[VISIBLE] = std::max(0.0f, tile.energy[VISIBLE] - photoGain * 0.5f);
    tile.energy[UV]      = std::max(0.0f, tile.energy[UV]      - photoGain * 0.3f);

    // Chemosynthesis: absorb dissolved nutrients
    float chemoGain = o.chemoRate * tile.nutrients * 0.2f * dt;
    tile.nutrients  = std::max(0.0f, tile.nutrients - chemoGain * 0.5f);

    // Fermentation: always available but slow and produces toxin
    float fermentGain = o.fermentRate * 0.05f * dt;
    tile.toxin       += fermentGain * 0.3f; // waste product

    o.energy += photoGain + chemoGain + fermentGain;
    o.energy  = std::min(o.energy, o.maxEnergy);

    // ── Basal metabolic cost ─────────────────────────────────────────────────
    float basalCost = (0.002f + (float)o.genome.genes.size() * 0.0001f) * dt;
    o.energy -= basalCost;

    // ── Toxin interaction ────────────────────────────────────────────────────
    // Predatory toxin production
    if (o.toxinProduce > 0.1f) {
        float produced = o.toxinProduce * 0.05f * dt;
        tile.toxin    += produced;
        o.energy      -= produced * 0.5f; // costs energy
    }

    // Absorb ambient toxin
    float absorbed = tile.toxin * 0.1f * dt;
    float resist   = o.toxinResist;
    float netToxin = absorbed * std::max(0.0f, 1.0f - resist);
    o.toxinLoad   += netToxin;
    tile.toxin     = std::max(0.0f, tile.toxin - absorbed * 0.5f);

    // Waste export: pump internal toxin out
    float exported = o.wasteExport * o.toxinLoad * 0.2f * dt;
    o.toxinLoad    = std::max(0.0f, o.toxinLoad - exported);
    tile.toxin    += exported * 0.5f;

    // Internal toxin damages health
    if (o.toxinLoad > 0.5f)
        o.health -= (o.toxinLoad - 0.5f) * 0.01f * dt;

    o.toxinLoad = std::max(0.0f, o.toxinLoad);
    o.health    = std::clamp(o.health, 0.0f, 1.0f);
}

// ──────────────────────────────────────────────────────────────────────────────
void Simulation::handleMovement(Organism& o, float dt) {
    if (o.moveSpeed < 0.01f) return; // sessile organism

    Tile& tile = world_.safe((int)o.x, (int)o.y);

    // Build neural network inputs
    float inputs[NN_INPUTS];
    inputs[0] = std::min(tile.energy[UV],      10.0f) / 10.0f;
    inputs[1] = std::min(tile.energy[VISIBLE], 10.0f) / 10.0f;
    inputs[2] = std::min(tile.energy[INFRARED],10.0f) / 10.0f;
    inputs[3] = std::min(tile.toxin,           5.0f)  / 5.0f;
    inputs[4] = std::min(tile.nutrients,       5.0f)  / 5.0f;
    inputs[5] = o.signalReceive;
    inputs[6] = 1.0f - (o.energy / o.maxEnergy); // hunger
    inputs[7] = std::min((float)o.age / 10000.0f, 1.0f);

    float outputs[NN_OUTPUTS];
    o.brain.forward(inputs, outputs);

    // outputs[0,1] = desired movement direction
    // outputs[2]   = eat (not used directly, handled by metabolism)
    // outputs[4]   = emit signal
    // outputs[5]   = attack (handled in interactions)

    float dx = outputs[0];
    float dy = outputs[1];

    // Sensor biases override neural output when genes are present
    if (o.genome.has(GeneType::LIGHT_SENSOR)) {
        // Sample neighbours for light gradient
        float lRight = world_.safe((int)o.x+2, (int)o.y).energy[VISIBLE];
        float lLeft  = world_.safe((int)o.x-2, (int)o.y).energy[VISIBLE];
        float lDown  = world_.safe((int)o.x, (int)o.y+2).energy[VISIBLE];
        float lUp    = world_.safe((int)o.x, (int)o.y-2).energy[VISIBLE];
        dx += (lRight - lLeft) * o.genome.expressionOf(GeneType::LIGHT_SENSOR) * 0.5f;
        dy += (lDown  - lUp)   * o.genome.expressionOf(GeneType::LIGHT_SENSOR) * 0.5f;
    }
    if (o.genome.has(GeneType::TOXIN_SENSOR)) {
        float tRight = world_.safe((int)o.x+2, (int)o.y).toxin;
        float tLeft  = world_.safe((int)o.x-2, (int)o.y).toxin;
        float tDown  = world_.safe((int)o.x, (int)o.y+2).toxin;
        float tUp    = world_.safe((int)o.x, (int)o.y-2).toxin;
        // Move away from toxin
        dx -= (tRight - tLeft) * o.genome.expressionOf(GeneType::TOXIN_SENSOR) * 0.5f;
        dy -= (tDown  - tUp)   * o.genome.expressionOf(GeneType::TOXIN_SENSOR) * 0.5f;
    }
    if (o.genome.has(GeneType::NUTRIENT_SENSOR)) {
        float nRight = world_.safe((int)o.x+2, (int)o.y).nutrients;
        float nLeft  = world_.safe((int)o.x-2, (int)o.y).nutrients;
        float nDown  = world_.safe((int)o.x, (int)o.y+2).nutrients;
        float nUp    = world_.safe((int)o.x, (int)o.y-2).nutrients;
        dx += (nRight - nLeft) * o.genome.expressionOf(GeneType::NUTRIENT_SENSOR) * 0.5f;
        dy += (nDown  - nUp)   * o.genome.expressionOf(GeneType::NUTRIENT_SENSOR) * 0.5f;
    }

    // Normalise and apply speed
    float mag = std::hypot(dx, dy);
    if (mag > 0.001f) {
        dx /= mag; dy /= mag;
    }

    float speed = o.moveSpeed * dt;
    float nx = o.x + dx * speed;
    float ny = o.y + dy * speed;

    // Boundary and solid tile checks
    nx = std::clamp(nx, 0.5f, (float)WORLD_W - 1.5f);
    ny = std::clamp(ny, 0.5f, (float)WORLD_H - 1.5f);
    if (!world_.at((int)nx, (int)ny).solid) {
        o.x = nx; o.y = ny;
    }

    // Movement costs energy
    o.energy -= speed * 0.005f;

    // Signal emission
    if (o.genome.has(GeneType::SIGNAL_EMIT)) {
        o.signalEmit = outputs[4] * o.genome.expressionOf(GeneType::SIGNAL_EMIT);
        world_.safe((int)o.x, (int)o.y).nutrients += o.signalEmit * 0.001f;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
void Simulation::handleReproduction(Organism& o, float dt,
                                    std::vector<Organism>& newborns) {
    if (o.energy < o.reproThreshold) return;
    if (o.justReproduced) { o.justReproduced = false; return; }

    // Reproduce: split energy, create child
    Organism child = makeChild(o);
    o.energy      *= 0.5f;
    child.energy   = o.energy;
    o.justReproduced = true;

    newborns.push_back(std::move(child));
}

Organism Simulation::makeChild(const Organism& parent) {
    Organism child;
    child.id       = newId();
    child.parentId = parent.id;
    child.born     = tick_;
    child.age      = 0;

    // Slight positional offset
    std::normal_distribution<float> jitter(0.0f, 1.0f);
    child.x = std::clamp(parent.x + jitter(rng_), 0.5f, (float)WORLD_W-1.5f);
    child.y = std::clamp(parent.y + jitter(rng_), 0.5f, (float)WORLD_H-1.5f);

    // Inherit and mutate genome
    child.genome = parent.genome.reproduce(rng_);
    child.health = 1.0f;
    child.toxinLoad = 0.0f;
    child.alive  = true;
    child.buildFromGenome(rng_);

    return child;
}

// ──────────────────────────────────────────────────────────────────────────────
void Simulation::handleInteractions(float dt) {
    // For each organism, query nearby organisms
    std::unordered_map<uint64_t, int> idxMap;
    idxMap.reserve(organisms_.size());
    for (int i = 0; i < (int)organisms_.size(); ++i)
        idxMap[organisms_[i].id] = i;

    for (auto& o : organisms_) {
        if (!o.alive) continue;

        std::vector<uint64_t> nearby;
        spatial_.query(o.x, o.y, 4.0f, nearby);

        float kinSignal = 0.0f;

        for (uint64_t nid : nearby) {
            if (nid == o.id) continue;
            auto it = idxMap.find(nid);
            if (it == idxMap.end()) continue;
            Organism& nb = organisms_[it->second];
            if (!nb.alive) continue;

            float dist = std::hypot(o.x - nb.x, o.y - nb.y);
            if (dist < 0.1f) dist = 0.1f;

            // ── Predation via toxin ──────────────────────────────────────────
            // Predators spray toxin directly onto nearby prey
            if (o.toxinProduce > 0.5f && dist < 2.0f) {
                float dmg = o.toxinProduce * 0.02f * dt / dist;
                nb.toxinLoad += dmg;
                nb.health    -= dmg * 0.5f;
                // Predator gains energy from victim's breakdown products
                if (nb.health < 0.3f)
                    o.energy += dmg * 0.3f;
            }

            // ── Kin signalling ───────────────────────────────────────────────
            float sim = o.genome.similarity(nb.genome);
            if (sim > 0.7f && o.genome.has(GeneType::KIN_SENSOR)) {
                kinSignal += nb.signalEmit * (1.0f - dist / 4.0f);
            }

            // ── Adhesion / multicellularity ──────────────────────────────────
            if (o.adhesion > 0.3f && nb.adhesion > 0.3f && sim > 0.6f && dist < 2.0f) {
                // Attract toward each other
                float fx = (nb.x - o.x) / dist * o.adhesion * 0.1f * dt;
                float fy = (nb.y - o.y) / dist * o.adhesion * 0.1f * dt;
                o.x = std::clamp(o.x + fx, 0.5f, (float)WORLD_W-1.5f);
                o.y = std::clamp(o.y + fy, 0.5f, (float)WORLD_H-1.5f);

                // Mark as multicellular colony
                if (!o.isMulticellular && dist < 1.5f) {
                    o.isMulticellular = true;
                    nb.isMulticellular = true;
                    if (o.colonyId == 0 && nb.colonyId == 0) {
                        o.colonyId = o.id;
                        nb.colonyId = o.id;
                    } else if (o.colonyId != 0) {
                        nb.colonyId = o.colonyId;
                    } else {
                        o.colonyId = nb.colonyId;
                    }
                }

                // Energy sharing within colony
                if (o.colonyId != 0 && o.colonyId == nb.colonyId) {
                    float share = (o.energy - nb.energy) * 0.01f * dt;
                    o.energy  -= share;
                    nb.energy += share;
                }
            }
        }

        o.signalReceive = std::min(kinSignal, 1.0f);
    }
}

// ──────────────────────────────────────────────────────────────────────────────
void Simulation::handleDeath(Organism& o) {
    // Release nutrients back into the tile on death
    Tile& tile = world_.safe((int)o.x, (int)o.y);
    float released = o.energy * 0.6f + (float)o.genome.genes.size() * 0.05f;
    tile.nutrients += released;

    // Nutrient release gene amplifies this
    if (o.genome.has(GeneType::NUTRIENT_RELEASE))
        tile.nutrients += o.genome.expressionOf(GeneType::NUTRIENT_RELEASE) * 0.5f;
}

// ──────────────────────────────────────────────────────────────────────────────
void Simulation::recordStats() {
    SimStats s;
    s.tick = tick_;
    s.population = (int)organisms_.size();

    float totalGenomeLen = 0, totalEnergy = 0;
    float totalToxin = 0, totalNutrients = 0;

    for (const auto& o : organisms_) {
        if (o.toxinProduce > 0.5f) s.predators++;
        if (o.photoRate > 0.3f)    s.photosynthesisers++;
        if (o.isMulticellular)     s.multicellular++;
        totalGenomeLen += (float)o.genome.genes.size();
        totalEnergy    += o.energy;
    }

    if (s.population > 0) {
        s.avgGenomeLen = totalGenomeLen / s.population;
        s.avgEnergy    = totalEnergy    / s.population;
    }

    for (int y = 0; y < WORLD_H; y += 10)
        for (int x = 0; x < WORLD_W; x += 10) {
            totalToxin     += world_.at(x,y).toxin;
            totalNutrients += world_.at(x,y).nutrients;
        }
    s.worldToxin     = totalToxin;
    s.worldNutrients = totalNutrients;

    statsHistory_.push_back(s);
    if (statsHistory_.size() > 500)
        statsHistory_.erase(statsHistory_.begin());
}

// ──────────────────────────────────────────────────────────────────────────────
//  God tools
// ──────────────────────────────────────────────────────────────────────────────
void Simulation::dropMeteor(int x, int y) {
    world_.dropMeteor(x, y, 8);
}

void Simulation::raiseMountain(int x, int y) {
    world_.raiseMountain(x, y, 12);
}

void Simulation::addNutrients(int x, int y) {
    world_.addNutrients(x, y, 3.0f);
}

void Simulation::addToxin(int x, int y) {
    world_.addToxin(x, y, 3.0f);
}

void Simulation::spawnOrganism(float x, float y) {
    if ((int)organisms_.size() >= maxOrganisms) return;
    Organism o;
    o.id     = newId();
    o.x      = x; o.y = y;
    o.genome = Genome::minimal(rng_);
    o.energy = 1.5f;
    o.born   = tick_;
    o.buildFromGenome(rng_);
    organisms_.push_back(std::move(o));
}

void Simulation::killAt(float x, float y, float radius) {
    for (auto& o : organisms_) {
        if (!o.alive) continue;
        if (std::hypot(o.x - x, o.y - y) < radius)
            o.alive = false;
    }
}
