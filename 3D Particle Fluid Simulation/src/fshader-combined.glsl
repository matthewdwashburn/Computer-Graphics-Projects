#version 300 es
precision mediump float;
precision lowp int;

in vec4 AmbientDiffuseColor;
in vec4 Normal;
in vec4 SpecularColor;
in float SpecularExponent;
in vec4 Position;
in float Density;

//Matricies
uniform mat4 model_view;
uniform mat4 projection;

//Lighting
uniform vec4 light_position[5];
uniform vec4 light_color[5];
uniform vec4 light_direction[5];
uniform float spotLight_angle[5];
uniform vec4 ambient_light;

out vec4  fColor;

void main()
{
    //If we are drawing instanced particles, set color to density value
    if(Density != -1000.0) {
        vec4 ambientColor = vec4(0.0, 0.0, 1.0, 1.0);
        ambientColor = vec4((Density+1.0) * 5.0, 0.0, 1.0 - (Density+1.0) * 5.0, 1.0);
        vec4 veyepos = model_view * Position; //get vertex from model to eye space
        vec4 amb = ambientColor * ambient_light;
        vec3 V = normalize(-veyepos.xyz);
        vec3 N = normalize((model_view * Normal).xyz);

        vec4 totalDiff = vec4(0,0,0,1);
        vec4 totalSpec = vec4(0,0,0,1);

        //For all lights
        for(int i = 0; i < 5; i++) {
            vec3 L = normalize(light_position[i].xyz - veyepos.xyz); //light vector pointing from the surface to the light source
            vec3 R = reflect(-L, N); //vector_from light source, reflected across Normal
            vec4 diff = max(dot(L, N), 0.0) * ambientColor * light_color[i];
            vec4 spec = pow(max(dot(R, V), 0.0), SpecularExponent) * SpecularColor * light_color[i];
            if (dot(L, N) < 0.0) {
                spec = vec4(0, 0, 0, 1); //no glare beyond the horizon!
            }
            //Spotlight implemented
            vec3 spotLightDir = normalize(light_direction[i].xyz);
            vec3 lightToVertex = normalize((veyepos - light_position[i]).xyz);
            float spotLightAngle = dot(spotLightDir, lightToVertex);
            //Set spotlight angle limit
            if (spotLightAngle < spotLight_angle[i]) {
                diff = vec4(0, 0, 0, 1);
                spec = vec4(0, 0, 0, 1);
            }
            totalDiff += diff;
            totalSpec += spec;
        }
        fColor = amb + totalDiff + totalSpec;
        //Otherwise just draw uniform ambient diffuse colors
    } else {
        vec4 veyepos = model_view * Position; //get vertex from model to eye space
        vec4 amb = AmbientDiffuseColor * ambient_light;
        vec3 V = normalize(-veyepos.xyz);
        vec3 N = normalize((model_view * Normal).xyz);

        vec4 totalDiff = vec4(0,0,0,1);
        vec4 totalSpec = vec4(0,0,0,1);

        //For all lights
        for(int i = 0; i < 5; i++) {
            vec3 L = normalize(light_position[i].xyz - veyepos.xyz); //light vector pointing from the surface to the light source
            vec3 R = reflect(-L, N); //vector_from light source, reflected across Normal
            vec4 diff = max(dot(L, N), 0.0) * AmbientDiffuseColor * light_color[i];
            vec4 spec = pow(max(dot(R, V), 0.0), SpecularExponent) * SpecularColor * light_color[i];
            if (dot(L, N) < 0.0) {
                spec = vec4(0, 0, 0, 1); //no glare beyond the horizon!
            }
            //Spotlight implemented
            vec3 spotLightDir = normalize(light_direction[i].xyz);
            vec3 lightToVertex = normalize((veyepos - light_position[i]).xyz);
            float spotLightAngle = dot(spotLightDir, lightToVertex);
            //Set spotlight angle limit
            if (spotLightAngle < spotLight_angle[i]) {
                diff = vec4(0, 0, 0, 1);
                spec = vec4(0, 0, 0, 1);
            }
            totalDiff += diff;
            totalSpec += spec;
        }
        fColor = amb + totalDiff + totalSpec;
    }

}