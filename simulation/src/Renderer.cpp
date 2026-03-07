#include "Renderer.h"
#include <cmath>
#include <algorithm>
#include <sstream>
#include <iomanip>

// ──────────────────────────────────────────────────────────────────────────────
Renderer::Renderer(sf::RenderWindow& window, Simulation& sim)
    : window_(window), sim_(sim)
{
    // Try to load a system font
    if (!font_.loadFromFile("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"))
        if (!font_.loadFromFile("/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"))
            fontLoaded_ = false;
    fontLoaded_ = true;

    // Initialise world texture
    worldTex_.create(WORLD_W, WORLD_H);
    worldSprite_.setTexture(worldTex_);
    pixels_.resize(WORLD_W * WORLD_H * 4, 0);

    orgVerts_.setPrimitiveType(sf::Quads);
}

// ──────────────────────────────────────────────────────────────────────────────
sf::Vector2f Renderer::worldToScreen(float wx, float wy) const {
    return { (wx - camX) * zoom, (wy - camY) * zoom };
}

sf::Vector2f Renderer::screenToWorld(float sx, float sy) const {
    return { sx / zoom + camX, sy / zoom + camY };
}

// ──────────────────────────────────────────────────────────────────────────────
sf::Color Renderer::heatmap(float v, float vmin, float vmax) const {
    float t = std::clamp((v - vmin) / (vmax - vmin + 0.001f), 0.0f, 1.0f);
    // Blue → Cyan → Green → Yellow → Red
    sf::Color c;
    if (t < 0.25f) {
        float s = t / 0.25f;
        c = sf::Color((uint8_t)(0), (uint8_t)(0), (uint8_t)(128 + 127*s));
    } else if (t < 0.5f) {
        float s = (t - 0.25f) / 0.25f;
        c = sf::Color((uint8_t)(0), (uint8_t)(255*s), (uint8_t)(255));
    } else if (t < 0.75f) {
        float s = (t - 0.5f) / 0.25f;
        c = sf::Color((uint8_t)(255*s), (uint8_t)(255), (uint8_t)(255*(1-s)));
    } else {
        float s = (t - 0.75f) / 0.25f;
        c = sf::Color((uint8_t)(255), (uint8_t)(255*(1-s)), (uint8_t)(0));
    }
    return c;
}

// ──────────────────────────────────────────────────────────────────────────────
void Renderer::updateWorldTexture() {
    const World& world = sim_.world();

    for (int y = 0; y < WORLD_H; ++y) {
        for (int x = 0; x < WORLD_W; ++x) {
            const Tile& t = world.at(x, y);
            sf::Color c;

            if (t.solid) {
                c = sf::Color(80, 60, 40);
            } else {
                switch (mode) {
                case RenderMode::ENERGY: {
                    float e = t.energy[VISIBLE] + t.energy[UV] * 0.5f;
                    c = heatmap(e, 0, 5.0f);
                    break;
                }
                case RenderMode::TOXIN:
                    c = heatmap(t.toxin, 0, 3.0f);
                    break;
                case RenderMode::NUTRIENTS:
                    c = heatmap(t.nutrients, 0, 3.0f);
                    break;
                case RenderMode::TEMPERATURE:
                    c = heatmap(t.temperature, 0, 40.0f);
                    break;
                default: {
                    // Dark background with subtle energy tint
                    uint8_t ev = (uint8_t)std::min(255.0f, t.energy[VISIBLE] * 15.0f);
                    uint8_t nv = (uint8_t)std::min(255.0f, t.nutrients * 30.0f);
                    uint8_t tv = (uint8_t)std::min(255.0f, t.toxin * 40.0f);
                    c = sf::Color(tv / 4, ev / 4 + nv / 4, ev / 6, 255);
                    break;
                }
                }
            }

            int idx = (y * WORLD_W + x) * 4;
            pixels_[idx+0] = c.r;
            pixels_[idx+1] = c.g;
            pixels_[idx+2] = c.b;
            pixels_[idx+3] = 255;
        }
    }

    worldTex_.update(pixels_.data());
}

// ──────────────────────────────────────────────────────────────────────────────
void Renderer::drawOrganisms() {
    const auto& orgs = sim_.organisms();
    orgVerts_.clear();
    orgVerts_.resize(orgs.size() * 4);

    int vi = 0;
    for (const auto& o : orgs) {
        if (!o.alive) continue;

        sf::Vector2f pos = worldToScreen(o.x, o.y);
        float sz = std::max(1.5f, zoom * 0.6f);

        // Multicellular organisms are slightly larger
        if (o.isMulticellular) sz *= 1.4f;

        sf::Color col(o.r, o.g, o.b, 220);

        // Flash white when reproducing
        if (o.justReproduced) col = sf::Color::White;

        // Dim if low energy
        float energyFrac = o.energy / o.maxEnergy;
        col.a = (uint8_t)(100 + 120 * energyFrac);

        orgVerts_[vi+0].position = { pos.x - sz, pos.y - sz };
        orgVerts_[vi+1].position = { pos.x + sz, pos.y - sz };
        orgVerts_[vi+2].position = { pos.x + sz, pos.y + sz };
        orgVerts_[vi+3].position = { pos.x - sz, pos.y + sz };
        for (int k = 0; k < 4; ++k)
            orgVerts_[vi+k].color = col;
        vi += 4;
    }

    window_.draw(orgVerts_);
}

// ──────────────────────────────────────────────────────────────────────────────
void Renderer::drawHUD() {
    if (!fontLoaded_ || !showHUD) return;

    const auto& history = sim_.statsHistory();
    SimStats cur;
    if (!history.empty()) cur = history.back();

    std::ostringstream ss;
    ss << "TICK: " << sim_.tick()
       << "   POP: " << sim_.population()
       << "   PRED: " << cur.predators
       << "   PHOTO: " << cur.photosynthesisers
       << "   MULTI: " << cur.multicellular
       << "\n"
       << "AVG GENOME: " << std::fixed << std::setprecision(1) << cur.avgGenomeLen
       << "   AVG ENERGY: " << std::setprecision(2) << cur.avgEnergy
       << "   WORLD TOXIN: " << std::setprecision(1) << cur.worldToxin
       << "\n"
       << "TIMESCALE: " << sim_.timeScale
       << "   MODE: ";

    switch (mode) {
    case RenderMode::ORGANISMS:   ss << "ORGANISMS"; break;
    case RenderMode::ENERGY:      ss << "ENERGY";    break;
    case RenderMode::TOXIN:       ss << "TOXIN";     break;
    case RenderMode::NUTRIENTS:   ss << "NUTRIENTS"; break;
    case RenderMode::TEMPERATURE: ss << "TEMP";      break;
    }

    ss << "\n";
    ss << "TOOL: ";
    switch (activeTool) {
    case Tool::NONE:      ss << "NONE";     break;
    case Tool::METEOR:    ss << "METEOR";   break;
    case Tool::MOUNTAIN:  ss << "MOUNTAIN"; break;
    case Tool::NUTRIENTS: ss << "NUTRIENTS";break;
    case Tool::TOXIN:     ss << "TOXIN";    break;
    case Tool::SPAWN:     ss << "SPAWN";    break;
    case Tool::KILL:      ss << "KILL";     break;
    }

    sf::Text text;
    text.setFont(font_);
    text.setString(ss.str());
    text.setCharacterSize(13);
    text.setFillColor(sf::Color(220, 220, 220));
    text.setPosition(6, 4);

    // Dark background rect
    sf::FloatRect bounds = text.getLocalBounds();
    sf::RectangleShape bg({ bounds.width + 12, bounds.height + 12 });
    bg.setFillColor(sf::Color(0, 0, 0, 160));
    bg.setPosition(2, 2);
    window_.draw(bg);
    window_.draw(text);
}

// ──────────────────────────────────────────────────────────────────────────────
void Renderer::drawGraph() {
    if (!fontLoaded_ || !showGraph) return;
    const auto& history = sim_.statsHistory();
    if (history.size() < 2) return;

    sf::Vector2u winSize = window_.getSize();
    float gx = winSize.x - 210.0f;
    float gy = winSize.y - 120.0f;
    float gw = 200.0f, gh = 110.0f;

    // Background
    sf::RectangleShape bg({gw, gh});
    bg.setPosition(gx, gy);
    bg.setFillColor(sf::Color(0,0,0,160));
    bg.setOutlineColor(sf::Color(80,80,80));
    bg.setOutlineThickness(1);
    window_.draw(bg);

    // Find max population for scaling
    int maxPop = 1;
    for (const auto& s : history)
        maxPop = std::max(maxPop, s.population);

    // Population line (green)
    sf::VertexArray popLine(sf::LineStrip, history.size());
    for (int i = 0; i < (int)history.size(); ++i) {
        float t = (float)i / (float)(history.size()-1);
        float v = (float)history[i].population / (float)maxPop;
        popLine[i].position = { gx + t * gw, gy + gh - v * gh };
        popLine[i].color    = sf::Color(80, 220, 80);
    }
    window_.draw(popLine);

    // Predator line (red)
    sf::VertexArray predLine(sf::LineStrip, history.size());
    for (int i = 0; i < (int)history.size(); ++i) {
        float t = (float)i / (float)(history.size()-1);
        float v = (float)history[i].predators / (float)maxPop;
        predLine[i].position = { gx + t * gw, gy + gh - v * gh };
        predLine[i].color    = sf::Color(220, 80, 80);
    }
    window_.draw(predLine);

    // Label
    sf::Text lbl;
    lbl.setFont(font_);
    lbl.setString("POP  PRED");
    lbl.setCharacterSize(11);
    lbl.setFillColor(sf::Color(180,180,180));
    lbl.setPosition(gx + 2, gy + 2);
    window_.draw(lbl);
}

// ──────────────────────────────────────────────────────────────────────────────
void Renderer::drawHelp() {
    if (!fontLoaded_ || !showHelp) return;

    const char* helpText =
        "CONTROLS\n"
        "─────────────────────────────\n"
        "WASD / Arrow keys  : Pan camera\n"
        "Scroll wheel       : Zoom\n"
        "Space              : Pause / Resume\n"
        "+ / -              : Speed up / slow down\n"
        "\n"
        "VIEW MODES (number keys)\n"
        "1  Organisms\n"
        "2  Energy heatmap\n"
        "3  Toxin heatmap\n"
        "4  Nutrient heatmap\n"
        "5  Temperature heatmap\n"
        "\n"
        "GOD TOOLS (click to apply)\n"
        "M  Drop meteor\n"
        "N  Raise mountain\n"
        "F  Add nutrients\n"
        "T  Add toxin\n"
        "O  Spawn organism\n"
        "K  Kill organisms\n"
        "\n"
        "H  Toggle this help\n"
        "G  Toggle graph\n"
        "R  Reset simulation\n";

    sf::Text text;
    text.setFont(font_);
    text.setString(helpText);
    text.setCharacterSize(13);
    text.setFillColor(sf::Color(220, 220, 220));

    sf::FloatRect bounds = text.getLocalBounds();
    sf::Vector2u winSize = window_.getSize();
    float px = (winSize.x - bounds.width) * 0.5f;
    float py = (winSize.y - bounds.height) * 0.5f;

    sf::RectangleShape bg({ bounds.width + 20, bounds.height + 20 });
    bg.setFillColor(sf::Color(10, 10, 30, 220));
    bg.setOutlineColor(sf::Color(100, 100, 180));
    bg.setOutlineThickness(2);
    bg.setPosition(px - 10, py - 10);
    window_.draw(bg);

    text.setPosition(px, py);
    window_.draw(text);
}

// ──────────────────────────────────────────────────────────────────────────────
void Renderer::drawToolCursor(sf::Vector2i mousePos) {
    if (activeTool == Tool::NONE) return;

    sf::CircleShape cursor(12.0f);
    cursor.setOrigin(12.0f, 12.0f);
    cursor.setPosition((float)mousePos.x, (float)mousePos.y);
    cursor.setFillColor(sf::Color(0,0,0,0));

    switch (activeTool) {
    case Tool::METEOR:    cursor.setOutlineColor(sf::Color(255,140,0));  break;
    case Tool::MOUNTAIN:  cursor.setOutlineColor(sf::Color(180,120,60)); break;
    case Tool::NUTRIENTS: cursor.setOutlineColor(sf::Color(60,200,60));  break;
    case Tool::TOXIN:     cursor.setOutlineColor(sf::Color(180,0,200));  break;
    case Tool::SPAWN:     cursor.setOutlineColor(sf::Color(0,200,200));  break;
    case Tool::KILL:      cursor.setOutlineColor(sf::Color(255,0,0));    break;
    default: break;
    }
    cursor.setOutlineThickness(2.0f);
    window_.draw(cursor);
}

// ──────────────────────────────────────────────────────────────────────────────
void Renderer::render() {
    window_.clear(sf::Color(5, 5, 15));

    // World background
    updateWorldTexture();
    worldSprite_.setScale(zoom, zoom);
    worldSprite_.setPosition(-camX * zoom, -camY * zoom);
    window_.draw(worldSprite_);

    // Organisms
    drawOrganisms();

    // UI overlays
    drawHUD();
    drawGraph();
    drawHelp();
    drawToolCursor(sf::Mouse::getPosition(window_));

    window_.display();
}

// ──────────────────────────────────────────────────────────────────────────────
void Renderer::handleEvent(const sf::Event& event) {
    // Keyboard shortcuts
    if (event.type == sf::Event::KeyPressed) {
        switch (event.key.code) {
        case sf::Keyboard::Num1: mode = RenderMode::ORGANISMS;   break;
        case sf::Keyboard::Num2: mode = RenderMode::ENERGY;      break;
        case sf::Keyboard::Num3: mode = RenderMode::TOXIN;       break;
        case sf::Keyboard::Num4: mode = RenderMode::NUTRIENTS;   break;
        case sf::Keyboard::Num5: mode = RenderMode::TEMPERATURE; break;
        case sf::Keyboard::H:    showHelp  = !showHelp;  break;
        case sf::Keyboard::G:    showGraph = !showGraph; break;
        case sf::Keyboard::M:    activeTool = Tool::METEOR;    break;
        case sf::Keyboard::N:    activeTool = Tool::MOUNTAIN;  break;
        case sf::Keyboard::F:    activeTool = Tool::NUTRIENTS; break;
        case sf::Keyboard::T:    activeTool = Tool::TOXIN;     break;
        case sf::Keyboard::O:    activeTool = Tool::SPAWN;     break;
        case sf::Keyboard::K:    activeTool = Tool::KILL;      break;
        case sf::Keyboard::Escape: activeTool = Tool::NONE;   break;
        default: break;
        }
    }

    // Scroll to zoom
    if (event.type == sf::Event::MouseWheelScrolled) {
        float factor = (event.mouseWheelScroll.delta > 0) ? 1.15f : 0.87f;
        zoom = std::clamp(zoom * factor, 0.5f, 20.0f);
    }

    // Click to apply god tool
    if (event.type == sf::Event::MouseButtonPressed &&
        event.mouseButton.button == sf::Mouse::Left)
    {
        sf::Vector2f wpos = screenToWorld(
            (float)event.mouseButton.x, (float)event.mouseButton.y);
        int wx = (int)wpos.x, wy = (int)wpos.y;

        switch (activeTool) {
        case Tool::METEOR:    sim_.dropMeteor(wx, wy);           break;
        case Tool::MOUNTAIN:  sim_.raiseMountain(wx, wy);        break;
        case Tool::NUTRIENTS: sim_.addNutrients(wx, wy);         break;
        case Tool::TOXIN:     sim_.addToxin(wx, wy);             break;
        case Tool::SPAWN:     sim_.spawnOrganism(wpos.x, wpos.y);break;
        case Tool::KILL:      sim_.killAt(wpos.x, wpos.y, 5.0f); break;
        default: break;
        }
    }
}
