#version 300 es
precision highp float;
precision lowp int;

in vec4 vPosition;
in vec3 vInstancePosition;

out vec2 vTexCoord;

void
main()
{
    //The position of the vertex relative to the screen
    gl_Position = vPosition;

    //Covert (-1 to 1) screen coordinates to (0 to 1) texture coordinates, pass them to frag shader
    vTexCoord = (vPosition.xy + 1.0) * 0.5;

}