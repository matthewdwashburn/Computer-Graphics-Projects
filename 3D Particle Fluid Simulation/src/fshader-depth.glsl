#version 300 es
precision mediump float;
precision lowp int;

in float vDepth;

out vec4 fColor;

void main()
{
    //Send the depth of the frag in the red channel for later use, alpha stays at 1
   fColor = vec4(0.0, 0.0, 0.0, vDepth);
}