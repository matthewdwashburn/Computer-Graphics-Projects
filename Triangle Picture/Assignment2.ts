import {initShaders, vec4, flatten} from "./helperfunctions.js";

"use strict";
let gl:WebGLRenderingContext;
let canvas:HTMLCanvasElement;
let program:WebGLProgram;
let bufferId:WebGLBuffer;

//do this immediately when the web page loads
window.onload = function init():void {
    canvas = document.getElementById("gl-canvas") as HTMLCanvasElement;
    //and the canvas has a webgl rendering context associated already
    gl = canvas.getContext("webgl2") as WebGLRenderingContext;
    if (!gl) {
        alert("WebGL not supported");
    }
    // use the helperfunctions function to turn vertex and fragment shader into program
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);
    makeTriangleAndBuffer();

    //what part of teh canvas should we use? (all of it here)
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0.0, 0.0, 0.0, 1.0); //start out opaque black

    //request a frame be drawn
    requestAnimationFrame(render); //render is the name of our drawing function below
}
function makeTriangleAndBuffer() {
    let trianglePoints: vec4[] = []; //create a local (RAM) array
    //create 3 vertices and add to local array
    //we haven't discussed projection, so stay between -1 and 1

    trianglePoints.push(new vec4(0, 0.8, 0, 1));
    trianglePoints.push(new vec4(-0.5, 0.4, 0,1));
    trianglePoints.push(new vec4(0, 0.55, 0,1));

    trianglePoints.push(new vec4(-0.1, 0.65, 0,1));
    trianglePoints.push(new vec4(0.1, 0.45, 0,1));
    trianglePoints.push(new vec4(-0.5, 0.28, 0,1));

    trianglePoints.push(new vec4(0, 0.8, 0, 1));
    trianglePoints.push(new vec4(0.5, 0.4, 0,1));
    trianglePoints.push(new vec4(0, 0.55, 0,1));

    trianglePoints.push(new vec4(0.1, 0.65, 0,1));
    trianglePoints.push(new vec4(-0.1, 0.45, 0,1));
    trianglePoints.push(new vec4(0.5, 0.28, 0,1));

    trianglePoints.push(new vec4(0, 0.55, 0, 1));
    trianglePoints.push(new vec4(-0.5, 0.15, 0,1));
    trianglePoints.push(new vec4(0, 0.3, 0,1));

    trianglePoints.push(new vec4(-0.1, 0.40, 0,1));
    trianglePoints.push(new vec4(0.1, 0.20, 0,1));
    trianglePoints.push(new vec4(-0.5, 0.03, 0,1));

    trianglePoints.push(new vec4(0, 0.55, 0, 1));
    trianglePoints.push(new vec4(0.5, 0.15, 0,1));
    trianglePoints.push(new vec4(0, 0.3, 0,1));

    trianglePoints.push(new vec4(0.1, 0.40, 0,1));
    trianglePoints.push(new vec4(-0.1, 0.20, 0,1));
    trianglePoints.push(new vec4(0.5, 0.03, 0,1));

    trianglePoints.push(new vec4(0, 0.3, 0, 1));
    trianglePoints.push(new vec4(-0.5, -0.1, 0,1));
    trianglePoints.push(new vec4(0, 0.05, 0,1));

    trianglePoints.push(new vec4(-0.1, 0.15, 0,1));
    trianglePoints.push(new vec4(0.1, -0.05, 0,1));
    trianglePoints.push(new vec4(-0.5, -0.22, 0,1));

    trianglePoints.push(new vec4(0, 0.3, 0, 1));
    trianglePoints.push(new vec4(0.5, -0.1, 0,1));
    trianglePoints.push(new vec4(0, 0.05, 0,1));

    trianglePoints.push(new vec4(0.1, 0.15, 0,1));
    trianglePoints.push(new vec4(-0.1, -0.05, 0,1));
    trianglePoints.push(new vec4(0.5, -0.22, 0,1));

    trianglePoints.push(new vec4(0, 0.05, 0, 1));
    trianglePoints.push(new vec4(-0.5, -0.35, 0,1));
    trianglePoints.push(new vec4(0, -0.2, 0,1));

    trianglePoints.push(new vec4(0, 0.05, 0, 1));
    trianglePoints.push(new vec4(0.5, -0.35, 0,1));
    trianglePoints.push(new vec4(0, -0.2, 0,1));

    trianglePoints.push(new vec4(-0.1, -0.2, 0,1));
    trianglePoints.push(new vec4(-0.1, -0.5, 0,1));
    trianglePoints.push(new vec4(0.1, -0.5, 0,1));

    trianglePoints.push(new vec4(-0.1, -0.2, 0,1));
    trianglePoints.push(new vec4(0.1, -0.5, 0,1));
    trianglePoints.push(new vec4(0.1, -0.2, 0,1));


    //get some graphics card memory
    bufferId = gl.createBuffer();
    //tell WebGL that the buffer we just created is the one to work with now
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    //send the local data over to the graphics card
    //flatten converts to 1D array
    gl.bufferData(gl.ARRAY_BUFFER, flatten(trianglePoints), gl.STATIC_DRAW);

    //tell openGL what the data means
    let vPosition:GLint = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);
}
    function render(){
        //start by clearing all buffers
        gl.clear(gl.COLOR_BUFFER_BIT);

        //iif we needed to, we could bind to the correct drawing buffer
        //but if we're already bound to it, this would have no impact
        //gl.bindBuffer(gl.ARRAY_BUFFER, bufferId):
        gl.drawArrays(gl.TRIANGLES, 0, 48);
    }