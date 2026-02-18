"use strict";

import {initFileShaders, perspective, vec2, vec4, mat4, flatten, lookAt, translate,rotateX, rotateY} from './helperfunctions.js';
let gl:WebGLRenderingContext;
let program:WebGLProgram;



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

let checkerTex:WebGLTexture;
//we can have multiple textures in graphics memory
//TODO
let domotex:WebGLTexture;
let alpacatex:WebGLTexture;
let logotex:WebGLTexture;

//and we need a main memory location to load the files into
//TODO
let domoimage:HTMLImageElement;
let alpacaimage:HTMLImageElement;
let logoimage:HTMLImageElement;

//Anisotropic ext
let anisotropic_ext:EXT_texture_filter_anisotropic;

window.onload = function init() {

    canvas = document.getElementById("gl-canvas") as HTMLCanvasElement ;
    gl = canvas.getContext('webgl2', {antialias:true}) as WebGLRenderingContext;
    if (!gl) {
        alert("WebGL isn't available");
    }

    anisotropic_ext = gl.getExtension('EXT_texture_filter_anisotropic');

    if(!anisotropic_ext){
        alert("Bruh");
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

    //note, still just one texture per object, so even though there are
    //multiple textures total, we just need the one texture sampler on the shader side
    //TODO
    uTextureSampler = gl.getUniformLocation(program, "textureSampler");//get reference to sampler2D

    //set up basic perspective viewing
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    p = perspective(zoom, (canvas.clientWidth / canvas.clientHeight), 1, 20);
    gl.uniformMatrix4fv(uproj, false, p.flatten());

    //don't forget to load in the texture files to main memory
    //TODO
    initTextures();
    makeSquareAndBuffer();

    //initialize rotation angles
    xAngle = 0;
    yAngle = 0;

    window.addEventListener("keydown" ,event=>{
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
            case "d":
                // Apply anisotropic filtering to all textures
                gl.bindTexture(gl.TEXTURE_2D, domotex);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                gl.texParameterf(gl.TEXTURE_2D, anisotropic_ext.TEXTURE_MAX_ANISOTROPY_EXT, 16);

                gl.bindTexture(gl.TEXTURE_2D, alpacatex);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                gl.texParameterf(gl.TEXTURE_2D, anisotropic_ext.TEXTURE_MAX_ANISOTROPY_EXT, 16);

                gl.bindTexture(gl.TEXTURE_2D, logotex);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                gl.texParameterf(gl.TEXTURE_2D, anisotropic_ext.TEXTURE_MAX_ANISOTROPY_EXT, 16);
                break;
            case "l":
                gl.bindTexture(gl.TEXTURE_2D, checkerTex);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);//try different min and mag filters
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                console.log("linear");
                break;
            case "n":
                gl.bindTexture(gl.TEXTURE_2D, checkerTex);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);//try different min and mag filters
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
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
    squarePoints.push(new vec2(1,0)); //texture coordinates, bottom right
    squarePoints.push(new vec4(1, 1, 0, 1));
    squarePoints.push(new vec2(1,1)); //texture coordinates, top right
    squarePoints.push(new vec4(-1, 1, 0, 1));
    squarePoints.push(new vec2(0,1)); //texture coordinates, top left

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

//TODO uncomment this, but make sure you're comfortable with what's happening
//https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL
function initTextures() {
    domotex = gl.createTexture();
    domoimage = new Image();
    domoimage.onload = function() { handleTextureLoaded(domoimage, domotex); };
    domoimage.src = 'domokun.png';

    alpacatex = gl.createTexture();
    alpacaimage = new Image();
    alpacaimage.onload = function() { handleTextureLoaded(alpacaimage, alpacatex); };
    alpacaimage.src = 'alpaca.png';

    logotex = gl.createTexture();
    logoimage = new Image();
    logoimage.onload = function() { handleTextureLoaded(logoimage, logotex); };
    logoimage.src = 'opengl.png';
}

//TODO There are a bunch of things we need to define for each texture
function handleTextureLoaded(image:HTMLImageElement, texture:WebGLTexture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);  //disagreement over what direction Y axis goes
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.bindTexture(gl.TEXTURE_2D, null);
}


//draw a frame
function render(){
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //position camera 5 units back from origin
    mv = lookAt(new vec4(0, 0, 5, 1), new vec4(0, 0, 0, 1), new vec4(0, 1, 0, 0));

    //rotate if the user has been dragging the mouse around
    let camera:mat4 = mv = mv.mult(rotateY(yAngle).mult(rotateX(xAngle)));

    //send the modelview matrix over
    gl.uniformMatrix4fv(umv, false, mv.flatten());


    //make sure the appropriate texture is sitting on texture unit 0
    //we could do this once since we only have one texture per object, but eventually you'll have multiple textures
    //so you'll be swapping them in and out for each object
    //TODO
    gl.activeTexture(gl.TEXTURE0); //we're using texture unit 0
    gl.bindTexture(gl.TEXTURE_2D, domotex); //we want domokun on that texture unit for the next object drawn
    //when the shader runs, the sampler2D will want to know what texture unit the texture is on
    //It's on texture unit 0, so send over the value 0
    gl.uniform1i(uTextureSampler, 0);

    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

    mv = camera.mult(rotateY(90).mult(translate(0,0,1)));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.bindTexture(gl.TEXTURE_2D, alpacatex); //we're still talking about texture unit 0, but we want an alpaca on the next object drawn
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

    //We have transparency in this one, so enable blending and disable depth write
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);

    mv = camera.mult(rotateY(-90).mult(translate(0,0,1)));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    //TODO
    gl.bindTexture(gl.TEXTURE_2D, logotex); //we're still talking about texture unit 0, but we want a logo on the next object drawn
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

    //and now put it back to appropriate values for opaque objects
    //TODO
    gl.disable(gl.BLEND);
    gl.depthMask(true);

}