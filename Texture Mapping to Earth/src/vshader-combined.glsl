#version 300 es
//Author: Matthew Washburn
//Version: Fall 2025
precision mediump float;
precision lowp int;
in vec4 vPosition;
in vec4 vNormal;
in vec4 vTangent;
in vec2 texCoord;
in vec4 vSpecularColor;
in float vSpecularExponent; //note this is a float, not a vec4

out vec4 Position;
out vec4 Normal;
out vec4 Tangent;
out vec2 ftexCoord;
out vec4 SpecularColor;
out float SpecularExponent; //note this is a float, not a vec4

uniform mat4 model_view;
uniform mat4 projection;

void
main()
{
    gl_Position = vec4(0, 0, 0, 1); //to make the shader compiler happy

    //Send all the vertex attributes to the fragment shader
    Position = vPosition;
    Normal = vNormal;
    Tangent = vTangent;
    ftexCoord = texCoord;
    SpecularColor = vSpecularColor;
    SpecularExponent = vSpecularExponent;
    gl_Position = projection * model_view * Position;
}