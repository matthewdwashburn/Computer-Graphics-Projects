#version 300 es
precision mediump float;
precision lowp int;

in vec4 color;



uniform int mode; //0: unlit, 1:Gouraud, 2: Phong, 3: Cel



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
	}
	

}