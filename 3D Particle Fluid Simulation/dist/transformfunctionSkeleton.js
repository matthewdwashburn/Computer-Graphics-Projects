"use strict";
//it will be handy to have references to some of our WebGL related objects
let gl;
let canvas;
let program;
let bufferId;
let umv; //index of model_view in shader program
let uproj; //index of projection in shader program
let xoffset;
let yoffset;
let zoffset;
let vPosition; //remember where this shader attribute is
let vColor; //remember where the color shader attribute is
//TODO we need to keep track of our current offsets
import { initShaders, vec4, flatten, perspective, translate, lookAt } from './helperfunctions.js';
//We want some set up to happen immediately when the page loads
window.onload = function init() {
    //fetch reference to the canvas element we defined in the html file
    canvas = document.getElementById("gl-canvas");
    //grab the WebGL 2 context for that canvas.  This is what we'll use to do our drawing
    gl = canvas.getContext('webgl2');
    if (!gl) {
        alert("WebGL isn't available");
    }
    //Take the vertex and fragment shaders we provided and compile them into a shader program
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program); //and we want to use that program for our rendering
    umv = gl.getUniformLocation(program, "model_view");
    uproj = gl.getUniformLocation(program, "projection");
    //TODO don't forget to initialize the offsets to zero
    xoffset = yoffset = zoffset = 0;
    //This won't execute until the user hits a key
    //Note that we're defining the function anonymously.  If this gets too complicated
    //we probably want to split the code off somewhere and just give the name of the function
    //to call for this event
    //Note that arrow keys are only picked up by keydown, not keypress for some reason
    window.addEventListener("keydown", function (event) {
        switch (event.key) {
            case "ArrowDown":
                yoffset -= 0.1;
                break;
            case "ArrowUp":
                yoffset += 0.1;
                break;
            case "ArrowLeft":
                xoffset += 0.1;
                break;
            case "ArrowRight":
                xoffset += 0.1;
                break;
            case "a":
                zoffset += 0.1;
                break;
            case "z":
                zoffset += 0.1;
                break;
            //TODO Respond to key presses
            //pattern is ArrowLeft for left arrow
        }
        requestAnimationFrame(render); //and now we need a new frame since we made a change
    });
    //We'll split this off to its own function for clarity, but we need something to make a picture of
    makeCubeAndBuffer();
    //we'll talk more about this in a future lecture, but this is saying what part of the canvas
    //we want to draw to.  In this case, that's all of it.
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    //What color do you want the background to be?  This sets it to black and opaque.
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    //we need to do this to avoid having objects that are behind other objects show up anyway
    gl.enable(gl.DEPTH_TEST);
    window.setInterval(update, 16); //target 60 frames per second
};
//Make a cube and send it over to the graphics card
function makeCubeAndBuffer() {
    let cubepoints = []; //empty array
    //front face = 6 verts, position then color
    cubepoints.push(new vec4(1.0, -1.0, 1.0, 1.0));
    cubepoints.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
    cubepoints.push(new vec4(1.0, 1.0, 1.0, 1.0));
    cubepoints.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
    cubepoints.push(new vec4(-1.0, 1.0, 1.0, 1.0));
    cubepoints.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
    cubepoints.push(new vec4(-1.0, 1.0, 1.0, 1.0));
    cubepoints.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
    cubepoints.push(new vec4(-1.0, -1.0, 1.0, 1.0));
    cubepoints.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
    cubepoints.push(new vec4(1.0, -1.0, 1.0, 1.0));
    cubepoints.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
    //back face
    cubepoints.push(new vec4(-1.0, -1.0, -1.0, 1.0));
    cubepoints.push(new vec4(1.0, 0.0, 1.0, 1.0)); //magenta
    cubepoints.push(new vec4(-1.0, 1.0, -1.0, 1.0));
    cubepoints.push(new vec4(1.0, 0.0, 1.0, 1.0)); //magenta
    cubepoints.push(new vec4(1.0, 1.0, -1.0, 1.0));
    cubepoints.push(new vec4(1.0, 0.0, 1.0, 1.0)); //magenta
    cubepoints.push(new vec4(1.0, 1.0, -1.0, 1.0));
    cubepoints.push(new vec4(1.0, 0.0, 1.0, 1.0)); //magenta
    cubepoints.push(new vec4(1.0, -1.0, -1.0, 1.0));
    cubepoints.push(new vec4(1.0, 0.0, 1.0, 1.0)); //magenta
    cubepoints.push(new vec4(-1.0, -1.0, -1.0, 1.0));
    cubepoints.push(new vec4(1.0, 0.0, 1.0, 1.0)); //magenta
    //left face
    cubepoints.push(new vec4(1.0, 1.0, 1.0, 1.0));
    cubepoints.push(new vec4(1.0, 1.0, 0.0, 1.0)); //yellow
    cubepoints.push(new vec4(1.0, -1.0, 1.0, 1.0));
    cubepoints.push(new vec4(1.0, 1.0, 0.0, 1.0)); //yellow
    cubepoints.push(new vec4(1.0, -1.0, -1.0, 1.0));
    cubepoints.push(new vec4(1.0, 1.0, 0.0, 1.0)); //yellow
    cubepoints.push(new vec4(1.0, -1.0, -1.0, 1.0));
    cubepoints.push(new vec4(1.0, 1.0, 0.0, 1.0)); //yellow
    cubepoints.push(new vec4(1.0, 1.0, -1.0, 1.0));
    cubepoints.push(new vec4(1.0, 1.0, 0.0, 1.0)); //yellow
    cubepoints.push(new vec4(1.0, 1.0, 1.0, 1.0));
    cubepoints.push(new vec4(1.0, 1.0, 0.0, 1.0)); //yellow
    //right face
    cubepoints.push(new vec4(-1.0, 1.0, -1.0, 1.0));
    cubepoints.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
    cubepoints.push(new vec4(-1.0, -1.0, -1.0, 1.0));
    cubepoints.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
    cubepoints.push(new vec4(-1.0, -1.0, 1.0, 1.0));
    cubepoints.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
    cubepoints.push(new vec4(-1.0, -1.0, 1.0, 1.0));
    cubepoints.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
    cubepoints.push(new vec4(-1.0, 1.0, 1.0, 1.0));
    cubepoints.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
    cubepoints.push(new vec4(-1.0, 1.0, -1.0, 1.0));
    cubepoints.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
    //top
    cubepoints.push(new vec4(1.0, 1.0, 1.0, 1.0));
    cubepoints.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
    cubepoints.push(new vec4(1.0, 1.0, -1.0, 1.0));
    cubepoints.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
    cubepoints.push(new vec4(-1.0, 1.0, -1.0, 1.0));
    cubepoints.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
    cubepoints.push(new vec4(-1.0, 1.0, -1.0, 1.0));
    cubepoints.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
    cubepoints.push(new vec4(-1.0, 1.0, 1.0, 1.0));
    cubepoints.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
    cubepoints.push(new vec4(1.0, 1.0, 1.0, 1.0));
    cubepoints.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
    //bottom
    cubepoints.push(new vec4(1.0, -1.0, -1.0, 1.0));
    cubepoints.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
    cubepoints.push(new vec4(1.0, -1.0, 1.0, 1.0));
    cubepoints.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
    cubepoints.push(new vec4(-1.0, -1.0, 1.0, 1.0));
    cubepoints.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
    cubepoints.push(new vec4(-1.0, -1.0, 1.0, 1.0));
    cubepoints.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
    cubepoints.push(new vec4(-1.0, -1.0, -1.0, 1.0));
    cubepoints.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
    cubepoints.push(new vec4(1.0, -1.0, -1.0, 1.0));
    cubepoints.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
    //we need some graphics memory for this information
    bufferId = gl.createBuffer();
    //tell WebGL that the buffer we just created is the one we want to work with right now
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    //send the local data over to this buffer on the graphics card.  Note our use of Angel's "flatten" function
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cubepoints), gl.STATIC_DRAW);
    //Data is packed in groups of 4 floats which are 4 bytes each, 32 bytes total for position and color
    // position            color
    //  x   y   z     w       r    g     b    a
    // 0-3 4-7 8-11 12-15  16-19 20-23 24-27 28-31
    //What is this data going to be used for?
    //The vertex shader has an attribute named "vPosition".  Let's associate part of this data to that attribute
    //TODO Uncomment this
    //vPosition = gl.getAttribLocation(program, "vPosition");
    //attribute location we just fetched, 4 elements in each vector, data type float, don't normalize this data,
    //each position starts 32 bytes after the start of the previous one, and starts right away at index 0
    //TODO uncomment these
    //gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 32, 0);
    //gl.enableVertexAttribArray(vPosition);
    //The vertex shader also has an attribute named "vColor".  Let's associate the other part of this data to that attribute
    //TODO uncomment
    //vColor = gl.getAttribLocation(program, "vColor");
    //attribute location we just fetched, 4 elements in each vector, data type float, don't normalize this data,
    //each color starts 32 bytes after the start of the previous one, and the first color starts 16 bytes into the data
    //TODO uncomment these
    //gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 32, 16);
    //gl.enableVertexAttribArray(vColor);
}
//increase rotation angle and request new frame
function update() {
    //TODO eventually we can do some animation updates here
    requestAnimationFrame(render);
}
//draw a new frame
function render() {
    //start by clearing any previous data for both color and depth
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    //we'll discuss projection matrices in a couple of days, but use this for now:
    let p = perspective(45.0, canvas.clientWidth / canvas.clientHeight, 1.0, 100.0);
    //TODO uncomment once you've declared the variable above
    gl.uniformMatrix4fv(uproj, false, p.flatten());
    //now set up the model view matrix and send it over as a uniform
    //the inputs to this lookAt are to move back 20 units, point at the origin, and the positive y axis is up
    //TODO construct a model view matrix and send it as a uniform to the vertex shader
    let mv = lookAt(new vec4(0, 10, 20, 1), new vec4(0, 0, 0, 1), (new vec4(0, 1, 0, 0)));
    //multiply translate matrix to the right of lookAt matrix
    mv = mv.mult(translate(xoffset, yoffset, zoffset));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    //we only have one object at the moment, but just so we don't forget this step later...
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    //draw the geometry we previously sent over.  It's a list of 12 triangle(s),
    //we want to start at index 0, and there will be a total of 36 vertices (6 faces with 6 vertices each)
    gl.drawArrays(gl.TRIANGLES, 0, 36); // draw the cube
}
