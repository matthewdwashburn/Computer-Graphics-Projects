#version 300 es
precision mediump float;
precision lowp int;
in vec4 vPosition;
in vec3 vInstancePosition;

out float vDepth;

uniform mat4 model_view;
uniform mat4 projection;

void
main()
{
    //Same logic from other shader
    vec4 instancedPosition = vec4(vPosition.xyz * 3.0 + vInstancePosition, 1.0);

    //Calculate the eye space position of the particle vertex
    vec4 vEyePos = model_view * instancedPosition;

    //eye position z value is negative cause we are looking down the negative z axis, flip the sign for positive depth value
    vDepth = -vEyePos.z;

    //The position of the vertex relative to the screen
    gl_Position = projection * vEyePos;
}