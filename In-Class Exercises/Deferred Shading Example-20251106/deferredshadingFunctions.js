import { initFileShaders, vec2, vec4, flatten, perspective, lookAt, rotateX, rotateY } from './helperfunctions.js';
"use strict";
//it will be handy to have references to some of our WebGL related objects
let gl;
//pending WebGL2RenderingContext support, we can still use extensions
let ext;
let canvas;
////////////////////////////////////////////////
//Note that we're going to have two different shader programs:
// firstpassprogram will be to generate our various textures
// secondpassprogram will just render a texturemapped square and will do the actual lighting calculations
//First pass is geometry pass, second pass is the lighting pass
let firstpassprogram;
let secondpassprogram;
///////////////////////////////////////////////
let umv; //index of the shader uniform for modelview matrix
let uproj; //index of the shader uniform for projection matrix
let sphereBufferId;
let sphereVertCount;
let squareBufferId; //again, this is a 2nd pass square that covers the whole screen
//interaction and rotation state
let xAngle;
let yAngle;
let mouse_button_down = false;
let prevMouseX = 0;
let prevMouseY = 0;
////////////////////////////
//TODO First is the geometry pass where we are interested in material properties
// note that the two shader programs will have separate attribute lists, so be safe about
// how we reference any attributes that have the same name (might not be in the same index for both)
let vPositionGeometry; //remember the location of shader attributes
let vNormal; //remember the location of shader attributes
let vAmbientDiffuseColor; //Ambient and Diffuse can be the same for the material
let vSpecularColor; //highlight color
let vSpecularExponent;
//TODO and now attributes and uniforms for our second pass where we do lighting
//shader variable indices for light properties
let light_position;
let light_color;
let ambient_light;
//Generated in pass 1, read in pass 2
let uAlbedoSampler; //our eventual texture sampler uniform
let uSpecularSampler; //our eventual texture sampler uniform
let uNormalSampler; //our eventual texture sampler uniform
let uPositionSampler;
let vPositionSquare; // and the other shader program might have a different attribute location
let vTexCoord; //our square will have texture coordinates
//******************************
// we will need color and depth buffers to render to, plus a separate framebuffer off screen
// For more details, see:
// https://webglfundamentals.org/webgl/lessons/webgl-render-to-texture.html
//
let texWidth;
let texHeight;
//We need textures in memory
let albedoTex;
let specularTex;
let normalTex;
let positionTex;
let fb;
//Depth texture for hidden surface removal
let depthTexture;
//TODO: LEAVE COMMENTED OUT FOR NOW
let uDepthSampler;
//*******************************
let bgcolor = new vec4(1, 1, 1, 1); //white background
//We want some set up to happen immediately when the page loads
window.onload = function init() {
    //fetch reference to the canvas element we defined in the html file
    canvas = document.getElementById("gl-canvas");
    //grab the WebGL 2 context for that canvas.  This is what we'll use to do our drawing
    gl = canvas.getContext('webgl2');
    //following line shouldn't be needed in webgl 2, but is still necessary in 2025
    let ext = gl.getExtension('EXT_color_buffer_float');
    if (!gl) {
        alert("WebGL isn't available");
    }
    texWidth = canvas.clientWidth;
    texHeight = canvas.clientHeight;
    //allow the user to rotate mesh with the mouse
    canvas.addEventListener("mousedown", mouse_down);
    canvas.addEventListener("mousemove", mouse_drag);
    canvas.addEventListener("mouseup", mouse_up);
    //Take the vertex and fragment shaders we provided and compile them into a shader program
    //Grab uniform locations/sampler locations
    secondpassprogram = initFileShaders(gl, "vertex-shader-lighting.glsl", "fragment-shader-lighting.glsl");
    gl.useProgram(secondpassprogram);
    uAlbedoSampler = gl.getUniformLocation(secondpassprogram, "albedoSampler");
    uSpecularSampler = gl.getUniformLocation(secondpassprogram, "specularSampler");
    uNormalSampler = gl.getUniformLocation(secondpassprogram, "normalSampler");
    uPositionSampler = gl.getUniformLocation(secondpassprogram, "positionSampler");
    //TODO LEAVE COMMENTED OUT FOR NOW:
    uDepthSampler = gl.getUniformLocation(secondpassprogram, "depthSampler");
    light_position = gl.getUniformLocation(secondpassprogram, "light_position");
    light_color = gl.getUniformLocation(secondpassprogram, "light_color");
    ambient_light = gl.getUniformLocation(secondpassprogram, "ambient_light");
    let ubgcolor = gl.getUniformLocation(secondpassprogram, "bgcolor");
    gl.uniform4fv(ubgcolor, bgcolor); //white background
    //Take the vertex and fragment shaders we provided and compile them into a shader program
    //First pass
    firstpassprogram = initFileShaders(gl, "vertex-shader-geometry.glsl", "fragment-shader-geometry.glsl");
    gl.useProgram(firstpassprogram); //and we want to use that program for our rendering
    umv = gl.getUniformLocation(firstpassprogram, "model_view");
    uproj = gl.getUniformLocation(firstpassprogram, "projection");
    //Not fetching anything for fragment shader, only geometry
    vPositionGeometry = gl.getAttribLocation(firstpassprogram, "vPosition");
    vNormal = gl.getAttribLocation(firstpassprogram, "vNormal");
    vAmbientDiffuseColor = gl.getAttribLocation(firstpassprogram, "vAmbientDiffuseColor");
    vSpecularColor = gl.getAttribLocation(firstpassprogram, "vSpecularColor");
    vSpecularExponent = gl.getAttribLocation(firstpassprogram, "vSpecularExponent");
    //initialize various animation parameters
    xAngle = 0;
    yAngle = 0;
    //We'll split this off to its own function for clarity, but we need something to make a picture of
    generateSphere(10);
    makeSquareAndBuffer();
    //we need to do this to avoid having objects that are behind other objects show up anyway
    gl.enable(gl.DEPTH_TEST);
    //*************************************
    // setting up textures we can render to
    // Set up texture function so we don't have to duplicate code
    albedoTex = gl.createTexture();
    setupTextureBuffer(albedoTex);
    specularTex = gl.createTexture();
    setupTextureBuffer(specularTex);
    normalTex = gl.createTexture();
    setupTextureBuffer(normalTex);
    positionTex = gl.createTexture();
    setupTextureBuffer(positionTex);
    //We need the depth texture for hidden surface removal
    depthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT32F, texWidth, texHeight, 0, gl.DEPTH_COMPONENT, gl.FLOAT, null); //null data for now
    //you have to specify all 4 filters to be able to read back out from a depth texture
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // set up our framebuffer
    fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    //and make this texture the color attachment of our framebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, albedoTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, specularTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, normalTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT3, gl.TEXTURE_2D, positionTex, 0);
    //TODO: LEAVE COMMENTED OUT FOR NOW
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);
    //TODO and now we wouldn't need that renderbuffer code below
    //TODO this is where it was important to have a fixed layout specified in
    //TODO fragment-shader-geometry.glsl so we can list them in the right order here
    gl.drawBuffers([
        //THis is how we get all 4 color attachments to be acknowledged as part of our offscreen frame buffer
        //These are the things to look for in this order coming out of the fragment shader
        gl.COLOR_ATTACHMENT0, //albedo
        gl.COLOR_ATTACHMENT1, //specular
        gl.COLOR_ATTACHMENT2, // normal
        gl.COLOR_ATTACHMENT3 // position
    ]);
};
function setupTextureBuffer(tex) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    //We want to store positions/normals outside of [0,1] range, so use actual float format like RGBA16F
    //RGB16F is listed in the spec as legal storage, but currently only RGBA16F is supported for rendering
    //null because we don't have any of this data yet, it will be generated in pass one
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, texWidth, texHeight, 0, gl.RGBA, gl.FLOAT, null); //null data for now
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
}
//***********************************************
//HEY! READ THIS!
//In this particular case, our normal vectors and vertex vectors are identical since the sphere is centered at the origin
//For most objects this won't be the case, so I'm treating them as separate values for that reason
//This could also be done as separate triangle strips, but I've chosen to make them just triangles so I don't have to execute multiple glDrawArrays() commands
//***********************************************
function generateSphere(subdiv) {
    let step = (360.0 / subdiv) * (Math.PI / 180.0);
    let sphereverts = [];
    for (let lat = 0; lat <= Math.PI; lat += step) { //latitude
        for (let lon = 0; lon + step <= 2 * Math.PI; lon += step) { //longitude
            //triangle 1
            sphereverts.push(new vec4(Math.sin(lat) * Math.sin(lon), Math.cos(lat), Math.cos(lon) * Math.sin(lat), 1.0));
            sphereverts.push(new vec4(Math.sin(lat) * Math.sin(lon), Math.cos(lat), Math.cos(lon) * Math.sin(lat), 0.0));
            sphereverts.push(new vec4(Math.sin(lat) * Math.sin(lon + step), Math.cos(lat), Math.sin(lat) * Math.cos(lon + step), 1.0));
            sphereverts.push(new vec4(Math.sin(lat) * Math.sin(lon + step), Math.cos(lat), Math.sin(lat) * Math.cos(lon + step), 0.0));
            sphereverts.push(new vec4(Math.sin(lat + step) * Math.sin(lon + step), Math.cos(lat + step), Math.cos(lon + step) * Math.sin(lat + step), 1.0));
            sphereverts.push(new vec4(Math.sin(lat + step) * Math.sin(lon + step), Math.cos(lat + step), Math.cos(lon + step) * Math.sin(lat + step), 0.0));
            //triangle 2
            sphereverts.push(new vec4(Math.sin(lat + step) * Math.sin(lon + step), Math.cos(lat + step), Math.cos(lon + step) * Math.sin(lat + step), 1.0));
            sphereverts.push(new vec4(Math.sin(lat + step) * Math.sin(lon + step), Math.cos(lat + step), Math.cos(lon + step) * Math.sin(lat + step), 0.0));
            sphereverts.push(new vec4(Math.sin(lat + step) * Math.sin(lon), Math.cos(lat + step), Math.sin(lat + step) * Math.cos(lon), 1.0));
            sphereverts.push(new vec4(Math.sin(lat + step) * Math.sin(lon), Math.cos(lat + step), Math.sin(lat + step) * Math.cos(lon), 0.0));
            sphereverts.push(new vec4(Math.sin(lat) * Math.sin(lon), Math.cos(lat), Math.cos(lon) * Math.sin(lat), 1.0));
            sphereverts.push(new vec4(Math.sin(lat) * Math.sin(lon), Math.cos(lat), Math.cos(lon) * Math.sin(lat), 0.0));
        }
    }
    sphereBufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereBufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(sphereverts), gl.STATIC_DRAW);
    sphereVertCount = sphereverts.length / 2;
    gl.useProgram(firstpassprogram);
    gl.vertexAttribPointer(vPositionGeometry, 4, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(vPositionGeometry);
    gl.vertexAttribPointer(vNormal, 4, gl.FLOAT, false, 32, 16);
    gl.enableVertexAttribArray(vNormal);
    gl.disableVertexAttribArray(vPositionGeometry);
    gl.disableVertexAttribArray(vNormal);
}
//Make a square and send it over to the graphics card
function makeSquareAndBuffer() {
    let squarePoints = []; //empty array
    //create 4 vertices and add them to the array
    //fill the whole screen: If we plan to use the default (aka identity)
    //orthographic projection matrix, then the screen will go from -1 to 1
    //in GL coordinates
    //Start out in normalized device coordinates, pass 2 has zero work to do on the geometry level
    squarePoints.push(new vec4(-1, -1, 0, 1));
    squarePoints.push(new vec2(0, 0)); //texture coordinates, bottom left
    squarePoints.push(new vec4(1, -1, 0, 1));
    squarePoints.push(new vec2(1, 0)); //texture coordinates, bottom right
    squarePoints.push(new vec4(1, 1, 0, 1));
    squarePoints.push(new vec2(1, 1)); //texture coordinates, top right
    squarePoints.push(new vec4(-1, 1, 0, 1));
    squarePoints.push(new vec2(0, 1)); //texture coordinates, top left
    //we need some graphics memory for this information
    squareBufferId = gl.createBuffer();
    //tell WebGL that the buffer we just created is the one we want to work with right now
    gl.bindBuffer(gl.ARRAY_BUFFER, squareBufferId);
    //send the local data over to this buffer on the graphics card.  Note our use of Angel's "flatten" function
    gl.bufferData(gl.ARRAY_BUFFER, flatten(squarePoints), gl.STATIC_DRAW);
    gl.useProgram(secondpassprogram);
    vPositionSquare = gl.getAttribLocation(secondpassprogram, "vPosition");
    gl.vertexAttribPointer(vPositionSquare, 4, gl.FLOAT, false, 24, 0); //stride is 24 bytes total for position, texcoord
    gl.enableVertexAttribArray(vPositionSquare);
    vTexCoord = gl.getAttribLocation(secondpassprogram, "texCoord");
    gl.vertexAttribPointer(vTexCoord, 2, gl.FLOAT, false, 24, 16); //stride is 24 bytes total for position, texcoord
    gl.enableVertexAttribArray(vTexCoord);
    gl.disableVertexAttribArray(vPositionSquare);
    gl.disableVertexAttribArray(vTexCoord);
}
//update rotation angles based on mouse movement
function mouse_drag(event) {
    let thetaY, thetaX;
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
//draw a new frame
function render() {
    //***********************************
    // PART 1: RENDER THE GEOMETRY TO OUR TEXTURES
    gl.useProgram(firstpassprogram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    //setting background color to white for render to texture
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    //start by clearing any previous data for both color and depth
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, texWidth, texHeight);
    let p = perspective(60.0, 1, 5.0, 500.0);
    gl.uniformMatrix4fv(uproj, false, p.flatten());
    let mv = lookAt(new vec4(0, 0, 10, 1), new vec4(0, 0, 0, 1), new vec4(0, 1, 0, 0));
    //rotate if the user has been dragging the mouse around
    mv = mv.mult(rotateY(yAngle).mult(rotateX(xAngle)));
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.vertexAttrib4fv(vAmbientDiffuseColor, [.5, 0, 0, 1]);
    gl.vertexAttrib4fv(vSpecularColor, [1.0, 1.0, 1.0, 1.0]);
    gl.vertexAttrib1f(vSpecularExponent, 30.0);
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereBufferId);
    gl.vertexAttribPointer(vPositionGeometry, 4, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(vPositionGeometry);
    gl.vertexAttribPointer(vNormal, 4, gl.FLOAT, false, 32, 16);
    gl.enableVertexAttribArray(vNormal);
    gl.drawArrays(gl.TRIANGLES, 0, sphereVertCount);
    gl.disableVertexAttribArray(vPositionGeometry);
    gl.disableVertexAttribArray(vNormal);
    // END PART 1
    //*****************************************
    //*****************************************
    // PART 2: RENDER A QUAD MAPPED WITH THIS TEXTURE
    //Bind to framebuffer null, because that actually sends the output to the screen
    gl.useProgram(secondpassprogram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); //use framebuffer that will draw to screen
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    //setting background color to black for render to screen
    gl.clearColor(0, 0, 0, 1.0);
    //using default orthgraphic projection
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    //Get various textures set up on appropriate texture units
    gl.activeTexture(gl.TEXTURE0); //we're using texture unit 0 for albedo
    gl.bindTexture(gl.TEXTURE_2D, albedoTex);
    //Albedo should be coming out of texture unit 0
    gl.uniform1i(uAlbedoSampler, 0);
    gl.activeTexture(gl.TEXTURE1); //we're using texture unit 1 for specular
    gl.bindTexture(gl.TEXTURE_2D, specularTex);
    gl.uniform1i(uSpecularSampler, 1);
    gl.activeTexture(gl.TEXTURE2); //we're using texture unit 2 for the normal
    //Shader if you would like a normal vector, screw into texture unit 2
    gl.bindTexture(gl.TEXTURE_2D, normalTex);
    gl.uniform1i(uNormalSampler, 2);
    gl.activeTexture(gl.TEXTURE3); //we're using texture unit 3 for the position
    gl.bindTexture(gl.TEXTURE_2D, positionTex);
    gl.uniform1i(uPositionSampler, 3);
    //TODO: LEAVE THIS COMMENTED OUT FOR NOW
    //TODO: Extra example: what if we wanted to read out of a depth texture?
    gl.activeTexture(gl.TEXTURE4); //the depth texture if we need it
    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.uniform1i(uDepthSampler, 4);
    gl.uniform4fv(light_position, mv.mult(new vec4(50, 50, 50, 1)).flatten());
    gl.uniform4fv(light_color, [1, 1, 1, 1]);
    gl.uniform4fv(ambient_light, [.5, .5, .5, 1]);
    gl.bindBuffer(gl.ARRAY_BUFFER, squareBufferId);
    gl.vertexAttribPointer(vPositionSquare, 4, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(vPositionSquare);
    gl.vertexAttribPointer(vTexCoord, 2, gl.FLOAT, false, 24, 16);
    gl.enableVertexAttribArray(vTexCoord);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    gl.disableVertexAttribArray(vPositionSquare);
    gl.disableVertexAttribArray(vTexCoord);
}
//# sourceMappingURL=deferredshadingFunctions.js.map