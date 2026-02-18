#version 300 es
//Author: Matthew Washburn
//Version: Fall 2025
precision mediump float;
precision lowp int;
in vec4 vPosition;
in vec4 vNormal;
in vec4 Tangent;
in vec2 texCoord;
in vec4 vSpecularColor;
in float vSpecularExponent; //note this is a float, not a vec4

out vec4 Normal;
out vec4 SpecularColor;
out float SpecularExponent; //note this is a float, not a vec4
out vec4 Position;
out vec2 ftexCoord;

uniform mat4 model_view;
uniform mat4 projection;
uniform vec4 light_position[1];
uniform vec4 light_color[1];
uniform vec4 light_direction[1];
uniform float spotLight_angle[1];
uniform vec4 ambient_light;


void
main()
{
    gl_Position = vec4(0, 0, 0, 1); //to make the shader compiler happy

    //Send all the vertex attributes to the fragment shader
    ftexCoord = texCoord;
    Normal = vNormal;
    SpecularColor = vSpecularColor;
    SpecularExponent = vSpecularExponent;
    Position = vPosition;
    gl_Position = projection * model_view * Position;
}
