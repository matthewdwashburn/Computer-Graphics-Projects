//Author: Matthew Washburn
//Version: Fall 2025
"use strict";
//references to WebGL related objects
let gl: WebGL2RenderingContext; // the actual webgl rendering context, allows communication to the gpu
let canvas: HTMLCanvasElement; // the html canvas element that's being drawn on
let program: WebGLProgram; // compiled shader program (vertex + fragment shaders)
let umv: WebGLUniformLocation; //index of model_view in shader program
let uproj: WebGLUniformLocation; //index of projection in shader program

//shader variable indices for per vertex and material attributes
let vNormal: GLint;
let vAmbientDiffuseColor: GLint; //Ambient and Diffuse can be the same for the material
let vSpecularColor: GLint; //highlight color
let vSpecularExponent: GLint;
let vPosition: GLint; // store the index for the vPosition attribute in the shader
let vInstancePosition: GLint; // Store the index for the instanced position attribute in the shader
let particlePositions: Float32Array; //32-bit float array for sending instanced positions to the vertex shader
let instanceBuffer: WebGLBuffer; //Create a personal buffer for sending instanced particle positions to the GPU
let densityBuffer: WebGLBuffer; //Create a buffer to send densities over to the GPU for each particle
let useInstancing: WebGLUniformLocation; //Bool in vertex shader that determines which position calculation to use

//Variables to track the motion of the car
let isGoing = false;
let isForward = false;
let turningLeft = false;
let turningRight = false;
let turningHeadLeft = false;
let turningHeadRight = false;

//variables to track and set the camera
let fov = 45;
let cameraZOffset = 93.75;
let cameraYOffset = 28.125;
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
let cameraFourZoomIn = false;
let cameraFourZoomOut = false;
let cameraFourRadius = 40;
let switchedToCameraFour = false;
let resetCamera = false;
let cameraStateArray = [];

//Variables to track light
let isDay = true;
let overHeadColor = new vec4;
let headLightColor = new vec4;
let blueEmergencyLightColor = new vec4;
let redEmergencyLightColor = new vec4;
let colors: vec4[] = [];
let directions: vec4[] = [];
let positions: vec4[] = [];
let angles: number[] = [];
let emergencyLightOn = false;
let headLightsOn = false;
let particlesMoving = false;
let testParticlesMoving = false;
let secondsPerFrame = 0.016; // (1 frame every 16ms)

//Set sphere colors outside of render class so they don't change every frame
let sphereColors: vec4[] = [];

//Set particle values
let particleCount: number = 3375;
let particleRadius = 0.1;
let particleColor = new vec4(0.0, 0, 1, 1.0); //Blue

//Set globally so function constants can access it
let influenceRadius = particleRadius * 4;

//Start particles higher so they make a bigger splash
let particleInitialHeight = 0;

// Make global so user can adjust it
let restDensity = 0;
let relaxationParameter = 0;
let boundingBoxSize = 0;

//Screen space fluid rendering pipeline global variables

let renderMode = 0;
//0 - Original Particle Simulation
//1 - Density Map Simulation
//2 - Density Map Simulation with Bilateral Filtering
//3 - Normal Map Simulation
//4 - Fluid Lighting Simulation

//First pass variables: draw everything in the background before drawing the water
let fbBackground: WebGLFramebuffer; //Background frame buffer
let texBackground: WebGLTexture; //Texture for the background
let rbBackground: WebGLRenderbuffer; //Need a render buffer to store depth info, we are drawing depth on the same renderbuffer
//no longer drawing to standard canvas but multiple texture passes

//Second pass variables: Depth map (particles), now draw particles and use saved background and adjacent particle info for fluid rendering
let fbDepth: WebGLFramebuffer; //Depth frame buffer
let texDepth: WebGLTexture; //Texture for the depth value saved in alpha channel

//Third pass variables
let fbComposite: WebGLFramebuffer;
let texComposite: WebGLTexture;

//Shader programs
//calculates the depth of each fragment
let programDepth: WebGLProgram;

//uses fragment depth to color only particle fragments grayscale, only background fragments, or both
let programTexture: WebGLProgram;

//uses bilateral filtering on depth particles to fill in the gaps between particles and make them look more like a surface
let programBlur: WebGLProgram;

//Buffers and textures for blur program
let fbBlur: WebGLFramebuffer;
let texBlur: WebGLTexture;

//Blur uniform sampler
let uBlurCompositeSampler: WebGLUniformLocation;

//Blur uniforms
let uBlurDirection: WebGLUniformLocation;
let uBlurInverseScreenSize: WebGLUniformLocation;
let uBlurFilterRadius: WebGLUniformLocation;
let uBlurSpatialScale: WebGLUniformLocation;
let uBlurDepthFalloff: WebGLUniformLocation;

//Composite shader program that uses the texture vshader to color both the background and the depth particles
//This makes the original particle simulation much more efficient
let programComposite: WebGLProgram;

//Normal shader program that creates a normal map on the particles from the blurred composite depth map texture
let programNormal: WebGLProgram;
let fbNormal: WebGLFramebuffer;
let texNormal: WebGLTexture;
let uNormalBlurSampler: WebGLUniformLocation;
let uNormalInverseScreenSize: WebGLUniformLocation;
let uNormalInverseProj: WebGLUniformLocation;
let uNormalInverseView: WebGLUniformLocation;

//Fluid lighting shader programs
let programFluidLighting: WebGLUniformLocation;
let uFluidLightingNormalSampler: WebGLUniformLocation;
let fbFluidLighting: WebGLFramebuffer;
let texFluidLighting: WebGLTexture;
let uFluidLightingInverseScreenSize: WebGLUniformLocation;
let uFluidLightingView: WebGLUniformLocation;
let uFluidLightingInverseProj: WebGLUniformLocation;

//Memory locations for depth shader program
//Uniform matrices
let uDepthMV: WebGLUniformLocation;
let uDepthProj: WebGLUniformLocation;

//Attribute positions
let vDepthPos: GLint;
let vDepthInstancedPos: GLint;

//Memory locations for texture shader program
let vTexPos: GLint;

//Pointer to samplers in frag shaders
let uTexSampler: WebGLUniformLocation;
let uDepthSampler: WebGLUniformLocation;
let uBackgroundSampler: WebGLUniformLocation;

//Vertex array object quad that covers camera used to display textures
let quadVao: WebGLVertexArrayObject;

// mouse interaction and rotation state
let xAngle: number = 0;
let yAngle: number = 0;
let mouse_button_down: boolean = false;
let prevMouseX: number = 0;
let prevMouseY: number = 0;

//Import helper functions
import {
    initFileShaders,
    vec4,
    mat4,
    flatten,
    perspective,
    translate,
    lookAt,
    rotateX,
    rotateY,
    rotateZ,
} from './helperfunctions.js';

//Grab bounding box radius sliders and values from html
let boundingBoxSizeSlider = document.getElementById("boundingBoxSize") as HTMLInputElement;
let boundingBoxSizeValue = document.getElementById("boundingBoxSizeValue") as HTMLElement;
let boundingBoxChanged = false;

//Immediately display bounding box radius slider values before user creates a slider event
//Also set equation bounding box radius immediately
let boundingBoxSizeSliderNumber = Number(boundingBoxSizeSlider.value);
boundingBoxSizeValue.textContent = boundingBoxSizeSliderNumber.toString();
boundingBoxSize = boundingBoxSizeSliderNumber;

// Update bounding box radius when slider moves
boundingBoxSizeSlider.addEventListener("input", () => {
    boundingBoxSizeSliderNumber = Number(boundingBoxSizeSlider.value);
    boundingBoxSizeValue.textContent = boundingBoxSizeSliderNumber.toString();
    boundingBoxSize = boundingBoxSizeSliderNumber;
    boundingBoxChanged = true;
    initializeParticles();
});

//Grab rest density sliders and values from html
let restDensitySlider = document.getElementById("restDensity") as HTMLInputElement;
let restDensityValue = document.getElementById("restDensityValue") as HTMLElement;

//Immediately display rest density slider values before user creates a slider event
//Also set equation rest density immediately
let restDensitySliderNumber = Number(restDensitySlider.value);
restDensityValue.textContent = restDensitySliderNumber.toString();
restDensity = restDensitySliderNumber;

// Update rest density when slider moves
restDensitySlider.addEventListener("input", () => {
    restDensitySliderNumber = Number(restDensitySlider.value);
    restDensityValue.textContent = restDensitySliderNumber.toString();
    restDensity = restDensitySliderNumber;
    resetConstants();
});

//Grab relaxation parameter slider and values from html
let relaxationParameterSlider = document.getElementById("relaxationParameter") as HTMLInputElement;
let relaxationParameterValue = document.getElementById("relaxationParameterValue") as HTMLElement;

//Immediately display relaxation parameter slider values before user creates a slider event
//Also set equation relaxation parameter immediately
let relaxationParameterSliderNumber = Number(relaxationParameterSlider.value);
relaxationParameterValue.textContent = relaxationParameterSliderNumber.toString();
relaxationParameter = relaxationParameterSliderNumber;

// Update relaxation parameter when slider moves
relaxationParameterSlider.addEventListener("input", () => {
    relaxationParameterSliderNumber = Number(relaxationParameterSlider.value);
    relaxationParameterValue.textContent = relaxationParameterSliderNumber.toString();
    relaxationParameter = relaxationParameterSliderNumber;
    resetConstants();
});

// filterRadius
let filterRadius:number;

let filterRadiusSlider = document.getElementById("filterRadius") as HTMLInputElement;
let filterRadiusValue = document.getElementById("filterRadiusValue") as HTMLElement;

let filterRadiusSliderNumber = Number(filterRadiusSlider.value);
filterRadiusValue.textContent = filterRadiusSliderNumber.toString();
filterRadius = filterRadiusSliderNumber;

filterRadiusSlider.addEventListener("input", () => {
    filterRadiusSliderNumber = Number(filterRadiusSlider.value);
    filterRadiusValue.textContent = filterRadiusSliderNumber.toString();
    filterRadius = filterRadiusSliderNumber;
});

// spatialScale
let spatialScale:number;

let spatialScaleSlider = document.getElementById("spatialScale") as HTMLInputElement;
let spatialScaleValue = document.getElementById("spatialScaleValue") as HTMLElement;

let spatialScaleSliderNumber = Number(spatialScaleSlider.value);
spatialScaleValue.textContent = spatialScaleSliderNumber.toString();
spatialScale = spatialScaleSliderNumber;

spatialScaleSlider.addEventListener("input", () => {
    spatialScaleSliderNumber = Number(spatialScaleSlider.value);
    spatialScaleValue.textContent = spatialScaleSliderNumber.toString();
    spatialScale = spatialScaleSliderNumber;
});

// depthFalloff
let depthFalloff:number;

let depthFalloffSlider = document.getElementById("depthFalloff") as HTMLInputElement;
let depthFalloffValue = document.getElementById("depthFalloffValue") as HTMLElement;

let depthFalloffSliderNumber = Number(depthFalloffSlider.value);
depthFalloffValue.textContent = depthFalloffSliderNumber.toString();
depthFalloff = depthFalloffSliderNumber;

depthFalloffSlider.addEventListener("input", () => {
    depthFalloffSliderNumber = Number(depthFalloffSlider.value);
    depthFalloffValue.textContent = depthFalloffSliderNumber.toString();
    depthFalloff = depthFalloffSliderNumber;
});


// Parent class for rendering each object
class RenderObject {
    //Variables to keep track of each object's position and rotation offsets
    xOffset: number = 0;
    yOffset: number = 0;
    zOffset: number = 0;
    thetaX: number = 0;
    thetaY: number = 0;
    thetaZ: number = 0;
    scaleFactor: number = 1;
    bufferId: WebGLBuffer;
    velocity: vec4 = new vec4(0, 0, 0, 0);

    //render this object, if parent model-view is provided, use the parent as the base to transform
    //returns the final model-view matrix used for this object so the children can use it
    render(gl: WebGL2RenderingContext, umv: WebGLUniformLocation, parentMV: mat4 | null = null, skipDraw: boolean = false) {
        let mv: mat4;

        //Check if this is a new object to render at the center, or if the object needs to be transformed from an existing parent
        if (parentMV == null) {
            mv = lookAt(new vec4(cameraXOffset, cameraYOffset, cameraZOffset, 1), new vec4(cameraLookingAtXOffset, cameraLookingAtYOffset, cameraLookingAtZOffset, 1), (new vec4(0, 1, 0, 0)));
        } else {
            mv = parentMV;
        }

        gl.disableVertexAttribArray(vPosition); //in case the indices change
        //multiply translate matrix first, then rotate to get correct behavior
        mv = mv.mult(translate(this.xOffset, this.yOffset, this.zOffset));
        mv = mv.mult(rotateX(this.thetaX))
        mv = mv.mult(rotateY(this.thetaY))
        mv = mv.mult(rotateZ(this.thetaZ))
        let scaleMatrix: mat4;
        scaleMatrix = new mat4(
            new vec4(this.scaleFactor, 0, 0, 0),
            new vec4(0, this.scaleFactor, 0, 0),
            new vec4(0, 0, this.scaleFactor, 0),
            new vec4(0, 0, 0, 1)
        );
        mv = mv.mult(scaleMatrix);
        //Create a buffer to store data and send to gpu
        gl.uniformMatrix4fv(umv, false, mv.flatten());
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferId);
        //Set up vertex attributes
        gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 32, 0);
        gl.enableVertexAttribArray(vPosition);

        gl.vertexAttribPointer(vNormal, 4, gl.FLOAT, false, 32, 16);
        gl.enableVertexAttribArray(vNormal);


        //Only draw if not instanced rendering
        if (!skipDraw) {
            gl.drawArrays(gl.TRIANGLES, 0, this.numVertices());
        }

        return mv;
    }

    numVertices(): number {
        return 0; // child class overrides
    }

}

//Stack particle positions into a cube shape, starting at the back left corner
function initializeParticles() {
    //How much we want the particles to be separated by
    let separationScale: number = 1.2;
    let spacing = particleRadius * 2 * separationScale;

    //How much we want the particles to shift around randomly
    let jitter = particleRadius * 0.2;

    //The width of the box minus some space on the edges
    let usableWidth = (boundingBoxSize * 2) - (spacing * 2);

    //Calculate how many particles we can have per edge using usable width
    let particlesPerEdge = Math.floor(usableWidth / spacing);

    //Safety check to avoid division by 0
    if (particlesPerEdge < 0) {
        particlesPerEdge = 1;
    }

    for (let i = 0; i < particleData.length; i++) {
        //Position index of particles in cube shape
        let xIndex = i % particlesPerEdge;
        let yIndex = Math.floor(i / particlesPerEdge) % particlesPerEdge;
        let zIndex = Math.floor(i / (particlesPerEdge * particlesPerEdge));

        //Start on left wall and build up from there
        let x = (-boundingBoxSize + particleRadius) + (xIndex * spacing);
        let y = (particleRadius + (yIndex * spacing)) + particleInitialHeight;
        let z = (-boundingBoxSize + particleRadius) + (zIndex * spacing);

        //Jitter the particles
        x += (Math.random() * jitter);
        y += (Math.random() * jitter);
        z += (Math.random() * jitter);

        //Move particles to starting points and clear velocity values
        particleData[i].xOffset = x;
        particleData[i].yOffset = y;
        particleData[i].zOffset = z;
        particleData[i].velocity = new vec4(0, 0, 0, 0);
    }
}

//Particle collision detection
function collisionDetection(particles: Particle[]) {
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            let p1 = particles[i];
            let p2 = particles[j];


            //Calculate distance between the center of each particle, vector from center of p1 to p2
            let dx = p2.xOffset - p1.xOffset;
            let dy = p2.yOffset - p1.yOffset;
            let dz = p2.zOffset - p1.zOffset;
            let distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            //Calculate the absolute closest particles can ever be to each other
            let minDistance = (p1.radius + p2.radius);

            //If the particles are too close to each other
            if (distance < minDistance) {
                // Particles are colliding, separate them
                let overlap = minDistance - distance;

                //Normalize the collision direction for each axis, divide each axis by magnitude
                let nx = dx / distance;
                let ny = dy / distance;
                let nz = dz / distance;

                //Calculate how much each sphere needs to separate from the other one
                //Then move the particles by that separation
                //First particle moves in negative direction by separation
                let separation = overlap / 2;
                p1.xOffset -= nx * separation;
                p1.yOffset -= ny * separation;
                p1.zOffset -= nz * separation;

                //Second particle moves in positive direction by separation
                p2.xOffset += nx * separation;
                p2.yOffset += ny * separation;
                p2.zOffset += nz * separation;

                //Calculate velocity of p2 relative to p1
                let rvx = p2.velocity[0] - p1.velocity[0];
                let rvy = p2.velocity[1] - p1.velocity[1];
                let rvz = p2.velocity[2] - p1.velocity[2];

                //Calculate the velocity along the collision normal vector
                //Tells you if the particles are moving towards or away from one another using the dot product
                //of the collision normal vector and the relative velocity of p2 from p1s perspective

                //Full relative velocity is only transferred from point 2 to point 1 if the collision normal vector and velocity vector are perfectly aligned
                //otherwise less momentum is transferred
                let velocityAlongCollisionNormal = rvx * nx + rvy * ny + rvz * nz;

                //We only need to create bounce if the particles are moving towards each other
                if (velocityAlongCollisionNormal < 0) {
                    // Bounce coefficient (restitution)
                    let restitution = 0.8;

                    //Impulse scalar, how much we should change the velocities to get correct bounce effect
                    //How fast the particles are approaching each other times how bouncy the collision should be split between 2 balls
                    //We add extra push if the collision is bouncy
                    //Since both spheres have same mass, the impulse is split evenly between them
                    let impulse = -(1 + restitution) * velocityAlongCollisionNormal / 2;

                    //Now we have to push the particles apart along the collision normal
                    //First particle
                    p1.velocity[0] -= nx * impulse;
                    p1.velocity[1] -= ny * impulse;
                    p1.velocity[2] -= nz * impulse;
                    //Second particle
                    p2.velocity[0] += nx * impulse;
                    p2.velocity[1] += ny * impulse;
                    p2.velocity[2] += nz * impulse;

                }
            }
        }
    }
}


//Pass in all particles and check if they are colliding with the car
function carCollisionDetection(particles: Particle[], car: Body) {
    //Box dimensions
    let boxWidth = 4;
    let boxHeight = 4;
    let boxLength = 6;

    //Half dimensions for model space calculations
    let boxHalfWidth = boxWidth / 2;
    let boxHalfHeight = boxHeight / 2;
    let boxHalfLength = boxLength / 2;

    //Rotation math
    let rotationAngleRadians = car.thetaY * (Math.PI / 180);
    let cos = Math.cos(rotationAngleRadians);
    let sin = Math.sin(rotationAngleRadians);

    for (let i = 0; i < particles.length; i++) {
        let p = particles[i];

        //Transform particles from world space to car model space by moving the origin to the center of the car
        //Find distance from center of car to particle
        let modelX = p.xOffset - car.xOffset;
        let modelY = p.yOffset - car.yOffset;
        let modelZ = p.zOffset - car.zOffset;

        //Instead of rotating the car boundary to match the car body rotation, use inverse rotation and rotate the particle
        // back to where it would be if the car did not rotate at all and stayed its initial orientation
        //Because webGL is right-handed, negative rotation is clockwise, so we need to use the positive 2d rotation matrix
        // for only x and z because we do not need to rotate the particle on the y-axis
        //Use positions in car model space where car is at the origin so it rotates particles perfectly around origin
        let localX = cos * modelX - sin * modelZ;
        let localY = modelY;
        let localZ = sin * modelX + cos * modelZ;

        //Check for collisions
        //Find the closest point on or inside the box to the center of the particle
        //If the particle is less than min, snaps to min, if it's more than max, snaps to max,
        // and if the particle is inside the cube, each axis snaps to the position of the particle
        let closestX = Math.max(-boxHalfWidth, Math.min(localX, boxHalfWidth));
        let closestY = Math.max(-boxHalfHeight, Math.min(localY, boxHalfHeight));
        let closestZ = Math.max(-boxHalfLength, Math.min(localZ, boxHalfLength));

        //Now calculate direction vector from the closest point on or in the box to the particle in local car space
        let dx = localX - closestX;
        let dy = localY - closestY;
        let dz = localZ - closestZ;
        let distanceSquared = dx * dx + dy * dy + dz * dz;

        //If the distance between the closest point on box and center of particle is less
        // than the particle's radius, we know a collision has occurred
        // Only do expensive square root calculation if we know there is collision
        if (distanceSquared < particleRadius * particleRadius) {
            let penetration = 0; //Needs to be global for particle inside case
            let distance = 0;

            //Collision has occurred
            if (distanceSquared > 0) {
                distance = Math.sqrt(distanceSquared);
            }
            //Special case for when the particle is inside the box
            if (distance === 0) {
                //Calculate the particle's distance to each side of the box in local space
                let distanceToMinX = Math.abs(localX - (-boxHalfWidth));
                let distanceToMaxX = Math.abs(localX - boxHalfWidth);
                let distanceToMinY = Math.abs(localY - (-boxHalfHeight));
                let distanceToMaxY = Math.abs(localY - boxHalfHeight);
                let distanceToMinZ = Math.abs(localZ - (-boxHalfLength));
                let distanceToMaxZ = Math.abs(localZ - boxHalfLength);

                //Find the face of the box that the particle is closest to
                let minDistance = Math.min(distanceToMinX, distanceToMaxX, distanceToMinY, distanceToMaxY, distanceToMinZ, distanceToMaxZ);

                switch (minDistance) {
                    //Which ever face its closest to, set the collision direction to match the perpendicular normal vector of that face
                    //And set the distance between the closest face and the particle
                    case distanceToMinX: {
                        dx = -1;
                        dy = 0;
                        dz = 0;
                    }
                        break;
                    case distanceToMaxX: {
                        dx = 1;
                        dy = 0;
                        dz = 0;
                    }
                        break;
                    case distanceToMinY: {
                        dx = 0;
                        dy = -1;
                        dz = 0;
                    }
                        break;
                    case distanceToMaxY: {
                        dx = 0;
                        dy = 1;
                        dz = 0;
                    }
                        break;
                    case distanceToMinZ: {
                        dx = 0;
                        dy = 0;
                        dz = -1;
                    }
                        break;
                    case distanceToMaxZ: {
                        dx = 0;
                        dy = 0;
                        dz = 1;
                    }
                        break;
                }
                //If the particle is inside
                penetration = minDistance + particleRadius;
            } else {
                //Normalize the collision direction vector for each axis, divide each axis by magnitude
                dx /= distance;
                dy /= distance;
                dz /= distance;

                //Calculate how much the particle has penetrated, knowing penetration is less than the radius
                penetration = particleRadius - distance;
            }

            //Change the collision direction vector from local space back to world space before moving the particles that are in world space
            //Since webGL positive rotation is counter-clockwise, use 2d negative rotation matrix for x and z axis
            let worldDx = cos * dx + sin * dz;
            let worldDy = dy;
            let worldDz = -sin * dx + cos * dz;

            //Move particles out of collision
            p.xOffset += worldDx * penetration;
            p.yOffset += worldDy * penetration;
            p.zOffset += worldDz * penetration;

            //Apply collision response to velocity
            //Calculate velocity along collision normal vector
            let velocityAlongNormal = (p.velocity[0] * worldDx + p.velocity[1] * worldDy + p.velocity[2] * worldDz);

            //Only stop velocity if velocity is moving in the direction of the car surface
            if (velocityAlongNormal < 0) {
                //Stop the velocity of the particle in the direction of the collision
                p.velocity[0] -= velocityAlongNormal * worldDx;
                p.velocity[1] -= velocityAlongNormal * worldDy;
                p.velocity[2] -= velocityAlongNormal * worldDz;
            }
        }
    }
}

//Wheel collision detection for cylinder tires
//Similar logic to carCollisionDetection
function wheelCollisionDetection(particles: Particle[], car: Body) {
    //Setup tire dimensions cylinder (built along x-axis and rotated)
    const wheelRadius = 1.0;
    const wheelWidth = 1.0;
    const wheelHalfWidth = wheelWidth / 2;

    //Wheel offsets in model car space
    const wheelOffsets = [
        {x: -2, z: -2.5}, //front left
        {x: 2, z: -2.5}, //front right
        {x: -2, z: 2.5}, //back left
        {x: 2, z: 2.5}  //back right
    ];

    //precalculate car rotation math
    const rotationAngleRadians = car.thetaY * (Math.PI / 180);
    const cos = Math.cos(rotationAngleRadians);
    const sin = Math.sin(rotationAngleRadians);

    //For all particles
    for (let i = 0; i < particles.length; i++) {
        let p = particles[i];
        //Test against each wheel
        for (let w = 0; w < wheelOffsets.length; w++) {
            let offset = wheelOffsets[w];

            //find wheel center in world space
            //rotate the wheel offsets according to car rotation and add car position to move from model to world space
            //uses negative rotation matrix as webgl is right-handed
            let wheelWorldX = car.xOffset + (cos * offset.x + sin * offset.z);
            let wheelWorldY = car.yOffset; // wheels are at same height as the car body
            let wheelWorldZ = car.zOffset + (-sin * offset.x + cos * offset.z);

            //transform particle to each wheel's model space
            ///get vector from wheel center to particle
            let dx = p.xOffset - wheelWorldX;
            let dy = p.yOffset - wheelWorldY;
            let dz = p.zOffset - wheelWorldZ;

            //rotate backwards to align with the un-rotated tire in model space
            //same logic as the car collision detection
            let localX = cos * dx - sin * dz;
            let localY = dy;
            let localZ = sin * dx + cos * dz;

            // Apply additional steering rotation for front wheels (wheels 0 and 1)
            if (w === 0 || w === 1) {
                // Get the steering angle for this wheel
                let wheelSteerAngle = (w === 0 ? wheel1.thetaY : wheel2.thetaY) - 90; // Offset from straight (rotated 90 degrees in object space)
                let steerRadians = wheelSteerAngle * (Math.PI / 180);
                let cosSteer = Math.cos(steerRadians);
                let sinSteer = Math.sin(steerRadians);

                // Apply steering rotation around Y-axis (in local wheel space)
                let tempX = localX;
                let tempZ = localZ;
                localX = cosSteer * tempX - sinSteer * tempZ;
                localZ = sinSteer * tempX + cosSteer * tempZ;
            }

            // Calculate distance from the axle (center of wheel) in yz plane
            let wheelCenterDistance = Math.sqrt(localY * localY + localZ * localZ);

            // Check bounding box first for speed
            if (Math.abs(localX) < (wheelHalfWidth + p.radius) && wheelCenterDistance < (wheelRadius + p.radius)) {
                //a collision has occurred
                //Determine if particle hit the tread or tire sidewall
                //push out of the closest surface
                let penetrationTread = (wheelRadius + p.radius) - wheelCenterDistance;
                let penetrationSidewall = (wheelHalfWidth + p.radius) - Math.abs(localX);

                //Initialize collision normals and penetration
                let collisionNormalX = 0;
                let collisionNormalY = 0;
                let collisionNormalZ = 0;
                let penetration = 0;

                //If the particle is deep inside the width, push out towards the tire tread
                //If the particle is deep inside the width of the tire but near the edge, push out towards the sidewall
                if (penetrationTread < penetrationSidewall) {
                    //Particle collision on the tread
                    if (wheelCenterDistance > 0.0001) {
                        collisionNormalY = localY / wheelCenterDistance;
                        collisionNormalZ = localZ / wheelCenterDistance;
                    } else {
                        //Push up if particle is exactly in the center of the width of the tire
                        collisionNormalY = 1;
                    }
                    penetration = penetrationTread;
                } else {
                    //Particle collision on the sidewall
                    collisionNormalX = Math.sign(localX); // +1 or -1
                    penetration = penetrationSidewall;
                }

                //Move collision normal to world space using the same negative rotation matrix (for right-handed WebGL)
                let worldCollisionNormalX = cos * collisionNormalX + sin * collisionNormalZ;
                let worldCollisionNormalY = collisionNormalY;
                let worldCollisionNormalZ = -sin * collisionNormalX + cos * collisionNormalZ;

                //Move the particles out exactly the same amount they were pushed in the opposite direction along collision normal
                p.xOffset += worldCollisionNormalX * penetration;
                p.yOffset += worldCollisionNormalY * penetration;
                p.zOffset += worldCollisionNormalZ * penetration;

                //Apply bounce along collision normal
                let velocityAlongCollisionNormal = p.velocity[0] * worldCollisionNormalX + p.velocity[1] * worldCollisionNormalY + p.velocity[2] * worldCollisionNormalZ;

                //Only bounce if particle is moving towards the wheel
                if (velocityAlongCollisionNormal < 0) {
                    p.velocity[0] -= velocityAlongCollisionNormal * worldCollisionNormalX;
                    p.velocity[1] -= velocityAlongCollisionNormal * worldCollisionNormalY;
                    p.velocity[2] -= velocityAlongCollisionNormal * worldCollisionNormalZ;
                }
            }
        }
    }
}

function fluidSimulation(particles: Particle[]) {
    let nextParticles = predictedParticlesStorage;
    let allNeighborLists = [];

    //Gravity constant
    let gravity = -60;

    //Step 1: Store the position of each particle at the next frame
    for (let i = 0; i < particles.length; i++) {

        //Apply gravity to velocity before any fluid dynamics
        //Adjust y velocity based on velocity of falling object equation
        particles[i].velocity[1] += gravity * secondsPerFrame;

        let nextX = particles[i].xOffset + particles[i].velocity[0] * secondsPerFrame;
        let nextY = particles[i].yOffset + particles[i].velocity[1] * secondsPerFrame;
        let nextZ = particles[i].zOffset + particles[i].velocity[2] * secondsPerFrame;
        //More efficient than calling new Particle() every frame, so we reuse the same malloc initialized globally for efficiency
        let nextParticle = predictedParticlesStorage[i];

        nextParticle.xOffset = nextX;
        nextParticle.yOffset = nextY;
        nextParticle.zOffset = nextZ;
        nextParticle.velocity = particles[i].velocity;

    }

    //Step 2: Find the neighbors to each predicted particle position, including self, using spacial hashing

    //First, populate the spatial hashing grid with each particle
    let grid: Map<number, number[]> = new Map();
    for (let i = 0; i < nextParticles.length; i++) {
        //Get the grid space of the current particle
        let key = getGridSpace(nextParticles[i].xOffset, nextParticles[i].yOffset, nextParticles[i].zOffset);

        //If the next particle moved to a new grid space not yet accessed, add it with no particles yet
        if (!grid.has(key)) {
            grid.set(key, []);
        }

        //Now push the index of the particle to its current spacial hashing grid cell
        grid.get(key)!.push(i);
    }

    //Set neighbors of each particle by checking the surrounding 3x3 grid cells for particles
    for (let i = 0; i < nextParticles.length; i++) {
        let neighborList: number[] = []; // Reset for each particle
        let cellSize = influenceRadius;
        let p1 = nextParticles[i];
        let cellX = Math.floor(p1.xOffset / cellSize);
        let cellY = Math.floor(p1.yOffset / cellSize);
        let cellZ = Math.floor(p1.zOffset / cellSize);
        //3x3 Grid surround current particle grid cell
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -1; z <= 1; z++) {
                    //For this cell
                    let gridX = cellX + x;
                    let gridY = cellY + y;
                    let gridZ = cellZ + z;
                    let key = ((gridX * prime1) ^ (gridY * prime2) ^ (gridZ * prime3)) & 0x7FFFFFFF;

                    //Get all particle indices in that cell
                    let cellParticles = grid.get(key);
                    //If there is any particles in that cell
                    if (cellParticles && cellParticles.length > 0) {
                        //Check each particle p2's distance to p1
                        for (let k = 0; k < cellParticles.length; k++) {
                            //j is the index of the current particle in this cell
                            let j = cellParticles[k];
                            let p2 = nextParticles[j];
                            //Find distance from p2 to p1
                            let dx = p2.xOffset - p1.xOffset;
                            let dy = p2.yOffset - p1.yOffset;
                            let dz = p2.zOffset - p1.zOffset;

                            let distanceSq = dx * dx + dy * dy + dz * dz;

                            //If the particles are influencing each other, add p2 to p1's neighbor list
                            if (distanceSq < influenceRadius * influenceRadius) {
                                neighborList.push(j);
                            }
                        }
                    }
                }
            }
        }
        //After all of p1's neighbors have been stored, store p1's neighbor list in the set of all neighbor lists
        allNeighborLists.push(neighborList);
    }

    //Repeat steps 3-5 for as many solver iterations as there are: The greater the number of solver iterations,
    // the more accurate the simulation, but the lower the performance
    let solverIterations = 20;
    for (let i = 0; i < solverIterations; i++) {

        //Step 3: Calculate and store the lambda correction value for each particle
        let lambdas = [];
        for (let i = 0; i < nextParticles.length; i++) {
            //Calculate current density of each particle
            let currentDensity = 0; //Reset density for each particle
            //Sum the smooth kernal values of all neighboring particles
            for (let j = 0; j < allNeighborLists[i].length; j++) {
                let p1 = nextParticles[i];
                let p2 = nextParticles[allNeighborLists[i][j]];

                //OPTIMIZATION: Removed new vec4 call
                let dx = p1.xOffset - p2.xOffset;
                let dy = p1.yOffset - p2.yOffset;
                let dz = p1.zOffset - p2.zOffset;
                let rSquared = dx * dx + dy * dy + dz * dz;
                currentDensity += smoothKernelOptimized(rSquared);
            }
            //Calculate density constraint
            //Target is 0 for density constraint because that is when density is at rest
            let densityConstraint = (currentDensity / restDensity) - 1;

            //Store particle density constraint for particle color
            particleDensityConstraints[i] = densityConstraint;

            //Calculate gradients for the denominator of the lambda calculation
            let gradientSum = 0;

            //Case 1 for gradient of the density constraint function: k = i
            //Gradient with respect to particle i, contributes one gradient vector to lambda denominator
            // that sums the contributions from all neighbors
            //Answers the question, if particle i moves to its next position, how do all the neighbor contributions change?
            //Sum the contributions from all neighbors and get the total gradient of density around i
            //OPTIMIZATION: Removed new vec4 call
            let gradientIx = 0, gradientIy = 0, gradientIz = 0;

            for (let j = 0; j < allNeighborLists[i].length; j++) {
                if (i === j) continue; //Skip self in gradient calculation
                let p1 = nextParticles[i];
                let p2 = nextParticles[allNeighborLists[i][j]];
                let dx = p1.xOffset - p2.xOffset;
                let dy = p1.yOffset - p2.yOffset;
                let dz = p1.zOffset - p2.zOffset;
                let rSquared = dx * dx + dy * dy + dz * dz;

                // We need Sqrt for Spiky Gradient, but only calculate if within range
                if (rSquared > 0.000001 && rSquared < h2) {
                    let r = Math.sqrt(rSquared);

                    //Returns x y z of current particle gradient vector
                    let currentParticleGradient = spikyKernelGradientOptimized(dx, dy, dz, r);

                    //Add to gradient i (self)
                    gradientIx += currentParticleGradient.x / restDensity;
                    gradientIy += currentParticleGradient.y / restDensity;
                    gradientIz += currentParticleGradient.z / restDensity;

                    //Case 2: k = j
                    //Answers: If a neighbor particle j moves, how does its influence on particle i change?
                    //Gives a different gradient density for each neighbor j, telling you how it is pulled or pushed away from particle i
                    //We use each case 2 gradient density magnitude and add it to the total gradient sum for the lambda denominator
                    //Gradient j is just negative gradient i / rest density
                    let gradientJx = -(currentParticleGradient.x / restDensity);
                    let gradientJy = -(currentParticleGradient.y / restDensity);
                    let gradientJz = -(currentParticleGradient.z / restDensity);

                    gradientSum += (gradientJx * gradientJx + gradientJy * gradientJy + gradientJz * gradientJz);
                }
            }

            //Get the magnitude for i and square it, add that to the gradient sum for lambda denominator
            gradientSum += (gradientIx * gradientIx + gradientIy * gradientIy + gradientIz * gradientIz);

            //Lambda is how much density constraint has been violated and thus how much we need to correct it
            //Relaxation parameter allows user to relax how much each particle needs to correct
            let lambda = -densityConstraint / (gradientSum + relaxationParameter);
            lambdas.push(lambda);
        }

        //Step 4: Calculate change in each particle position (delta p)
        //OPTIMIZATION: Use float 32 array to store delta positions to avoid vec4
        for (let i = 0; i < nextParticles.length; i++) {
            let p1 = nextParticles[i];
            let deltaPx = 0, deltaPy = 0, deltaPz = 0;

            for (let j = 0; j < allNeighborLists[i].length; j++) {
                let p2 = nextParticles[allNeighborLists[i][j]];

                let dx = p1.xOffset - p2.xOffset;
                let dy = p1.yOffset - p2.yOffset;
                let dz = p1.zOffset - p2.zOffset;
                let rSquared = dx * dx + dy * dy + dz * dz;

                if (rSquared > 0.000001 && rSquared < h2) {
                    let r = Math.sqrt(rSquared);
                    let gradient = spikyKernelGradientOptimized(dx, dy, dz, r);

                    let artificialPressure = calculateArtificialPressureOptimized(rSquared);

                    let correctionPressureSum = lambdas[i] + lambdas[j] + artificialPressure;

                    deltaPx += (correctionPressureSum * gradient.x) / restDensity;
                    deltaPy += (correctionPressureSum * gradient.y) / restDensity;
                    deltaPz += (correctionPressureSum * gradient.z) / restDensity;
                }
            }
            //Store directly in flat array
            deltaParticlePositions[i * 3] = deltaPx;
            deltaParticlePositions[i * 3 + 1] = deltaPy;
            deltaParticlePositions[i * 3 + 2] = deltaPz;
        }
        //Step 5: Adjust particle positions based on delta p
        for (let i = 0; i < nextParticles.length; i++) {
            nextParticles[i].xOffset += deltaParticlePositions[i * 3];
            nextParticles[i].yOffset += deltaParticlePositions[i * 3 + 1];
            nextParticles[i].zOffset += deltaParticlePositions[i * 3 + 2];
        }

        //Add collision detection for cars and barriers
        carCollisionDetection(nextParticles, body1);
        wheelCollisionDetection(nextParticles, body1);
    } // End of solver iteration refinement

    //Step 6: Adjust the velocity of each particle based on its new position
    //OPTIMIZATION: Removed vec4, directly accessed memory positions instead
    for (let i = 0; i < nextParticles.length; i++) {
        //Set a variable to the direct memory location of both the next and the current particle
        let pNext = nextParticles[i];
        let pCurrent = particles[i];

        //Calculate how much the particle has changed its position from the last frame for each axis
        let changeInPositionX = pNext.xOffset - pCurrent.xOffset;
        let changeInPositionY = pNext.yOffset - pCurrent.yOffset;
        let changeInPositionZ = pNext.zOffset - pCurrent.zOffset;

        //Divide by the change in time to get the new velocity for each axis
        pCurrent.velocity[0] = changeInPositionX / secondsPerFrame;
        pCurrent.velocity[1] = changeInPositionY / secondsPerFrame;
        pCurrent.velocity[2] = changeInPositionZ / secondsPerFrame;

        //TODO Step 7: Apply vorticity and viscosity

        //Apply the new positions to each particle
        pCurrent.xOffset = pNext.xOffset;
        pCurrent.yOffset = pNext.yOffset;
        pCurrent.zOffset = pNext.zOffset;
    }
    //Move pixels out of the barrier back into the barrier
    enforceBarriers(particles);
}


//Set constants globally to save CPU overhead
//Pi and influence radius constants
let pi: number;
let h: number;
let h2: number;
let smoothConstant: number;
let spikyConstant: number;
let wDeltaQ: number;

//Artificial pressure constants
let k_pressure: number;

// Optimization avoided using math pow(n), no need for n pressure variable
// let n_pressure: number;
let deltaQ: number;
let deltaQ2: number;

// Denominator for artificial pressure constant
// Smooth Kernel value at distance DeltaQ
let diffDQ: number;

//Function to reset constants every single time the user changes a slider bar
function resetConstants() {
    pi = Math.PI;
    h = influenceRadius;
    h2 = h * h;
    smoothConstant = 315 / (64 * pi * Math.pow(influenceRadius, 9));
    spikyConstant = -45 / (pi * Math.pow(influenceRadius, 6));
    k_pressure = 0.1;
    deltaQ = 0.3 * h;
    deltaQ2 = deltaQ * deltaQ;
    diffDQ = h2 - deltaQ2;
    wDeltaQ = smoothConstant * (diffDQ * diffDQ * diffDQ)
}

//Calculate the amount of density influence two particles have on each other
//Takes in influence distanced squared (r2) and influence radius squared (h2)
function smoothKernelOptimized(r2: number) {
    //particles are too close to each other, calculate influence
    if (r2 >= 0 && r2 <= h2) {
        let diff = h2 - r2;
        return smoothConstant * (diff * diff * diff);
    } else {
        return 0;
    }
}

//Calculate direction to push particles when target density is violated
function spikyKernelGradientOptimized(dx: number, dy: number, dz: number, r: number) {
    //The distance between the particles calculated from the distance vector
    //Handle edge cases, too far away or too close, avoid division by zero
    if (r <= h && r > 0) {
        let hMinusR = h - r;
        //particles are too close to each other, calculate push back vector
        let scalar = spikyConstant * (hMinusR * hMinusR) / r;

        //Return the push vector components directly
        return {x: dx * scalar, y: dy * scalar, z: dz * scalar};
    } else {
        return {x: 0, y: 0, z: 0};
    }
}

//Calculate artificial pressure to prevent particles from clumping when they only have a few neighbors which creates negative pressure
function calculateArtificialPressureOptimized(r2: number) {
    //If particles are too far apart, then the artificial pressure is zero
    if (r2 >= h2) {
        return 0;
    }
    //Calculate density at distance W(r) smoothKernal(r)
    let diff = h2 - r2;
    let wR = smoothConstant * (diff * diff * diff);

    //Calculate ratio of W(r) / W(dq) using precalculated wDeltaQ constant
    let ratio = wR / wDeltaQ;

    //Instead of doing a math power we can just square ratio twice since n_pressure = 4
    let ratio2 = ratio * ratio;
    let ratio4 = ratio2 * ratio2;

    //Return artificial pressure
    return -k_pressure * ratio4;
}


function enforceBarriers(particles: Particle[]) {
    for (let i = 0; i < particles.length; i++) {
        //Bounding box to contain fluids

        // Ground Barrier
        if (particles[i].yOffset <= particles[i].radius) {
            particles[i].yOffset = particles[i].radius;

            //Only stop particles from going down more, allow upward velocity
            //Otherwise all the particles get stuck to the ground
            if (particles[i].velocity[1] < 0) {
                particles[i].velocity[1] = 0;
            }
        }

        // Positive Y Barrier (hard set to 15)
        if (particles[i].yOffset >= 50 - particles[i].radius) {
            particles[i].yOffset = 50 - particles[i].radius;
            //Prevent velocity going in the same direction as the barrier
            if (particles[i].velocity[1] > 0) {
                particles[i].velocity[1] = 0;
            }
        }

        // Positive X Barrier
        if (particles[i].xOffset >= boundingBoxSize - particles[i].radius) {
            particles[i].xOffset = boundingBoxSize - particles[i].radius;
            //Prevent velocity going in the same direction as the barrier
            if (particles[i].velocity[0] > 0) {
                particles[i].velocity[0] = 0;
            }
        }

        // Negative X Barrier
        if (particles[i].xOffset <= particles[i].radius - boundingBoxSize) {
            particles[i].xOffset = particles[i].radius - boundingBoxSize;
            //Prevent velocity going in the same direction as the barrier
            if (particles[i].velocity[0] < 0) {
                particles[i].velocity[0] = 0;
            }
        }

        // Positive Z Barrier
        if (particles[i].zOffset >= boundingBoxSize - particles[i].radius) {
            particles[i].zOffset = boundingBoxSize - particles[i].radius;
            //Prevent velocity going in the same direction as the barrier
            if (particles[i].velocity[2] > 0) {
                particles[i].velocity[2] = 0;
            }
        }

        // Negative Z barrier
        if (particles[i].zOffset <= particles[i].radius - boundingBoxSize) {
            particles[i].zOffset = particles[i].radius - boundingBoxSize;
            //Prevent velocity going in the same direction as the barrier
            if (particles[i].velocity[2] < 0) {
                particles[i].velocity[2] = 0;
            }
        }
    }
}

//Use prime numbers to reduce hashing collisions
let prime1 = 10000019;
let prime2 = 73856093;
let prime3 = 83492791;

//Calculate which grid space a particle is in
function getGridSpace(pX: number, pY: number, pZ: number) {
    //Gets the specific grid cell for each axis
    let gridX = Math.floor(pX / influenceRadius);
    let gridY = Math.floor(pY / influenceRadius);
    let gridZ = Math.floor(pZ / influenceRadius);

    //OPTIMIZATION: Use hashing to get an int instead of a string
    //Return in XOR hash form to be used as a key
    //Use & 0x7FFFFFFF to ensure the result is always a positive int
    return ((gridX * prime1) ^ (gridY * prime2) ^ (gridZ * prime3)) & 0x7FFFFFFF;
}

class Particle {
    xOffset: number = 0;
    yOffset: number = particleInitialHeight;
    zOffset: number = 0;
    velocity: vec4 = new vec4(0, 0, 0, 0);
    radius: number = particleRadius;
}

// class for green grass ground that car drives on
class Ground extends RenderObject {
    private vertices: vec4[] = [];

    initBuffer(gl: WebGL2RenderingContext) {
        //Build the ground vertices and color
        this.vertices = this.makeObjectVertices();
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
    private makeObjectVertices(): vec4[] {
        let points: vec4[] = [];

        //green grass ground
        points.push(new vec4(250.0, -1.0, -250.0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //Facing towards positive y direction
        points.push(new vec4(250.0, -1.0, 250.0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //Facing towards positive y direction
        points.push(new vec4(-250.0, -1.0, 250.0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //Facing towards positive y direction
        points.push(new vec4(-250.0, -1.0, 250.0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //Facing towards positive y direction
        points.push(new vec4(-250.0, -1.0, -250.0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //Facing towards positive y direction
        points.push(new vec4(250.0, -1.0, -250.0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //Facing towards positive y direction


        return points;
    }
}

// class for the Torso of the driver
class Torso extends RenderObject {
    private vertices: vec4[] = [];

    initBuffer(gl: WebGL2RenderingContext) {
        //Build the ground vertices and color
        this.vertices = this.makeObjectVertices();
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
    private makeObjectVertices(): vec4[] {
        let points: vec4[] = [];

        //backward face
        points.push(new vec4(0.5, -1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //Facing in the positive z direction
        points.push(new vec4(0.5, 1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //Facing in the positive z direction
        points.push(new vec4(-0.5, 1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //Facing in the positive z direction
        points.push(new vec4(-0.5, 1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //Facing in the positive z direction
        points.push(new vec4(-0.5, -1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //Facing in the positive z direction
        points.push(new vec4(0.5, -1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //Facing in the positive z direction

        //forward face
        points.push(new vec4(-0.5, -1.0, -0.5, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //Facing in the negative z direction
        points.push(new vec4(-0.5, 1.0, -0.5, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //Facing in the negative z direction
        points.push(new vec4(0.5, 1.0, -0.5, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //Facing in the negative z direction
        points.push(new vec4(0.5, 1.0, -0.5, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //Facing in the negative z direction
        points.push(new vec4(0.5, -1.0, -0.5, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //Facing in the negative z direction
        points.push(new vec4(-0.5, -1.0, -0.5, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //Facing in the negative z direction

        //right face
        points.push(new vec4(0.5, 1.0, 0.5, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //Facing in the negative x direction
        points.push(new vec4(0.5, -1.0, 0.5, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //Facing in the negative x direction
        points.push(new vec4(0.5, -1.0, -0.5, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //Facing in the negative x direction
        points.push(new vec4(0.5, -1.0, -0.5, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //Facing in the negative x direction
        points.push(new vec4(0.5, 1.0, -0.5, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //Facing in the negative x direction
        points.push(new vec4(0.5, 1.0, 0.5, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //Facing in the negative x direction

        //left face
        points.push(new vec4(-0.5, 1.0, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //Facing in the positive x direction
        points.push(new vec4(-0.5, -1.0, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //Facing in the positive x direction
        points.push(new vec4(-0.5, -1.0, 0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //Facing in the positive x direction
        points.push(new vec4(-0.5, -1.0, 0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //Facing in the positive x direction
        points.push(new vec4(-0.5, 1.0, 0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //Facing in the positive x direction
        points.push(new vec4(-0.5, 1.0, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //Facing in the positive x direction

        //top face
        points.push(new vec4(0.5, 1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //Facing in the positive y direction
        points.push(new vec4(0.5, 1.0, -0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //Facing in the positive y direction
        points.push(new vec4(-0.5, 1.0, -0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //Facing in the positive y direction
        points.push(new vec4(-0.5, 1.0, -0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //Facing in the positive y direction
        points.push(new vec4(-0.5, 1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //Facing in the positive y direction
        points.push(new vec4(0.5, 1.0, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //Facing in the positive y direction

        //bottom
        points.push(new vec4(0.5, -1.0, -0.5, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //Facing in the negative y direction
        points.push(new vec4(0.5, -1.0, 0.5, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //Facing in the negative y direction
        points.push(new vec4(-0.5, -1.0, 0.5, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //Facing in the negative y direction
        points.push(new vec4(-0.5, -1.0, 0.5, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //Facing in the negative y direction
        points.push(new vec4(-0.5, -1.0, -0.5, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //Facing in the negative y direction
        points.push(new vec4(0.5, -1.0, -0.5, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //Facing in the negative y direction

        return points;

    }
}

// class for the head of the driver
class Cube extends RenderObject {
    private vertices: vec4[] = [];

    initBuffer(gl: WebGL2RenderingContext) {
        //Build the ground vertices and color
        this.vertices = this.makeObjectVertices();
        //Send data to gpu
        this.bufferId = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferId);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.vertices), gl.STATIC_DRAW);
    }

    // Return number of vertices to parent class
    numVertices() {
        return this.vertices.length / 2;
    }

    // returns all the points for the cube
    private makeObjectVertices(): vec4[] {
        let points: vec4[] = [];

        //back of face
        points.push(new vec4(0.5, -0.5, 0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //positive z
        points.push(new vec4(0.5, 0.5, 0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //positive z
        points.push(new vec4(-0.5, 0.5, 0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //positive z
        points.push(new vec4(-0.5, 0.5, 0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //positive z
        points.push(new vec4(-0.5, -0.5, 0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //positive z
        points.push(new vec4(0.5, -0.5, 0.5, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //positive z

        //front of face
        points.push(new vec4(-0.5, -0.5, -0.5, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z
        points.push(new vec4(-0.5, 0.5, -0.5, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z
        points.push(new vec4(0.5, 0.5, -0.5, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z
        points.push(new vec4(0.5, 0.5, -0.5, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z
        points.push(new vec4(0.5, -0.5, -0.5, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z
        points.push(new vec4(-0.5, -0.5, -0.5, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z

        //right face
        points.push(new vec4(0.5, 0.5, 0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x
        points.push(new vec4(0.5, -0.5, 0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x
        points.push(new vec4(0.5, -0.5, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x
        points.push(new vec4(0.5, -0.5, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x
        points.push(new vec4(0.5, 0.5, -0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x
        points.push(new vec4(0.5, 0.5, 0.5, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x

        //left face
        points.push(new vec4(-0.5, 0.5, -0.5, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x
        points.push(new vec4(-0.5, -0.5, -0.5, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x
        points.push(new vec4(-0.5, -0.5, 0.5, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x
        points.push(new vec4(-0.5, -0.5, 0.5, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x
        points.push(new vec4(-0.5, 0.5, 0.5, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x
        points.push(new vec4(-0.5, 0.5, -0.5, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x

        //top face
        points.push(new vec4(0.5, 0.5, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //positive y
        points.push(new vec4(0.5, 0.5, -0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //positive y
        points.push(new vec4(-0.5, 0.5, -0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //positive y
        points.push(new vec4(-0.5, 0.5, -0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //positive y
        points.push(new vec4(-0.5, 0.5, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //positive y
        points.push(new vec4(0.5, 0.5, 0.5, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //positive y

        //bottom face
        points.push(new vec4(0.5, -0.5, -0.5, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //negative y
        points.push(new vec4(0.5, -0.5, 0.5, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //negative y
        points.push(new vec4(-0.5, -0.5, 0.5, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //negative y
        points.push(new vec4(-0.5, -0.5, 0.5, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //negative y
        points.push(new vec4(-0.5, -0.5, -0.5, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //negative y
        points.push(new vec4(0.5, -0.5, -0.5, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //negative y

        //left eye (triangle)
        points.push(new vec4(-0.3, 0.075, -0.51, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z
        points.push(new vec4(-0.15, 0.25, -0.51, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z
        points.push(new vec4(-0.05, 0.075, -0.51, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z

        //right eye (triangle)
        points.push(new vec4(0.05, 0.075, -0.51, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z
        points.push(new vec4(0.15, 0.25, -0.51, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z
        points.push(new vec4(0.3, 0.075, -0.51, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z

        return points;

    }
}

// Car body class
class Body extends RenderObject {
    private vertices: vec4[] = [];

    initBuffer(gl: WebGL2RenderingContext) {
        //Build the body vertices and color
        this.vertices = this.makeObjectVertices();
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
    private makeObjectVertices(): vec4[] {
        let points: vec4[] = [];
        //rear face
        points.push(new vec4(2.0, 0.0, 3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //positive z
        points.push(new vec4(2.0, 2.0, 3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //positive z
        points.push(new vec4(-2.0, 2.0, 3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //positive z
        points.push(new vec4(-2.0, 2.0, 3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //positive z
        points.push(new vec4(-2.0, 0.0, 3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //positive z
        points.push(new vec4(2.0, 0.0, 3.0, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //positive z

        //front face
        points.push(new vec4(-2.0, 0.0, -3.0, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z
        points.push(new vec4(-2.0, 2.0, -3.0, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z
        points.push(new vec4(2.0, 2.0, -3.0, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z
        points.push(new vec4(2.0, 2.0, -3.0, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z
        points.push(new vec4(2.0, 0.0, -3.0, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z
        points.push(new vec4(-2.0, 0.0, -3.0, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z

        //right face
        points.push(new vec4(2.0, 2.0, 3.0, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x
        points.push(new vec4(2.0, 0.0, 3.0, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x
        points.push(new vec4(2.0, 0.0, -3.0, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x
        points.push(new vec4(2.0, 0.0, -3.0, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x
        points.push(new vec4(2.0, 2.0, -3.0, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x
        points.push(new vec4(2.0, 2.0, 3.0, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x

        //left face
        points.push(new vec4(-2.0, 2.0, -3.0, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x
        points.push(new vec4(-2.0, 0.0, -3.0, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x
        points.push(new vec4(-2.0, 0.0, 3.0, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x
        points.push(new vec4(-2.0, 0.0, 3.0, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x
        points.push(new vec4(-2.0, 2.0, 3.0, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x
        points.push(new vec4(-2.0, 2.0, -3.0, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x

        //top face
        points.push(new vec4(2.0, 2.0, 3.0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //positive y
        points.push(new vec4(2.0, 2.0, -3.0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //positive y
        points.push(new vec4(-2.0, 2.0, -3.0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //positive y
        points.push(new vec4(-2.0, 2.0, -3.0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //positive y
        points.push(new vec4(-2.0, 2.0, 3.0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //positive y
        points.push(new vec4(2.0, 2.0, 3.0, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //positive y

        //bottom face
        points.push(new vec4(2.0, 0.0, -3.0, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //negative y
        points.push(new vec4(2.0, 0.0, 3.0, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //negative y
        points.push(new vec4(-2.0, 0.0, 3.0, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //negative y
        points.push(new vec4(-2.0, 0.0, 3.0, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //negative y
        points.push(new vec4(-2.0, 0.0, -3.0, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //negative y
        points.push(new vec4(2.0, 0.0, -3.0, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //negative y

        return points;
    }

}

// class for sphere object reference points
class Sphere extends RenderObject {
    private vertices: vec4[] = [];

    initBuffer(gl: WebGL2RenderingContext) {
        //Build the ground vertices and color
        this.vertices = this.makeObjectVertices();
        //Send data to gpu
        this.bufferId = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferId);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.vertices), gl.STATIC_DRAW);
    }

    // Return number of vertices to parent class
    numVertices() {
        return this.vertices.length / 2;
    }

    // returns all the points for the sphere
    private makeObjectVertices(): vec4[] {
        let step: number = (360.0 / circleSlices) * (Math.PI / 180.0);
        let sphereverts: vec4[] = []
        for (let lat: number = 0; lat <= Math.PI; lat += step) { //latitude
            for (let lon: number = 0; lon + step <= 2 * Math.PI; lon += step) { //longitude
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
        return sphereverts;
    }
}


// class for car wheel
class Wheel extends RenderObject {
    private vertices: vec4[] = [];

    initBuffer(gl: WebGL2RenderingContext) {
        //Build the wheel vertices and color
        this.vertices = this.makeObjectVertices();
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
    private makeObjectVertices(): vec4[] {
        let points: vec4[] = [];
        let numSides: number = 32;
        let radius = 1.0

        //Build the tire right sidewall circle
        for (let i = 0; i < numSides; i++) {
            let angle1 = (i / numSides) * 2 * Math.PI;
            let angle2 = ((i + 1) / numSides) * 2 * Math.PI;
            let z = 0.5;

            // center of circle
            points.push(new vec4(0.0, 0.0, z, 1.0));
            points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x

            // edge point 1
            points.push(new vec4(radius * Math.cos(angle1), radius * Math.sin(angle1), z, 1.0));
            points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x

            // edge point 2
            points.push(new vec4(radius * Math.cos(angle2), radius * Math.sin(angle2), z, 1.0));
            points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x
        }
        //Build the tire left sidewall circle
        for (let i = 0; i < numSides; i++) {
            let angle1 = (i / numSides) * 2 * Math.PI;
            let angle2 = ((i + 1) / numSides) * 2 * Math.PI;
            let z = -0.5;

            // center of sidewall circle
            points.push(new vec4(0.0, 0.0, z, 1.0));
            points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x

            // edge point 1
            points.push(new vec4(radius * Math.cos(angle1), radius * Math.sin(angle1), z, 1.0));
            points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x

            // edge point 2
            points.push(new vec4(radius * Math.cos(angle2), radius * Math.sin(angle2), z, 1.0));
            points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x
        }
        //Build the tire tread
        for (let i = 0; i < numSides; i++) {
            let angleStep = (2 * Math.PI) / numSides;
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

            //Vector from the first point to the second point on a circle
            let vectorOnCircumference = [x2 - x1, y2 - y1, 0];

            //Vector from the center of the left circle to the center of the right circle
            let vectorFromLeftToRightCircle = [0, 0, rightCircleCenterZ - leftCircleCenterZ];

            // Cross product to get the outward-facing vector, works for both triangles with the base on either side
            // Outward facing vector still goes in the same direction
            let outwardVector = [
                vectorOnCircumference[1] * vectorFromLeftToRightCircle[2] - vectorOnCircumference[2] * vectorFromLeftToRightCircle[1],  // i component
                vectorOnCircumference[2] * vectorFromLeftToRightCircle[0] - vectorOnCircumference[0] * vectorFromLeftToRightCircle[2],  // j component
                vectorOnCircumference[0] * vectorFromLeftToRightCircle[1] - vectorOnCircumference[1] * vectorFromLeftToRightCircle[0]   // k component
            ];

            // Normalize the outward vector
            let length = Math.sqrt(outwardVector[0] * outwardVector[0] + outwardVector[1] * outwardVector[1] + outwardVector[2] * outwardVector[2]);
            outwardVector = [outwardVector[0] / length, outwardVector[1] / length, outwardVector[2] / length];

            // Put it into a vec 4
            let normalVector = new vec4(outwardVector[0], outwardVector[1], outwardVector[2], 0);
            points.push(new vec4(x1, y1, leftCircleCenterZ, 1.0));
            points.push(normalVector);
            points.push(new vec4(x2, y2, leftCircleCenterZ, 1.0));
            points.push(normalVector);
            points.push(new vec4(x1, y1, rightCircleCenterZ, 1.0));
            points.push(normalVector);
            //Connects the two points from the circumference of the right circle
            // to the second point on the circumference of the left circle
            // Second triangle completing one of 32 tread rectangles around the
            // two tire sidewall circles to create a tire
            points.push(new vec4(x1, y1, rightCircleCenterZ, 1.0));
            points.push(normalVector);
            points.push(new vec4(x2, y2, rightCircleCenterZ, 1.0));
            points.push(normalVector);
            points.push(new vec4(x2, y2, leftCircleCenterZ, 1.0));
            points.push(normalVector);

        }
        return points;
    }
}

// class for car headlights
class Headlight extends RenderObject {
    private vertices: vec4[] = [];

    initBuffer(gl: WebGL2RenderingContext) {
        this.vertices = this.makeObjectVertices();
        this.bufferId = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferId);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.vertices), gl.STATIC_DRAW);
    }

    numVertices() {
        return this.vertices.length / 2;
    }

    private makeObjectVertices(): vec4[] {
        let points: vec4[] = [];

        // Headlight dimensions - flat rectangular box
        // Width: 0.6, Height: 0.4, Depth: 0.1
        let w = 0.3;  // half-width
        let h = 0.2;  // half-height
        let d = 0.05; // half-depth (thin)

        // Front face (the light-emitting face)
        points.push(new vec4(-w, -h, -d, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z
        points.push(new vec4(-w, h, -d, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z
        points.push(new vec4(w, h, -d, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z
        points.push(new vec4(w, h, -d, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z
        points.push(new vec4(w, -h, -d, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z
        points.push(new vec4(-w, -h, -d, 1.0));
        points.push(new vec4(0.0, 0.0, -1.0, 0.0)); //negative z

        // Back face
        points.push(new vec4(w, -h, d, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //positive z
        points.push(new vec4(w, h, d, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //positive z
        points.push(new vec4(-w, h, d, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //positive z
        points.push(new vec4(-w, h, d, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //positive z
        points.push(new vec4(-w, -h, d, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //positive z
        points.push(new vec4(w, -h, d, 1.0));
        points.push(new vec4(0.0, 0.0, 1.0, 0.0)); //positive z

        // Right face
        points.push(new vec4(w, h, -d, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x
        points.push(new vec4(w, -h, -d, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x
        points.push(new vec4(w, -h, d, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x
        points.push(new vec4(w, -h, d, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x
        points.push(new vec4(w, h, d, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x
        points.push(new vec4(w, h, -d, 1.0));
        points.push(new vec4(1.0, 0.0, 0.0, 0.0)); //positive x

        // Left face
        points.push(new vec4(-w, h, d, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x
        points.push(new vec4(-w, -h, d, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x
        points.push(new vec4(-w, -h, -d, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x
        points.push(new vec4(-w, -h, -d, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x
        points.push(new vec4(-w, h, -d, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x
        points.push(new vec4(-w, h, d, 1.0));
        points.push(new vec4(-1.0, 0.0, 0.0, 0.0)); //negative x

        // Top face
        points.push(new vec4(w, h, -d, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //positive y
        points.push(new vec4(w, h, d, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //positive y
        points.push(new vec4(-w, h, d, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //positive y
        points.push(new vec4(-w, h, d, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //positive y
        points.push(new vec4(-w, h, -d, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //positive y
        points.push(new vec4(w, h, -d, 1.0));
        points.push(new vec4(0.0, 1.0, 0.0, 0.0)); //positive y

        // Bottom face
        points.push(new vec4(w, -h, d, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //negative y
        points.push(new vec4(w, -h, -d, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //negative y
        points.push(new vec4(-w, -h, -d, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //negative y
        points.push(new vec4(-w, -h, -d, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //negative y
        points.push(new vec4(-w, -h, d, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //negative y
        points.push(new vec4(w, -h, d, 1.0));
        points.push(new vec4(0.0, -1.0, 0.0, 0.0)); //negative y
        return points;
    }
}

//helper function to save the current state of the camera
function saveCameraState() {
    cameraStateArray[0] = fov;
    cameraStateArray[1] = cameraXOffset;
    cameraStateArray[2] = cameraYOffset;
    cameraStateArray[3] = cameraZOffset;
    cameraStateArray[4] = cameraLookingAtXOffset;
    cameraStateArray[5] = cameraLookingAtYOffset;
    cameraStateArray[6] = cameraLookingAtZOffset;
}

//helper function to restore the state of the camera back to the saved state
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

//Create objects for head
let head1 = new Sphere();
let leftEye = new Sphere();
let rightEye = new Sphere();

//Create objects for car
let wheel1 = new Wheel();
let wheel2 = new Wheel();
let wheel3 = new Wheel();
let wheel4 = new Wheel();
let headlight1 = new Headlight();
let headlight2 = new Headlight();
let emergencyLight = new Cube();

//Store all spheres in an array
let spheres: Sphere[] = [];
let sphereCount = 20;


//Global variable for number of sphere slices to differentiate between particles and environment spheres
let circleSlices:number;

//Create spheres and Randomize colors
for (let i = 0; i < sphereCount; i++) {
    circleSlices=100; //Higher for detailed environment spheres
    spheres.push(new Sphere());
    sphereColors.push(new vec4(Math.random() * .7, Math.random() * .7, Math.random() * .7, 1.0))
}

//Create particle position data array and fill it with empty particles to reuse and increase efficiency
let particleData: Particle[] = [];
    circleSlices=10; //Lower for efficient particles
let sharedParticleSphere = new Sphere();
for (let i = 0; i < particleCount; i++) {
    particleData.push(new Particle());
}

//Store particle density constraints to use to color particles
let particleDensityConstraints = new Float32Array(particleCount);

//Initialize values to perfect density
for(let i =0; i<particleCount; i++) {
    particleDensityConstraints[i] = -1.0;
}

// Allocate the space for all the predicted particles once so we don't have to call new particle
// to fill up the entire nextParticles array every single frame
// Make function more efficient
let predictedParticlesStorage: Particle[] = [];

//Same memory allocation optimization strategy for change in particle positions (delta)
let deltaParticlePositions = new Float32Array(particleData.length * 3);

for (let i = 0; i < particleData.length; i++) {
    predictedParticlesStorage.push(new Particle());
}

//update rotation angles based on mouse movement
function mouse_drag(event: MouseEvent) {
    let thetaY: number, thetaX: number;
    if (mouse_button_down) {
        thetaY = 360.0 * (event.clientX - prevMouseX) / canvas.clientWidth;
        thetaX = 360.0 * (event.clientY - prevMouseY) / canvas.clientHeight;
        prevMouseX = event.clientX;
        prevMouseY = event.clientY;
        xAngle += thetaX;
        yAngle += thetaY;

        // Clamp xAngle to prevent flipping controls
        xAngle = Math.max(0.1, Math.min(89, xAngle));
    }
    requestAnimationFrame(render);
}

//record that the mouse button is now down
function mouse_down(event: MouseEvent) {
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

//Set up events to happen immediately when the page loads
window.onload = function init() {

    //Set particle constants immediately
    resetConstants();

    //fetch reference to the canvas element defined in the html file
    canvas = document.getElementById("gl-canvas") as HTMLCanvasElement;
    //grab the WebGL 2 context for that canvas
    gl = canvas.getContext('webgl2') as WebGL2RenderingContext;
    if (!gl) {
        alert("WebGL isn't available");
    }

    //allow the user to rotate the camera with the mouse
    canvas.addEventListener("mousedown", mouse_down);
    canvas.addEventListener("mousemove", mouse_drag);
    canvas.addEventListener("mouseup", mouse_up);

    //Take the vertex and fragment shaders provided and compile them into a shader program
    program = initFileShaders(gl, "vshader-combined.glsl", "fshader-combined.glsl");

    //shader program to calculate depth and output it as a stored color
    programDepth = initFileShaders(gl, "vshader-depth.glsl", "fshader-depth.glsl");

    //shader program to display only particle density textures or only background textures, for debugging
    programTexture = initFileShaders(gl, "vshader-texture.glsl", "fshader-texture.glsl");

    //shader program to bilaterally blur the depths of each pixel to create a smoother surface for the water
    programBlur = initFileShaders(gl, "vshader-texture.glsl", "fshader-blur.glsl");

    //shader program that combines the background with the depth texture map
    programComposite = initFileShaders(gl, "vshader-texture.glsl", "fshader-composite.glsl");

    //shader program to create a normal map on the particles based on the blurred density map
    programNormal = initFileShaders(gl, "vshader-texture.glsl", "fshader-normal.glsl");

    //shader program that applies lighting to the particle normal map
    programFluidLighting = initFileShaders(gl, "vshader-texture.glsl", "fshader-fluid-lighting.glsl");

    // initialize fluid rendering pipeline after the file shaders have been initialized
    initFluidRenderingPipeline(gl);

    //use the original shader program for our background rendering
    gl.useProgram(program);

    // fetch uniform and attribute locations
    umv = gl.getUniformLocation(program, "model_view");
    uproj = gl.getUniformLocation(program, "projection");
    vPosition = gl.getAttribLocation(program, "vPosition");
    vInstancePosition = gl.getAttribLocation(program, "vInstancePosition");
    useInstancing = gl.getUniformLocation(program, "useInstancing");

    vNormal = gl.getAttribLocation(program, "vNormal");
    vAmbientDiffuseColor = gl.getAttribLocation(program, "vAmbientDiffuseColor");
    vSpecularColor = gl.getAttribLocation(program, "vSpecularColor");
    vSpecularExponent = gl.getAttribLocation(program, "vSpecularExponent");

    // Position the torso
    torso1.yOffset += 2.25;

    // Position the head
    head1.yOffset += 3.95;
    head1.scaleFactor = 0.5

    // Position the eyes for the head
    leftEye.yOffset = 0.2;
    leftEye.scaleFactor = 0.1;
    leftEye.zOffset -= 0.9;
    leftEye.xOffset = -0.3;

    rightEye.yOffset = 0.2;
    rightEye.scaleFactor = 0.1;
    rightEye.zOffset -= 0.9;
    rightEye.xOffset = 0.3;


    // Position front left tire
    wheel1.thetaY += 90;
    wheel1.xOffset -= 2;
    wheel1.zOffset -= 2.5;

    // Position front right tire
    wheel2.thetaY += 90;
    wheel2.xOffset += 2;
    wheel2.zOffset -= 2.5;

    // Position back left tire
    wheel3.thetaY += 90;
    wheel3.xOffset -= 2;
    wheel3.zOffset += 2.5;

    // Position back right tire
    wheel4.thetaY += 90;
    wheel4.xOffset += 2;
    wheel4.zOffset += 2.5;

    // Position headlights at front of car

    // Right headlight
    headlight1.yOffset += 1.5;
    headlight1.xOffset += 1;
    headlight1.zOffset -= 3.05;
    // Left headlight
    headlight2.yOffset += 1.5;
    headlight2.xOffset -= 1;
    headlight2.zOffset -= 3.05;

    // Emergency light
    emergencyLight.zOffset += 1.5;
    emergencyLight.yOffset += 2.5;

    // Initialize the car to be placed at the origin facing forwards
    body1.xOffset = 0;
    body1.yOffset = 0;
    body1.zOffset = 30;
    body1.thetaY = 0;
    body1.velocity = new vec4(0, 0, 0, 0);


// randomize sphere placements and rotations
    for (let i = 0; i < spheres.length; i++) {
        // randomize sign
        let randomSign = () => Math.random() < 0.5 ? -1 : 1;

        // generate random position ensuring its at least 20 units from origin
        let xOffset: number, zOffset: number;

        let distanceFromOrigin = 50;

        do {
            xOffset = Math.random() * 200 * randomSign();
            zOffset = Math.random() * 200 * randomSign();
        } while (Math.abs(xOffset) < distanceFromOrigin && Math.abs(zOffset) < distanceFromOrigin);

        // Apply random values to each sphere
        spheres[i].xOffset = xOffset;
        spheres[i].yOffset = 5;
        spheres[i].zOffset = zOffset;
        spheres[i].scaleFactor = 15;
    }


    //Initialize particle positions and velocities when the page loads
    initializeParticles();

    //Send the data for the body to the gpu
    body1.initBuffer(gl);

    //Send the data for the ground to the gpu
    ground1.initBuffer(gl);

    //Send the data for the torso to the gpu
    torso1.initBuffer(gl);

    //Send the data for the head to the gpu
    head1.initBuffer(gl);
    leftEye.initBuffer(gl);
    rightEye.initBuffer(gl);

    //Send the data for the wheels to the gpu
    wheel1.initBuffer(gl);
    wheel2.initBuffer(gl);
    wheel3.initBuffer(gl);
    wheel4.initBuffer(gl);

    //Send the data for the headlights and emergency light to the gpu
    headlight1.initBuffer(gl);
    headlight2.initBuffer(gl);
    emergencyLight.initBuffer(gl);

    //Send sphere data to gpu
    for (let i = 0; i < spheres.length; i++) {
        circleSlices=100; //Higher for detailed environment spheres
        spheres[i].initBuffer(gl);
    }

    //Send shared water particle sphere data to gpu
    circleSlices=10; //Lower quality for efficiency
    sharedParticleSphere.initBuffer(gl);

    // Create instance buffer for particle positions
    particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = particleData[i].xOffset;
        particlePositions[i * 3 + 1] = particleData[i].yOffset;
        particlePositions[i * 3 + 2] = particleData[i].zOffset;
    }

    //Create an instance buffer object and send the particle positions over to gpu
    instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, particlePositions, gl.DYNAMIC_DRAW);

    //Create a density buffer object and send the densities over to gpu
    densityBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, densityBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, particleDensityConstraints, gl.DYNAMIC_DRAW);

    //Listen for arrow keys and space bar to tell the car what to do
    window.addEventListener("keydown", function (event) {
        switch (event.key) {
            //Reset particle positions to their starting points and starting velocities
            case "5":
                initializeParticles();
                particlesMoving = false;
                testParticlesMoving = false;
                document.getElementById("physicsMode").innerHTML = "Physics Mode: OFF";
                document.getElementById("movement").innerHTML = "Movement: OFF";
                break;
            //Stop and start particles
            case "6":
                if (!testParticlesMoving) {
                    document.getElementById("physicsMode").innerHTML = "Physics Mode: FLUIDS";
                    particlesMoving = !particlesMoving;
                    if (particlesMoving) {
                        document.getElementById("movement").innerHTML = "Movement: ON";
                    } else {
                        document.getElementById("movement").innerHTML = "Movement: OFF";
                    }
                }
                break;
            //Stop and start particles test case
            case "7":
                if (!particlesMoving) {
                    document.getElementById("physicsMode").innerHTML = "Physics Mode: TEST";
                    testParticlesMoving = !testParticlesMoving;
                    if (testParticlesMoving) {
                        document.getElementById("movement").innerHTML = "Movement: ON";
                    } else {
                        document.getElementById("movement").innerHTML = "Movement: OFF";
                    }
                }
                break;
            //Change rendering mode
            case "8":
                //Cycle between each render mode (0-3)
                renderMode = (renderMode + 1) % 5;

                switch (renderMode) {
                    case 0:
                        document.getElementById("renderMode").innerHTML = `Render Mode: Density Map`;
                        break;
                    case 1:
                        document.getElementById("renderMode").innerHTML = `Render Mode: Depth Map`;
                        break;
                    case 2:
                        document.getElementById("renderMode").innerHTML = `Render Mode: Blurred Depth Map`;
                        break;
                    case 3:
                        document.getElementById("renderMode").innerHTML = `Render Mode: Normal Map`;
                        break;
                    case 4:
                        document.getElementById("renderMode").innerHTML = `Render Mode: Fluid Lighting`;
                        break;
                }
                break;
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
                if (currentCamera == 1) {
                    cameraOneZoomIn = true;
                }
                break;
            case "w":
                if (currentCamera == 1) {
                    cameraOneZoomOut = true;
                }
                break;
            case "a":
                if (currentCamera == 1) {
                    cameraOneDollyOut = true;
                }
                break;
            case "s":
                if (currentCamera == 1) {
                    cameraOneDollyIn = true;
                }
                break;
            case "f":
                if (currentCamera == 1) {
                    cameraOnePointingAtCar = !cameraOnePointingAtCar;
                }
                break;
            case "r":
                currentCamera = 1;
                resetCamera = true;
                break;
            case "z":
                turningHeadLeft = true;
                break;
            case "x":
                turningHeadRight = true;
                break;
            case "1":
                if (currentCamera != 1) {
                    restoreCameraState();
                }
                currentCamera = 1;
                break;
            case "2":
                if (currentCamera == 1) {
                    saveCameraState();
                }
                resetCamera = true;
                currentCamera = 2;
                break;
            case "3":
                if (currentCamera == 1) {
                    saveCameraState();
                }
                resetCamera = true;
                currentCamera = 3;
                break;
            case "4":
                if (currentCamera == 1) {
                    saveCameraState();
                }
                resetCamera = true;
                switchedToCameraFour = true;
                currentCamera = 4;
                break;
            case "=":
                isDay = !isDay;
                break;
            case "0":
                emergencyLightOn = !emergencyLightOn
                break;
            case "9":
                headLightsOn = !headLightsOn;
                break;
            case "u":
                cameraFourZoomIn = true;
                break;
            case "j":
                cameraFourZoomOut = true;
                break;
            default:
        }
        //now we need a new frame since we made a change
        requestAnimationFrame(render);
    });
    //When you release left or right keys
    window.addEventListener("keyup", function (event) {
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
                if (currentCamera == 1) {
                    cameraOneZoomIn = false;
                }
                break;
            case "w":
                if (currentCamera == 1) {
                    cameraOneZoomOut = false;
                }
                break;
            case "a":
                if (currentCamera == 1) {
                    cameraOneDollyOut = false;
                }
                break;
            case "s":
                if (currentCamera == 1) {
                    cameraOneDollyIn = false;
                }
                break;
            case "z":
                turningHeadLeft = false;
                break;
            case "x":
                turningHeadRight = false;
                break;
            case "u":
                cameraFourZoomIn = false;
                break;
            case "j":
                cameraFourZoomOut = false;
                break;
        }
        //now we need a new frame since we made a change
        requestAnimationFrame(render);
    });


    //Draw to the entire screen
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    //Sets the background to sky blue
    gl.clearColor(0.1, 0.1, 0.4, 1.0);
    //Avoid having objects that are behind other objects show up anyway
    gl.enable(gl.DEPTH_TEST);
    window.setInterval(update, 16); //target 60 frames per second
};

//request new frame
function update() {
    //Set car and graphics information
    let moveSpeed = 0.15;
    let turnDegreesPerSecond = 180;
    let straightTireAngle = 90;
    let forwardTurnStrength = 2.25;
    let reverseTurnStrength = 1.75;

    //Start fluid simulation
    if (particlesMoving) {
        fluidSimulation(particleData);
    }

    // Test version
    if (testParticlesMoving) {
        let gravity = -60;
        for (let i = 0; i < particleData.length; i++) {
            particleData[i].velocity[1] += gravity * secondsPerFrame;

            // move particles based on their velocity
            particleData[i].xOffset += particleData[i].velocity[0] * secondsPerFrame;
            particleData[i].yOffset += particleData[i].velocity[1] * secondsPerFrame;
            particleData[i].zOffset += particleData[i].velocity[2] * secondsPerFrame;

        }
        collisionDetection(particleData);
        carCollisionDetection(particleData, body1);
        wheelCollisionDetection(particleData, body1);
        enforceBarriers(particleData);
    }


//Create a barrier for the car
    //front
    if (body1.zOffset < 0) {
        body1.zOffset = Math.max(body1.zOffset, -247);
    }
    //back
    if (body1.zOffset > 0) {
        body1.zOffset = Math.min(body1.zOffset, 247);
    }
    //left
    if (body1.xOffset < 0) {
        body1.xOffset = Math.max(body1.xOffset, -247);
    }
    //right
    if (body1.xOffset > 0) {
        body1.xOffset = Math.min(body1.xOffset, 247);
    }


    //Car is turning left
    if (turningLeft) {
        //Turn wheels to the left, don't let them turn past a 45-degree angle
        wheel1.thetaY += turnDegreesPerSecond * secondsPerFrame;
        wheel1.thetaY = Math.min(wheel1.thetaY, straightTireAngle + 45);

        wheel2.thetaY += turnDegreesPerSecond * secondsPerFrame;
        wheel2.thetaY = Math.min(wheel2.thetaY, straightTireAngle + 45);
    }
//Car is turning right
    if (turningRight) {
        //Turn wheels to the right, don't let them turn past a 45-degree angle
        wheel1.thetaY -= turnDegreesPerSecond * secondsPerFrame;
        wheel1.thetaY = Math.max(wheel1.thetaY, straightTireAngle - 45);

        wheel2.thetaY -= turnDegreesPerSecond * secondsPerFrame;
        wheel2.thetaY = Math.max(wheel2.thetaY, straightTireAngle - 45);
    }

    //Head is turning left
    if (turningHeadLeft) {
        //Turn head of driver to left
        head1.thetaY += turnDegreesPerSecond * secondsPerFrame * 0.5;
    }
//Head is turning right
    if (turningHeadRight) {
        //Turn head of driver to the right
        head1.thetaY -= turnDegreesPerSecond * secondsPerFrame * 0.5;
    }

    let steerAngle = wheel1.thetaY - 90;
    //Car is going forward
    if (isGoing == true && isForward == true) {
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
    if (isGoing == true && isForward == false) {
        //Reverse steering angle when car in reverse (turn right to go left in reverse, etc.)
        steerAngle *= -1;
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

    if (isGoing == false) {
        body1.velocity = new vec4(0, 0, 0, 0);
    }
    //Viewpoint Camera 1, positioned to look at the center of the screen or follow the car,
    //with the ability to zoom and dolly the camera in and out on the car
    //All math and numbers are explained below
    //Make Camera One look at the car
    if (cameraOnePointingAtCar) {
        cameraLookingAtXOffset = body1.xOffset;
        cameraLookingAtYOffset = body1.yOffset;
        cameraLookingAtZOffset = body1.zOffset;
    }
    //Make Camera look at the center
    if (!cameraOnePointingAtCar) {
        cameraLookingAtXOffset = 0;
        cameraLookingAtYOffset = 0;
        cameraLookingAtZOffset = 0;
    }
    //Camera One Zoom and Dolly logic
    if (currentCamera == 1) {

        //Don't let the camera zoom beyond 5 or the car starts filling the screen
        if (cameraOneZoomIn) {
            fov -= 10 * secondsPerFrame;
            fov = Math.max(fov, 5);
        }
        //Don't let the camera zoom too far out beyond 180, or it flips
        if (cameraOneZoomOut) {
            fov += 10 * secondsPerFrame;
            fov = Math.min(fov, 179);
        }
        //Don't let the camera dolly in too close beyond 5, or it will start to go inside the car
        if (cameraOneDollyIn) {
            cameraZOffset -= 30 * secondsPerFrame;
            cameraZOffset = Math.max(cameraZOffset, 5);
        }
        //Don't let the camera get beyond the 100 units away, or it will get too hard to see
        if (cameraOneDollyOut) {
            cameraZOffset += 30 * secondsPerFrame;
            cameraZOffset = Math.min(cameraZOffset, 200);
        }
    }

    //reset all camera values
    if (resetCamera) {
        //Fov 45 is a medium zoom
        fov = 45;
        //Resets the camera 50 units back and 15 units up
        cameraZOffset = 50;
        cameraYOffset = 15;
        cameraXOffset = 0;
        //Resets the camera to look at the center of the stage
        cameraLookingAtXOffset = 0;
        cameraLookingAtYOffset = 0;
        cameraLookingAtZOffset = 0;
        //Disable all camera motion after the reset
        cameraOnePointingAtCar = false;
        cameraOneZoomIn = false;
        cameraOneZoomOut = false;
        cameraOneDollyOut = false;
        cameraOneDollyIn = false;
        resetCamera = false;
    }
    //Viewpoint camera 2, positioned in front of the head of the driver
    //All math and numbers are explained within the method
    if (currentCamera == 2) {
        //All math is explained within the method
        //The rotation of the car adds to the rotation of the head to point the camera in the right direction
        let combinedDirection = body1.thetaY + head1.thetaY;

        //Forward direction of the head based on its y-axis (yaw)
        //Because of the way the head and car were drawn forwards is backwards and vice versa
        //So we need to flip the signs with a negative
        //Degrees are converted to radians with pi/180
        let forwardX = -Math.sin(combinedDirection * Math.PI / 180);
        let forwardZ = -Math.cos(combinedDirection * Math.PI / 180);

        //Position camera in the head of the driver
        cameraXOffset = body1.xOffset + forwardX;
        //Move the camera up enough to be level with the eyes of the driver's head
        cameraYOffset = body1.yOffset + 3.9;
        cameraZOffset = body1.zOffset + forwardZ;

        //Make driver look 7.5 units ahead of car in both the z direction
        // (forward and backwards) and the x direction (left and right)
        cameraLookingAtXOffset = body1.xOffset + forwardX * 7.5;
        cameraLookingAtYOffset = body1.yOffset + 2.5;
        cameraLookingAtZOffset = body1.zOffset + forwardZ * 7.5;
    }
    //Chase camera 3, positioned 15 units above (y), in the middle (x), and 20 units back (z) from the car,
    // and follows behind it always
    //All math and numbers are explained within the method
    if (currentCamera == 3) {
        //Forward direction of the car based on its y-axis (yaw)
        //Because of the way the car was drawn forwards is backwards and vice versa
        //So we need to flip the signs with a negative
        //Degrees are converted to radians with pi/180
        let forwardX = -Math.sin(body1.thetaY * Math.PI / 180);
        let forwardZ = -Math.cos(body1.thetaY * Math.PI / 180);
        //Set cos and sin name variables to illustrate equation
        let cos = forwardX;
        let sin = forwardZ;
        //Create rotation points in the middle (x) and 20 units back (z) from wherever they are rotating around
        let localX = 0;
        let localZ = -20;
        // Rotation points obtained using x' = x cos(θ) - y sin(θ) and y' = x sin(θ) + y cos(θ),
        // in this case y is z because our car is driving across the z axis
        let rotatedX = localZ * cos - localX * sin;
        let rotatedZ = localZ * sin + localX * cos;

        //Apply rotation points to the car coordinates, so the chase camera will stick 20 units behind the car
        //and 10 units up for y
        cameraXOffset = body1.xOffset + rotatedX;
        cameraYOffset = body1.yOffset + 10;
        cameraZOffset = body1.zOffset + rotatedZ;

        //Make chase camera look 10 units in front of car and 7.5 units upwards towards the horizon
        cameraLookingAtXOffset = body1.xOffset - forwardX * 10;
        cameraLookingAtYOffset = body1.yOffset + 7.5;
        cameraLookingAtZOffset = body1.zOffset - forwardZ * 10;
    }
    if (currentCamera == 4) {
        if (currentCamera == 4) {
            if (switchedToCameraFour || boundingBoxChanged) {
                //Reset to default view
                cameraFourRadius = boundingBoxSize * 2 + 20;
                xAngle = 15;
                yAngle = 0;
                switchedToCameraFour = false;
                boundingBoxChanged = false;
            }
            console.log(xAngle, yAngle);

            //zoom in
            if (cameraFourZoomIn) {
                cameraFourRadius -= 20 * secondsPerFrame;
                cameraFourRadius = Math.max(cameraFourRadius, 2); // Don't go inside the center
            }
            //zoom out
            if (cameraFourZoomOut) {
                cameraFourRadius += 20 * secondsPerFrame;
                cameraFourRadius = Math.min(cameraFourRadius, 100);
            }

            // Convert degrees to radians
            let xMouseAngleRadians = xAngle * (Math.PI / 180);
            let yMouseAngleRadians = -yAngle * (Math.PI / 180);

            //Set camera based on mouse angles
            cameraXOffset = cameraFourRadius * Math.cos(xMouseAngleRadians) * Math.sin(yMouseAngleRadians);
            cameraYOffset = cameraFourRadius * Math.sin(xMouseAngleRadians);
            cameraZOffset = cameraFourRadius * Math.cos(xMouseAngleRadians) * Math.cos(yMouseAngleRadians);

            //Camera always looks at world origin
            cameraLookingAtXOffset = 0;
            cameraLookingAtYOffset = 0;
            cameraLookingAtZOffset = 0;
        }
    }
    requestAnimationFrame(render);
}

//Initialize screen space fluid rendering pipeline
function initFluidRenderingPipeline(gl: WebGL2RenderingContext) {
    //Enable float textures for smooth water colors
    if (!gl.getExtension("EXT_color_buffer_float")) {
        console.error("Float textures not supported.");
    }
    //Shorten heavily used values
    let width = canvas.width;
    let height = canvas.height;

    //Stage 1: Background frame buffer
    fbBackground = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbBackground);

    //Set up texture we will render the background to
    texBackground = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texBackground);
    //Get a chunk of memory from the graphics card, don't put anything in it yet
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    //Use linear texture filter to average the colors for the background pixels, no particles so won't affect performance
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    // attach the background texture as the color output of the background framebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texBackground, 0);

    //Store the depth value for the background frame buffer
    rbBackground = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rbBackground);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
    //Attach the background render buffer to the background frame buffer as the depth buffer
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbBackground);

    //Stage 2: Depth map (Particle) frame buffer
    fbDepth = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbDepth);

    //Set up texture to render the depth map to
    texDepth = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texDepth);
    //Get a chunk of memory from the graphics card, don't put anything in it yet, use 32 float for smoother not blocky water colors
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
    //Need nearest texture filtering because we need the exact texel that is closest to the center of each pixel to get exact depth
    //Linear filtering would blur depths and create values that would break the physics
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    // attach the depth texture as the color output of the depth framebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texDepth, 0);

    //We want to use the same depth render buffer so background depth particles aren't always drawn in front of background
    //Attach the background render buffer to the depth frame buffer as the depth buffer
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbBackground);

    //Stage 3: Blur depth frame buffer with bilateral filtering
    fbBlur = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbBlur);
    texBlur = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texBlur);
    //Match settings of depth map
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    // attach the blur texture as the color output of the blur framebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texBlur, 0);
    //No renderbuffer needed because we are only altering the existing image, not changing anything physically

    //Stage 4: Draw composite texture into the composite framebuffer
    fbComposite = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbComposite);
    texComposite = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texComposite);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // attach the composite texture as the color output of the composite framebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texComposite, 0);

    //Stage 5: Normal mapping
    fbNormal = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbNormal);
    texNormal = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texNormal);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // attach the normal texture as the color output of the normal framebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texNormal, 0);
    //No renderbuffer needed because we are only altering the existing image, not changing anything physically

    //Stage 5: Fluid lighting
    fbFluidLighting = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbFluidLighting);
    texFluidLighting = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texFluidLighting);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // attach the fluid lighting texture as the color output of the fluid lighting framebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texFluidLighting, 0);
    //No renderbuffer needed because we are only altering the existing image, not changing anything physically

    //Stop rendering to any frame buffer and switch back to rendering to the default canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // set uniform and attribute locations for depth map shaders
    uDepthMV = gl.getUniformLocation(programDepth, "model_view");
    uDepthProj = gl.getUniformLocation(programDepth, "projection");
    vDepthPos = gl.getAttribLocation(programDepth, "vPosition");
    vDepthInstancedPos = gl.getAttribLocation(programDepth, "vInstancePosition");

    //Set a variable for the attribute position index in the texture shader
    vTexPos = gl.getAttribLocation(programTexture, "vPosition");

    //Store pointer to texture sampler uniform location
    uTexSampler = gl.getUniformLocation(programTexture, "texSampler");

    //Store pointer to depth sampler
    uDepthSampler = gl.getUniformLocation(programComposite, "depthSampler");

    //Store pointer to blur sampler
    uNormalBlurSampler = gl.getUniformLocation(programNormal, "blurSampler");

    //Store pointer to background sampler
    uBackgroundSampler = gl.getUniformLocation(programComposite, "backgroundSampler");

    //Store pointer to normal sampler
    uFluidLightingNormalSampler = gl.getUniformLocation(programComposite, "normalSampler");

    // set uniform and attribute locations for blur fragment shader
    //Store pointer to composite sampler
    uBlurCompositeSampler = gl.getUniformLocation(programBlur, "compositeSampler");
    uBlurDirection = gl.getUniformLocation(programBlur, "direction");
    uBlurInverseScreenSize = gl.getUniformLocation(programBlur, "inverseScreenSize");
    uBlurFilterRadius = gl.getUniformLocation(programBlur, "filterRadius");
    uBlurSpatialScale = gl.getUniformLocation(programBlur, "spatialScale");
    uBlurDepthFalloff = gl.getUniformLocation(programBlur, "depthFalloff");

    //Pointer to normal uniforms
    uNormalInverseProj = gl.getUniformLocation(programNormal, "inverseProjection");
    uNormalInverseView = gl.getUniformLocation(programNormal, "inverseView");
    uNormalInverseScreenSize = gl.getUniformLocation(programNormal, "inverseScreenSize");

    //Pointer to fluid lighting uniforms
    uFluidLightingInverseScreenSize = gl.getUniformLocation(programFluidLighting, "inverseScreenSize");
    uFluidLightingView = gl.getUniformLocation(programFluidLighting, "model_view");
    uFluidLightingInverseProj = gl.getUniformLocation(programFluidLighting, "inverseProjection");

    //Set up screen quad we are rendering our textures on
    //Put the vertices of the quad in an array for easy access
    //Two triangles to make up the quad, 6 vertices
    let quadVerts = new Float32Array([
        -1, -1, 0, 1, //Bottom left
        1, -1, 0, 1, //Bottom right
        -1, 1, 0, 1, //Top left

        -1, 1, 0, 1, //Top Left
        1, -1, 0, 1, //Bottom Right
        1, 1, 0, 1] //Top Right
    );
    //init vertex array object
    quadVao = gl.createVertexArray();
    gl.bindVertexArray(quadVao);

    //Create buffer on the gpu for quad
    let quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);

    //Upload the vertex data to the gpu once and never change it
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
    //Put quad info into the texture shader as vertex positions, 16 bytes per 4 floats for stride
    gl.vertexAttribPointer(vTexPos, 4, gl.FLOAT, false, 16, 0);

    //Turn on the quad and then unbind it so it is never modified again
    gl.enableVertexAttribArray(0);
    gl.bindVertexArray(null);
}

function calculateLights(mv: mat4) {
    //Lighting
    //Set day time
    if (isDay) {
        overHeadColor = new vec4(1, 1, 1, 1);
        //Set the day sky
        gl.clearColor(0, 0.5, 1.0, 1.0);
    }
    //Set nighttime
    if (!isDay) {
        overHeadColor = new vec4(0.2, 0.2, 0.2, 1);
        //Set the night sky
        gl.clearColor(0.1, 0.1, 0.4, 1.0);
    }
    //Turn headlights on
    if (headLightsOn) {
        headLightColor = new vec4(1, 1, 0.8, 1);
    }
    //Turn headlights off
    if (!headLightsOn) {
        headLightColor = new vec4(0, 0, 0, 1);
    }
    //Emergency light directions
    let emergencyRedRightX = -Math.sin((body1.thetaY + emergencyLight.thetaY) * Math.PI / 180);
    let emergencyRedRightZ = -Math.cos((body1.thetaY + emergencyLight.thetaY) * Math.PI / 180);
    let emergencyBlueLeftX = -Math.sin((body1.thetaY + emergencyLight.thetaY + 180) * Math.PI / 180);
    let emergencyBlueLeftZ = -Math.cos((body1.thetaY + emergencyLight.thetaY + 180) * Math.PI / 180);

    //Turn emergency lights on
    if (emergencyLightOn) {
        emergencyLight.thetaY -= 100 * 0.016; // Rotate 100 degrees per second
        blueEmergencyLightColor = new vec4(0, 0, 1, 1)
        redEmergencyLightColor = new vec4(1, 0, 0, 1)
    }
    //Turn emergency lights off
    if (!emergencyLightOn) {
        blueEmergencyLightColor = new vec4(0, 0, 0, 1);
        redEmergencyLightColor = new vec4(0, 0, 0, 1);
    }


    function setLightPosition(lightXOffset: number, lightYOffset: number, lightZOffset: number) {
        //Copy over camera logic to use for the headlights
        let forwardX = -Math.sin(body1.thetaY * Math.PI / 180);
        let forwardZ = -Math.cos(body1.thetaY * Math.PI / 180);
        //Set cos and sin name variables to illustrate equation
        let cos = forwardX;
        let sin = forwardZ;

        // For headlights - position them in front of the car
        let localHeadlightX = lightXOffset;
        let localHeadlightZ = lightZOffset; // 3

        // Apply rotation for headlights using 2d rotation matrix for x and z
        let rotatedHeadlightX = localHeadlightZ * cos - localHeadlightX * sin;
        let rotatedHeadlightZ = localHeadlightZ * sin + localHeadlightX * cos;

        // Position headlight at front of car in
        let headlightXOffset = body1.xOffset + rotatedHeadlightX;
        let headlightYOffset = body1.yOffset + lightYOffset // 1.5;  // Near ground level
        let headlightZOffset = body1.zOffset + rotatedHeadlightZ;

        return ([forwardX, forwardZ, headlightXOffset, headlightYOffset, headlightZOffset]);
    }

    // Set all light colors
    colors = [
        overHeadColor, //Overhead light, depending on day/night
        headLightColor,
        headLightColor,
        blueEmergencyLightColor, //Blue emergency light left side
        redEmergencyLightColor, //Red emergency right left side
    ]
    // Set all light positions
    positions = [
        mv.mult(new vec4(0, 100, 0, 1)), //Overhead light
        mv.mult(new vec4(setLightPosition(1, 1.5, 3)[2], setLightPosition(1, 1.5, 3)[3], setLightPosition(1, 1.5, 3)[4], 1)), //Left headlight
        mv.mult(new vec4(setLightPosition(-1, 1.5, 3)[2], setLightPosition(-1, 1.5, 3)[3], setLightPosition(-1, 1.5, 3)[4], 1)), //Right headlight
        mv.mult(new vec4(setLightPosition(0, 2.5, -1.5)[2], setLightPosition(0, 2.5, -1.5)[3], setLightPosition(0, 2.5, -1.5)[4], 1)), //Right emergency
        mv.mult(new vec4(setLightPosition(0, 2.5, -1.5)[2], setLightPosition(0, 2.5, -1.5)[3], setLightPosition(0, 2.5, -1.5)[4], 1)) //Left emergency
    ]
    // Set all light directions
    directions = [
        mv.mult(new vec4(0, -1, 0, 0)), //Overhead light
        mv.mult(new vec4(setLightPosition(1, 1.5, 3)[0], 0, setLightPosition(1, 1.5, 3)[1], 0)), //Left headlight
        mv.mult(new vec4(setLightPosition(1, 1.5, 3)[0], 0, setLightPosition(1, 1.5, 3)[1], 0)),  //Right headlight
        mv.mult(new vec4(emergencyRedRightX, 0, emergencyRedRightZ, 0)),
        mv.mult(new vec4(emergencyBlueLeftX, 0, emergencyBlueLeftZ, 0))
    ]
    //Set all spotlight angles
    angles = [
        -1.0, //overhead light
        0.94, //headlights
        0.94,
        0.71, //emergency lights
        0.71
    ]
}

function setLightUniforms(gl: WebGLRenderingContext, targetProgram: WebGLProgram) {
    gl.useProgram(targetProgram);

    //Set uniform locations
    let uPosition = gl.getUniformLocation(targetProgram, "light_position");
    let uColor = gl.getUniformLocation(targetProgram, "light_color");
    let uDirection = gl.getUniformLocation(targetProgram, "light_direction");
    let uAngle = gl.getUniformLocation(targetProgram, "spotLight_angle");
    let uAmbient = gl.getUniformLocation(targetProgram, "ambient_light");

    //Pass in uniform values
    gl.uniform4fv(uPosition, flatten(positions));
    gl.uniform4fv(uColor, flatten(colors));
    gl.uniform4fv(uDirection, flatten(directions));
    gl.uniform1fv(uAngle, angles);

    //Set ambient color based on if it is day
    let ambColor = isDay ? [0.7, 0.7, 0.7, 1] : [0.2, 0.2, 0.2, 1];

    gl.uniform4fv(uAmbient, ambColor);
}

//Draw everything except the particles
function drawBackground(mv: mat4, p: mat4) {
    gl.useProgram(program);

    // Send matrices to Main Shader variables
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.uniformMatrix4fv(uproj, false, p.flatten());

    // White CAR BODY
    gl.vertexAttrib4fv(vAmbientDiffuseColor, [1.0, 1.0, 1.0, 1.0]); // Red
    gl.vertexAttrib4fv(vSpecularColor, [1.0, 1.0, 1.0, 1.0]);
    gl.vertexAttrib1f(vSpecularExponent, 15.0);

    //Render the body so the other objects can use the body as the parent object
    let bodyMV = body1.render(gl, umv, null);

    // BLACK WHEELS
    gl.vertexAttrib4fv(vAmbientDiffuseColor, [0.1, 0.1, 0.1, 1.0]); // Dark gray/black
    gl.vertexAttrib4fv(vSpecularColor, [0.5, 0.5, 0.5, 1.0]);
    gl.vertexAttrib1f(vSpecularExponent, 10.0);
    wheel1.render(gl, umv, bodyMV);
    wheel2.render(gl, umv, bodyMV);
    wheel3.render(gl, umv, bodyMV);
    wheel4.render(gl, umv, bodyMV);

    // YELLOW HEADLIGHTS
    gl.vertexAttrib4fv(vAmbientDiffuseColor, [1, 1, 0.5, 1.0]); // Yellowish
    gl.vertexAttrib4fv(vSpecularColor, [1.0, 1.0, 1.0, 1.0]);
    gl.vertexAttrib1f(vSpecularExponent, 10.0);
    headlight1.render(gl, umv, bodyMV);
    headlight2.render(gl, umv, bodyMV);

    //GRAY EMERGENCY LIGHT
    gl.vertexAttrib4fv(vAmbientDiffuseColor, [0.8, 0.8, 0.8, 1.0]); // Yellowish
    gl.vertexAttrib4fv(vSpecularColor, [1.0, 1.0, 1.0, 1.0]);
    gl.vertexAttrib1f(vSpecularExponent, 10.0);
    emergencyLight.render(gl, umv, bodyMV);


    // BLUE TORSO
    gl.vertexAttrib4fv(vAmbientDiffuseColor, [0.0, 0.0, 1.0, 1.0]); // Blue
    gl.vertexAttrib4fv(vSpecularColor, [1.0, 1.0, 1.0, 1.0]);
    gl.vertexAttrib1f(vSpecularExponent, 15.0);
    torso1.render(gl, umv, bodyMV);

    // SKIN-COLORED HEAD
    gl.vertexAttrib4fv(vAmbientDiffuseColor, [1.0, 0.8, 0.6, 1.0]); // Skin tone
    gl.vertexAttrib4fv(vSpecularColor, [0.3, 0.3, 0.3, 1.0]);
    gl.vertexAttrib1f(vSpecularExponent, 5.0);

    let headMV = head1.render(gl, umv, bodyMV);

    // BLUE EYES
    gl.vertexAttrib4fv(vAmbientDiffuseColor, [0.0, 0.8, 1.0, 1.0]); // Blue
    gl.vertexAttrib4fv(vSpecularColor, [0.3, 0.3, 0.3, 1.0]);
    gl.vertexAttrib1f(vSpecularExponent, 5.0);
    leftEye.render(gl, umv, headMV);
    rightEye.render(gl, umv, headMV);

    // GREEN GROUND
    gl.vertexAttrib4fv(vAmbientDiffuseColor, [0.1, 0.5, 0.1, 1.0]); // Green grass
    gl.vertexAttrib4fv(vSpecularColor, [0.2, 0.2, 0.2, 1.0]);
    gl.vertexAttrib1f(vSpecularExponent, 5.0);
    ground1.render(gl, umv, null);

    // MULTI-COLORED SPHERES
    gl.vertexAttrib4fv(vSpecularColor, [1.0, 1.0, 1.0, 1.0]);
    gl.vertexAttrib1f(vSpecularExponent, 50.0); // Shiny


    for (let i = 0; i < spheres.length; ++i) {
        //render the spheres with no parent object
        //Set sphere colors to a random predefined color set above
        gl.vertexAttrib4fv(vAmbientDiffuseColor, sphereColors[i].flatten()); // Random Color
        spheres[i].render(gl, umv, null);
    }

}

//Draw the particles with depth grayscale
function drawParticlesDepth(mv: mat4, p: mat4) {
    //Activate depth shaders
    gl.useProgram(programDepth);

    //Uniforms
    gl.uniformMatrix4fv(uDepthMV, false, mv.flatten());
    gl.uniformMatrix4fv(uDepthProj, false, p.flatten());

    //Update particle data and store in buffer
    for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = particleData[i].xOffset / particleRadius;
        particlePositions[i * 3 + 1] = particleData[i].yOffset / particleRadius;
        particlePositions[i * 3 + 2] = particleData[i].zOffset / particleRadius;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, particlePositions);

    //Attributes for sphere geometry, only position, removed lighting
    gl.bindBuffer(gl.ARRAY_BUFFER, sharedParticleSphere.bufferId);
    gl.vertexAttribPointer(vDepthPos, 4, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(vDepthPos);

    //Attributes for instance positions
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.vertexAttribPointer(vDepthInstancedPos, 3, gl.FLOAT, false, 12, 0);
    gl.vertexAttribDivisor(vDepthInstancedPos, 1);
    gl.enableVertexAttribArray(vDepthInstancedPos);

    // Set the model-view matrix once for all particles
    sharedParticleSphere.xOffset = 0;
    sharedParticleSphere.yOffset = 0;
    sharedParticleSphere.zOffset = 0;
    sharedParticleSphere.scaleFactor = particleRadius;

    //Set up model-view matrix but don't draw yet
    sharedParticleSphere.render(gl, uDepthMV, null, true);

    //Now draw all instances with one call
    gl.drawArraysInstanced(gl.TRIANGLES, 0, sharedParticleSphere.numVertices(), particleCount);

    //Clean up
    //Disable the divisor
    gl.vertexAttribDivisor(vDepthInstancedPos, 0);
    //Disable the vertex attribute array
    gl.disableVertexAttribArray(vDepthInstancedPos);
}

//Draw particles with light
function drawParticlesOriginal(mv: mat4, p: mat4) {
    // use original shader with lights
    gl.useProgram(program);
    // send matrices
    gl.uniformMatrix4fv(umv, false, mv.flatten());
    gl.uniformMatrix4fv(uproj, false, p.flatten());

    //BLUE WATER PARTICLES
    gl.vertexAttrib4fv(vSpecularColor, [0.7, 0.7, 0.7, 1.0]);
    gl.vertexAttrib1f(vSpecularExponent, 50.0); // Very Shiny (Water)
    gl.vertexAttrib4fv(vAmbientDiffuseColor, particleColor.flatten()); // Blue water
    // ============ INSTANCED RENDERING ==============
    gl.uniform1i(useInstancing, 1); // turn on instanced rendering mode
    // Update instance buffer with current particle positions
    for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = particleData[i].xOffset / particleRadius;
        particlePositions[i * 3 + 1] = particleData[i].yOffset / particleRadius;
        particlePositions[i * 3 + 2] = particleData[i].zOffset / particleRadius;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, particlePositions);

    //Store buffer densities in density buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, densityBuffer);
    console.log("Density sample:", particleDensityConstraints[0], particleDensityConstraints[1]);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, particleDensityConstraints);

    // Set up sphere geometry (normal attributes)
    gl.bindBuffer(gl.ARRAY_BUFFER, sharedParticleSphere.bufferId);
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribPointer(vNormal, 4, gl.FLOAT, false, 32, 16);
    gl.vertexAttribDivisor(vPosition, 0);
    gl.vertexAttribDivisor(vNormal, 0);
    gl.enableVertexAttribArray(vPosition);
    gl.enableVertexAttribArray(vNormal);

    // Set up instance positions (instanced attribute)
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.vertexAttribPointer(vInstancePosition, 3, gl.FLOAT, false, 12, 0);
    gl.vertexAttribDivisor(vInstancePosition, 1);
    gl.enableVertexAttribArray(vInstancePosition);

    //Set up instanced densities (instanced attribute)
    gl.bindBuffer(gl.ARRAY_BUFFER, densityBuffer);
    let vDensity = gl.getAttribLocation(program, "vDensity");
    gl.vertexAttribPointer(vDensity, 1, gl.FLOAT, false, 4, 0); // 1 float, 4 bytes
    gl.vertexAttribDivisor(vDensity, 1);
    gl.enableVertexAttribArray(vDensity);

    // Set the model-view matrix once for all particles
    sharedParticleSphere.xOffset = 0;
    sharedParticleSphere.yOffset = 0;
    sharedParticleSphere.zOffset = 0;
    sharedParticleSphere.scaleFactor = particleRadius;
    //Set up matrices for model-view but don't draw yet
    sharedParticleSphere.render(gl, umv,null, true);
    //Now draw all instances with one call
    gl.drawArraysInstanced(gl.TRIANGLES, 0, sharedParticleSphere.numVertices(), particleCount);
    //Cleanup
    //Disable instance position
    gl.vertexAttribDivisor(vInstancePosition, 0);
    gl.disableVertexAttribArray(vInstancePosition);
    //Disable instance density
    gl.vertexAttribDivisor(vDensity, 0);
    gl.disableVertexAttribArray(vDensity);
    gl.uniform1i(useInstancing, 0); // turn off instanced rendering mode


    // ============ INSTANCED RENDERING ==============
}

//draw a new frame
function render() {
    //Calculate projection matrix
    let pM: mat4 = perspective(fov, canvas.clientWidth / canvas.clientHeight, 1.0, 1000.0);
    //Calculate view matrix (world space to eye space)
    let vM: mat4 = lookAt(new vec4(cameraXOffset, cameraYOffset, cameraZOffset, 1), new vec4(cameraLookingAtXOffset, cameraLookingAtYOffset, cameraLookingAtZOffset, 1), (new vec4(0, 1, 0, 0)));
    //Calculate lights immediately
    calculateLights(vM);

    //Original rendering mode
    if (renderMode == 0) {
        //Pipeline pass 0: No textures, draw original geometry straight to web canvas
        //Render to screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight);
        gl.clearColor(0, 0.5, 1.0, 1.0); // Set color sky blue
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);  //clear any previous data for both color and depth
        gl.enable(gl.DEPTH_TEST);

        //Set uniforms for original shader
        setLightUniforms(gl, program);

        //Draw background
        drawBackground(vM, pM);

        //Draw particles with lighting
        drawParticlesOriginal(vM, pM);
    } else { //All other rendering modes
        //Enable depth test for 3D render passes
        gl.enable(gl.DEPTH_TEST);

        //Set uniforms for original shader
        setLightUniforms(gl, program);

        //Draw particles with lighting
        drawParticlesOriginal(vM, pM);

        //Pipeline pass 1: Background (car, ground, spheres)
        //Target: Background texture
        //Set the background frame buffer to receive the next items drawn, don't draw anything to the screen yet
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbBackground);
        gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight);
        gl.clearColor(0, 0.5, 1.0, 1.0); // Set color sky blue
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);  //clear any previous data for both color and depth

        //Draw the background scene to background frame buffer
        drawBackground(vM, pM);

        //Pipeline pass 2: Depth (Particles)
        //Target: Depth texture
        //Set the depth frame buffer to receive the next items drawn, don't draw anything to the screen yet
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbDepth);
        //Clear depth (alpha channel) to 1000 for all depth buffers
        gl.clearBufferfv(gl.COLOR, 0, [0.0, 0.0, 0.0, 1000.0]);

        //Draw depth particles to depth frame buffer, respecting the background's depth
        drawParticlesDepth(vM, pM);

        //Disable depth test for the 2D pass because the quad is a flat image and depth is not a factor, removes screen flicker
        gl.disable(gl.DEPTH_TEST);

        //Pipeline pass 3: Debug Modes - Just background or just depth map
        //Target: Screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight);
        gl.clear(gl.COLOR_BUFFER_BIT);

        //Bind the quad vertex array object and draw to quad after view mode is determined
        gl.bindVertexArray(quadVao);

        if (renderMode >= 1) {

            function renderModeOne() {
                //Pipeline pass 4: Composite (Background and Depth Map textures drawn together, with depth values in alpha channel)
                //Draw depth particle grayscale texture combined with the background texture to quad
                gl.bindFramebuffer(gl.FRAMEBUFFER, fbComposite); //Write into the depth frame buffer
                // ADD THIS: Clear the texture before drawing to it
                gl.clearColor(0.0, 0.0, 0.0, 1.0);
                gl.clear(gl.COLOR_BUFFER_BIT);

                gl.useProgram(programComposite);

                //Texture unit 0: Depth
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, texDepth);
                gl.uniform1i(uDepthSampler, 0);

                //Texture unit 1: Background
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, texBackground);
                gl.uniform1i(uBackgroundSampler, 1);

                gl.bindVertexArray(quadVao);
                gl.drawArrays(gl.TRIANGLES, 0, 6);

            }

            function renderModeTwo() {
                //Pipeline pass 5a: Bilateral filtering in the horizontal direction
                //Read from depth texture and write to blur frame buffer -> texture
                gl.useProgram(programBlur);
                gl.bindFramebuffer(gl.FRAMEBUFFER, fbBlur);  //Write into the blur frame buffer
                gl.bindVertexArray(quadVao); //Make sure we are drawing to the quad
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, texComposite); //Inputting the color AND depth values for each pixel
                gl.uniform1i(uBlurCompositeSampler, 0);
                gl.uniform2f(uBlurDirection, 1.0, 0.0); //X direction
                gl.uniform2f(uBlurInverseScreenSize, 1 / canvas.width, 1 / canvas.height);
                gl.uniform1i(uBlurFilterRadius, filterRadius);
                gl.uniform1f(uBlurSpatialScale, spatialScale);
                gl.uniform1f(uBlurDepthFalloff, depthFalloff);
                gl.drawArrays(gl.TRIANGLES, 0, 6); //Run the horizontal pass and paint it on the quad

                //Pipeline pass 5b: Bilateral filtering in the vertical direction
                //Read from depth texture and write to blur frame buffer -> texture
                gl.useProgram(programBlur);
                gl.bindFramebuffer(gl.FRAMEBUFFER, fbComposite); //Write into the composite frame buffer (texture)
                gl.bindVertexArray(quadVao); //Make sure we are drawing to the quad
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, texBlur); //Inputting the result of depth pass 3a
                gl.uniform1i(uBlurCompositeSampler, 0);
                gl.uniform2f(uBlurDirection, 0.0, 1.0); //Y direction
                gl.uniform2f(uBlurInverseScreenSize, 1.0 / canvas.width, 1.0 / canvas.height);
                gl.uniform1i(uBlurFilterRadius, filterRadius);
                gl.uniform1f(uBlurSpatialScale, spatialScale);
                gl.uniform1f(uBlurDepthFalloff, depthFalloff);
                gl.drawArrays(gl.TRIANGLES, 0, 6); //Run the vertical pass and paint it on the quad
            }

            function renderModeThree() {
                //Pipeline pass 6: normal mapping from bilaterally blurred composite image
                gl.useProgram(programNormal);
                gl.bindFramebuffer(gl.FRAMEBUFFER, fbNormal); //Write into the normal frame buffer (texture)
                gl.bindVertexArray(quadVao); //Make sure we are drawing to the quad
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, texComposite); //Inputting the blurred depth composite map
                gl.uniform1i(uNormalBlurSampler, 0);
                gl.uniform2f(uNormalInverseScreenSize, 1.0 / canvas.width, 1.0 / canvas.height);
                let inverseProjection: mat4 = pM.inverse(); //We need to take objects from clip space back into view space
                let inverseView: mat4 = vM.inverse();
                gl.uniformMatrix4fv(uNormalInverseProj, false, inverseProjection.flatten());
                gl.uniformMatrix4fv(uNormalInverseView, false, inverseView.flatten());
                gl.drawArrays(gl.TRIANGLES, 0, 6); //Create normals and paint it on the quad
            }

            function renderModeFour() {
                //Pipeline pass 7: Fluid lighting from normal map
                gl.useProgram(programFluidLighting);
                setLightUniforms(gl, programFluidLighting);
                gl.bindFramebuffer(gl.FRAMEBUFFER, fbFluidLighting); //Write into the fluid lighting frame buffer (texture)
                gl.bindVertexArray(quadVao); //Make sure we are drawing to the quad
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, texNormal); //Inputting the normal map
                gl.uniform1i(uFluidLightingNormalSampler, 0);
                gl.uniform2f(uFluidLightingInverseScreenSize, 1.0 / canvas.width, 1.0 / canvas.height);
                let inverseProjection: mat4 = pM.inverse(); //We need to take objects from clip space back into view space
                gl.uniformMatrix4fv(uFluidLightingInverseProj, false, inverseProjection.flatten());
                gl.uniformMatrix4fv(uFluidLightingView, false, vM.flatten());
                gl.drawArrays(gl.TRIANGLES, 0, 6); //Create fluid lighting and paint it on the quad
            }

            //Set the texture output to the corresponding render mode
            let targetTexture: WebGLTexture;

            switch (renderMode) {
                case 1:
                    targetTexture = texComposite;
                    renderModeOne();
                    break;
                case 2:
                    targetTexture = texComposite;
                    renderModeOne();
                    renderModeTwo();
                    break;
                case 3:
                    targetTexture = texNormal;
                    renderModeOne();
                    renderModeTwo();
                    renderModeThree();
                    break;
                case 4:
                    targetTexture = texFluidLighting;
                    renderModeOne();
                    renderModeTwo();
                    renderModeThree();
                    renderModeFour();
                    break;
            }

            //Pipeline pass 8: Draw final texture to screen
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight);
            gl.clear(gl.COLOR_BUFFER_BIT);

            //Use texture program to display the texture
            gl.useProgram(programTexture);

            //Activate texture unit 0
            gl.activeTexture(gl.TEXTURE0);
            //Grab the background texture we saved before
            gl.bindTexture(gl.TEXTURE_2D, targetTexture);
            //It's on texture unit 0, so send over the value 0
            gl.uniform1i(uTexSampler, 0);

            //Draw the screen quad canvas, 2 triangles, 6 vertices
            gl.bindVertexArray(quadVao);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        //Clear the quad geometry
        gl.bindVertexArray(null);
    }
}
