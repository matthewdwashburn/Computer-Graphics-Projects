//Author: Matthew Washburn
//Version: Fall 2025
"use strict";
//references to WebGL related objects
let gl:WebGLRenderingContext; // the actual webgl rendering context, allows communication to the gpu
let canvas:HTMLCanvasElement; // the html canvas element that's being drawn on
let program:WebGLProgram; // compiled shader program (vertex + fragment shaders)
let umv:WebGLUniformLocation; //index of model_view in shader program
let uproj:WebGLUniformLocation; //index of projection in shader program
let vPosition:GLint; // store the index for the vPosition attribute in the shader
let vColor:GLint; // store the index for the vColor attribute in the shader

//Variables to track the motion of the car
let isGoing = false;
let isForward = false;
let turningLeft = false;
let turningRight = false;

let fov = 45;
let cameraZOffset = 50;
let cameraYOffset = 15;
let cameraXOffset = 0;
let currentCamera = 1;
let cameraOnePointingAtCar = false;
let cameraLookingAtXOffset = 0;
let cameraLookingAtYOffset = 0;
let cameraLookingAtZOffset = 0;
let cameraOneZoomIn = false;
let cameraOneZoomOut = false;
let cameraOneDollyOut = false;
let cameraOneDollyIn = false;
let resetCamera = false;
let cameraStateArray = [];



//Import helper functions
import {
    initShaders,
    vec4,
    mat4,
    flatten,
    perspective,
    translate,
    lookAt,
    rotateX,
    rotateY,
    rotateZ,
    rotate,
} from './helperfunctions.js';

// Parent class for rendering each object
class RenderObject {
    //Variables to keep track of each object's position and rotation offsets
    xOffset:number = 0;
    yOffset:number = 0;
    zOffset:number = 0;
    thetaX:number = 0;
    thetaY:number = 0;
    thetaZ:number = 0;
    bufferId:WebGLBuffer;

    //base class overridden by child class, each new object needs its own buffer and data
    initBuffer(gl:WebGLRenderingContext) {
    }

    //render this object, if parent model-view is provided, use the parent as the base to transform
    //returns the final model-view matrix used for this object so the children can use it
    render(gl:WebGLRenderingContext, umv:WebGLUniformLocation, uproj:WebGLUniformLocation, parentMV: mat4 | null = null) {
        let mv:mat4;

        //Check if this is a new object to render at the center, or if the object needs to be transformed from an existing parent
        if(parentMV == null) {
           mv = lookAt(new vec4(cameraXOffset, cameraYOffset, cameraZOffset, 1), new vec4(cameraLookingAtXOffset, cameraLookingAtYOffset, cameraLookingAtZOffset, 1), (new vec4(0, 1, 0, 0)));
        } else {
            mv = parentMV;
        }
        //multiply translate matrix first, then rotate to get correct behavior
        mv = mv.mult(translate(this.xOffset, this.yOffset, this.zOffset));
        mv = mv.mult(rotateX(this.thetaX))
        mv = mv.mult(rotateY(this.thetaY))
        mv = mv.mult(rotateZ(this.thetaZ))
        //Create a buffer to store data and send to gpu
        gl.uniformMatrix4fv(umv, false, mv.flatten());
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferId);
        //Set up vertex attributes
        gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 32, 0);
        gl.enableVertexAttribArray(vPosition);
        gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 32, 16);
        gl.enableVertexAttribArray(vColor);
        gl.drawArrays(gl.TRIANGLES, 0, this.numVertices());

        return mv;
    }

    numVertices(): number {
        return 0; // child class overrides
    }

}

// class for green grass ground that car drives on
class Ground extends RenderObject {
    private vertices: vec4[] = [];

    initBuffer(gl: WebGLRenderingContext) {
        //Build the ground vertices and color
        this.vertices = this.makeBodyVertices();
        //Send data to gpu
        this.bufferId = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferId);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.vertices), gl.STATIC_DRAW);
    }
    // Return number of vertices to parent class
    numVertices() {
        return this.vertices.length / 2;
    }
    // returns all the points for the ground
    private makeBodyVertices(): vec4[] {
        let points:vec4[] = [];

        //green grass ground
        points.push(new vec4(20.0, -1.0, -40.0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.7)); //green
        points.push(new vec4(20.0, -1.0, 40.0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.7)); //green
        points.push(new vec4(-20.0, -1.0, 40.0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.7)); //green
        points.push(new vec4(-20.0, -1.0, 40.0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.7)); //green
        points.push(new vec4(-20.0, -1.0, -40.0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.7)); //green
        points.push(new vec4(20.0, -1.0, -40.0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.7)); //green

        return points;
    }
}

// class for the Torso of the driver
class Torso extends RenderObject {
    private vertices: vec4[] = [];

    initBuffer(gl: WebGLRenderingContext) {
        //Build the ground vertices and color
        this.vertices = this.makeBodyVertices();
        //Send data to gpu
        this.bufferId = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferId);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.vertices), gl.STATIC_DRAW);
    }
    // Return number of vertices to parent class
    numVertices() {
        return this.vertices.length / 2;
    }
    // returns all the points for the ground
    private makeBodyVertices(): vec4[] {
        let points:vec4[] = [];

        //front face
        points.push(new vec4(0.5, -1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
        points.push(new vec4(0.5, 1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
        points.push(new vec4(-0.5, 1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
        points.push(new vec4(-0.5, 1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
        points.push(new vec4(-0.5, -1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
        points.push(new vec4(0.5, -1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan

        //back face
        points.push(new vec4(-0.5, -1.0, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 1.0, 1.0)); //magenta
        points.push(new vec4(-0.5, 1.0, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 1.0, 1.0));//magenta
        points.push(new vec4(0.5, 1.0, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 1.0, 1.0));//magenta
        points.push(new vec4(0.5, 1.0, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 1.0, 1.0));//magenta
        points.push(new vec4(0.5, -1.0, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 1.0, 1.0));//magenta
        points.push(new vec4(-0.5, -1.0, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 1.0, 1.0));//magenta

        //left face
        points.push(new vec4(0.5, 1.0, 0.5, 1.0));
        points.push(new vec4(1.0, 1.0, 0.0, 1.0)); //yellow
        points.push(new vec4(0.5, -1.0, 0.5, 1.0));
        points.push(new vec4(1.0, 1.0, 0.0, 1.0)); //yellow
        points.push(new vec4(0.5, -1.0, -0.5, 1.0));
        points.push(new vec4(1.0, 1.0, 0.0, 1.0)); //yellow
        points.push(new vec4(0.5, -1.0, -0.5, 1.0));
        points.push(new vec4(1.0, 1.0, 0.0, 1.0)); //yellow
        points.push(new vec4(0.5, 1.0, -0.5, 1.0));
        points.push(new vec4(1.0, 1.0, 0.0, 1.0)); //yellow
        points.push(new vec4(0.5, 1.0, 0.5, 1.0));
        points.push(new vec4(1.0, 1.0, 0.0, 1.0)); //yellow

        //right face
        points.push(new vec4(-0.5, 1.0, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
        points.push(new vec4(-0.5, -1.0, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
        points.push(new vec4(-0.5, -1.0, 0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
        points.push(new vec4(-0.5, -1.0, 0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
        points.push(new vec4(-0.5, 1.0, 0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
        points.push(new vec4(-0.5, 1.0, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red

        //top
        points.push(new vec4(0.5, 1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
        points.push(new vec4(0.5, 1.0, -0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
        points.push(new vec4(-0.5, 1.0, -0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
        points.push(new vec4(-0.5, 1.0, -0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
        points.push(new vec4(-0.5, 1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
        points.push(new vec4(0.5, 1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue

        //bottom
        points.push(new vec4(0.5, -1.0, -0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
        points.push(new vec4(0.5, -1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
        points.push(new vec4(-0.5, -1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
        points.push(new vec4(-0.5, -1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
        points.push(new vec4(-0.5, -1.0, -0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
        points.push(new vec4(0.5, -1.0, -0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
        
        return points;

    }
}

// class for the head of the driver
class Head extends RenderObject {
    private vertices: vec4[] = [];

    initBuffer(gl: WebGLRenderingContext) {
        //Build the ground vertices and color
        this.vertices = this.makeBodyVertices();
        //Send data to gpu
        this.bufferId = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferId);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.vertices), gl.STATIC_DRAW);
    }
    // Return number of vertices to parent class
    numVertices() {
        return this.vertices.length / 2;
    }
    // returns all the points for the ground
    private makeBodyVertices(): vec4[] {
        let points:vec4[] = [];

        //front face 
        points.push(new vec4(0.5, -0.375, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
        points.push(new vec4(0.5, 0.375, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
        points.push(new vec4(-0.5, 0.375, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
        points.push(new vec4(-0.5, 0.375, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
        points.push(new vec4(-0.5, -0.375, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan
        points.push(new vec4(0.5, -0.375, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 1.0, 1.0)); //cyan

        //back face
        points.push(new vec4(-0.5, -0.375, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 1.0, 1.0)); //magenta
        points.push(new vec4(-0.5, 0.375, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 1.0, 1.0));//magenta
        points.push(new vec4(0.5, 0.375, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 1.0, 1.0));//magenta
        points.push(new vec4(0.5, 0.375, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 1.0, 1.0));//magenta
        points.push(new vec4(0.5, -0.375, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 1.0, 1.0));//magenta
        points.push(new vec4(-0.5, -0.375, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 1.0, 1.0));//magenta

        //left face
        points.push(new vec4(0.5, 0.375, 0.5, 1.0));
        points.push(new vec4(1.0, 1.0, 0.0, 1.0)); //yellow
        points.push(new vec4(0.5, -0.375, 0.5, 1.0));
        points.push(new vec4(1.0, 1.0, 0.0, 1.0)); //yellow
        points.push(new vec4(0.5, -0.375, -0.5, 1.0));
        points.push(new vec4(1.0, 1.0, 0.0, 1.0)); //yellow
        points.push(new vec4(0.5, -0.375, -0.5, 1.0));
        points.push(new vec4(1.0, 1.0, 0.0, 1.0)); //yellow
        points.push(new vec4(0.5, 0.375, -0.5, 1.0));
        points.push(new vec4(1.0, 1.0, 0.0, 1.0)); //yellow
        points.push(new vec4(0.5, 0.375, 0.5, 1.0));
        points.push(new vec4(1.0, 1.0, 0.0, 1.0)); //yellow

        //right face
        points.push(new vec4(-0.5, 0.375, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
        points.push(new vec4(-0.5, -0.375, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
        points.push(new vec4(-0.5, -0.375, 0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
        points.push(new vec4(-0.5, -0.375, 0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
        points.push(new vec4(-0.5, 0.375, 0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
        points.push(new vec4(-0.5, 0.375, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red

        //top
        points.push(new vec4(0.5, 0.375, 0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
        points.push(new vec4(0.5, 0.375, -0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
        points.push(new vec4(-0.5, 0.375, -0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
        points.push(new vec4(-0.5, 0.375, -0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
        points.push(new vec4(-0.5, 0.375, 0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
        points.push(new vec4(0.5, 0.375, 0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue

        //bottom
        points.push(new vec4(0.5, -0.375, -0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
        points.push(new vec4(0.5, -0.375, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
        points.push(new vec4(-0.5, -0.375, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
        points.push(new vec4(-0.5, -0.375, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
        points.push(new vec4(-0.5, -0.375, -0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green
        points.push(new vec4(0.5, -0.375, -0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 1.0)); //green

        return points;

    }
}

// Car body class
class Body extends RenderObject {
    private vertices: vec4[] = [];

    initBuffer(gl: WebGLRenderingContext) {
        //Build the body vertices and color
        this.vertices = this.makeBodyVertices();
        //Send data to gpu
        this.bufferId = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferId);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.vertices), gl.STATIC_DRAW);
    }
    // Return number of vertices to parent class
    numVertices() {
        return this.vertices.length / 2;
    }
    // returns all the points for the body of the car
    private makeBodyVertices(): vec4[] {
        let points:vec4[] = [];
        //rear face
        points.push(new vec4(2.0, 0.0, 3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(2.0, 2.0, 3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(-2.0, 2.0, 3.0, 1.0));
        points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white
        points.push(new vec4(-2.0, 2.0, 3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(-2.0, 0.0, 3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(2.0, 0.0, 3.0, 1.0));
        points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white

        //front face
        points.push(new vec4(-2.0, 0.0, -3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(-2.0, 2.0, -3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(2.0, 2.0, -3.0, 1.0));
        points.push(new vec4(1.0, 1.0, 0.0, 1.0)); //yellow
        points.push(new vec4(2.0, 2.0, -3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(2.0, 0.0, -3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(-2.0, 0.0, -3.0, 1.0));
        points.push(new vec4(1.0, 1.0, 0.0, 1.0)); //yellow

        //right face
        points.push(new vec4(2.0, 2.0, 3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(2.0, 0.0, 3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(2.0, 0.0, -3.0, 1.0));
        points.push(new vec4(0.0, 1.0, 1.0, 1.0)); //teal
        points.push(new vec4(2.0, 0.0, -3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(2.0, 2.0, -3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(2.0, 2.0, 3.0, 1.0));
        points.push(new vec4(0.0, 1.0, 1.0, 1.0)); //teal

        //left face
        points.push(new vec4(-2.0, 2.0, -3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(-2.0, 0.0, -3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(-2.0, 0.0, 3.0, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
        points.push(new vec4(-2.0, 0.0, 3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(-2.0, 2.0, 3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(-2.0, 2.0, -3.0, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red

        //top face
        points.push(new vec4(2.0, 2.0, 3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
        points.push(new vec4(2.0, 2.0, -3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
        points.push(new vec4(-2.0, 2.0, -3.0, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red
        points.push(new vec4(-2.0, 2.0, -3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
        points.push(new vec4(-2.0, 2.0, 3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
        points.push(new vec4(2.0, 2.0, 3.0, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 1.0)); //red

        //bottom face
        points.push(new vec4(2.0, 0.0, -3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(2.0, 0.0, 3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(-2.0, 0.0, 3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(-2.0, 0.0, 3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(-2.0, 0.0, -3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black
        points.push(new vec4(2.0, 0.0, -3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 0.0, 1.0)); //black

        return points;
    }

}



// class for car wheel
class Wheel extends RenderObject {
    private vertices: vec4[] = [];

    initBuffer(gl: WebGLRenderingContext) {
        //Build the wheel vertices and color
        this.vertices = this.makeWheelVertices();
        //Send data to gpu
        this.bufferId = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferId);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.vertices), gl.STATIC_DRAW);
    }
    // Return number of vertices to parent class
    numVertices() {
        return this.vertices.length / 2;
    }
    // Returns all the points for the wheel of the car
    private makeWheelVertices(): vec4[] {
        let points:vec4[] = [];
        let numSides:number = 32;
        let radius = 1.0

        //Build the tire right sidewall circle
        for (let i = 0; i < numSides; i++) {
            let angle1 = (i / numSides) * 2 * Math.PI;
            let angle2 = ((i+1) / numSides) * 2 * Math.PI;
            let z = 0.5;

            // center of circle
            points.push(new vec4(0.0, 0.0, z, 1.0));
            points.push(new vec4(0.2, 0.2, 0.2, 1.0)); //gray

            // edge point 1
            points.push(new vec4(radius * Math.cos(angle1), radius * Math.sin(angle1), z, 1.0));
            points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white

            // edge point 2
            points.push(new vec4(radius * Math.cos(angle2), radius * Math.sin(angle2), z, 1.0));
            points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
        }
        //Build the tire left sidewall circle
        for (let i = 0; i < numSides; i++) {
            let angle1 = (i / numSides) * 2 * Math.PI;
            let angle2 = ((i+1) / numSides) * 2 * Math.PI;
            let z = -0.5;

            // center of sidewall circle
            points.push(new vec4(0.0, 0.0, z, 1.0));
            points.push(new vec4(0.2, 0.2, 0.2, 1.0)); //gray

            // edge point 1
            points.push(new vec4(radius * Math.cos(angle1), radius * Math.sin(angle1), z, 1.0));
            points.push(new vec4(1.0, 1.0, 1.0, 1.0)); //white

            // edge point 2
            points.push(new vec4(radius * Math.cos(angle2), radius * Math.sin(angle2), z, 1.0));
            points.push(new vec4(0.0, 0.0, 1.0, 1.0)); //blue
        }
        //Build the tire tread
        for(let i = 0; i < numSides; i++) {
            let angleStep =  (2 * Math.PI ) / numSides;
            let leftCircleCenterZ = -0.5;
            let rightCircleCenterZ = 0.5;
            //For finding the start and ending spots of each tread rectangle on each circle
            let theta = i * angleStep;
            let nextTheta = (i + 1) * angleStep;

            // Circle points for the left and right wheel side walls
            let x1 = Math.cos(theta);
            let y1 = Math.sin(theta);
            let x2 = Math.cos(nextTheta);
            let y2 = Math.sin(nextTheta);

            //Connects the two points from the circumference of the left circle
            // to the first point on the circumference of the right circle
            // First triangle of the tread rectangle
            points.push(new vec4(x1, y1, leftCircleCenterZ, 1.0));
            points.push(new vec4(1.0, 1.0, 1.0, 1.0));
            points.push(new vec4(x2, y2, leftCircleCenterZ, 1.0));
            points.push(new vec4(0.1, 0.1, 0.1, 1.0));
            points.push(new vec4(x1, y1, rightCircleCenterZ, 1.0));
            points.push(new vec4(0.1, 0.1, 0.1, 1.0));
            //Connects the two points from the circumference of the right circle
            // to the second point on the circumference of the left circle
            // Second triangle completing one of 32 tread rectangles around the
            // two tire sidewall circles to create a tire
            points.push(new vec4(x1, y1, rightCircleCenterZ, 1.0));
            points.push(new vec4(1.0, 1.0, 1.0, 1.0));
            points.push(new vec4(x2, y2, rightCircleCenterZ, 1.0));
            points.push(new vec4(0.1, 0.1, 0.1, 1.0));
            points.push(new vec4(x2, y2, leftCircleCenterZ, 1.0));
            points.push(new vec4(0.1, 0.1, 0.1, 1.0));

        }
        return points;
    }
}

function saveCameraState() {
    cameraStateArray[0] = fov;
    cameraStateArray[1] = cameraXOffset;
    cameraStateArray[2] = cameraYOffset;
    cameraStateArray[3] = cameraZOffset;
    cameraStateArray[4] = cameraLookingAtXOffset;
    cameraStateArray[5] = cameraLookingAtYOffset;
    cameraStateArray[6] = cameraLookingAtZOffset;
}

function restoreCameraState() {
    fov = cameraStateArray[0];
    cameraXOffset = cameraStateArray[1];
    cameraYOffset = cameraStateArray[2];
    cameraZOffset = cameraStateArray[3];
    cameraLookingAtXOffset = cameraStateArray[4];
    cameraLookingAtYOffset = cameraStateArray[5];
    cameraLookingAtZOffset = cameraStateArray[6];
}

//Create new objects for car and environment
let body1 = new Body();
let ground1 = new Ground();
let torso1 = new Torso();
let head1 = new Head();
let wheel1 = new Wheel();
let wheel2 = new Wheel();
let wheel3 = new Wheel();
let wheel4 = new Wheel();

//Set up events to happen immediately when the page loads
window.onload = function init() {

    //fetch reference to the canvas element defined in the html file
    canvas = document.getElementById("gl-canvas") as HTMLCanvasElement;
    //grab the WebGL 2 context for that canvas
    gl = canvas.getContext('webgl2') as WebGLRenderingContext;
    if (!gl) {
        alert("WebGL isn't available");
    }

    //Take the vertex and fragment shaders provided and compile them into a shader program
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    //use that program for our rendering
    gl.useProgram(program);

    // fetch uniform and attribute locations
    umv = gl.getUniformLocation(program, "model_view");
    uproj = gl.getUniformLocation(program, "projection");
    vPosition = gl.getAttribLocation(program, "vPosition");
    vColor = gl.getAttribLocation(program, "vColor");

    // Position the torso
    torso1.yOffset += 2.25;
    torso1.zOffset -= 2;
    // torso1.xOffset -= 1;

    // Position the head
    head1.yOffset += 3.75;
    head1.zOffset -= 2;
    // head1.xOffset -= 1;

    // Position front left tire
    wheel1.thetaY +=90;
    wheel1.xOffset -=2;
    wheel1.zOffset -=2.5;

    // Position front right tire
    wheel2.thetaY +=90;
    wheel2.xOffset +=2;
    wheel2.zOffset -=2.5;

    // Position back left tire
    wheel3.thetaY +=90;
    wheel3.xOffset -=2;
    wheel3.zOffset +=2.5;

    // Position back right tire
    wheel4.thetaY +=90;
    wheel4.xOffset +=2;
    wheel4.zOffset +=2.5;

    // Initialize the car to be placed at the origin facing forwards
    body1.xOffset = 0;
    body1.yOffset = 0;
    body1.zOffset = 0;
    body1.thetaY = 0;

    //Send the data for the body to the gpu
    body1.initBuffer(gl);

    //Send the data for the ground to the gpu
    ground1.initBuffer(gl);

    //Send the data for the torso to the gpu
    torso1.initBuffer(gl);

    //Send the data for the head to the gpu
    head1.initBuffer(gl);

    //Send the data for the wheels to the gpu
    wheel1.initBuffer(gl);
    wheel2.initBuffer(gl);
    wheel3.initBuffer(gl);
    wheel4.initBuffer(gl);


    //Listen for arrow keys and space bar to tell the car what to do
    window.addEventListener("keydown" ,function(event){
        switch(event.key) {
            //Signal to move car forward
            case "ArrowUp":
                isGoing = true;
                isForward = true;
                break;
            //Signal to move car backward
            case "ArrowDown":
                isGoing = true;
                isForward = false;
                break;
            //Signal to move car to the left
            case "ArrowLeft":
                turningLeft = true;
                turningRight = false;
                break;
            //Signal to move car to the right
            case "ArrowRight":
                turningRight = true;
                turningLeft = false;
                break;
            //Signal to stop moving the car
            case " ":
                isGoing = false;
                break;
            case "q":
                if(currentCamera == 1) {
                    cameraOneZoomIn = true;
                }
                break;
            case "w":
                if(currentCamera == 1) {
                    cameraOneZoomOut = true;
                }
                break;
            case "a":
                if(currentCamera == 1) {
                    cameraOneDollyOut = true;
                }
                break;
            case "s":
                if(currentCamera == 1) {
                    cameraOneDollyIn = true;
                }
                break;
            case "f":
                if(currentCamera == 1) {
                    cameraOnePointingAtCar = !cameraOnePointingAtCar;
                }
                break;
            case "r":
                currentCamera = 1;
                resetCamera = true;
                break;
            case "1":
                if(currentCamera != 1) {
                    restoreCameraState();
                }
                currentCamera = 1;
                break;
            case "2":
                if(currentCamera == 1) {
                    saveCameraState();
                }
                resetCamera = true;
                currentCamera = 2;
                break;
            case "3":
                if(currentCamera == 1) {
                    saveCameraState();
                }
                resetCamera = true;
                currentCamera = 3;
                break;
        }
        //now we need a new frame since we made a change
        requestAnimationFrame(render);
    });
    //When you release left or right keys
    window.addEventListener("keyup" ,function(event) {
        switch (event.key) {
            //Stop turning the wheel left
            case "ArrowLeft":
                    turningLeft = false;
                break;
            //Stop turning the wheel right
            case "ArrowRight":
                    turningRight = false;
                break;
            case "q":
                if(currentCamera == 1) {
                    cameraOneZoomIn = false;
                }
                break;
            case "w":
                if(currentCamera == 1) {
                    cameraOneZoomOut = false;
                }
                break;
            case "a":
                if(currentCamera == 1) {
                    cameraOneDollyOut = false;
                }
                break;
            case "s":
                if(currentCamera == 1) {
                    cameraOneDollyIn = false;
                }
                break;
        }
        //now we need a new frame since we made a change
        requestAnimationFrame(render);
    });


    //Draw to the entire screen
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    //Sets the background to sky blue
    gl.clearColor(0.0, 0.55, 1, 1.0);
    //Avoid having objects that are behind other objects show up anyway
    gl.enable(gl.DEPTH_TEST);


    window.setInterval(update, 16); //target 60 frames per second
};

//request new frame
function update(){
    //Set car and graphics information
 let moveSpeed = 0.15;
 let turnDegreesPerSecond = 180;
 let secondsPerFrame = 0.016; // (1 frame every 16ms)
 let straightTireAngle = 90;
 let forwardTurnStrength = 2.25;
let reverseTurnStrength = 1.75;

//Create a barrier for the car
    //front
    if(body1.zOffset < 0) {
        body1.zOffset = Math.max(body1.zOffset, -37);
    }
    //back
    if(body1.zOffset > 0) {
        body1.zOffset = Math.min(body1.zOffset, 37);
    }
    //left
    if(body1.xOffset < 0) {
        body1.xOffset = Math.max(body1.xOffset, -17);
    }
    //right
    if(body1.xOffset > 0) {
        body1.xOffset = Math.min(body1.xOffset, 17);
    }


    //Car is turning left
 if(turningLeft){
     //Turn wheels to the left, don't let them turn past a 45-degree angle
     wheel1.thetaY += turnDegreesPerSecond * secondsPerFrame;
     wheel1.thetaY = Math.min(wheel1.thetaY, straightTireAngle + 45);

     wheel2.thetaY += turnDegreesPerSecond * secondsPerFrame;
     wheel2.thetaY = Math.min(wheel2.thetaY, straightTireAngle + 45);
 }
//Car is turning right
 if(turningRight){
     //Turn wheels to the right, don't let them turn past a 45-degree angle
     wheel1.thetaY -= turnDegreesPerSecond * secondsPerFrame;
     wheel1.thetaY = Math.max(wheel1.thetaY, straightTireAngle - 45);

     wheel2.thetaY -= turnDegreesPerSecond * secondsPerFrame;
     wheel2.thetaY = Math.max(wheel2.thetaY, straightTireAngle - 45);
 }
    let steerAngle = wheel1.thetaY - 90;
    //Car is going forward
    if(isGoing == true && isForward == true){
        //update car direction
        body1.thetaY += steerAngle * secondsPerFrame * forwardTurnStrength;

        //update location of car based on the direction of the front of the car
        let carDirectionRadians = body1.thetaY * (Math.PI / 180);
        let dx = moveSpeed * Math.sin(carDirectionRadians);
        let dz = moveSpeed * Math.cos(carDirectionRadians);
        body1.xOffset -= dx;
        body1.zOffset -= dz;

        //Rotate wheels forwards
        wheel1.thetaZ -= 3;
        wheel2.thetaZ -= 3;
        wheel3.thetaZ -= 3;
        wheel4.thetaZ -= 3;
    }

    //Car is going backwards
    if(isGoing == true && isForward == false){
        //Reverse steering angle when car in reverse (turn right to go left in reverse, etc.)
        steerAngle*=-1;
        //update car direction
        body1.thetaY += steerAngle * secondsPerFrame * reverseTurnStrength;

        //update location of car based on the direction of the back of the car
        let carDirectionRadians = body1.thetaY * (Math.PI / 180);
        let dx = moveSpeed * Math.sin(carDirectionRadians);
        let dz = moveSpeed * Math.cos(carDirectionRadians);
        body1.xOffset += dx;
        body1.zOffset += dz;

        //Rotate wheels backwards
        wheel1.thetaZ += 3;
        wheel2.thetaZ += 3;
        wheel3.thetaZ += 3;
        wheel4.thetaZ += 3;
    }
    //Make Camera One look at the car
    if(cameraOnePointingAtCar) {
        cameraLookingAtXOffset = body1.xOffset;
        cameraLookingAtYOffset = body1.yOffset;
        cameraLookingAtZOffset = body1.zOffset;
    }
    //Make Camera look at the center
    if(!cameraOnePointingAtCar) {
        cameraLookingAtXOffset = 0;
        cameraLookingAtYOffset = 0;
        cameraLookingAtZOffset = 0;
    }

    //Camera One Zoom and Dolly
    if(cameraOneZoomIn) {
        fov -= 10 * secondsPerFrame;
        fov = Math.max(fov, 5);
    }
    if(cameraOneZoomOut) {
        fov += 10 * secondsPerFrame;
        fov = Math.min(fov, 179);
    }
    if(cameraOneDollyIn) {
        cameraZOffset -= 10 * secondsPerFrame;
        cameraZOffset = Math.max(cameraZOffset, 5);
    }
    if(cameraOneDollyOut) {
        cameraZOffset += 10 * secondsPerFrame;
        cameraZOffset = Math.min(cameraZOffset, 100);
    }

    if(resetCamera) {
        fov = 50;
        cameraZOffset = 50;
        cameraYOffset = 15;
        cameraXOffset = 0;
        cameraOnePointingAtCar = false;
        cameraLookingAtXOffset = 0;
        cameraLookingAtYOffset = 0;
        cameraLookingAtZOffset = 0;
        cameraOneZoomIn = false;
        cameraOneZoomOut = false;
        cameraOneDollyOut = false;
        cameraOneDollyIn = false;
        resetCamera = false;
    }
    //Viewpoint camera 2, positioned in the front of car representing driver
    if(currentCamera == 2) {
        //Forward direction of the car based on its y-axis (yaw)
        //Because of the way the car was drawn forwards is backwards and vice versa
        //So we need to flip the signs with a negative
        let forwardX = -Math.sin(body1.thetaY * Math.PI / 180);
        let forwardZ = -Math.cos(body1.thetaY * Math.PI / 180);

        //Position camera in the head of the driver at front of car
        cameraXOffset = body1.xOffset + forwardX * 1.55;
        cameraYOffset = body1.yOffset + 3.9;
        cameraZOffset = body1.zOffset + forwardZ * 1.55;

        //Make driver look 20 units ahead of car in both the z direction
        // (forward and backwards) and the x direction (left and right)
        cameraLookingAtXOffset = body1.xOffset + forwardX * 20;
        cameraLookingAtYOffset = body1.yOffset + 2.5;
        cameraLookingAtZOffset = body1.zOffset + forwardZ * 20;
    }
    //Chase camera 3, positioned 15 units above (y), in the middle (x), and 20 units back (z) from the car,
    // and follows behind it always
    if(currentCamera == 3) {
        //Forward direction of the car based on its y-axis (yaw)
        //Because of the way the car was drawn forwards is backwards and vice versa
        //So we need to flip the signs with a negative
        let forwardX = -Math.sin(body1.thetaY * Math.PI / 180);
        let forwardZ = -Math.cos(body1.thetaY * Math.PI / 180);
        let cos = forwardX;
        let sin = forwardZ;
        //Create rotation points in the middle (x) and 20 units back (z) from wherever they are rotating around
        let localX = 0;
        let localZ = -20;
        // Rotation points obtained using x' = x cos(θ) - y sin(θ) and y' = x sin(θ) + y cos(θ),
        // in this case y is z because our car is driving across the z axis
        let rotatedX = localZ * cos - localX * sin;
        let rotatedZ = localZ * sin + localX * cos;

        //Apply rotation points to the car coordinates, so they will always be 20
        //Position chase camera up 15 for y
        cameraXOffset = body1.xOffset + rotatedX;
        cameraYOffset = body1.yOffset + 10;
        cameraZOffset = body1.zOffset + rotatedZ;

        //Make chase camera look 10 units in front of car and slightly upwards
        cameraLookingAtXOffset = body1.xOffset - forwardX * 10;
        cameraLookingAtYOffset = body1.yOffset + 7.5;
        cameraLookingAtZOffset = body1.zOffset - forwardZ * 10;
    }
    requestAnimationFrame(render);
}

//draw a new frame
function render(){
    //clear any previous data for both color and depth
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //set screen projection
    let p:mat4 = perspective(fov, canvas.clientWidth / canvas.clientHeight, 1.0, 1000.0);
    gl.uniformMatrix4fv(uproj, false, p.flatten());

     //render the car body as a new object without a parent every frame
     let bodyMV = body1.render(gl, umv, uproj, null);

    //render the wheels onto the new parent body
    wheel1.render(gl, umv, uproj, bodyMV);
    wheel2.render(gl, umv, uproj, bodyMV);
    wheel3.render(gl, umv, uproj, bodyMV);
    wheel4.render(gl, umv, uproj, bodyMV);

    //Render the driver's torso onto the parent car body
    torso1.render(gl, umv, uproj, bodyMV);

    //Render the driver's head onto the parent car body
    head1.render(gl, umv, uproj, bodyMV);


    //render the ground with no parent object, it is unaffected by anything else
    ground1.render(gl, umv, uproj, null);

}
