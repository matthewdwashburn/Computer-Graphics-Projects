#version 300 es

in vec4 vPosition;
in vec2 texCoord;
in vec4 vNormal;
in vec4 vTangent;

out vec2 ftexCoord;
out vec3 vT;
out vec3 vN;
out vec4 position;

uniform mat4 model_view;
uniform mat4 projection;
uniform vec4 light_position;


void
main()
{
	vN = normalize(model_view * vNormal).xyz;
	vT = normalize(model_view * vTangent).xyz;

	vec4 veyepos = model_view * vPosition;
	position = veyepos;

	ftexCoord = texCoord;

	gl_Position = projection * model_view*vPosition;


}