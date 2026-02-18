#version 300 es
precision highp float;
precision lowp int;

in vec2 vTexCoord;
uniform sampler2D normalSampler; //Normal map plus background texture

//Transformation matricies
uniform mat4 inverseProjection; //Take objects from clip space to view space
uniform mat4 model_view; //Take world to view space
uniform mat4 inverseView; //Take objects from view space to world space


//Lighting
uniform vec4 light_position[5];
uniform vec4 light_color[5];
uniform vec4 light_direction[5];
uniform float spotLight_angle[5];
uniform vec4 ambient_light;

out vec4  fColor;

//Given a pixel's texture position, use density to calculate it's position in view space
vec3 viewPosition (vec2 texCoord) {
    vec4 normalSample = texture(normalSampler, texCoord);
    float depth = normalSample.a;

    //Convert texture coordinates to screen coordinates
    vec2 normalizedDeviceCoords = texCoord * 2.0 - 1.0;

    //Reconstruct the viewVector pointing from the camera to the object
    //Take the ndc from clip space to view space with the inverse proj matrix
    vec4 viewVector = inverseProjection * vec4(normalizedDeviceCoords, -1.0, 1.0);
    vec3 viewDirection = normalize(viewVector.xyz);
    //Step in the direction of the pixel the same number of times as its depth
    return vec3(viewDirection * depth);
}

void main()
{
    vec4 texNormal = texture(normalSampler, vTexCoord);
    float depth = texNormal.a;

    //Skip background, already has lighting
    if(depth > 900.0) {
        fColor =  texture(normalSampler, vTexCoord);
        return;
    }

        vec4 veyepos = vec4(viewPosition(vTexCoord), 1.0); //get vertex from model to eye space

        vec4 worldNormal = vec4(normalize(texNormal.rgb * 2.0 - 1.0), 0.0); //Convert back to a -1 to 1 normalized vector

        vec3 V = normalize(-veyepos.xyz);
        vec3 N = normalize((model_view * worldNormal).xyz);

        //TODO Set blue to white sky gradient as ambient diffuse color
        vec4 AmbientDiffuseColor = vec4(0.0, 0.1, 0.7, 0.5); //Slightly transparent deep blue
        vec4 SpecularColor = vec4(1.0, 1.0, 1.0, 1.0); //White sun
        float SpecularExponent = 100.0; //Very reflective

        vec4 amb = AmbientDiffuseColor * ambient_light;

        //Sum of diffuse and specular light
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
            vec4 finalColor = amb + totalDiff + totalSpec;

            fColor = vec4(finalColor.xyz, 1.0);
//            fColor = texNormal;
    }