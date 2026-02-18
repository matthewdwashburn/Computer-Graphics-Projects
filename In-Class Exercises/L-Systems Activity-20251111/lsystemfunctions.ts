import {initShaders, lookAt, vec4, mat4, flatten, perspective, translate, rotateZ} from "./helperfunctions.js";

"use strict";
//it will be handy to have references to some of our WebGL related objects
let gl:WebGLRenderingContext;
let canvas:HTMLCanvasElement;
let program:WebGLProgram;
let umv:WebGLUniformLocation; //index of the shader uniform for modelview matrix
let uproj:WebGLUniformLocation; //index of the shader uniform for projection matrix
let bufferId:WebGLBuffer;
let vPosition:GLint; //remember the location of shader attributes
let vColor:GLint; //remember the location of shader attributes
let mvstack:mat4[];
const ANGLE:number = 25;
let zoom:number = 45;

let mv:mat4;


let myPS:string; //plant string

//We want some set up to happen immediately when the page loads
window.onload = function init() {

    //fetch reference to the canvas element we defined in the html file
    canvas = document.getElementById("gl-canvas") as HTMLCanvasElement;
    //grab the WebGL 2 context for that canvas.  This is what we'll use to do our drawing
    gl = canvas.getContext('webgl2') as WebGLRenderingContext;
    if (!gl) {
        alert("WebGL isn't available");
    }

    //Take the vertex and fragment shaders we provided and compile them into a shader program
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program); //and we want to use that program for our rendering

    umv = gl.getUniformLocation(program, "model_view");
    uproj = gl.getUniformLocation(program, "projection");


    myPS = "[X]";
    mvstack = [];

    //This won't execute until the user hits a key
    //Note that we're defining the function anonymously.  If this gets too complicated
    //we probably want to split the code off somewhere and just give the name of the function
    //to call for this event
    window.addEventListener("keydown" ,function(event:KeyboardEvent){
        switch(event.key) {
            case " ": //switch modes
                nextPlant();
                break;
            case "ArrowDown":
                if(zoom < 170){
                    zoom += 5;
                }
                break;
            case "ArrowUp":
                if(zoom > 10){
                    zoom -= 5;
                }
                break;

        }

        requestAnimationFrame(render);//and now we need a new frame since we made a change
    });

    //We'll split this off to its own function for clarity, but we need something to make a picture of
    makeLineBuffer();

    //we'll talk more about this in a future lecture, but this is saying what part of the canvas
    //we want to draw to.  In this case, that's all of it.
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    //What color do you want the background to be?  This sets it to black and opaque.
    gl.clearColor(1.0, 1.0, 1.0, 1.0);

    //we need to do this to avoid having objects that are behind other objects show up anyway
    gl.enable(gl.DEPTH_TEST);
};


function nextPlant():void{
    let nextYear:string = "";

    for(let i:number = 0; i< myPS.length; i++){
        switch(myPS.charAt(i)){
            case 'F':
                nextYear += "FF";
                break;
            case 'L':
                nextYear += "L";
                break;
            case 'R':
                nextYear += "R";
                break;
            case 'X':
                nextYear += "FL[[X]RX]RF[RFX]LX";
                break;
            case '[':
                nextYear += "[";
                break;
            case ']':
                nextYear += "]";
                break;
        }
    }
    myPS = nextYear;
}


//Make a unit length line and send it over to the graphics card
function makeLineBuffer(){
    let lineverts:vec4[] = []; //empty array

    lineverts.push(new vec4(0,0,0,1));
    lineverts.push(new vec4(0,1,0,1));

    //we need some graphics memory for this information
    bufferId = gl.createBuffer();
    //tell WebGL that the buffer we just created is the one we want to work with right now
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    //send the local data over to this buffer on the graphics card.  Note our use of Angel's "flatten" function
    gl.bufferData(gl.ARRAY_BUFFER, flatten(lineverts), gl.STATIC_DRAW);

    //What is this data going to be used for?
    //The vertex shader has an attribute named "vPosition".  Let's associate part of this data to that attribute
    vPosition = gl.getAttribLocation(program, "vPosition");
    //attribute location we just fetched, 4 elements in each vector, data type float, don't normalize this data,
    //each position starts 32 bytes after the start of the previous one, and starts right away at index 0
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(vPosition);

}



//draw a new frame
function render(){
    //start by clearing any previous data for both color and depth
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //we'll discuss projection matrices in a couple of days, but use this for now:
    let p = perspective(zoom, canvas.clientWidth / canvas.clientHeight, 1.0, 1000.0);
    gl.uniformMatrix4fv(uproj, false, p.flatten());

    //now set up the model view matrix and send it over as a uniform
    //the inputs to this lookAt are to move back 20 units, point at the origin, and the positive y axis is up
    mv = lookAt(new vec4(0, 150, 500, 1), new vec4(0, 150, 0, 1), new vec4(0, 1, 0, 0));

    gl.uniformMatrix4fv(umv, false, mv.flatten());

    //we only have one object at the moment, but just so we don't forget this step if we have multiple buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 16, 0);

    drawPlant();

}

//TODO You fill in this function
function drawPlant(){
    for(let i:number=0; i< myPS.length; i++){
        switch(myPS.charAt(i)){
            case 'F':
                //TODO: send over the current modelview matrix
                gl.uniformMatrix4fv(umv, false, mv.flatten());
                //TODO: draw the line segment (mv will position it in vertex shader)
                gl.drawArrays(gl.LINES, 0, 2);
                mv = mv.mult(translate(0, 1, 0));
                //TODO: update the main memory mv matrix to translate one unit "up"
                gl.uniformMatrix4fv(umv, false, mv.flatten());
                break;
            case 'L':
                //TODO: update the main memory mv matrix to rotate around Z axis by ANGLE
                mv = mv.mult(rotateZ(ANGLE));
                gl.uniformMatrix4fv(umv, false, mv.flatten());
                break;
            case 'R':
                //TODO: update the main memory mv matrix to rotate around Z axis by -ANGLE
                mv = mv.mult(rotateZ(-ANGLE));
                gl.uniformMatrix4fv(umv, false, mv.flatten());
                break;
            case 'X':
                //TODO: do we need to do anything for 'X' this generation?
                break;
            case '[':
                //TODO push the current modelview matrix onto stack
                mvstack.push(mv);
                break;
            case ']':
                //TODO pop from modelview stack and restore to that state
                mv = mvstack.pop();
                break;     }
    }
}