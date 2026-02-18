"use strict";

import {initFileShaders, perspective, vec2, vec4, mat4, flatten, lookAt, rotateX, rotateY} from './helperfunctions.js';
let gl:WebGLRenderingContext;
let program:WebGLProgram;
let activeProgram:WebGLProgram;
let anisotropic_ext:EXT_texture_filter_anisotropic; //TODO next week...

let checkerTex:WebGLTexture;


//uniform locations
let umv:WebGLUniformLocation; //uniform for mv matrix
let uproj:WebGLUniformLocation; //uniform for projection matrix

//matrices
let mv:mat4; //local mv
let p:mat4; //local projection

//shader variable indices for material properties
let vPosition:GLint; //
let vTexCoord:GLint;
let uTextureSampler:WebGLUniformLocation;//this will be a pointer to our sampler2D


//document elements
let canvas:HTMLCanvasElement;

//interaction and rotation state
let xAngle:number;
let yAngle:number;
let mouse_button_down:boolean = false;
let prevMouseX:number = 0;
let prevMouseY:number = 0;
let zoom:number = 45;

window.onload = function init() {

    canvas = document.getElementById("gl-canvas") as HTMLCanvasElement;
    gl = canvas.getContext('webgl2', {antialias:true}) as WebGLRenderingContext;
    if (!gl) {
        alert("WebGL isn't available");
    }
    //allow the user to rotate mesh with the mouse
    canvas.addEventListener("mousedown", mouse_down);
    canvas.addEventListener("mousemove", mouse_drag);
    canvas.addEventListener("mouseup", mouse_up);

    //black background
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    program = initFileShaders(gl, "vshader-texture.glsl", "fshader-texture.glsl");

    gl.useProgram(program);
    umv = gl.getUniformLocation(program, "model_view");
    uproj = gl.getUniformLocation(program, "projection");
    uTextureSampler = gl.getUniformLocation(program, "textureSampler");//get reference to sampler2D

    //set up basic perspective viewing
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    p = perspective(zoom, (canvas.clientWidth / canvas.clientHeight), 1, 20);
    gl.uniformMatrix4fv(uproj, false, p.flatten());

    makeCheckerTexture();
    makeSquareAndBuffer();

    //initialize rotation angles
    xAngle = 0;
    yAngle = 0;

    window.addEventListener("keydown" ,event => {
        switch(event.key) {
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
            case "l":
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                break;
            case "n":
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);//try different min and mag filters
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                break;
            case "c":
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                break;
            case "r":
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                break;
        }

        p = perspective(zoom, (canvas.clientWidth / canvas.clientHeight), 1, 20);
        gl.uniformMatrix4fv(uproj, false, p.flatten());
        requestAnimationFrame(render);//and now we need a new frame since we made a change
    });

    requestAnimationFrame(render);

};




//Make a square and send it over to the graphics card
function makeSquareAndBuffer(){
    let squarePoints:any[] = []; //empty array

    //create 4 vertices and add them to the array
    squarePoints.push(new vec4(-1, -1, 0, 1));

    squarePoints.push(new vec2(0,0)); //texture coordinates, bottom left

    squarePoints.push(new vec4(1, -1, 0, 1));

    squarePoints.push(new vec2(2,0)); //texture coordinates, bottom right

    squarePoints.push(new vec4(1, 1, 0, 1));

    squarePoints.push(new vec2(2,2)); //texture coordinates, top right

    squarePoints.push(new vec4(-1, 1, 0, 1));

    squarePoints.push(new vec2(0,2)); //texture coordinates, top left

    //we need some graphics memory for this information
    let bufferId:WebGLBuffer = gl.createBuffer();
    //tell WebGL that the buffer we just created is the one we want to work with right now
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    //send the local data over to this buffer on the graphics card.  Note our use of Angel's "flatten" function
    gl.bufferData(gl.ARRAY_BUFFER, flatten(squarePoints), gl.STATIC_DRAW);

    vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 24, 0); //stride is 24 bytes total for position, texcoord
    gl.enableVertexAttribArray(vPosition);

    vTexCoord = gl.getAttribLocation(program, "texCoord");
    gl.vertexAttribPointer(vTexCoord, 2, gl.FLOAT, false, 24, 16); //stride is 24 bytes total for position, texcoord
    gl.enableVertexAttribArray(vTexCoord);

}

//update rotation angles based on mouse movement
function mouse_drag(event:MouseEvent){
    let thetaY:number, thetaX:number;
    if (mouse_button_down) {
        thetaY = 360.0 *(event.clientX-prevMouseX)/canvas.clientWidth;
        thetaX = 360.0 *(event.clientY-prevMouseY)/canvas.clientHeight;
        prevMouseX = event.clientX;
        prevMouseY = event.clientY;
        xAngle += thetaX;
        yAngle += thetaY;
    }
    requestAnimationFrame(render);
}

//record that the mouse button is now down
function mouse_down(event:MouseEvent) {
    //establish point of reference for dragging mouse in window
    mouse_button_down = true;
    prevMouseX= event.clientX;
    prevMouseY = event.clientY;
    requestAnimationFrame(render);
}

//record that the mouse button is now up, so don't respond to mouse movements
function mouse_up(){
    mouse_button_down = false;
    requestAnimationFrame(render);
}

//Note here we're populating memory with colors using a math function
//Next time we'll look at loading an image from a file
function makeCheckerTexture()
{
    const texHeight:number = 1024;
    const texWidth:number = 1024;
    //mmtexture is the main memory texture
    let mmtexture:Uint8Array = new Uint8Array(texHeight * texWidth * 4);

    for (let i:number = 0; i < texHeight; i++) {
        for (let j:number = 0; j < texWidth; j++) {
            let c:number = ((Math.floor(i/64) + Math.floor(j/64))%2)*255;

            mmtexture[4*(texWidth * i + j)] = c;
            mmtexture[4*(texWidth * i + j)+1] = c;
            mmtexture[4*(texWidth * i + j)+2] = c;
            mmtexture[4*(texWidth * i + j)+3] = 255;
        }
    }
    //now create a texture object [in graphics memory hopefully]
    checkerTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, checkerTex);
    //this is a 2D texture, full resolution (level 0), RGBA now, texWidth by texHeight texels big, has no border
    // and should also be RGBA in video memory, currently each
    //texel is stored as unsigned bytes, and you can find all the texels in mmtexture
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texWidth, texHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, mmtexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);//try different min and mag filters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);


}

//draw a frame
function render(){
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //position camera 10 units back from origin
    mv = lookAt(new vec4(0, 0, 5, 1), new vec4(0, 0, 0, 1), new vec4(0, 1, 0, 0));

    //rotate if the user has been dragging the mouse around
    mv = mv.mult(rotateY(yAngle).mult(rotateX(xAngle)));

    //send the modelview matrix over
    gl.uniformMatrix4fv(umv, false, mv.flatten());

    //make sure the appropriate texture is sitting on texture unit 0
    //we could do this once since we only have one texture, but eventually you'll have multiple textures
    //so you'll be swapping them in and out for each object
    gl.activeTexture(gl.TEXTURE0); //we're using texture unit 0
    gl.bindTexture(gl.TEXTURE_2D, checkerTex); //we want checkerTex on that texture unit
    //when the shader runs, the sampler2D will want to know what texture unit the texture is on
    //It's on texture unit 0, so send over the value 0
    gl.uniform1i(uTextureSampler, 0);

    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

}