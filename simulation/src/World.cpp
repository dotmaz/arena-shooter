#include "World.h"
#include <cmath>
#include <algorithm>

World::World() : rng(42) {
    tiles.resize(WORLD_W * WORLD_H);

    // Initialise base moisture and temperature gradient
    for (int y = 0; y < WORLD_H; ++y) {
        for (int x = 0; x < WORLD_W; ++x) {
            Tile& t = at(x, y);
            // Slight temperature gradient: warmer near equator (centre row)
            float dy = (float)(y - WORLD_H/2) / (float)(WORLD_H/2);
            t.temperature = 22.0f - 10.0f * dy * dy;
            t.moisture    = 0.4f + 0.2f * (float)(rng() % 100) / 100.0f;
            t.nutrients   = 0.01f;
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
void World::update(float dt, uint64_t tick) {
    radiateSun(dt, tick);
    diffuse(dt);
}

// ──────────────────────────────────────────────────────────────────────────────
// Sun emits energy from the top of the world, attenuated with depth.
// Different bands penetrate differently.
void World::radiateSun(float dt, uint64_t tick) {
    // Sun moves slowly left/right (day cycle)
    float sunX = (float)WORLD_W * 0.5f +
                 (float)WORLD_W * 0.4f * std::sin((float)tick * 0.0002f);

    for (int x = 0; x < WORLD_W; ++x) {
        // Distance from sun centre modulates intensity
        float dist = std::abs((float)x - sunX) / (float)WORLD_W;
        float base = std::max(0.0f, 1.0f - dist * 1.5f);

        for (int y = 0; y < WORLD_H; ++y) {
            if (at(x,y).solid) break; // rock blocks sunlight
            float depth = (float)y / (float)WORLD_H;

            // UV penetrates least, IR most
            at(x,y).energy[UV]       += base * 0.3f * std::exp(-depth * 8.0f)  * dt;
            at(x,y).energy[VISIBLE]  += base * 0.8f * std::exp(-depth * 3.0f)  * dt;
            at(x,y).energy[INFRARED] += base * 0.5f * std::exp(-depth * 1.5f)  * dt;

            // Clamp to prevent runaway accumulation
            for (int b = 0; b < ENERGY_BANDS; ++b)
                at(x,y).energy[b] = std::min(at(x,y).energy[b], 10.0f);
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Simple 4-neighbour diffusion for toxins, nutrients, and energy.
void World::diffuse(float dt) {
    const float TOXIN_DIFF    = 0.05f * dt;
    const float NUTRIENT_DIFF = 0.02f * dt;
    const float ENERGY_DIFF   = 0.03f * dt;

    // We operate on a copy to avoid order-dependency
    std::vector<Tile> next = tiles;

    for (int y = 1; y < WORLD_H-1; ++y) {
        for (int x = 1; x < WORLD_W-1; ++x) {
            if (tiles[idx(x,y)].solid) continue;

            auto spread = [&](float Tile::*field, float rate) {
                float centre = tiles[idx(x,y)].*field;
                float sum = 0;
                int   cnt = 0;
                int dx[] = {-1,1,0,0};
                int dy[] = {0,0,-1,1};
                for (int d = 0; d < 4; ++d) {
                    int nx = x+dx[d], ny = y+dy[d];
                    if (!tiles[idx(nx,ny)].solid) {
                        sum += tiles[idx(nx,ny)].*field;
                        cnt++;
                    }
                }
                if (cnt > 0) {
                    float avg = sum / cnt;
                    next[idx(x,y)].*field += (avg - centre) * rate;
                }
            };

            spread(&Tile::toxin,     TOXIN_DIFF);
            spread(&Tile::nutrients, NUTRIENT_DIFF);

            for (int b = 0; b < ENERGY_BANDS; ++b) {
                float centre = tiles[idx(x,y)].energy[b];
                float sum = 0; int cnt = 0;
                int dx[] = {-1,1,0,0};
                int dy[] = {0,0,-1,1};
                for (int d = 0; d < 4; ++d) {
                    int nx = x+dx[d], ny = y+dy[d];
                    if (!tiles[idx(nx,ny)].solid) {
                        sum += tiles[idx(nx,ny)].energy[b];
                        cnt++;
                    }
                }
                if (cnt > 0) {
                    float avg = sum / cnt;
                    next[idx(x,y)].energy[b] += (avg - centre) * ENERGY_DIFF;
                }
            }

            // Passive energy decay (heat loss)
            for (int b = 0; b < ENERGY_BANDS; ++b)
                next[idx(x,y)].energy[b] *= (1.0f - 0.001f * dt);

            // Toxin decay (natural breakdown)
            next[idx(x,y)].toxin    = std::max(0.0f, next[idx(x,y)].toxin    - 0.0005f * dt);
            next[idx(x,y)].nutrients= std::max(0.0f, next[idx(x,y)].nutrients- 0.0002f * dt);
        }
    }

    tiles = std::move(next);
}

// ──────────────────────────────────────────────────────────────────────────────
void World::dropMeteor(int cx, int cy, int radius) {
    for (int y = cy-radius; y <= cy+radius; ++y) {
        for (int x = cx-radius; x <= cx+radius; ++x) {
            if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) continue;
            float d = std::hypot((float)(x-cx),(float)(y-cy));
            if (d <= radius) {
                at(x,y).solid     = (d < radius * 0.5f);
                at(x,y).toxin    += std::max(0.0f, 2.0f - d);
                at(x,y).nutrients+= 0.5f;
                at(x,y).temperature += 40.0f * std::max(0.0f, 1.0f - d/radius);
            }
        }
    }
}

void World::raiseMountain(int cx, int cy, int radius) {
    for (int y = cy-radius; y <= cy+radius; ++y) {
        for (int x = cx-radius; x <= cx+radius; ++x) {
            if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) continue;
            float d = std::hypot((float)(x-cx),(float)(y-cy));
            if (d <= radius) at(x,y).solid = true;
        }
    }
}

void World::addNutrients(int cx, int cy, float amount) {
    for (int y = cy-5; y <= cy+5; ++y)
        for (int x = cx-5; x <= cx+5; ++x)
            safe(x,y).nutrients += amount;
}

void World::addToxin(int cx, int cy, float amount) {
    for (int y = cy-5; y <= cy+5; ++y)
        for (int x = cx-5; x <= cx+5; ++x)
            safe(x,y).toxin += amount;
}
