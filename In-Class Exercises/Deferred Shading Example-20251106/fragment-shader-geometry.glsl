#version 300 es

precision mediump float;
in vec3 vPos;
in vec3 vN;
in vec4 AmbientDiffuseColor;
in vec4 SpecularColor;
in float SpecularExponent;
//Delay the fragment shader calculations until were sure this fragment is shown on the final screen
//We're just creating the storage for this later
layout (location = 0) out vec4 albedo;
layout (location = 1) out vec4 specular;
layout (location = 2) out vec4 normal;
layout (location = 3) out vec4 position;


void main()
{
    albedo = AmbientDiffuseColor;
    specular = vec4(SpecularColor.xyz, SpecularExponent);
    normal = (vec4(vN,0)) ;
    position = (vec4(vPos, 1));
}