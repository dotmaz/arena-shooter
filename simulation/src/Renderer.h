#pragma once
#include <SFML/Graphics.hpp>
#include "Simulation.h"
#include <string>
#include <deque>

// ──────────────────────────────────────────────────────────────────────────────
//  Render mode: what to show on the world background
// ──────────────────────────────────────────────────────────────────────────────
enum class RenderMode {
    ORGANISMS,   // colour-coded organisms on dark background
    ENERGY,      // energy heatmap
    TOXIN,       // toxin heatmap
    NUTRIENTS,   // nutrient heatmap
    TEMPERATURE, // temperature heatmap
};

// ──────────────────────────────────────────────────────────────────────────────
//  Renderer
// ──────────────────────────────────────────────────────────────────────────────
class Renderer {
public:
    Renderer(sf::RenderWindow& window, Simulation& sim);

    void render();
    void handleEvent(const sf::Event& event);

    // Camera
    float camX = 0, camY = 0;
    float zoom = 2.0f;   // pixels per tile

    // UI state
    RenderMode mode = RenderMode::ORGANISMS;
    bool showHUD    = true;
    bool showGraph  = true;
    bool showHelp   = false;

    // God tool selection
    enum class Tool { NONE, METEOR, MOUNTAIN, NUTRIENTS, TOXIN, SPAWN, KILL };
    Tool activeTool = Tool::NONE;

private:
    sf::RenderWindow& window_;
    Simulation&       sim_;
    sf::Font          font_;
    bool              fontLoaded_ = false;

    // World texture (drawn as a pixel array)
    sf::Texture worldTex_;
    sf::Sprite  worldSprite_;
    std::vector<sf::Uint8> pixels_;

    // Organism vertex array for fast batch rendering
    sf::VertexArray orgVerts_;

    void updateWorldTexture();
    void drawOrganisms();
    void drawHUD();
    void drawGraph();
    void drawHelp();
    void drawToolCursor(sf::Vector2i mousePos);

    sf::Color heatmap(float v, float vmin, float vmax) const;
    sf::Vector2f worldToScreen(float wx, float wy) const;
    sf::Vector2f screenToWorld(float sx, float sy) const;
};
