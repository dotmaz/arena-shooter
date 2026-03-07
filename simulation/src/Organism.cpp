#include "Organism.h"
#include <cmath>
#include <algorithm>

// ──────────────────────────────────────────────────────────────────────────────
//  NeuralNet
// ──────────────────────────────────────────────────────────────────────────────
static float relu(float x) { return x > 0 ? x : 0.0f; }
static float sigmoid(float x) { return 1.0f / (1.0f + std::exp(-x)); }
static float tanh_f(float x) { return std::tanh(x); }

void NeuralNet::forward(const float in[NN_INPUTS], float out[NN_OUTPUTS]) const {
    if (hiddenSize == 0) {
        // No hidden layer: direct input→output with bias
        for (int o = 0; o < NN_OUTPUTS; ++o) {
            float sum = bias_o[o];
            // Use first NN_INPUTS weights from w_ho row 0 as direct weights
            for (int i = 0; i < NN_INPUTS && i < NN_OUTPUTS; ++i)
                sum += in[i] * w_ho[i * NN_OUTPUTS + o];
            out[o] = tanh_f(sum);
        }
        return;
    }

    // Hidden layer
    float h[NN_MAX_HIDDEN] = {};
    for (int j = 0; j < hiddenSize; ++j) {
        float sum = bias_h[j];
        for (int i = 0; i < NN_INPUTS; ++i)
            sum += in[i] * w_ih[i * NN_MAX_HIDDEN + j];
        h[j] = relu(sum);
    }

    // Output layer
    for (int o = 0; o < NN_OUTPUTS; ++o) {
        float sum = bias_o[o];
        for (int j = 0; j < hiddenSize; ++j)
            sum += h[j] * w_ho[j * NN_OUTPUTS + o];
        out[o] = tanh_f(sum);
    }
}

void NeuralNet::buildFromGenome(const Genome& g, std::mt19937& rng) {
    std::normal_distribution<float> gauss(0.0f, 0.5f);

    // Count NEURAL_NODE genes → hidden size
    hiddenSize = 0;
    for (const auto& gene : g.genes)
        if (gene.type == GeneType::NEURAL_NODE)
            hiddenSize = std::min(hiddenSize + 1, NN_MAX_HIDDEN);

    // Seed weights from NEURAL_WEIGHT genes, rest random
    std::fill(w_ih.begin(), w_ih.end(), 0.0f);
    std::fill(w_ho.begin(), w_ho.end(), 0.0f);
    std::fill(bias_h.begin(), bias_h.end(), 0.0f);
    std::fill(bias_o.begin(), bias_o.end(), 0.0f);

    // Initialise all weights with small random values
    for (auto& w : w_ih) w = gauss(rng) * 0.3f;
    for (auto& w : w_ho) w = gauss(rng) * 0.3f;

    // Apply NEURAL_WEIGHT genes as weight deltas
    int wIdx = 0;
    for (const auto& gene : g.genes) {
        if (gene.type == GeneType::NEURAL_WEIGHT) {
            int total = (int)w_ih.size() + (int)w_ho.size();
            int slot  = ((int)(gene.param[0] * 1000.0f) & 0x7FFFFFFF) % total;
            if (slot < (int)w_ih.size())
                w_ih[slot] += gene.expression * gene.param[1];
            else
                w_ho[slot - w_ih.size()] += gene.expression * gene.param[1];
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
//  Organism
// ──────────────────────────────────────────────────────────────────────────────
void Organism::buildFromGenome(std::mt19937& rng) {
    photoRate      = genome.expressionOf(GeneType::PHOTOSYNTHESIS);
    chemoRate      = genome.expressionOf(GeneType::CHEMOSYNTHESIS);
    fermentRate    = genome.expressionOf(GeneType::FERMENTATION);
    wasteExport    = genome.expressionOf(GeneType::WASTE_EXPORT);
    toxinResist    = genome.expressionOf(GeneType::TOXIN_RESISTANCE);
    toxinProduce   = genome.expressionOf(GeneType::TOXIN_PRODUCTION);
    adhesion       = genome.expressionOf(GeneType::ADHESION);

    // Flagellum gives movement
    float flagella = genome.expressionOf(GeneType::FLAGELLUM);
    moveSpeed      = flagella * 2.0f;

    // Cell wall increases max energy
    float wall = genome.expressionOf(GeneType::CELL_WALL);
    maxEnergy  = 2.0f + wall * 3.0f;

    // Reproduction threshold scales with max energy
    reproThreshold = maxEnergy * 0.85f;

    brain.buildFromGenome(genome, rng);
    computeColor();
}

void Organism::computeColor() {
    // Colour encodes dominant trait
    // Green = photosynthesis, Red = predator/toxin, Blue = chemosynthesis
    float photo  = std::min(photoRate,    2.0f) / 2.0f;
    float pred   = std::min(toxinProduce, 2.0f) / 2.0f;
    float chemo  = std::min(chemoRate,    2.0f) / 2.0f;
    float adh    = std::min(adhesion,     2.0f) / 2.0f;

    r = (uint8_t)(50  + 200 * pred);
    g = (uint8_t)(50  + 200 * photo);
    b = (uint8_t)(50  + 200 * (chemo + adh * 0.5f));
}
