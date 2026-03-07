#pragma once
#include <vector>
#include <cstdint>
#include <algorithm>
#include <cmath>
#include <random>

// ──────────────────────────────────────────────────────────────────────────────
//  World constants
// ──────────────────────────────────────────────────────────────────────────────
constexpr int   WORLD_W      = 400;   // tiles wide
constexpr int   WORLD_H      = 300;   // tiles tall
constexpr float TILE_SIZE    = 2.0f;  // pixels per tile when rendered at 1:1

// Energy wavelength buckets (like different EM bands)
enum EnergyBand { UV=0, VISIBLE=1, INFRARED=2, ENERGY_BANDS=3 };

// ──────────────────────────────────────────────────────────────────────────────
//  Tile – one cell of the world grid
// ──────────────────────────────────────────────────────────────────────────────
struct Tile {
    float energy[ENERGY_BANDS] = {0,0,0}; // ambient energy per band
    float toxin               = 0.0f;     // accumulated waste / toxins
    float nutrients           = 0.0f;     // dissolved organic material
    float temperature         = 20.0f;    // Celsius
    float moisture            = 0.5f;     // 0..1
    bool  solid               = false;    // rock / mountain
};

// ──────────────────────────────────────────────────────────────────────────────
//  World
// ──────────────────────────────────────────────────────────────────────────────
class World {
public:
    World();

    Tile&       at(int x, int y)       { return tiles[idx(x,y)]; }
    const Tile& at(int x, int y) const { return tiles[idx(x,y)]; }

    // Clamp helpers
    Tile& safe(int x, int y) {
        x = std::clamp(x, 0, WORLD_W-1);
        y = std::clamp(y, 0, WORLD_H-1);
        return tiles[idx(x,y)];
    }

    void update(float dt, uint64_t tick);

    // God tools
    void dropMeteor(int cx, int cy, int radius);
    void raiseMountain(int cx, int cy, int radius);
    void addNutrients(int cx, int cy, float amount);
    void addToxin(int cx, int cy, float amount);

    int  width()  const { return WORLD_W; }
    int  height() const { return WORLD_H; }

private:
    std::vector<Tile> tiles;
    std::mt19937      rng;

    int idx(int x, int y) const { return y * WORLD_W + x; }

    void diffuse(float dt);
    void radiateSun(float dt, uint64_t tick);
};
