"use strict";
import { initFileShaders, perspective, vec2, vec4, flatten, lookAt, translate, rotateX, rotateY } from './helperfunctions.js';
let gl;
let program;
let activeProgram;
let anisotropic_ext;
//uniform locations
let umv; //uniform for mv matrix
let uproj; //uniform for projection matrix
//matrices
let mv; //local mv
let p; //local projection
//shader variable indices for material properties
let vPosition; //
let vNormal; //actually need a normal vector to modify
let vTangent; //need a tangent vector as well
let utexmapsampler; //this will be a pointer to our sampler2D
let unormalmapsampler;
let uLightPosition;
let uAmbienLight;
let uLightColor;
let vTexCoord;
//document elements
let canvas;
//interaction and rotation state
let xAngle;
let yAngle;
let mouse_button_down = false;
let prevMouseX = 0;
let prevMouseY = 0;
let zoom = 45;
let flattex;
let brickcolortex;
let bricknormaltex;
let flatimage;
let brickcolorimage;
let bricknormalimage;
window.onload = function init() {
    canvas = document.getElementById("gl-canvas");
    gl = canvas.getContext('webgl2', { antialias: true });
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
    program = initFileShaders(gl, "vshader-normal.glsl", "fshader-normal.glsl");
    gl.useProgram(program);
    umv = gl.getUniformLocation(program, "model_view");
    uproj = gl.getUniformLocation(program, "projection");
    uLightColor = gl.getUniformLocation(program, "light_color");
    uLightPosition = gl.getUniformLocation(program, "light_position");
    uAmbienLight = gl.getUniformLocation(program, "ambient_light");
    //TODO
    utexmapsampler = gl.getUniformLocation(program, "colorMap");
    gl.uniform1i(utexmapsampler, 0); //assign this one to texture unit 0
    unormalmapsampler = gl.getUniformLocation(program, "normalMap");
    gl.uniform1i(unormalmapsampler, 1); //assign normal map to 2nd texture unit
    //set up basic perspective viewing
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    p = perspective(zoom, (canvas.clientWidth / canvas.clientHeight), 1, 20);
    gl.uniformMatrix4fv(uproj, false, p.flatten());
    initTextures();
    makeSquareAndBuffer();
    //initialize rotation angles
    xAngle = 0;
    yAngle = 0;
    window.addEventListener("keydown", function (event) {
        switch (event.key) {
            case "ArrowDown":
                if (zoom < 170) {
                    zoom += 5;
                }
                break;
            case "ArrowUp":
                if (zoom > 10) {
                    zoom -= 5;
                }
                break;
        }
        p = perspective(zoom, (canvas.clientWidth / canvas.clientHeight), 1, 20);
        gl.uniformMatrix4fv(uproj, false, p.flatten());
        requestAnimationFrame(render); //and now we need a new frame since we made a change
    });
    requestAnimationFrame(render);
};
//Make a square and send it over to the graphics card
function makeSquareAndBuffer() {
    let squarePoints = []; //empty array
    //create 4 vertices and add them to the array
    squarePoints.push(new vec4(-1, -1, 0, 1));
    squarePoints.push(new vec4(0, 0, 1, 0)); //normal vector
    squarePoints.push(new vec4(1, 0, 0, 0)); //tangent vector
    squarePoints.push(new vec2(0, 0)); //texture coordinates, bottom left
    squarePoints.push(new vec4(1, -1, 0, 1));
    squarePoints.push(new vec4(0, 0, 1, 0)); //normal vector
    squarePoints.push(new vec4(1, 0, 0, 0)); //tangent vector
    squarePoints.push(new vec2(1, 0)); //texture coordinates, bottom right
    squarePoints.push(new vec4(1, 1, 0, 1));
    squarePoints.push(new vec4(0, 0, 1, 0)); //normal vector
    squarePoints.push(new vec4(1, 0, 0, 0)); //tangent vector
    squarePoints.push(new vec2(1, 1)); //texture coordinates, top right
    squarePoints.push(new vec4(-1, 1, 0, 1));
    squarePoints.push(new vec4(0, 0, 1, 0)); //normal vector
    squarePoints.push(new vec4(1, 0, 0, 0)); //tangent vector
    squarePoints.push(new vec2(0, 1)); //texture coordinates, top left
    //we need some graphics memory for this information
    let bufferId = gl.createBuffer();
    //tell WebGL that the buffer we just created is the one we want to work with right now
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    //send the local data over to this buffer on the graphics card.  Note our use of Angel's "flatten" function
    gl.bufferData(gl.ARRAY_BUFFER, flatten(squarePoints), gl.STATIC_DRAW);
    vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 56, 0); //stride is 56 bytes total for position, normal, tangent texcoord
    gl.enableVertexAttribArray(vPosition);
    vNormal = gl.getAttribLocation(program, "vNormal");
    gl.vertexAttribPointer(vNormal, 4, gl.FLOAT, false, 56, 16);
    gl.enableVertexAttribArray(vNormal);
    vTangent = gl.getAttribLocation(program, "vTangent");
    gl.vertexAttribPointer(vTangent, 4, gl.FLOAT, false, 56, 32);
    gl.enableVertexAttribArray(vTangent);
    vTexCoord = gl.getAttribLocation(program, "texCoord");
    gl.vertexAttribPointer(vTexCoord, 2, gl.FLOAT, false, 56, 48);
    gl.enableVertexAttribArray(vTexCoord);
}
//update rotation angles based on mouse movement
function mouse_drag(event) {
    var thetaY, thetaX;
    if (mouse_button_down) {
        thetaY = 360.0 * (event.clientX - prevMouseX) / canvas.clientWidth;
        thetaX = 360.0 * (event.clientY - prevMouseY) / canvas.clientHeight;
        prevMouseX = event.clientX;
        prevMouseY = event.clientY;
        xAngle += thetaX;
        yAngle += thetaY;
    }
    requestAnimationFrame(render);
}
//record that the mouse button is now down
function mouse_down(event) {
    //establish point of reference for dragging mouse in window
    mouse_button_down = true;
    prevMouseX = event.clientX;
    prevMouseY = event.clientY;
    requestAnimationFrame(render);
}
//record that the mouse button is now up, so don't respond to mouse movements
function mouse_up() {
    mouse_button_down = false;
    requestAnimationFrame(render);
}
//https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL
function initTextures() {
    flattex = gl.createTexture();
    flatimage = new Image();
    flatimage.onload = function () { handleTextureLoaded(flatimage, flattex); };
    flatimage.src = 'flat.png';
    brickcolortex = gl.createTexture();
    brickcolorimage = new Image();
    brickcolorimage.onload = function () { handleTextureLoaded(brickcolorimage, brickcolortex); };
    brickcolorimage.src = 'brickwork-texture.jpg';
    bricknormaltex = gl.createTexture();
    bricknormalimage = new Image();
    bricknormalimage.onload = function () { handleTextureLoaded(bricknormalimage, bricknormaltex); };
    bricknormalimage.src = 'brickwork_normal-map.jpg';
}
function handleTextureLoaded(image, texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    let anisotropic_ext = gl.getExtension('EXT_texture_filter_anisotropic');
    gl.texParameterf(gl.TEXTURE_2D, anisotropic_ext.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    gl.bindTexture(gl.TEXTURE_2D, null);
}
//draw a frame
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    //position camera 10 units back from origin
    let camera = lookAt(new vec4(0, 0, 5, 1), new vec4(0, 0, 0, 1), new vec4(0, 1, 0, 0));
    //rotate if the user has been dragging the mouse around
    mv = camera.mult(translate(2, 0, 0).mult(rotateY(yAngle).mult(rotateX(xAngle))));
    //send the modelview matrix over
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.uniform4fv(uLightPosition, [0, 0, 50, 1]); //light is locked to the camera position
    gl.uniform4fv(uLightColor, [1, 1, 1, 1]);
    gl.uniform4fv(uAmbienLight, [.1, .1, .1, 1]);
    //draw our 'flat' square first
    //TODO
    gl.activeTexture(gl.TEXTURE0); //texture unit 0 should be mapped to...
    gl.bindTexture(gl.TEXTURE_2D, brickcolortex); //which texture do we want?
    gl.activeTexture(gl.TEXTURE1); //texture unit 1 should be mapped to...
    gl.bindTexture(gl.TEXTURE_2D, flattex); //just a flat texture for our normal map
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    //and now draw our square with the brick normal map
    mv = camera.mult(translate(-2, 0, 0).mult(rotateY(yAngle).mult(rotateX(xAngle))));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    //TODO
    gl.activeTexture(gl.TEXTURE1); //and now that we're drawing the normal mapped square
    gl.bindTexture(gl.TEXTURE_2D, bricknormaltex); //switch to the normal map texture
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
}
//# sourceMappingURL=normalmapfunctions.js.map