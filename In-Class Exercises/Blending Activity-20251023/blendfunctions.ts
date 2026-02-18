
import {initShaders, vec4, mat4, flatten, perspective, lookAt, translate} from './helperfunctions.js';

"use strict";
//it will be handy to have references to some of our WebGL related objects
let gl:WebGLRenderingContext;
let canvas:HTMLCanvasElement;
let program:WebGLProgram;

//uniform locations
let umv:WebGLUniformLocation; //uniform for mv matrix
let uproj:WebGLUniformLocation; //uniform for projection matrix



//We want some set up to happen immediately when the page loads
window.onload = function init() {

    //fetch reference to the canvas element we defined in the html file
    canvas = document.getElementById("gl-canvas") as HTMLCanvasElement;
    //grab the WebGL 2 context for that canvas.  This is what we'll use to do our drawing4
    gl = canvas.getContext('webgl2') as WebGLRenderingContext;
    //note that if we leave a pixel with an alpha less than 1, it will blend with the canvas background
    //which is white by default.  Try adding this to the canvas in the html: style="background: black"
    if (!gl) {
        alert("WebGL isn't available");
    }

    //Take the vertex and fragment shaders we provided and compile them into a shader program
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program); //and we want to use that program for our rendering

    umv = gl.getUniformLocation(program, "model_view");
    uproj = gl.getUniformLocation(program, "projection");

    //TODO Enable blending
    gl.enable(gl.BLEND);
    //TODO define a blending function
    //this function is the standard OpenGL blending function
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    //but this one might be more appropriate for WebGL since the canvas itself can be translucent
    //if a canvas pixel has a final alpha less than 1
    gl.blendFuncSeparate(
        gl.SRC_ALPHA,
        gl.ONE_MINUS_SRC_ALPHA,
        gl.ONE,                      //note that this will force the resulting fragment to have an alpha of 1
        gl.ONE_MINUS_SRC_ALPHA
    );

    //We'll split this off to its own function for clarity, but we need something to assign colors to
    makeSquareAndBuffer();

    //we'll talk more about this in a future lecture, but this is saying what part of the canvas
    //we want to draw to.  In this case, that's all of it.
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    //What color do you want the background to be?  This sets it to black and opaque.
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    //request that a frame be drawn
    render(); //we'll have a better way to trigger a new frame in the next lecture, but this will work for now
};

//Make a square and send it over to the graphics card
function makeSquareAndBuffer(){
    let squarePoints: vec4[] = []; //empty array

    //create 6 vertices and add them to the array
    squarePoints.push(new vec4(-1, -1, 0, 1));
    squarePoints.push(new vec4(1, -1, 0, 1));
    squarePoints.push(new vec4(1, 1, 0, 1));
    squarePoints.push(new vec4(1, 1, 0, 1));
    squarePoints.push(new vec4(-1, 1, 0, 1));
    squarePoints.push(new vec4(-1, -1, 0, 1));


    //we need some graphics memory for this information
    let bufferId:WebGLBuffer = gl.createBuffer();
    //tell WebGL that the buffer we just created is the one we want to work with right now
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    //send the local data over to this buffer on the graphics card.  Note our use of Angel's "flatten" function
    gl.bufferData(gl.ARRAY_BUFFER, flatten(squarePoints), gl.STATIC_DRAW);

    let vPosition:GLint = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

}

//draw a new frame
function render(){
    //start by clearing any previous data
    gl.clear(gl.COLOR_BUFFER_BIT);


    let p:mat4 = perspective(45.0, canvas.clientWidth / canvas.clientHeight, 1.0, 100.0);
    gl.uniformMatrix4fv(uproj, false, p.flatten());

    let mv:mat4 = lookAt(new vec4(0, 0, 5, 1), new vec4(0, 0, 0, 1), new vec4(0, 1, 0, 0));

    let commonmv:mat4 = mv; //so we can get back to this state later


    gl.uniformMatrix4fv(umv, false, mv.flatten());


    //TODO Play with the color values (specifically that alpha value)
    let vColor:GLint = gl.getAttribLocation(program, "vColor");
    //opaque red
    gl.vertexAttrib4fv(vColor, [1,0,0,1]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);


    mv = commonmv.mult(translate(-0.5, 0.5, 0));

    gl.uniformMatrix4fv(umv, false, mv.flatten());

    //TODO play with color/alpha
    //translucent green
    gl.vertexAttrib4fv(vColor, [0, 0.9, 0, .5]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

}
