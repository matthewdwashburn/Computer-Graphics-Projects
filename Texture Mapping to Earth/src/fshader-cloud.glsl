#version 300 es
//Author: Matthew Washburn
//Version: Fall 2025
precision mediump float;
precision lowp int;

in vec4 Normal;
in vec4 Position;
uniform mat4 model_view;
uniform mat4 projection;

//Textures
in vec2 ftexCoord; //interpolated texture coordinate for this fragment
uniform sampler2D cloudSampler; //connected to memory with colors we can look up

//Lighting
uniform vec4 light_position[1];
uniform vec4 light_color[1];
uniform vec4 light_direction[1];
uniform float spotLight_angle[1];
uniform vec4 ambient_light;
out vec4  fColor;

void main()
{
       vec4 amb = vec4(0,0,0,1);
       vec4 diff = vec4(0,0,0,1);
       vec4 totalDiff = vec4(0,0,0,1);

       //Store the color for the cloud texture map at this texture coordinate
       vec4 cloudColor = texture(cloudSampler, ftexCoord);

       //get vertex from model to eye space
       vec4 veyepos = model_view * Position;

       //store the normal vector from this point on the sphere
       vec3 N = normalize((model_view * Normal).xyz);

        //For all lights
        for(int i = 0; i < 1; i++) {
            vec3 L = normalize(light_position[i].xyz - veyepos.xyz); //light vector pointing from the surface to the light source
            vec4 diff = max(dot(L, N), 0.0) * cloudColor * light_color[i];

            //If this float is negative, we know that this fragment is facing away from the light source
            float angleBetweenLightandSurface = dot(L, N);

            //Spotlight implemented
            vec3 spotLightDir = normalize(light_direction[i].xyz);
            vec3 lightToVertex = normalize((veyepos - light_position[i]).xyz);
            float spotLightAngle = dot(spotLightDir, lightToVertex);

            //Set a brightness for the clouds on the day side and the night side
            vec4 darkClouds = vec4(0, 0, 0, 1);
            vec4 lightClouds = vec4(0.7, 0.7, 0.7, 1);

            // Smooth day/night transition based on how much surface faces the light
            float dayNightBlend = smoothstep(-0.8, 0.8, angleBetweenLightandSurface);

            // Blend diff between night and day textures
            diff = mix(darkClouds, lightClouds, dayNightBlend);

            // Blend amb between night and day textures
            amb = mix(darkClouds, lightClouds, dayNightBlend);

            totalDiff += diff;

        }
       // Use alpha from cloud texture for transparency
       fColor = vec4((amb + totalDiff).rgb, cloudColor.a);

    }