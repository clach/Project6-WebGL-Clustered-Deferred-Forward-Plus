# WebGL Clustered Deferred and Forward+ Shading
**University of Pennsylvania, CIS 565: GPU Programming and Architecture,
Project 6**

Caroline Lachanski: [LinkedIn](https://www.linkedin.com/in/caroline-lachanski/), [personal website](http://carolinelachanski.com/)

Tested on: Google Chrome 78.0.3904.70, Windows 10, i5-6500 @ 3.20GHz 16GB, GTX 1660 (personal computer)

### Live Online

// insert link

### Demo Video/GIF

// insert header gif/video

## Project Overview

The goal of this project was to create a forward+ and clustered deferred renderers using WebGL. 

### Forward+

Forward+ rendering consists of two steps: 

1. Light culling
2. Forward rendering

In our forward+ renderer, we perform light culling in camera space. This bins all of the lights in the scene within specific clusters (grid locations within a grid encompassing the view frustum). Then forward rendering proceeds as normal, except when it comes to accumulating the lights' contributions to shading a fragment. Rather than looping over all of the lights in the fragment shader, we simply determine in which cluster our fragment lies, then shade using only the lights contributing to that cluster.

Here's a visualization of the clusters (here, a 15x15x15 grid) in the Sponza scene. The brighter a cluster, the more lights effecting that cluster.

// insert image here

Forward+ rendering is good at handling scenes with many, many lights. And because of its general similarity to forward rendering, it can handle both opaque and transparent geometry. 

### Clustered Deferred

Generally, fragment shading is the most computationally expensive part of the rendering pipeline. The goal of deferred rendering is to postpone (defer) fragment shading until the last possible moment, and avoid unnecessary computations. All the necessary information for shading such as position, normals, albedo, etc. are written to G buffers (essentially textures). Then, a screen space quad is rendered using information from the G buffers. With deferred rendering, only pixels that will be in the final image are shaded, saving a lot of computation time.

We can add the same light clustering functionality used in forward+ to a deferred render to make it even more efficient. 

### Deferred Optimizations

There are lots of strategies to optimize the use of G buffers within deferred rendering. For example, instead of passing world space position in a G buffer, we can reconstruct in the final fragment shader using the screen space position and the inverse view-projection matrix. Similarly, rather than passing three components per normal, we can pass two and reconstruct the third later. Efficient packing of these values in the G buffer can also help.

### Toon Shading


## Performance Analysis

We can compare the performance of each of the renderers and seeing what happens as we increase the number of lights. Unfortunately, Google Chrome caps my browser FPS to 60 FPS.

// insert graph here

We can see see a clear performance hierarchy. Clustered deferred performs best, followed by forward+, then regular deferred, then regular forward. Clustered deferred seems particularly robust as the number of lights increases.

// More performance here

## Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
