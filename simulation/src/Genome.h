#pragma once
#include <vector>
#include <cstdint>
#include <random>
#include <algorithm>
#include <cmath>

// ──────────────────────────────────────────────────────────────────────────────
//  Gene types – each gene encodes one "protein" behaviour
// ──────────────────────────────────────────────────────────────────────────────
enum class GeneType : uint8_t {
    // Metabolism
    PHOTOSYNTHESIS   = 0,   // absorb visible/UV light → energy
    CHEMOSYNTHESIS   = 1,   // absorb nutrients from tile → energy
    FERMENTATION     = 2,   // produce energy without light (slow, produces toxin)
    WASTE_EXPORT     = 3,   // pump toxins out of cell
    TOXIN_RESISTANCE = 4,   // reduce damage from toxins
    TOXIN_PRODUCTION = 5,   // deliberately produce extra toxin (predatory)
    NUTRIENT_RELEASE = 6,   // break down and release nutrients on death

    // Structural
    CELL_WALL        = 7,   // increases max energy / defence
    ADHESION         = 8,   // tendency to stick to neighbours (multicellularity)
    FLAGELLUM        = 9,   // movement capability

    // Sensing
    LIGHT_SENSOR     = 10,  // bias movement toward light
    TOXIN_SENSOR     = 11,  // bias movement away from toxin
    NUTRIENT_SENSOR  = 12,  // bias movement toward nutrients
    KIN_SENSOR       = 13,  // detect genetically similar neighbours

    // Neural
    NEURAL_NODE      = 14,  // adds a hidden neuron to the organism's brain
    NEURAL_WEIGHT    = 15,  // modifies a synaptic weight

    // Communication
    SIGNAL_EMIT      = 16,  // emit a chemical signal
    SIGNAL_RECEIVE   = 17,  // respond to chemical signals

    COUNT            = 18
};

// ──────────────────────────────────────────────────────────────────────────────
//  A single gene: type + expression level (0..1) + a few float parameters
// ──────────────────────────────────────────────────────────────────────────────
struct Gene {
    GeneType type       = GeneType::PHOTOSYNTHESIS;
    float    expression = 0.5f;   // how strongly this gene is expressed
    float    param[4]   = {0,0,0,0}; // gene-specific parameters

    // Mutate in-place
    void mutate(std::mt19937& rng, float rate) {
        std::uniform_real_distribution<float> uni(0.0f, 1.0f);
        std::normal_distribution<float>       gauss(0.0f, 0.05f);

        if (uni(rng) < rate) {
            // Possibly change gene type entirely
            if (uni(rng) < 0.1f) {
                type = static_cast<GeneType>(rng() % (int)GeneType::COUNT);
            }
            expression = std::clamp(expression + gauss(rng), 0.0f, 1.0f);
            for (int i = 0; i < 4; ++i)
                if (uni(rng) < 0.3f)
                    param[i] = std::clamp(param[i] + gauss(rng), -1.0f, 1.0f);
        }
    }
};

// ──────────────────────────────────────────────────────────────────────────────
//  Genome: ordered sequence of genes
// ──────────────────────────────────────────────────────────────────────────────
struct Genome {
    std::vector<Gene> genes;
    float mutationRate = 0.01f;

    // Construct a minimal starter genome
    static Genome minimal(std::mt19937& rng) {
        Genome g;
        g.mutationRate = 0.015f;
        // Every cell starts with basic photosynthesis + waste export
        Gene ph; ph.type = GeneType::PHOTOSYNTHESIS; ph.expression = 0.6f;
        Gene we; we.type = GeneType::WASTE_EXPORT;   we.expression = 0.3f;
        g.genes.push_back(ph);
        g.genes.push_back(we);
        return g;
    }

    // Produce a child genome with mutations
    Genome reproduce(std::mt19937& rng) const {
        Genome child = *this;
        std::uniform_real_distribution<float> uni(0.0f, 1.0f);

        // Mutate existing genes
        for (auto& g : child.genes)
            g.mutate(rng, mutationRate);

        // Chance to duplicate a gene
        if (!child.genes.empty() && uni(rng) < 0.02f) {
            int idx = rng() % child.genes.size();
            child.genes.push_back(child.genes[idx]);
        }

        // Chance to delete a gene (minimum 1)
        if (child.genes.size() > 1 && uni(rng) < 0.02f) {
            int idx = rng() % child.genes.size();
            child.genes.erase(child.genes.begin() + idx);
        }

        // Mutate the mutation rate itself (meta-evolution)
        child.mutationRate = std::clamp(
            child.mutationRate + std::normal_distribution<float>(0,0.001f)(rng),
            0.001f, 0.15f);

        return child;
    }

    // Genetic similarity score [0..1]
    float similarity(const Genome& other) const {
        if (genes.empty() || other.genes.empty()) return 0.0f;
        int matches = 0;
        int total   = std::max(genes.size(), other.genes.size());
        int minLen  = std::min(genes.size(), other.genes.size());
        for (int i = 0; i < minLen; ++i)
            if (genes[i].type == other.genes[i].type) matches++;
        return (float)matches / (float)total;
    }

    // Query helpers
    float expressionOf(GeneType t) const {
        float total = 0.0f;
        for (const auto& g : genes)
            if (g.type == t) total += g.expression;
        return total;
    }

    bool has(GeneType t) const {
        for (const auto& g : genes)
            if (g.type == t) return true;
        return false;
    }
};
