#pragma once
#include "World.h"
#include "Organism.h"
#include <vector>
#include <unordered_map>
#include <memory>
#include <random>
#include <cstdint>
#include <functional>

// ──────────────────────────────────────────────────────────────────────────────
//  Spatial hash grid for fast neighbour lookup
// ──────────────────────────────────────────────────────────────────────────────
class SpatialHash {
public:
    explicit SpatialHash(int cellSize = 8) : cellSize_(cellSize) {}

    void clear();
    void insert(uint64_t id, float x, float y);
    void query(float x, float y, float radius,
               std::vector<uint64_t>& out) const;

private:
    int cellSize_;
    std::unordered_map<uint64_t, std::vector<uint64_t>> cells_;

    uint64_t key(int cx, int cy) const {
        return ((uint64_t)(uint32_t)cx << 32) | (uint32_t)cy;
    }
};

// ──────────────────────────────────────────────────────────────────────────────
//  Statistics snapshot (logged every N ticks)
// ──────────────────────────────────────────────────────────────────────────────
struct SimStats {
    uint64_t tick        = 0;
    int      population  = 0;
    int      predators   = 0;
    int      photosynthesisers = 0;
    int      multicellular    = 0;
    float    avgGenomeLen     = 0;
    float    avgEnergy        = 0;
    float    worldToxin       = 0;
    float    worldNutrients   = 0;
};

// ──────────────────────────────────────────────────────────────────────────────
//  Simulation
// ──────────────────────────────────────────────────────────────────────────────
class Simulation {
public:
    Simulation();

    void update(float dt);
    void reset();

    World&  world()  { return world_; }
    const std::vector<Organism>& organisms() const { return organisms_; }
    const std::vector<SimStats>& statsHistory() const { return statsHistory_; }
    uint64_t tick() const { return tick_; }
    int      population() const { return (int)organisms_.size(); }

    // God tools
    void dropMeteor(int x, int y);
    void raiseMountain(int x, int y);
    void addNutrients(int x, int y);
    void addToxin(int x, int y);
    void spawnOrganism(float x, float y);
    void killAt(float x, float y, float radius);

    // Settings
    float timeScale = 1.0f;
    int   maxOrganisms = 8000;

private:
    World                world_;
    std::vector<Organism> organisms_;
    std::vector<SimStats> statsHistory_;
    SpatialHash           spatial_;
    std::mt19937          rng_;
    uint64_t              tick_    = 0;
    uint64_t              nextId_  = 1;

    void seedLife();
    void updateOrganism(Organism& o, float dt);
    void handleMetabolism(Organism& o, float dt);
    void handleMovement(Organism& o, float dt);
    void handleReproduction(Organism& o, float dt,
                            std::vector<Organism>& newborns);
    void handleDeath(Organism& o);
    void handleInteractions(float dt);
    void recordStats();

    Organism makeChild(const Organism& parent);
    uint64_t newId() { return nextId_++; }
};
