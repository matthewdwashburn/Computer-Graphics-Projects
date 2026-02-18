#version 300 es
precision mediump float;
precision lowp int;

in vec2 vTexCoord;
uniform sampler2D texSampler;

out vec4 fColor;

void main()
{
    //Store the texture color
    vec4 texColor = texture(texSampler, vTexCoord);

    //Check if the color is a density value stored in the alpha channel
    if(texColor.a > 0.0 && texColor.g == 0.0 && texColor.b == 0.0 && texColor.r == 0.0) {
        //Divide by 50 so every particle is gray scale, not white
        fColor = vec4(vec3(texColor.a / 50.0), 1.0);
    } else {
        //If the color is not a density, this is not a particle fragment, send the background color straight through
        fColor = texColor;
    }
}