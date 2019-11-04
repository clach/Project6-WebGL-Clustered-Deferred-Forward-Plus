import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene';
import { ceil } from 'gl-matrix/src/gl-matrix/vec2';
import { mat4, vec4, vec3 } from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 100;

const PI = 3.141592653589793;

function sin_atan(angle) {
  return angle / Math.sqrt(1.0 + angle * angle);
}
function cos_atan(angle) {
  return 1.0 / Math.sqrt(1.0 + angle * angle);
}

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

     // get frustum properties
     const halfFrustumHeight = Math.tan(camera.fov * PI / 360);
     const frustumHeight = 2 * halfFrustumHeight;
     const frustumWidth = camera.aspect * frustumHeight;
     const frustumDepth = camera.far - camera.near;

     // get cluster strides
     const xStride = frustumWidth / this._xSlices;
     const yStride = frustumHeight / this._ySlices;
     const zStride = frustumDepth / this._zSlices;

    for (let l = 0; l < NUM_LIGHTS; ++l) {
      const light = scene.lights[l];
      const lightPos = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1);

      const lightRadius = light.radius;

      // convert to camera space using view matrix
      let lightPosView = vec4.create();
      vec4.transformMat4(lightPosView, lightPos, viewMatrix);

      // use as vec3 from now on
      // and flip z direction
      const lightPosView3 = vec3.fromValues(lightPosView[0], lightPosView[1], -lightPosView[2]);

      // x direction
      const xStart = -frustumWidth / 2;
      let xMin = 0;
      for (let x = 0; x <= this._xSlices + 1; ++x) {
        let curr = xStart + x * xStride;

        let normal = vec3.fromValues(cos_atan(curr), 0, -sin_atan(curr));
        let dotProduct = vec3.dot(lightPosView3, normal);

        if (dotProduct < lightRadius) {
          xMin = Math.max(0, x - 1);
          break;
        } 
      }
      
      let xMax = this._xSlices;
      for (let x = xMin + 1; x <= this._xSlices + 1; ++x) {
        let curr = xStart + x * xStride;

        let normal = vec3.fromValues(cos_atan(curr), 0, -sin_atan(curr));
        let dotProduct = vec3.dot(lightPosView3, normal);

        if (dotProduct > lightRadius) {
          xMax = Math.max(0, x - 1);
          break;
        } 
      }

      // y direction
      const yStart = -halfFrustumHeight;
      let yMin = 0;
      for (let y = 0; y <= this._ySlices + 1; ++y) {
        let curr = yStart + y * yStride;

        let normal = vec3.fromValues(0, cos_atan(curr), -sin_atan(curr));
        let dotProduct = vec3.dot(lightPosView3, normal);

        if (dotProduct < lightRadius) {
          yMin = Math.max(0, y - 1);
          break;
        } 
      }

      let yMax = this._ySlices;
      for (let y = yMin + 1; y <= this._ySlices + 1; ++y) {
        let curr = yStart + y * yStride;

        let normal = vec3.fromValues(0, cos_atan(curr), -sin_atan(curr));
        let dotProduct = vec3.dot(lightPosView3, normal);

        if (dotProduct > lightRadius) {
          yMax = Math.max(0, y - 1);
          break;
        } 
      }

      // z direction
      let zMin = Math.floor(((lightPosView3[2] - lightRadius - camera.near) / zStride));
      let zMax = Math.ceil(((lightPosView3[2] + lightRadius - camera.near) / zStride));

      // if light is completely out of bounds of frustum, skip it
      if (zMax < 0 || zMin > this._zSlices) {
        continue;
      }

      // clamp values if only partially out of bounds
      zMin = Math.max(0, zMin);
      zMax = Math.min(this._zSlices, zMax);

      //console.log("xMin = " + xMin);
      //console.log("xMax = " + xMax);

      for (let x = xMin; x < xMax; ++x) {
        for (let y = yMin; y < yMax; ++y) {
          for (let z = zMin; z < zMax; ++z) {
            let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;

            let numLights = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];

            if (numLights < MAX_LIGHTS_PER_CLUSTER) {
              numLights++;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = numLights;
              
              let row = Math.floor(numLights / 4);
              let component = numLights - row * 4;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, row) + component] = l;
            }
          }
        }
      }


    }

    this._clusterTexture.update();
  }
}