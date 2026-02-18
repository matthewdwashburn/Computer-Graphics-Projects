#version 300 es
precision mediump float;
precision lowp int;

in vec4 color;
in vec4 AmbientDiffuseColor;
in vec4 Normal;
in vec4 SpecularColor;
in float SpecularExponent; //note this is a float, not a vec4
in vec4 Position;




uniform int mode; //0: unlit, 1:Gouraud, 2: Phong, 3: Cel
uniform mat4 model_view;
uniform mat4 projection;
uniform vec4 light_position;
uniform vec4 light_color;
uniform vec4 ambient_light;

const vec4[] colorPallet = vec4[](vec4(0,0,0,1), vec4(0.2,0,0,1), vec4(0.4,0,0,1), vec4(0.8,0,0,1), vec4(1,1,1,1));



out vec4  fColor;

void main()
{
	vec4 amb = vec4(0,0,0,1);
	vec4 diff = vec4(0,0,0,1);
	vec4 spec = vec4(0,0,0,1);

	if(mode == 0){ //Unlit
		fColor = color;

	}else if(mode == 1){ //Gouraud
		fColor = color;
	} else if(mode == 2) {
	    vec4 veyepos = model_view * Position; //get vertex from model to eye space
	    vec3 L = normalize( light_position.xyz - veyepos.xyz); //light vector pointing from the surface to the light source
	    vec3 V = normalize(-veyepos.xyz);
	    vec3 N = normalize((model_view * Normal).xyz);
	    vec3 R = reflect(-L, N); //vector_from light source, reflected across Normal
	    vec4 amb = AmbientDiffuseColor * ambient_light;
	    vec4 diff = max(dot(L,N), 0.0) * AmbientDiffuseColor * light_color;
	    vec4 spec = pow(max(dot(R,V), 0.0), SpecularExponent) * SpecularColor * light_color;

	    if(dot(L,N) < 0.0) {
	        spec = vec4(0,0,0,1); //no glare beyond the horizon!
	        }
        fColor = amb + diff + spec;
        // fColor = vec4(N, 1.0);
	} else if(mode == 3) {
        vec4 veyepos = model_view * Position; //get vertex from model to eye space
        vec3 L = normalize( light_position.xyz - veyepos.xyz); //light vector pointing from the surface to the light source
        vec3 V = normalize(-veyepos.xyz);
        vec3 N = normalize((model_view * Normal).xyz);
        vec3 R = reflect(-L, N); //vector_from light source, reflected across Normal
        vec4 amb = AmbientDiffuseColor * ambient_light;
        vec4 diff = max(dot(L,N), 0.0) * AmbientDiffuseColor * light_color;
        vec4 spec = pow(max(dot(R,V), 0.0), SpecularExponent) * SpecularColor * light_color;

        if(dot(L,N) < 0.0) {
            spec = vec4(0,0,0,1); //no glare beyond the horizon!
        }

        vec4 computedColor = amb + diff + spec;

        float minDistance = distance(computedColor.rgb, colorPallet[0].rgb);
        int nearestColorIndex = 0;

        for(int i = 1; i < 5; i++) {
            float dist = distance(computedColor.rgb, colorPallet[i].rgb);
            if(dist < minDistance) {
                minDistance = dist;
                nearestColorIndex = i;
            }
        }

        fColor = colorPallet[nearestColorIndex];

        // fColor = vec4(N, 1.0);
    }

	

}