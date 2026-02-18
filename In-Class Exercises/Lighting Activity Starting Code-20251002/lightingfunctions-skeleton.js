import { initFileShaders, vec4, perspective, flatten, lookAt, rotateX, rotateY } from "./helperfunctions.js";
"use strict";
let gl;
let program; //array of different shader programs
let activeProgram; //index of active program
let UNLIT = 0;
let GOURAUD = 1;
let PHONG = 2;
let CEL = 3;
//eventually we'll have different objects we can draw
let object; //which object are we drawing?
const SPHERE = 0;
const MESH = 1;
//uniform locations
let umv; //uniform for mv matrix
let uproj; //uniform for projection matrix
let umode; //lighting mode
//local copies of these matrices
let mv; //local mv
let p; //local projection
//shader variable indices for per vertex and material attributes
let vPosition; //
let vNormal;
let vAmbientDiffuseColor; //Ambient and Diffuse can be the same for the material
let vSpecularColor; //highlight color
let vSpecularExponent;
//uniform indices for light properties
//TODO
let light_position;
let light_color;
let ambient_light;
//document elements
let canvas;
//interaction and rotation state
let xAngle;
let yAngle;
let mouse_button_down = false;
let prevMouseX = 0;
let prevMouseY = 0;
//mesh vars
let sphereverts; //local copy of vertex data
let sphereBufferID; //buffer id
//mesh vars
let meshVertexBufferID;
let indexBufferID;
let meshVertexData;
let indexData;
window.onload = function init() {
    canvas = document.getElementById("gl-canvas");
    gl = canvas.getContext('webgl2', { antialias: true });
    if (!gl) {
        alert("WebGL isn't available");
    }
    ///////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////
    //https://codepen.io/matt-west/pen/KjEHg
    //converted to typescript by Nathan Gossett
    let fileInput = document.getElementById("fileInput");
    fileInput.addEventListener('change', function (e) {
        let file = fileInput.files[0];
        let textType = /text.*/;
        if (file.type.match(textType)) {
            let reader = new FileReader();
            reader.onload = function (e) {
                createMesh(reader.result); //ok, we have our data, so parse it
                requestAnimationFrame(render); //ask for a new frame
            };
            reader.readAsText(file);
        }
        else {
            alert("File not supported: " + file.type + ".");
        }
    });
    ////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////
    //start as blank arrays
    meshVertexData = [];
    indexData = [];
    //allow the user to rotate mesh with the mouse
    canvas.addEventListener("mousedown", mouse_down);
    canvas.addEventListener("mousemove", mouse_drag);
    canvas.addEventListener("mouseup", mouse_up);
    //white background
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    //initialize rotation angles
    xAngle = 0;
    yAngle = 0;
    program = initFileShaders(gl, "vshader-combined.glsl", "fshader-combined.glsl");
    //Also note that we'll need to be using a local web server rather than just loading it off the harddrive to make
    //the browser happy with external .glsl files
    //Eventually we're going to have to store references to these attributes an uniforms in many different shaders
    //TODO
    gl.useProgram(program);
    umv = gl.getUniformLocation(program, "model_view");
    uproj = gl.getUniformLocation(program, "projection");
    umode = gl.getUniformLocation(program, "mode");
    vPosition = gl.getAttribLocation(program, "vPosition");
    vNormal = gl.getAttribLocation(program, "vNormal");
    vAmbientDiffuseColor = gl.getAttribLocation(program, "vAmbientDiffuseColor");
    vSpecularColor = gl.getAttribLocation(program, "vSpecularColor");
    vSpecularExponent = gl.getAttribLocation(program, "vSpecularExponent");
    light_position = gl.getUniformLocation(program, "light_position");
    light_color = gl.getUniformLocation(program, "light_color");
    ambient_light = gl.getUniformLocation(program, "ambient_light");
    //get our sphere, 15 slices around the circle
    generateSphere(100);
    // object = MESH;
    object = SPHERE;
    switchObjects();
    //set up basic perspective viewing and make sure the new shader gets it
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    p = perspective(60, (canvas.clientWidth / canvas.clientHeight), 5, 500);
    gl.uniformMatrix4fv(uproj, false, p.flatten());
    //initialize rotation angles
    xAngle = 0;
    yAngle = 0;
    gl.uniform1i(umode, UNLIT);
    requestAnimationFrame(render);
};
/**
 * Parse string into list of vertices and triangles
 * Not robust at all, but simple enough to follow as an introduction
 * @param input string of ascii floats
 */
function createMesh(input) {
    let numbers = input.split(/\s+/); //split on white space
    let numVerts = parseInt(numbers[0]); //first element is number of vertices
    let numTris = parseInt(numbers[1]); //second element is number of triangles
    let positionData = [];
    //three numbers at a time for xyz
    for (let i = 2; i < 3 * numVerts + 2; i += 3) {
        positionData.push(new vec4(parseFloat(numbers[i]), parseFloat(numbers[i + 1]), parseFloat(numbers[i + 2]), 1));
    }
    //now the triangles
    indexData = []; //empty out any previous data
    //three vertex indices per triangle
    for (let i = 3 * numVerts + 2; i < numbers.length; i++) {
        indexData.push(parseInt(numbers[i]));
    }
    let normalVectors = [];
    //at first, we have no normal vectors
    for (let i = 0; i < positionData.length; i++) {
        normalVectors.push(new vec4(0, 0, 0, 0));
    }
    //We need to calculate normal vectors for each triangle
    for (let i = 0; i < indexData.length; i += 3) {
        //direction from vertex 0 to vertex 1
        let triLeg1 = positionData[indexData[i + 1]].subtract(positionData[indexData[i]]).normalize();
        //direction from vertex 0 to vertex 2
        let triLeg2 = positionData[indexData[i + 2]].subtract(positionData[indexData[i]]).normalize();
        //get a vector perpendicular to both triangle sides
        let triNormal = triLeg1.cross(triLeg2).normalize();
        //and add that on to the totals for all three vertices involved in this triangle
        normalVectors[indexData[i]] = normalVectors[indexData[i]].add(triNormal);
        normalVectors[indexData[i + 1]] = normalVectors[indexData[i + 1]].add(triNormal);
        normalVectors[indexData[i + 2]] = normalVectors[indexData[i + 2]].add(triNormal);
    }
    //at this point, every vertex normal is the sum of all the normal vectors of the triangles that meet up at that vertex
    //so normalize to get a unit length average normal direction for the vertex
    for (let i = 0; i < normalVectors.length; i++) {
        normalVectors[i] = normalVectors[i].normalize();
    }
    //and put that all together into an array so we can buffer it to graphics memory
    meshVertexData = [];
    for (let i = 0; i < positionData.length; i++) {
        meshVertexData.push(positionData[i]);
        meshVertexData.push(normalVectors[i]);
    }
    //buffer vertex data and enable vPosition attribute
    meshVertexBufferID = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, meshVertexBufferID);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(meshVertexData), gl.STATIC_DRAW);
    let vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 32, 0); //stride is 32 bytes total for position, normal
    gl.enableVertexAttribArray(vPosition);
    let vNormal = gl.getAttribLocation(program, "vNormal");
    gl.vertexAttribPointer(vNormal, 4, gl.FLOAT, false, 32, 16);
    gl.enableVertexAttribArray(vNormal);
    //we could at this point go through the list and duplicate vertex data as needed, or we can
    //just buffer the list of indices and use drawElements() instead of drawArrays()
    //If you see references to EBO (Element Buffer Objects) rather than VBO (Vertex Buffer Objects)
    //then you're using Indexed rendering
    indexBufferID = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBufferID);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexData), gl.STATIC_DRAW);
    //note we have Uint16 so we have UNSIGNED_SHORT, which allows us 65k vertices.  If our mesh has more
    //than that we'll need to switch to an UNSIGNED_INT with 32 bits
}
function switchObjects() {
    //There are a variety of ways to accomplish this, but this way is pretty straightforward
    //note that we don't re-buffer the data, simply connect the existing buffer to a different shader program
    gl.disableVertexAttribArray(vPosition); //incase the indices change
    //TODO gl.disableVertexAttribArray(vNormal);
    if (object == SPHERE) {
        gl.bindBuffer(gl.ARRAY_BUFFER, sphereBufferID);
    }
    else {
        gl.bindBuffer(gl.ARRAY_BUFFER, meshVertexBufferID);
    }
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 32, 0); //stride is 32 bytes total for position, normal
    gl.enableVertexAttribArray(vPosition);
    //TODO once we have normal vectors
    gl.vertexAttribPointer(vNormal, 4, gl.FLOAT, false, 32, 16);
    gl.enableVertexAttribArray(vNormal);
}
//***********************************************
//TODO HEY! READ THIS!
//In this particular case, our normal vectors and vertex vectors are identical since the sphere is centered at the origin
//For most objects this won't be the case, so I'm treating them as separate values for that reason
//This could also be done as separate triangle strips, but I've chosen to make them just triangles so I don't
//have to execute multiple glDrawArrays() commands
//***********************************************
function generateSphere(subdiv) {
    let step = (360.0 / subdiv) * (Math.PI / 180.0);
    sphereverts = [];
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
    sphereBufferID = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereBufferID);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(sphereverts), gl.STATIC_DRAW);
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
window.addEventListener("keydown", function (event) {
    switch (event.key) {
        //TODO uncomment these as you add the various lighting programs
        case "g":
            gl.uniform1i(umode, GOURAUD);
            break;
        case "p":
            gl.uniform1i(umode, PHONG);
            break;
        case "c": //cel shading color
            gl.uniform1i(umode, CEL);
            break;
        default:
            gl.uniform1i(umode, UNLIT);
    }
    requestAnimationFrame(render); //and now we need a new frame since we made a change
});
//draw a frame
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    //position camera 10 units back from origin
    mv = lookAt(new vec4(0, 0, 10, 1), new vec4(0, 0, 0, 1), new vec4(0, 1, 0, 0));
    //rotate if the user has been dragging the mouse around
    mv = mv.mult(rotateY(yAngle).mult(rotateX(xAngle)));
    //send the modelview matrix over
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    //note that if we have one value that should be applied to all the vertices,
    //we can send it over just once even if it's an attribute and not a uniform
    gl.vertexAttrib4fv(vAmbientDiffuseColor, [0.5, 0, 0, 1]);
    //these don't impact the UNLIT mode
    //TODO
    gl.vertexAttrib4fv(vSpecularColor, [1.0, 1.0, 1.0, 1.0]);
    gl.vertexAttrib1f(vSpecularExponent, 15.0);
    gl.uniform4fv(light_position, mv.mult(new vec4(50, 50, 50, 1)).flatten());
    gl.uniform4fv(light_color, [1, 1, 1, 1]);
    gl.uniform4fv(ambient_light, [.5, .5, .5, 1]);
    if (object == SPHERE) {
        gl.drawArrays(gl.TRIANGLES, 0, sphereverts.length / 2);
    }
    else if (meshVertexData.length > 0) { //if we've loaded a mesh, draw it
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBufferID);
        //note that we're using gl.drawElements() here instead of drawArrays()
        //this allows us to make use of shared vertices between triangles without
        //having to repeat the vertex data.  However, if each vertex has additional
        //attributes like color, normal vector, texture coordinates, etc that are not
        //shared between triangles like position is, than this might cause problems
        gl.drawElements(gl.TRIANGLES, indexData.length, gl.UNSIGNED_SHORT, 0);
    }
}
