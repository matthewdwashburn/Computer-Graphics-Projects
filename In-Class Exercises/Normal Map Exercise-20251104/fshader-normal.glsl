#version 300 es

precision highp float;

in vec2 ftexCoord;
in vec3 vT; //parallel to surface in eye space
in vec3 vN; //perpendicular to surface in eye space
in vec4 position;

uniform vec4 light_position;
uniform vec4 light_color;
uniform vec4 ambient_light;
uniform sampler2D colorMap;
uniform sampler2D normalMap;

out vec4  fColor;

void main()
{
    //TODO don't forget to re-normalize normal and tangent vectors on arrival
    vec3 T3 = normalize(vT);
    vec3 N3 = normalize(vN);

	//TODO binormal is cross of normal and tangent vectors in eye space
    vec3 Binormal3 = cross(T3,N3);

    vec4 T = vec4(T3, 0);
    vec4 N = vec4(N3, 0);
    vec4 Binormal = vec4(Binormal3, 0);

    //TODO construct a change of coordinate frame mat4 with columns of
    mat4 ChangeFrame = mat4(T, Binormal, N, vec4(0,0,0,1));

	//Tangent, Binormal, Normal, (0,0,0,1)
	//This will transform from local space (normal map values) to eye space

	vec3 L = normalize(light_position - position).xyz;
	vec3 E = normalize(-position).xyz;

	//TODO read from normal map
    vec4 NormalTexture = texture(normalMap, ftexCoord);
    NormalTexture = (NormalTexture * 2.0)- 1.0;
	//values stored in normal texture is [0,1] range, we need [-1, 1] range

	//TODO multiply change of coordinate frame matrix by normal map value
	//to convert from local space to eye space
    vec4 LocalToEye = ChangeFrame * NormalTexture;

	vec4 amb = texture(colorMap, ftexCoord) * ambient_light;
	//TODO calculate diffuse term using our eye-space vectors and the color map value
    vec4 diff = max(dot(L, LocalToEye.xyz), 0.0) * texture(colorMap, ftexCoord) * light_color;

	//bricks aren't shiny, so we'll skip the specular term on this one
	fColor = amb + diff;

}