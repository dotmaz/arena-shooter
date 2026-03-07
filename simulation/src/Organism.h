#pragma once
#include "Genome.h"
#include <cstdint>
#include <array>
#include <vector>
#include <string>

// ──────────────────────────────────────────────────────────────────────────────
//  Simple feed-forward neural network for organism behaviour
//  Inputs:  light[3 bands], toxin, nutrients, kin_signal, hunger, age_norm
//  Hidden:  variable (grows with NEURAL_NODE genes)
//  Outputs: move_x, move_y, eat, reproduce, emit_signal, attack
// ──────────────────────────────────────────────────────────────────────────────
constexpr int NN_INPUTS  = 8;
constexpr int NN_OUTPUTS = 6;
constexpr int NN_MAX_HIDDEN = 32;

struct NeuralNet {
    int hiddenSize = 0;

    // Weights stored flat: input→hidden, hidden→output
    std::array<float, NN_INPUTS  * NN_MAX_HIDDEN> w_ih = {};
    std::array<float, NN_MAX_HIDDEN * NN_OUTPUTS> w_ho = {};
    std::array<float, NN_MAX_HIDDEN>              bias_h = {};
    std::array<float, NN_OUTPUTS>                 bias_o = {};

    void forward(const float in[NN_INPUTS], float out[NN_OUTPUTS]) const;
    void buildFromGenome(const Genome& g, std::mt19937& rng);
};

// ──────────────────────────────────────────────────────────────────────────────
//  Organism – one living entity in the simulation
// ──────────────────────────────────────────────────────────────────────────────
struct Organism {
    // Identity
    uint64_t id       = 0;
    uint64_t parentId = 0;
    uint64_t born     = 0;   // tick when born
    uint64_t age      = 0;

    // Position (float for smooth movement)
    float x = 0, y = 0;
    float vx = 0, vy = 0;  // velocity

    // Vitals
    float energy    = 1.0f;   // 0..maxEnergy
    float maxEnergy = 2.0f;
    float health    = 1.0f;   // 0..1
    float toxinLoad = 0.0f;   // internal toxin accumulation

    // Genome and brain
    Genome    genome;
    NeuralNet brain;

    // Multicellularity
    bool     isMulticellular = false;
    uint64_t colonyId        = 0;  // 0 = solitary
    int      cellRole        = 0;  // 0=generic, 1=mover, 2=feeder, 3=defender

    // Signals
    float signalEmit    = 0.0f;  // chemical signal strength emitted
    float signalReceive = 0.0f;  // signal received from neighbours

    // Flags
    bool alive = true;
    bool justReproduced = false;

    // Colour (derived from genome for rendering)
    uint8_t r = 100, g = 200, b = 100;

    // Derived stats (recomputed from genome)
    float photoRate      = 0.0f;
    float chemoRate      = 0.0f;
    float fermentRate    = 0.0f;
    float wasteExport    = 0.0f;
    float toxinResist    = 0.0f;
    float toxinProduce   = 0.0f;
    float adhesion       = 0.0f;
    float moveSpeed      = 0.0f;
    float reproThreshold = 1.8f;

    void buildFromGenome(std::mt19937& rng);
    void computeColor();
};
