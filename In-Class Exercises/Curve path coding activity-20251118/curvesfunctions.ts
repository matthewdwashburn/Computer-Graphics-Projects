import {initFileShaders, mat4, ortho, flatten, vec2, vec4} from "./helperfunctions.js";

"use strict";
//it will be handy to have references to some of our WebGL related objects
let gl:WebGLRenderingContext;
let canvas:HTMLCanvasElement;
let program:WebGLProgram;
let umv:WebGLUniformLocation; //index of the shader uniform for modelview matrix
let uproj:WebGLUniformLocation; //index of the shader uniform for projection matrix
let umode:WebGLUniformLocation; //what type of curve are we following?
let shader_t:WebGLUniformLocation; //what is the free parameter value?
let controlPoints:WebGLUniformLocation; //what is the current set of control points?
let mode:number;
let trace:boolean;
let bufferId:WebGLBuffer;
let vPosition:GLint; //remember the location of shader attributes
let vColor:GLint; //remember the location of shader attributes
const NUM_POINTS:number = 24; //how many control points should there be? (for Bezier curves, try to make this a multiple of 3)
let p0:number = 0; //Control point index 0 is the starting P0
let t:number = 0; //t is the free parameter
let tstep:number = 0.01; //delta t
let mv:mat4;
let verts:vec2[];



//We want some set up to happen immediately when the page loads
window.onload = function init() {

    //fetch reference to the canvas element we defined in the html file
    canvas = <HTMLCanvasElement> document.getElementById("gl-canvas");
    //grab the WebGL 2 context for that canvas.  This is what we'll use to do our drawing
    gl = <WebGLRenderingContext> canvas.getContext('webgl2', { preserveDrawingBuffer: true });

    //gl = canvas.getContext('webgl2', {preserveDrawingBuffer: true});
    if (!gl) {
        alert("WebGL isn't available");
    }

    //Take the vertex and fragment shaders we provided and compile them into a shader program
    program = initFileShaders(gl, "vshader-universal.glsl", "fshader-universal.glsl");
    gl.useProgram(program); //and we want to use that program for our rendering

    umv = gl.getUniformLocation(program, "model_view");
    uproj = gl.getUniformLocation(program, "projection");
    umode = gl.getUniformLocation(program, "mode");
    //and our moving dot shader needs these uniforms as well
    shader_t = gl.getUniformLocation(program, "t");
    controlPoints = gl.getUniformLocation(program, "controlPoints");

    vColor = gl.getAttribLocation(program, "vColor");



    window.addEventListener("keydown" ,function(event:KeyboardEvent){
        switch(event.key) {
            case "1": //switch modes to lerp
                mode = 1;
                break;
            case "2": //switch modes to bezier
                mode = 2;
                break;
            case "3": //switch modes to catmull rom
                mode = 3;
                break;
            case "4": //switch modes to b spline
                mode = 4;
                break;
            case "t": //toggle trace mode
                trace = !trace;
                break;
            case "c": //clear the screen if we're in trace mode
                gl.clear(gl.COLOR_BUFFER_BIT);
                break;

        }

        requestAnimationFrame(render);//and now we need a new frame since we made a change
    });

    //We'll split this off to its own function for clarity, but we need something to make a picture of
    makePointsBuffer();

    mode = 1; //start with lerp
    trace = true;

    //gl.enable(gl.POINT_SMOOTH); //doesn't look like WebGL supports this

    gl.uniformMatrix4fv(uproj, false, ortho(0, canvas.clientWidth, 0, canvas.clientHeight, -1, 1).flatten());
    gl.uniformMatrix4fv(umv, false, new mat4().flatten());

    //we'll talk more about this in a future lecture, but this is saying what part of the canvas
    //we want to draw to.  In this case, that's all of it.
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    //What color do you want the background to be?  This sets it to black and opaque.
    gl.clearColor(1.0, 1.0, 1.0, 1.0);

    window.setInterval(update, 60); //was getting some weird framerate issues with rates faster than this, didn't have time to diagnose properly
};

function update(){
    t+=tstep; //Increase to next t value
    if(t >= 1){//Move to next set of control points
        t-=1;
        if(mode == 2){//bezier moves 3 at a time
            p0 = (p0+3)%NUM_POINTS;
        }else{
            p0= (p0+1)%NUM_POINTS;//advance to next set of control points
        }
        let points:vec2[] = [verts[p0], verts[(p0+1)%NUM_POINTS], verts[(p0+2)%NUM_POINTS], verts[(p0+3)%NUM_POINTS]];
        gl.uniform2fv(controlPoints,  flatten(points));
    }
    gl.uniform1f(shader_t, t);
    //figure out new position of ball

    requestAnimationFrame(render);
}





//Make a unit length line and send it over to the graphics card
function makePointsBuffer(){
    verts = [];
    //initialize control point positions to two concentric circles
    for(let i=0; i<NUM_POINTS; i++){
        verts[i] = new vec2(Math.cos(2*Math.PI*i/NUM_POINTS)*(250+100*(i%2))+500, Math.sin(2*Math.PI*i/NUM_POINTS)*(250+100*(i%2))+500);
    }

    bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(verts), gl.STATIC_DRAW);

    //What is this data going to be used for?
    //The vertex shader has an attribute named "vPosition".  Let's associate part of this data to that attribute
    vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 8, 0);
    gl.enableVertexAttribArray(vPosition);

    let points:vec2[] = [verts[0], verts[1], verts[2], verts[3]];
    gl.uniform2fv(controlPoints,  flatten(points));

}



//draw a new frame
function render(){
    if(!trace) {
        gl.clear(gl.COLOR_BUFFER_BIT);
    }
    drawPoints();

    //Draw the ball
    gl.uniform1i(umode, mode);
    //now it's time for our little ball that's moving around according to our active curve program
    gl.drawArrays(gl.POINTS, 0, 1);//the position will be ignored, we just need to trigger a vertex shader invocation

}

function drawPoints(){
    //draw control points
    gl.uniform1i(umode, 0);

    // current batch of control points in red
    gl.vertexAttrib4fv(vColor, [1, 0, 0, 1]);
    // draw control points at the beginning of the circle when the current position is at the end of the circle
    if(p0 + 4 > NUM_POINTS) {
        gl.drawArrays(gl.POINTS, 0, (p0 + 4) - NUM_POINTS);
    }
    // otherwise, draw control points starting at current position
    gl.drawArrays(gl.POINTS, p0, Math.min(NUM_POINTS - p0, 4));

    // the rest of the points in green
    gl.vertexAttrib4fv(vColor, [0, 1, 0, 1]);

    // start either at the beginning of the circle, or after the control points if control points are at beginning
    if(p0 - Math.max(0, (p0 + 4) - NUM_POINTS) > 0 ) {
        gl.drawArrays(gl.POINTS, Math.max(0, (p0 + 4) - NUM_POINTS), p0 - Math.max(0, (p0 + 4) - NUM_POINTS));
    }

    if( Math.max(0, NUM_POINTS - p0 - 4) > 0) {
        gl.drawArrays(gl.POINTS, (p0 + 4) % NUM_POINTS, Math.max(0, NUM_POINTS - p0 - 4));
    }

    //The following block of code does a really poor job of drawing the Bezier guide lines
    //barely useful
    if (mode == 2){
        gl.vertexAttrib4fv(vColor, [0, 0, 0, 1]);
        for (let i:number = 0; i < NUM_POINTS - 2; i++){
            gl.drawArrays(gl.LINES, i, 2);
            i += 2;
            if (i < NUM_POINTS-1){
                gl.drawArrays(gl.LINES, i, 2);
            }
        }
    }
}

