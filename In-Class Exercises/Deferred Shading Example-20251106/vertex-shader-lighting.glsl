#version 300 es

in vec4 vPosition;
in vec2 texCoord;

out vec2 ftexCoord;

void main()
{
    ftexCoord = texCoord;
    gl_Position = vPosition;
}
