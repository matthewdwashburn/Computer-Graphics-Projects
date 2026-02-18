#version 300 es
//Author: Matthew Washburn
//Version: Fall 2025
precision mediump float;
precision lowp int;
in vec4 Normal;
in vec4 Tangent;
in vec4 SpecularColor;
in float SpecularExponent; //note this is a float, not a vec4
in vec4 Position;
uniform mat4 model_view;
uniform mat4 projection;

//Textures
in vec2 ftexCoord; //interpolated texture coordinate for this fragment
uniform sampler2D textureSampler; //connected to memory with colors we can look up
uniform sampler2D specularSampler;
uniform sampler2D nightSampler;
uniform sampler2D normalSampler;

uniform bool textureMapOn;
uniform bool specularMapOn;
uniform bool nightMapOn;
uniform bool normalMapOn;

//Lighting
uniform vec4 light_position[1];
uniform vec4 light_color[1];
uniform vec4 light_direction[1];
uniform float spotLight_angle[1];
uniform vec4 ambient_light;

out vec4  fColor;

void main()
{
    //Amb, spec, and diff light values to 0
    vec4 amb = vec4(0,0,0,1);
    vec4 diff = vec4(0,0,0,1);
    vec4 spec = vec4(0,0,0,1);

    //Store the color for each texture map at this texture coordinate
    vec4 texColor = texture(textureSampler, ftexCoord);
    vec4 specColor = texture(specularSampler, ftexCoord);
    vec4 nightColor = texture(nightSampler, ftexCoord);
    vec4 normalColor = texture(normalSampler, ftexCoord);

    //Change the winning texture map based off which one is active between specular and the day texture
    if(specularMapOn && !textureMapOn) {
        texColor = specColor;
    }
    if(textureMapOn && !specularMapOn) {
        specColor = texColor;
    }
    if(!textureMapOn && !specularMapOn) {
        specColor = vec4(1,1,1,1);
        texColor = vec4(1,1,1,1);
    }

    //values stored in normal texture is [0,1] range, we need [-1, 1] range
    normalColor = (normalColor * 2.0)- 1.0;


    vec4 veyepos = model_view * Position; //get vertex from model to eye space
    //Use the color of the texture instead of ambient diffuse color
    vec3 V = normalize(-veyepos.xyz);

    //Store normal, tangent, and bitangent vectors for this point on the spehere
    vec3 N3 = normalize((model_view * Normal).xyz);
    vec3 T3 = normalize((model_view * Tangent).xyz); //Tangent vector
    vec3 B3 = cross(T3, N3); //Bitangent vector

    //Convert them to vec4s
    vec4 N = vec4(N3, 0);
    vec4 T = vec4(T3, 0);
    vec4 B = vec4(B3, 0);

    // construct a change of coordinate frame mat4 with columns of T, B, and N
    mat4 changeFrame = mat4(T, B, N, vec4(0,0,0,1));

    //Move our normals from model space to eye space
    vec4 eyeSpaceNormal = changeFrame * normalColor;

    //Initialize the total diffuse and specular light to 0
    vec4 totalDiff = vec4(0,0,0,1);
    vec4 totalSpec = vec4(0,0,0,1);

    //Toggle off and on normals based on user input
    vec3 toggleNormals;
    if(normalMapOn) {
        toggleNormals = eyeSpaceNormal.xyz;
    } else {
        toggleNormals = N3;
    }

    //For all lights
    for(int i = 0; i < 1; i++) {
        vec3 L = normalize(light_position[i].xyz - veyepos.xyz); //light vector pointing from the surface to the light source
        vec3 R = reflect(-L, toggleNormals); //vector from light source, reflected across Normal

        //If this float is negative, we know that this fragment is facing away from the light source
        float angleBetweenLightandSurface = dot(L, toggleNormals);

        // Smooth day/night transition based on how much surface faces the light
        float dayNightBlend = smoothstep(-0.2, 0.2, angleBetweenLightandSurface);

        float lightIntensity = max(dot(L, toggleNormals), 0.0);

        //Use the color of the texture map combined with the color of the normals
        vec4 dayDiff = lightIntensity * texColor * light_color[i];

        //Store the night diffuse color with full intensity, emits its own light
        vec4 nightDiff = nightColor;

        vec4 diff = mix(nightDiff, dayDiff, dayNightBlend);
        //If there's no night map, just set the day map all around the globe
        if(!nightMapOn) {
            diff = dayDiff;
        }
        //Specular light reflects towards the camera
        vec4 spec = pow(max(dot(R, V), 0.0), SpecularExponent) * specColor * light_color[i];

        //no glare beyond the horizon!
        if (dot(L, toggleNormals) < 0.0) {
            spec = vec4(0, 0, 0, 1);
        }

        //Spotlight implemented
        vec3 spotLightDir = normalize(light_direction[i].xyz);
        vec3 lightToVertex = normalize((veyepos - light_position[i]).xyz);
        float spotLightAngle = dot(spotLightDir, lightToVertex);

        //Set spotlight angle limit
        if (spotLightAngle < spotLight_angle[i] || angleBetweenLightandSurface < 0.0) {
            spec = vec4(0, 0, 0, 1);
        }

        if(nightMapOn) {
            // Blend between night and day textures
            amb = mix(nightColor, texColor, dayNightBlend) * ambient_light;
        } else {
            // Keep the dark side the day texture
            amb = mix(texColor, texColor, dayNightBlend) * ambient_light;
        }

        totalDiff += diff;
        totalSpec += spec;
    }
    fColor = amb + totalDiff + totalSpec;

}