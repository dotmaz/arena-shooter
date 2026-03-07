// Headless test: run the simulation for 1000 ticks and print stats
#include "Simulation.h"
#include <iostream>
#include <iomanip>

int main() {
    std::cout << "Initialising simulation...\n";
    Simulation sim;
    sim.timeScale = 1.0f;

    std::cout << "Initial population: " << sim.population() << "\n";

    for (int i = 0; i < 10000; ++i) {
        sim.update(0.016f);
        if (i % 500 == 499) {
            const auto& hist = sim.statsHistory();
            if (!hist.empty()) {
                const auto& s = hist.back();
                std::cout << "Tick " << std::setw(6) << s.tick
                          << "  pop=" << std::setw(5) << s.population
                          << "  pred=" << std::setw(4) << s.predators
                          << "  photo=" << std::setw(4) << s.photosynthesisers
                          << "  multi=" << std::setw(4) << s.multicellular
                          << "  avgGenome=" << std::fixed << std::setprecision(1) << s.avgGenomeLen
                          << "  toxin=" << std::setprecision(1) << s.worldToxin
                          << "\n";
            }
        }
    }

    std::cout << "Test complete. Final population: " << sim.population() << "\n";

    // Print a sample of organisms to show diversity
    const auto& orgs = sim.organisms();
    std::cout << "\nSample organisms (first 5):\n";
    for (int i = 0; i < std::min(5, (int)orgs.size()); ++i) {
        const auto& o = orgs[i];
        std::cout << "  id=" << o.id
                  << " age=" << o.age
                  << " energy=" << std::fixed << std::setprecision(2) << o.energy
                  << " genome_len=" << o.genome.genes.size()
                  << " photo=" << std::setprecision(2) << o.photoRate
                  << " pred=" << o.toxinProduce
                  << " adhesion=" << o.adhesion
                  << " multi=" << o.isMulticellular
                  << "\n";
    }
    return 0;
}
