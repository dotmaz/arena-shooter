#include <SFML/Graphics.hpp>
#include "Simulation.h"
#include "Renderer.h"
#include <iostream>
#include <chrono>

int main() {
    // ── Window ──────────────────────────────────────────────────────────────
    sf::RenderWindow window(
        sf::VideoMode(1280, 800),
        "Life in the Machine — Evolutionary Simulation",
        sf::Style::Default
    );
    window.setFramerateLimit(60);

    // ── Simulation & Renderer ────────────────────────────────────────────────
    Simulation sim;
    Renderer   renderer(window, sim);

    // Centre camera on world
    renderer.camX = WORLD_W * 0.5f - 1280.0f / (2.0f * renderer.zoom);
    renderer.camY = WORLD_H * 0.5f - 800.0f  / (2.0f * renderer.zoom);

    bool paused = false;

    // ── Main loop ────────────────────────────────────────────────────────────
    sf::Clock clock;
    while (window.isOpen()) {
        float dt = clock.restart().asSeconds();
        dt = std::min(dt, 0.05f); // cap to avoid spiral of death

        // ── Events ──────────────────────────────────────────────────────────
        sf::Event event;
        while (window.pollEvent(event)) {
            if (event.type == sf::Event::Closed)
                window.close();

            renderer.handleEvent(event);

            if (event.type == sf::Event::KeyPressed) {
                switch (event.key.code) {
                case sf::Keyboard::Space:
                    paused = !paused;
                    break;
                case sf::Keyboard::Equal:   // + key
                case sf::Keyboard::Add:
                    sim.timeScale = std::min(sim.timeScale * 2.0f, 64.0f);
                    break;
                case sf::Keyboard::Dash:    // - key
                case sf::Keyboard::Subtract:
                    sim.timeScale = std::max(sim.timeScale * 0.5f, 0.125f);
                    break;
                case sf::Keyboard::R:
                    sim.reset();
                    break;
                default: break;
                }
            }
        }

        // ── Camera pan (WASD / arrow keys) ──────────────────────────────────
        float panSpeed = 80.0f / renderer.zoom * dt;
        if (sf::Keyboard::isKeyPressed(sf::Keyboard::W) ||
            sf::Keyboard::isKeyPressed(sf::Keyboard::Up))
            renderer.camY -= panSpeed;
        if (sf::Keyboard::isKeyPressed(sf::Keyboard::S) ||
            sf::Keyboard::isKeyPressed(sf::Keyboard::Down))
            renderer.camY += panSpeed;
        if (sf::Keyboard::isKeyPressed(sf::Keyboard::A) ||
            sf::Keyboard::isKeyPressed(sf::Keyboard::Left))
            renderer.camX -= panSpeed;
        if (sf::Keyboard::isKeyPressed(sf::Keyboard::D) ||
            sf::Keyboard::isKeyPressed(sf::Keyboard::Right))
            renderer.camX += panSpeed;

        // Clamp camera
        renderer.camX = std::clamp(renderer.camX, 0.0f, (float)WORLD_W);
        renderer.camY = std::clamp(renderer.camY, 0.0f, (float)WORLD_H);

        // ── Update simulation ────────────────────────────────────────────────
        if (!paused) {
            // Run multiple steps per frame at high time scales
            int steps = std::max(1, (int)sim.timeScale);
            float stepDt = dt / steps;
            for (int i = 0; i < steps; ++i)
                sim.update(stepDt);
        }

        // ── Render ───────────────────────────────────────────────────────────
        renderer.render();
    }

    return 0;
}
