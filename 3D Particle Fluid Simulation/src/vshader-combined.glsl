#version 300 es
precision mediump float;
precision lowp int;
in vec4 vPosition;
in vec4 vAmbientDiffuseColor;
in vec4 vNormal;
in vec4 vSpecularColor;
in float vSpecularExponent;
in vec3 vInstancePosition;
in float vDensity;

out vec4 AmbientDiffuseColor;
out vec4 Normal;
out vec4 SpecularColor;
out float SpecularExponent;
out vec4 Position;
out float Density;

uniform mat4 model_view;
uniform mat4 projection;
uniform bool useInstancing;

void
main()
{
    //Add instanced position to vertex position for instancing
    // because we no longer move the object offsets in the mv matrix
    // So we have to add the movements here

    Density = vDensity;

    if(useInstancing) {
        vec4 instancedPosition = vPosition + vec4(vInstancePosition, 0);
        Position = instancedPosition;
    } else {
        Density = -1000.0; //Otherwise set to -1000.0
        Position = vPosition;
    }

    AmbientDiffuseColor = vAmbientDiffuseColor;
    Normal = vNormal;
    SpecularColor = vSpecularColor;
    SpecularExponent = vSpecularExponent;
    gl_Position = projection * model_view * Position;
}