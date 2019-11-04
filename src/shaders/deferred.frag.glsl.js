export default function(params) {
  return `
  #version 100
  precision highp float;

  uniform vec2 u_dimensions;
  
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;

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

  mat3 xKernel = mat3(3, 10, 3,
                               0, 0, 0,
                              -3, -10, -3);

  mat3 yKernel = mat3(3, 0, -3,
                          10, 0, -10,
                           3, 0, -3);


                           mat3 sx = mat3( 
                            1.0, 2.0, 1.0, 
                            0.0, 0.0, 0.0, 
                           -1.0, -2.0, -1.0 
                        );
                        mat3 sy = mat3( 
                            1.0, 0.0, -1.0, 
                            2.0, 0.0, -2.0, 
                            1.0, 0.0, -1.0 
                        );


  void main() {
    // TODO: extract data from g buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    vec4 gb2 = texture2D(u_gbuffers[2], v_uv);
    // vec4 gb3 = texture2D(u_gbuffers[3], v_uv);

    vec3 albedo = gb0.xyz;
    vec3 pos = gb1.xyz;
    vec3 nor = gb2.xyz;

    vec3 fragColor = vec3(0.0);

    const int levels = 5;
    const float scaleFactor = 1.0 / float(levels);

    vec3 lightFactor = vec3(0);
    for (int i = 0; i < ${params.numLights}; ++i) {
      Light light = UnpackLight(i);
      float lightDistance = distance(light.position, pos);
      vec3 L = (light.position - pos) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, nor), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);





      float diffuseTerm = dot(L, nor) * 0.5 + 0.5;

      // TWO DIFFERENT TYPES OF TOON RAMP SHADING
      //fragColor += albedo * light.color * vec3(lightIntensity) * floor(diffuseTerm * float(levels)) * scaleFactor;
      //lightFactor += light.color * vec3(lightIntensity) * diffuseTerm * albedo;
    }

    //fragColor = floor(lightFactor * float(levels)) * scaleFactor;// * albedo;


    mat3 I;
    for (int i=0; i<3; i++) {
        for (int j=0; j<3; j++) {
            vec2 offsetUV = vec2(v_uv.x + float(i) / u_dimensions.x, v_uv.y + float(j) / u_dimensions.y);
            vec4 offsetColor = texture2D(u_gbuffers[2], offsetUV);
            I[i][j] = length(offsetColor); 
        }
    }

    float gx = dot(sx[0], I[0]) + dot(sx[1], I[1]) + dot(sx[2], I[2]); 
    float gy = dot(sy[0], I[0]) + dot(sy[1], I[1]) + dot(sy[2], I[2]);

    float g = sqrt(pow(gx, 2.0) + pow(gy, 2.0));


    // attempts at filtering g
    // Try different values and see what happens
    g = smoothstep(0.4, 0.6, g);

    vec3 edgeColor = vec3(0.0, 0.0, 0.0);
    //fragColor = mix(fragColor, edgeColor, g);

    //fragColor -= g;


    //fragColor = vec3(g);





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