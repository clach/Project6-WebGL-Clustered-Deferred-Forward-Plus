export default function(params) {
  return `
  #version 100
  precision highp float;

#define TOON_SHADING 0
#define CLUSTERED 1
#define BLINNPHONG 1

#define RECONSTRUCT_POS 1
#define RECONSTRUCT_NOR 1

  uniform vec2 u_dimensions;
  uniform ivec3 u_numSlices;
  uniform mat4 u_viewMat;
  uniform vec2 u_nearFar;
  uniform vec3 u_eye;
  uniform mat4 u_invViewProj;

  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;

  uniform sampler2D u_depth;

  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  varying vec2 v_uv;

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };
  
  float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) {
    float u = float(index + 1) / float(textureWidth + 1);
    int pixel = component / 4;
    float v = float(pixel + 1) / float(textureHeight + 1);
    vec4 texel = texture2D(texture, vec2(u, v));
    int pixelComponent = component - pixel * 4;
    if (pixelComponent == 0) {
      return texel[0];
    } else if (pixelComponent == 1) {
      return texel[1];
    } else if (pixelComponent == 2) {
      return texel[2];
    } else if (pixelComponent == 3) {
      return texel[3];
    }
  }

  Light UnpackLight(int index) {
    Light light;
    float u = float(index + 1) / float(${params.numLights + 1});
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.3));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.6));
    light.position = v1.xyz;

    // LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
    // Note that this is just an example implementation to extract one float.
    // There are more efficient ways if you need adjacent values
    light.radius = ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);

    light.color = v2.rgb;
    return light;
  }

  // Cubic approximation of gaussian curve so we falloff to exactly 0 at the light radius
  float cubicGaussian(float h) {
    if (h < 1.0) {
      return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
    } else if (h < 2.0) {
      return 0.25 * pow(2.0 - h, 3.0);
    } else {
      return 0.0;
    }
  }

  mat3 kernelX = mat3(1.0, 1.0, 1.0, 
                      0.0, 0.0, 0.0, 
                     -1.0, -1.0, -1.0);
  
  mat3 kernelY = mat3(1.0, 0.0, -1.0, 
                      1.0, 0.0, -1.0, 
                      1.0, 0.0, -1.0);

  void main() {
    // DONE: extract data from g buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    //vec4 gb2 = texture2D(u_gbuffers[2], v_uv);
    // vec4 gb3 = texture2D(u_gbuffers[3], v_uv);

    float near = u_nearFar.x;
    float far = u_nearFar.y;

    vec3 albedo = gb0.xyz;
    //vec3 pos = gb1.xyz;
    vec3 nor = gb1.xyz;

    // get depth
    float depth = texture2D(u_depth, v_uv).x;

    // reconstruct worldspace position
    vec4 clipSpacePos;
    clipSpacePos.xy = v_uv * 2.0 - 1.0;
    clipSpacePos.z = texture2D(u_depth, v_uv).r * 2.0 - 1.0;
    clipSpacePos.w = 1.0;
    vec4 pos4 = u_invViewProj * clipSpacePos;
    vec3 pos = pos4.xyz / pos4.w;

    // reconstruct normals
    //vec3 nor = vec3(gb1.x, gb1.y, 0.0);
    //nor.z = sqrt(1.0 - pow(nor.x, 2.0) - pow(nor.y, 2.0));

#if TOON_SHADING
    // remap depth
    depth = (2.0 * near) / (far + near - depth * (far - near));
#endif // #if TOON_SHADING

    vec3 fragColor = vec3(0.0);

  #if CLUSTERED
    vec2 fragPos = vec2(gl_FragCoord.x / u_dimensions.x, 
                        gl_FragCoord.y / u_dimensions.y);

    // get cluster index in 3D
    vec4 posView = u_viewMat * vec4(pos, 1.0);
    int clusterX = int(float(u_numSlices.x) * fragPos.x); 
    int clusterY = int(float(u_numSlices.y) * fragPos.y); 
    int clusterZ = int((-posView.z - near) * float(u_numSlices.z) / (far - near));

    // get cluster index in 1D
    int clusterID = clusterX + clusterY * u_numSlices.x + clusterZ * u_numSlices.x * u_numSlices.y;

    // numClusters = textureWidth also
    int numClusters = u_numSlices.x * u_numSlices.y * u_numSlices.z;
    int textureHeight = int(ceil(float(${params.numLights} + 1) / 4.0));

    // get number of lights
    int numLights = int(texture2D(u_clusterbuffer, 
    vec2(float(clusterID + 1) / float(numClusters + 1), 0)).x);
#endif // #if CLUSTERED


#if TOON_SHADING
    const int levels = 4;
    const float scaleFactor = 1.0 / float(levels);
    vec3 lightAccum = vec3(0);

#endif // #if TOON_SHADING

    for (int l = 0; l < ${params.numLights}; ++l) {
      int lightIndex = l;
#if CLUSTERED
      if (l >= numLights) {
        break;
      }

      lightIndex = int(ExtractFloat(u_clusterbuffer, numClusters, textureHeight, clusterID, l + 1));
#endif // #if CLUSTERED     

      Light light = UnpackLight(lightIndex);
      float lightDistance = distance(light.position, pos);
      vec3 L = (light.position - pos) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = dot(L, nor);

#if TOON_SHADING
      // remap from [-1, 1] to [0, 1]
      lambertTerm = clamp(lambertTerm, -1.0, 1.0) * 0.5 + 0.5;
      //fragColor += albedo * light.color * vec3(lightIntensity) * floor(lambertTerm * float(levels)) * scaleFactor;
      lightAccum += albedo * lambertTerm * light.color * vec3(lightIntensity);

#else // #if TOON_SHADING
      lambertTerm = max(lambertTerm, 0.0);
      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);

#if BLINNPHONG
      //vec3 viewDir = normalize(u_eye - pos);
      //vec3 halfwayDir = normalize(L + viewDir);
      float specularTerm = pow(abs(dot(L, nor)), 50.0);
      //fragColor += specularTerm * light.color;
#endif // #if BLINNPHONG
#endif // #else // #if TOON_SHADING
    }

#if TOON_SHADING

    fragColor = floor(lightAccum * float(levels)) * scaleFactor;

    // edge detection with sobel filter

    // edge detection based on depth
    mat3 I;
    for (int i=0; i<3; i++) {
        for (int j=0; j<3; j++) {
            vec2 offsetUV = vec2(v_uv.x + float(i) / u_dimensions.x, v_uv.y + float(j) / u_dimensions.y);
            vec4 offsetColor = texture2D(u_depth, offsetUV);
            offsetColor = (2.0 * near) / (far + near - offsetColor * (far - near));
            //offsetColor = (2.0 * 0.001) / (1.0 + 0.001 - offsetColor * (1.0 - 0.001));
            I[i][j] = length(offsetColor);
        }
    }

    float gx = dot(kernelX[0], I[0]) + dot(kernelX[1], I[1]) + dot(kernelX[2], I[2]); 
    float gy = dot(kernelY[0], I[0]) + dot(kernelY[1], I[1]) + dot(kernelY[2], I[2]);

    float g = sqrt(pow(gx, 2.0) + pow(gy, 2.0));

    // edge detection based on normals
    mat3 I2;
    for (int i=0; i<3; i++) {
        for (int j=0; j<3; j++) {
            vec2 offsetUV = vec2(v_uv.x + float(i) / u_dimensions.x, v_uv.y + float(j) / u_dimensions.y);
            vec4 offsetColor = texture2D(u_gbuffers[1], offsetUV);
            I2[i][j] = length(offsetColor);
        }
    }

    float gx2 = dot(kernelX[0], I2[0]) + dot(kernelX[1], I2[1]) + dot(kernelX[2], I2[2]); 
    float gy2 = dot(kernelY[0], I2[0]) + dot(kernelY[1], I2[1]) + dot(kernelY[2], I2[2]);

    float g2 = sqrt(pow(gx2, 2.0) + pow(gy2, 2.0));

    // attempts at filtering g
    g2 = smoothstep(0.7, 1.0, g2);

    /*
    // edge detection based on normals WITHOUT normal map applied
    mat3 I3;
    for (int i=0; i<3; i++) {
        for (int j=0; j<3; j++) {
            vec2 offsetUV = vec2(v_uv.x + float(i) / u_dimensions.x, v_uv.y + float(j) / u_dimensions.y);
            vec4 offsetColor = texture2D(u_gbuffers[3], offsetUV);
            I3[i][j] = length(offsetColor);
        }
    }

    float gx3 = dot(kernelX[0], I3[0]) + dot(kernelX[1], I3[1]) + dot(kernelX[2], I3[2]); 
    float gy3 = dot(kernelY[0], I3[0]) + dot(kernelY[1], I3[1]) + dot(kernelY[2], I3[2]);

    float g3 = sqrt(pow(gx3, 2.0) + pow(gy3, 2.0));
    */

    vec3 edgeColor = vec3(0.0, 0.0, 0.0);
    fragColor = mix(fragColor, edgeColor, g + g2);

    if (g + g2 > 0.1) {
      fragColor = edgeColor;
    }
#endif // #if TOON_SHADING

    // albedo
    //gl_FragColor = vec4(albedo, 1.0);
    
    // position
    //gl_FragColor = vec4(pos, 1.0);

    // normals
    //gl_FragColor = vec4(nor, 1.0);

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}