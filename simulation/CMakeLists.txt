cmake_minimum_required(VERSION 3.16)
project(LifeSimulation VERSION 1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_BUILD_TYPE Release)
set(CMAKE_CXX_FLAGS_RELEASE "-O3")

find_package(SFML 2.5 COMPONENTS graphics window system REQUIRED)

file(GLOB_RECURSE SOURCES "src/*.cpp")

add_executable(life_sim ${SOURCES})

target_include_directories(life_sim PRIVATE src)

target_link_libraries(life_sim
    sfml-graphics
    sfml-window
    sfml-system
)

# Headless test (no SFML window needed)
add_executable(test_headless
    src/test_headless.cpp
    src/World.cpp
    src/Organism.cpp
    src/Simulation.cpp
)
target_include_directories(test_headless PRIVATE src)
target_link_libraries(test_headless sfml-system)
