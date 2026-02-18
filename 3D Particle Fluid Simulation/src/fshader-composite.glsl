#version 300 es
precision mediump float;
precision lowp int;

in vec2 vTexCoord;
uniform sampler2D depthSampler; // Particle depth map sampler
uniform sampler2D backgroundSampler; //Background sampler: Everything besides particles (car, ground, spheres, sky)

out vec4 fColor;

void main()
{
    //Store the fragment depth, red channel of fragment texture vec4
    float depth = texture(depthSampler, vTexCoord).a;
    
    //Store the background color at this fragment
    vec3 backgroundColor = texture(backgroundSampler, vTexCoord).xyz;

    //Check if depth has been set, if so we know that this fragment is on a particle
    if(depth < 1000.0 && depth > 0.0) {
        //Divide by 50 so every particle is gray scale, not always pure white
        fColor = vec4(vec3(depth / 50.0), depth);
    } else {
        //If the depth has not been set, this is not a particle fragment, send the background color straight through
        fColor = vec4(backgroundColor, 1000.0);
    }
}