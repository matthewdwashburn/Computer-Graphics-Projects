#version 300 es
precision mediump float;
precision lowp int;
in vec4 vPosition;
in vec4 vAmbientDiffuseColor;


out vec4 color;


uniform mat4 model_view;
uniform mat4 projection;
uniform int mode; //0: unlit, 1:Gouraud, 2: Phong, 3: Cel


void
main()
{
	gl_Position = vec4(0, 0, 0, 1); //to make the shader compiler happy
	if(mode == 0){ //unlit
		color = vAmbientDiffuseColor;
		gl_Position = projection * model_view * vPosition;

	}
	

}