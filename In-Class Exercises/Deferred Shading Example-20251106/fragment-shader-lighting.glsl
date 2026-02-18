#version 300 es

precision mediump float;
in vec3 position;
in vec2 ftexCoord;
//Now we are sure this fragment will be in the final screen
uniform sampler2D albedoSampler;
uniform sampler2D specularSampler;
uniform sampler2D normalSampler;
uniform sampler2D positionSampler;

uniform vec4 light_position;
uniform vec4 light_color;
uniform vec4 ambient_light;
uniform vec4 bgcolor;

out vec4  fColor;

void main()
{
    vec3 P = (texture(positionSampler, ftexCoord).xyz);
    if(P == vec3(1.0, 1.0, 1.0)){ //there was no geometry during geometry pass
        fColor =  bgcolor; //set to "background" color
    }else{
        vec3 L = normalize( light_position.xyz - P);
        vec3 E = normalize(-P);
        vec3 N = normalize((texture(normalSampler, ftexCoord).xyz));

        vec3 R = reflect(-L, N);
        vec4 amb = texture(albedoSampler, ftexCoord) * ambient_light;
        vec4 diff = max(dot(L,N), 0.0) * texture(albedoSampler, ftexCoord) * light_color;
        //don't forget to scale exponent back up
        vec4 spec = pow( max (dot(R,E), 0.0), texture(specularSampler, ftexCoord).w) *  texture(specularSampler, ftexCoord) * light_color;
        if(dot(L,N) < 0.0){
            spec = vec4(0,0,0,1);
        }
        fColor = amb + diff + spec;


        //TODO LEAVE THIS COMMENTED OUT FOR NOW
        //TODO Extra example: What if we wanted to read out of a depth texture?
        //float depth = texture(depthSampler, ftexCoord).x;
        //fColor = vec4(depth, depth, depth, 1.0);

    }
}