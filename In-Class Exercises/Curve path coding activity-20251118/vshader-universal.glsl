#version 300 es

in vec2 vPosition;
in vec4 vColor;

uniform int mode;
uniform float t;
uniform mat4 model_view;
uniform mat4 projection;
uniform vec2 controlPoints[4];

out vec4 color;

vec4 bezier(){
    vec4 tvec = vec4(
    (1.0-t)*(1.0-t)*(1.0-t),
    3.0*(1.0-t)*(1.0-t)*t,
    3.0*(1.0-t)*t*t,
    t*t*t);
    //make a 4 column, 2 row matrix
    mat4x2 coordmat = mat4x2(controlPoints[0], controlPoints[1], controlPoints[2], controlPoints[3]);
    //glsl wants matrix columns (column major), but I actually want those to be rows, not columns
    mat2x4 transposedMatrix = transpose(coordmat);
    return vec4(tvec * transposedMatrix, 0.0, 1.0);
}

vec4 bSpline(){
    vec4 tvec = vec4(
    (1.0-t)*(1.0-t)*(1.0-t),
    3.0*t*t*t - 6.0*t*t + 4.0,
    -3.0*t*t*t + 3.0*t*t + 3.0*t + 1.0,
    t*t*t)/6.0;
    //make a 4 column, 2 row matrix
    mat4x2 coordmat = mat4x2(controlPoints[0], controlPoints[1], controlPoints[2], controlPoints[3]);
    //glsl wants matrix columns (column major), but I actually want those to be rows, not columns
    mat2x4 transposedMatrix = transpose(coordmat);
    return vec4(tvec * transposedMatrix, 0.0, 1.0);
}

vec4 cr(){
    vec4 tvec = vec4(
        -t + 2.0 * t*t - t*t*t,
        2.0 - 5.0 * t*t + 3.0 * t*t*t,
        t + 4.0 * t*t - 3.0 * t*t*t,
        -t*t + t*t*t
    )/2.0; // All terms should be mulitplied by 1/2 which is the same as dividing by two

    //make a 4 column, 2 row matrix
    mat4x2 coordmat = mat4x2(controlPoints[0], controlPoints[1], controlPoints[2], controlPoints[3]);
    //glsl wants matrix columns (column major), but I actually want those to be rows, not columns
    mat2x4 transposedMatrix = transpose(coordmat);
    return vec4(tvec * transposedMatrix, 0.0, 1.0);
}

vec4 lerp(){
	//this will calculate the x and y coordinates as a vec2, then add on the z and w coordinates
	//linearly interpolate between 2nd and 3rd control point (ignore 1st and 4th)s
	return vec4(controlPoints[1]*(1.0-t) + t*controlPoints[2], 0.0, 1.0);
}

//this is for drawing the control points
vec4 control(){
    return vec4(vPosition, 0.0, 1.0);
}


void main()
{
    if(mode == 0){ //mode 0 is control points, so use supplied point color
        color = vColor;

    }else{
        color = vec4(0.0,0.0,1.0,1.0); //make the "ball" blue
    }

    vec4 position;
    switch(mode){
        case 0: //control point
            position = control();
            gl_PointSize = 10.0;
            break;
        case 1: //lerp
            position = lerp();
            gl_PointSize = 20.0;
            break;
        case 2: //bezier
            position = bezier();
            gl_PointSize = 20.0;
            break;
        case 3: //cr
            position = cr();
            gl_PointSize = 20.0;
            break;
        case 4: //b-spline
            position = bSpline();
            gl_PointSize = 20.0;
            break;
    }

	gl_Position = projection * model_view * position;
	

}