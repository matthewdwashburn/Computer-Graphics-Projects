import { initShaders, vec4, flatten } from "./helperfunctions.js";
"use strict";
let gl;
let canvas;
let program;
let bufferId;
let color; //local color value
let ucolor; // store location of shader uniform, not local value, uniform location
let trianglePoints;
let xoffset;
let yoffset;
let targetCenterLocationArray;
let targetHitArray = [0, 0, 0, 0, 0];
let tempPoints;
// Store all vertex directions/speeds altering numbers where every i * 2 index is alters X and i * 2 + 1 alters Y for each vertex
let vertexSpeedDirectionArray = [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01];
let targetsRemainingLabel = document.getElementById("targetsRemaining");
let missCountLabel = document.getElementById("missCount");
let targetsMoving = false;
let missCount = 0;
//Author: Matthew Washburn, Nathan Gosset
//Description: This is a target practice game in which you attempt to click all five targets on the screen with
//as little misses as you can. The targets move around the screen at random speeds and in random directions.
//Version: Fall 2025
document.getElementById("resetButton").onclick = () => {
    //Stop the targets from moving
    window.clearInterval(animationStart);
    targetsMoving = false;
    //Reset target speeds and directions
    vertexSpeedDirectionArray = [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01];
    //Reset number of targets in label
    targetsRemainingLabel.textContent = "Targets Remaining: 5";
    //Reset target color to white
    color = new vec4(1, 1, 1, 1); //white
    // and not send over the color to our uniform location on the GPU
    gl.uniform4fv(ucolor, color.flatten());
    //Reset shot count
    missCount = 0;
    //Set miss count to 0
    missCountLabel.textContent = "Misses: 0";
    //randomize target directions
    for (let i = 0; i < vertexSpeedDirectionArray.length; i++) {
        if (Math.random() <= 0.5) {
            vertexSpeedDirectionArray[i] *= -1;
        }
    }
    //randomize target speeds
    for (let i = 0; i < vertexSpeedDirectionArray.length; i++) {
        vertexSpeedDirectionArray[i] += Math.random() / 20;
    }
    //Reset the canvas and start rendering
    makeTriangleAndBuffer();
    requestAnimationFrame(render);
};
//do this immediately when the web page loads
window.onload = function init() {
    canvas = document.getElementById("gl-canvas");
    //and the canvas has a webgl rendering context associated already
    gl = canvas.getContext("webgl2");
    if (!gl) {
        alert("WebGL not supported");
    }
    //randomize vertex directions
    for (let i = 0; i < vertexSpeedDirectionArray.length; i++) {
        if (Math.random() < 0.5) {
            vertexSpeedDirectionArray[i] *= -1;
        }
    }
    //randomize target speeds
    for (let i = 0; i < vertexSpeedDirectionArray.length; i++) {
        vertexSpeedDirectionArray[i] += Math.random() / 20;
    }
    //use the helperfunctions function to turn vertex and fragment shader into program
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);
    color = new vec4(1, 1, 1, 1); // start out white
    // fetch the color uniform location from the shader program
    ucolor = gl.getUniformLocation(program, "color"); // we need to find out where in memory this color uniform ended up
    //now send the uniform information to the GPU
    gl.uniform4fv(ucolor, color.flatten());
    //keyboard function
    window.addEventListener("keydown", keylistener);
    xoffset = 0;
    yoffset = 0;
    //mouse function
    window.addEventListener("mousedown", mouseDownFunction);
    makeTriangleAndBuffer();
    //what part of the canvas should we use?  (all of it here)
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0.0, 0.0, 0.0, 1.0); //start out opaque black
    //request a frame be drawn
    requestAnimationFrame(render); //render is the name of our drawing function below
};
function update() {
    //store the last triangle points in a temporary array
    tempPoints = trianglePoints;
    //reset the main triangle points array
    trianglePoints = [];
    //reset the center of each target location to be used on next mouse click
    targetCenterLocationArray = [];
    let vertexDirectionChangeIndicator = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < tempPoints.length; i++) {
        //Switch case to set j to the index of the current target (0-4)
        let j;
        switch (true) {
            case (i >= 0 && i <= 5):
                j = 0;
                break;
            case (i >= 6 && i <= 11):
                j = 1;
                break;
            case (i >= 12 && i <= 17):
                j = 2;
                break;
            case (i >= 18 && i <= 23):
                j = 3;
                break;
            case (i >= 24 && i <= 29):
                j = 4;
                break;
        }
        //Update the current target with its corresponding speed/direction adjustment number
        //Using previously stored triangle points to add and create the new slightly adjusted triangle points
        trianglePoints.push(new vec4(tempPoints[i][0] + vertexSpeedDirectionArray[j * 2], tempPoints[i][1] + vertexSpeedDirectionArray[j * 2 + 1], tempPoints[i][2], tempPoints[i][3]));
        //If the current target's Y value is outside the box, indicate that this target needs its Y direction changed by storing a corresponding 1 in the array
        if (1.0 <= tempPoints[i][0] + vertexSpeedDirectionArray[j * 2] || tempPoints[i][0] + vertexSpeedDirectionArray[j * 2] <= -1.0) {
            vertexDirectionChangeIndicator[j * 2] = 1;
        }
        //If the current target's X value is outside the box, indicate that this target needs its X direction changed by storing a corresponding 1 in the array
        if (1.0 <= tempPoints[i][1] + vertexSpeedDirectionArray[j * 2 + 1] || tempPoints[i][1] + vertexSpeedDirectionArray[j * 2 + 1] <= -1.0) {
            vertexDirectionChangeIndicator[j * 2 + 1] = 1;
        }
    }
    //Record the current center location of each triangle and store it in the center array
    for (let i = 0; i < 5; i++) {
        targetCenterLocationArray[i * 2] = trianglePoints[i * 6][0] + 0.1;
        targetCenterLocationArray[i * 2 + 1] = trianglePoints[i * 6][1] + 0.1;
    }
    //Check if any triangles need to change directions and reverse the corresponding speed/direction altering number in the array accordingly
    for (let i = 0; i < vertexDirectionChangeIndicator.length; i++) {
        if (vertexDirectionChangeIndicator[i] == 1) {
            vertexSpeedDirectionArray[i] *= -1;
        }
    }
    //Send new trianglePoints vertex data to GPU
    gl.bufferData(gl.ARRAY_BUFFER, flatten(trianglePoints), gl.STATIC_DRAW);
    //Tell the machine to render when its ready
    requestAnimationFrame(render);
}
function mouseDownFunction(event) {
    //Convert mouse click location into correct format
    let rect = canvas.getBoundingClientRect();
    let canvasY = event.clientY - rect.top;
    let flippedY = canvas.clientHeight - canvasY;
    yoffset = 2 * flippedY / canvas.clientHeight - 1;
    xoffset = 2 * (event.clientX - rect.left) / canvas.clientWidth - 1;
    //Count the current number of hits before click for # of misses calculation
    let currentHits = 0;
    for (let i = 0; i < targetHitArray.length; i++) {
        if (targetHitArray[i] == 1) {
            currentHits++;
        }
    }
    //Check if the click was inside a target and record a hit for the corresponding target if so
    for (let i = 0; i < 5; i++) {
        if (-0.1 + targetCenterLocationArray[i * 2 + 1] <= yoffset && yoffset <= 0.1 + targetCenterLocationArray[i * 2 + 1] &&
            -0.1 + targetCenterLocationArray[i * 2] <= xoffset && xoffset <= 0.1 + targetCenterLocationArray[i * 2]) {
            targetHitArray[i] = 1;
        }
    }
    // Count how many targets have been hit
    let hitCountTemp = 0;
    for (let i = 0; i < targetHitArray.length; i++) {
        if (targetHitArray[i] == 1) {
            hitCountTemp++;
        }
    }
    //variable for remaining hits
    let hitsRemaining = 5 - hitCountTemp;
    //If there is no difference between the number of hits before and after a click, then there must have been a miss
    if (hitCountTemp == currentHits) {
        missCount++;
    }
    //change remaining hits label to update remaining hits
    targetsRemainingLabel.textContent = "Targets Remaining:" + " " + hitsRemaining;
    if (5 - hitCountTemp == 0) {
        targetsRemainingLabel.textContent = "Targets Remaining: " + hitsRemaining + ", You Win!";
    }
    //change miss count label to update current # of misses
    missCountLabel.textContent = "Misses: " + missCount;
    requestAnimationFrame(render);
}
// ID for beginning the window animation
let animationStart;
// keyboard listener to change target colors and start moving the targets
function keylistener(event) {
    switch (event.key) {
        case "r":
            color = new vec4(1, 0, 0, 1); //red
            break;
        case "b":
            color = new vec4(0, 0, 1, 1); //blue
            break;
        case "g":
            color = new vec4(0, 1, 0, 1); //green
            break;
        case "w":
            color = new vec4(1, 1, 1, 1); //white
            break;
        case "m":
            //start moving targets with the update function 60 times per second
            if (!targetsMoving) {
                animationStart = window.setInterval(update, 16);
                targetsMoving = true;
            }
            else {
                //If the targets are already moving, stop them from moving
                window.clearInterval(animationStart);
                targetsMoving = false;
            }
            break;
    }
    // and not send over the color to our uniform location on the GPU
    gl.uniform4fv(ucolor, color.flatten());
    // and request new frame
    requestAnimationFrame(render);
}
//make a triangle and send to graphics memory
function makeTriangleAndBuffer() {
    trianglePoints = []; //create a local (RAM) array
    tempPoints = []; //reset temp points if there's anything in them, new game is starting
    targetCenterLocationArray = []; //store the location of each target
    targetHitArray = [0, 0, 0, 0, 0];
    //Create variables for the random numbers for shifting each target
    let randomNumX;
    let randomNumY;
    //Create 5 square targets each composed of two triangles and shift them randomly
    for (let i = 0; i < 5; i++) {
        randomNumX = Math.random() * 1.8 - 0.9;
        randomNumY = Math.random() * 1.8 - 0.9;
        //Push two triangles to make a square target in the middle of the canvas, and adjust it to a random location
        trianglePoints.push(new vec4(-0.1 + randomNumX, -0.1 + randomNumY, 0, 1));
        trianglePoints.push(new vec4(-0.1 + randomNumX, 0.1 + randomNumY, 0, 1));
        trianglePoints.push(new vec4(0.1 + randomNumX, -0.1 + randomNumY, 0, 1));
        trianglePoints.push(new vec4(-0.1 + randomNumX, 0.1 + randomNumY, 0, 1));
        trianglePoints.push(new vec4(0.1 + randomNumX, -0.1 + randomNumY, 0, 1));
        trianglePoints.push(new vec4(0.1 + randomNumX, 0.1 + randomNumY, 0, 1));
        //Store the randomly generated center of each target
        targetCenterLocationArray[i * 2] = randomNumX;
        targetCenterLocationArray[i * 2 + 1] = randomNumY;
    }
    //get some graphics card memory
    bufferId = gl.createBuffer();
    //tell WebGL that the buffer we just created is the one to work with now
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    //send the local data over to the graphics card
    //flatten converts to 1D array
    gl.bufferData(gl.ARRAY_BUFFER, flatten(trianglePoints), gl.STATIC_DRAW);
    //tell openGL what the data means
    let vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);
}
function render() {
    //start by clearing all buffers
    gl.clear(gl.COLOR_BUFFER_BIT);
    //if we needed to, we could bind to the correct drawing buffer
    //but if we're already bound to it, this would have no impact
    //gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    //variables for incrementing between targets
    let first = 0;
    let count = 6;
    //Only draw targets that have not been hit
    for (let i = 0; i < 5; i++) {
        if (targetHitArray[i] == 0) {
            gl.drawArrays(gl.TRIANGLES, first, count);
        }
        first += 6;
    }
}
