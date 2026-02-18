//Author: Matthew Washburn
//Version: Fall 2025

"use strict";
//references to WebGL related objects

//fetch reference to the canvas element defined in the html file
let canvas:HTMLCanvasElement = document.getElementById("gl-canvas") as HTMLCanvasElement; // the html canvas element that's being drawn on

//grab the WebGL 2 context for that canvas
let gl:WebGLRenderingContext = canvas.getContext('webgl2') as WebGLRenderingContext; // the actual webgl rendering context, allows communication to the gpu

//Earth Shader
//Take the vertex and fragment shaders provided and compile them into a shader program
let program:WebGLProgram = initFileShaders(gl, "vshader-combined.glsl", "fshader-combined.glsl"); // compiled earth shader program (vertex + fragment shaders)

//Cloud Shader
let cloudProgram:WebGLProgram = initFileShaders(gl, "vshader-cloud.glsl", "fshader-cloud.glsl"); // compiled cloud shader program (vertex + fragment shaders)

//Cloud shader model view and projection matrix
let cloudsUmv:WebGLUniformLocation; //index of model_view in shader program
let cloudsUproj:WebGLUniformLocation; //index of projection in shader program

//Earth shader model view and projection matrix
let umv:WebGLUniformLocation; //index of model_view in shader program
let uproj:WebGLUniformLocation; //index of projection in shader program

//shader variable indices for per vertex and material attributes
let vNormal:GLint;
let vTangent:GLint;
let vSpecularColor:GLint; //highlight color
let vSpecularExponent:GLint;
let vPosition:GLint; // store the index for the vPosition attribute in the shader
let vTexCoord:GLint;

//pointer to our sampler2Ds in fragment shader
let uTextureSampler:WebGLUniformLocation;
let uSpecularSampler:WebGLUniformLocation;
let uNightSampler:WebGLUniformLocation;
let uCloudSampler:WebGLUniformLocation;
let uNormalSampler:WebGLUniformLocation;

//Anisotropic ext
let anisotropic_ext:EXT_texture_filter_anisotropic;

//uniform indices for earth shader light properties
let light_position:WebGLUniformLocation;
let light_color:WebGLUniformLocation;
let light_direction:WebGLUniformLocation;
let spotLight_angle:WebGLUniformLocation;
let ambient_light:WebGLUniformLocation;

//uniform indices for cloud shader light properties
let cloudLight_position:WebGLUniformLocation;
let cloudLight_color:WebGLUniformLocation;
let cloudLight_direction:WebGLUniformLocation;
let cloudSpotLight_angle:WebGLUniformLocation;
let cloudAmbient_light:WebGLUniformLocation;

//variables to track and set the camera
let fov = 45;
let zoomIn:boolean = false;
let zoomOut:boolean = false;
let cameraZOffset =-300;
let cameraYOffset = 0;
let cameraXOffset = 0;
let cameraLookingAtXOffset = 0;
let cameraLookingAtYOffset = 0;
let cameraLookingAtZOffset = 0;

//Variables to track light
let sunColor = new vec4;
let colors:vec4[] = [];
let directions:vec4[] = [];
let positions:vec4[] = [];
let angles:number[] = [];

//interaction and rotation state
let xAngle:number = 0;
let yAngle:number = 0;
let mouse_button_down:boolean = false;
let prevMouseX:number = 0;
let prevMouseY:number = 0;

//Store textures in graphics memory
let earthTex:WebGLTexture;
let earthSpecTex:WebGLTexture;
let earthNightTex:WebGLTexture;
let cloudTex:WebGLTexture;
let normalTex:WebGLTexture;

//We also need a main memory location to store the raw files into
let earthImage:HTMLImageElement;
let earthSpecImage:HTMLImageElement;
let earthNightImage:HTMLImageElement;
let cloudImage:HTMLImageElement;
let normalImage:HTMLImageElement;

//Toggle values to set active layers based on user input
let toggleClouds:boolean = true;
let textureMapOn:WebGLUniformLocation;
let isTextureMap:boolean = true;
let specularMapOn:WebGLUniformLocation;
let isSpecularMap:boolean = true;
let nightMapOn:WebGLUniformLocation;
let isNightMap:boolean = true;
let normalMapOn:WebGLUniformLocation;
let isNormalMap:boolean = true;

//Import helper functions
import {
    initFileShaders,
    vec4,
    vec2,
    mat4,
    flatten,
    perspective,
    translate,
    lookAt,
    rotateX,
    rotateY,
    rotateZ,
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
    scaleFactor:number = 1;
    bufferId:WebGLBuffer;

    //base class overridden by child class, each new object needs its own buffer and data
    initBuffer(gl:WebGLRenderingContext) {
    }

    //render this object, if parent model-view is provided, use the parent as the base to transform
    //returns the final model-view matrix used for this object so the children can use it
    render(gl:WebGLRenderingContext, umv:WebGLUniformLocation, uproj:WebGLUniformLocation, sphereNumber: number) {
        let mv:mat4;
        mv = lookAt(new vec4(cameraXOffset, cameraYOffset, cameraZOffset, 1), new vec4(cameraLookingAtXOffset, cameraLookingAtYOffset, cameraLookingAtZOffset, 1), (new vec4(0, 1, 0, 0)));

        gl.disableVertexAttribArray(vPosition); //in case the indices change
        //multiply translate matrix first, then rotate to get correct behavior
        mv = mv.mult(translate(this.xOffset, this.yOffset, this.zOffset));
        mv = mv.mult(rotateX(this.thetaX))
        mv = mv.mult(rotateY(this.thetaY))
        mv = mv.mult(rotateZ(this.thetaZ))
        let scaleMatrix:mat4;
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
        gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 56, 0);
        gl.enableVertexAttribArray(vPosition);

        gl.vertexAttribPointer(vNormal, 4, gl.FLOAT, false, 56, 16);
        gl.enableVertexAttribArray(vNormal);

        gl.vertexAttribPointer(vTangent, 4, gl.FLOAT, false, 56, 32);
        gl.enableVertexAttribArray(vTangent);

        gl.vertexAttribPointer(vTexCoord, 2, gl.FLOAT, false, 56, 48);
        gl.enableVertexAttribArray(vTexCoord);

        gl.vertexAttrib4fv(vSpecularColor, [0.7, 0.7, 0.7, 1.0]);
        gl.vertexAttrib1f(vSpecularExponent, 10);

        // earth
        if(sphereNumber == 0){
            //We want to send these textures over for the earth sphere
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, earthTex);
            //It's on texture unit 0, so send over the value 0
            gl.uniform1i(uTextureSampler, 0);

            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, earthSpecTex);
            //It's on texture unit 1, so send over the value 1
            gl.uniform1i(uSpecularSampler, 1);

            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, earthNightTex);
            //It's on texture unit 2, so send over the value 2
            gl.uniform1i(uNightSampler, 2);

            gl.activeTexture(gl.TEXTURE4);
            gl.bindTexture(gl.TEXTURE_2D, normalTex);
            gl.uniform1i(uNormalSampler, 4);

        }
        // clouds layer
        if(sphereNumber == 1) {
            //We want to send these textures over for the cloud sphere
            gl.activeTexture(gl.TEXTURE3);
            //We have transparency in this one, so enable blending and disable depth write
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
            gl.depthMask(false);
            gl.bindTexture(gl.TEXTURE_2D, cloudTex);
            //It's on texture unit 2, so send over the value 1
            gl.uniform1i(uCloudSampler, 3);
        }

        gl.drawArrays(gl.TRIANGLES, 0, this.numVertices());

        //and now put it back to appropriate values for opaque objects
        gl.disable(gl.BLEND);
        gl.depthMask(true);

        //Apply anisotropic filtering
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameterf(gl.TEXTURE_2D, anisotropic_ext.TEXTURE_MAX_ANISOTROPY_EXT, 16);

        return mv;
    }
    numVertices(): number {
        return 0; // child class overrides
    }

}

// class for sphere object
class Sphere extends RenderObject {
    private vertices: vec4[] = [];

    initBuffer(gl: WebGLRenderingContext) {
        //Build the ground vertices and color
        this.vertices = this.makeObjectVertices();
        //Send data to gpu
        this.bufferId = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferId);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(this.vertices), gl.STATIC_DRAW);
    }
    // Return number of vertices to parent class
    numVertices() {
        return this.vertices.length / 4;
    }
    // returns all the points for the sphere
    private makeObjectVertices(): vec4[] {
        let circleSlices:number = 100;
        let step:number = (360.0 / circleSlices)*(Math.PI / 180.0);
        let sphereverts:any[] = []
        for (let lat:number = 0; lat <= Math.PI ; lat += step){ //latitude
            for (let lon:number = 0; lon + step <= 2*Math.PI; lon += step){ //longitude

                //triangle 1
                // Vertex 1: (lat, lon)
                sphereverts.push(new vec4(Math.cos(lon) * Math.sin(lat), Math.cos(lat), Math.sin(lat) * Math.sin(lon), 1.0)); //Position
                sphereverts.push(new vec4(Math.cos(lon) * Math.sin(lat), Math.cos(lat), Math.sin(lat) * Math.sin(lon), 0.0)); //Normal
                sphereverts.push(new vec4(-Math.sin(lon), 0, Math.cos(lon), 0.0)); //Tangent, don't need sin(lat)
                // because since sin(lat) is a constant, it just scales it in the same direction
                sphereverts.push(new vec2(lon/(2*Math.PI), lat/(Math.PI))); //Texture coordinate

                // Vertex 2: (lat, lon+step)
                sphereverts.push(new vec4(Math.sin(lat) * Math.cos(lon + step), Math.cos(lat), Math.sin(lat) * Math.sin(lon + step), 1.0)); //Position
                sphereverts.push(new vec4(Math.sin(lat) * Math.cos(lon + step), Math.cos(lat), Math.sin(lat) * Math.sin(lon + step), 0.0)); //Normal
                sphereverts.push(new vec4(-Math.sin(lon + step), 0, Math.cos(lon + step), 0.0)); //Tangent
                sphereverts.push(new vec2((lon+step)/(2*Math.PI), lat/(Math.PI))); //Texture coordinate

                // Vertex 3: (lat+step, lon+step)
                sphereverts.push(new vec4(Math.cos(lon + step) * Math.sin(lat + step), Math.cos(lat + step), Math.sin(lat + step) * Math.sin(lon + step), 1.0)); //Position
                sphereverts.push(new vec4(Math.cos(lon + step) * Math.sin(lat + step), Math.cos(lat + step), Math.sin(lat + step) * Math.sin(lon + step), 0.0)); //Normal
                sphereverts.push(new vec4(-Math.sin(lon + step), 0, Math.cos(lon + step), 0.0)); //Tangent
                sphereverts.push(new vec2((lon+step)/(2*Math.PI), (lat+step)/(Math.PI))); //Texture coordinate

                //triangle 2
                // Vertex 4: (lat+step, lon+step)
                sphereverts.push(new vec4(Math.cos(lon + step) * Math.sin(lat + step), Math.cos(lat + step), Math.sin(lat + step) * Math.sin(lon + step), 1.0)); //Position
                sphereverts.push(new vec4(Math.cos(lon + step) * Math.sin(lat + step), Math.cos(lat + step), Math.sin(lat + step) * Math.sin(lon + step), 0.0)); //Normal
                sphereverts.push(new vec4(-Math.sin(lon + step), 0, Math.cos(lon + step), 0.0)); //Tangent
                sphereverts.push(new vec2((lon+step)/(2*Math.PI), (lat+step)/(Math.PI))); //Texture coordinate

                // Vertex 5: (lat+step, lon)
                sphereverts.push(new vec4(Math.sin(lat + step) * Math.cos(lon), Math.cos(lat + step), Math.sin(lat + step) * Math.sin(lon), 1.0)); //Position
                sphereverts.push(new vec4(Math.sin(lat + step) * Math.cos(lon), Math.cos(lat + step), Math.sin(lat + step) * Math.sin(lon), 0.0)); //Normal
                sphereverts.push(new vec4(-Math.sin(lon), 0, Math.cos(lon), 0.0)); //Tangent
                sphereverts.push(new vec2(lon/(2*Math.PI), (lat+step)/(Math.PI))); //Texture coordinate

                // Vertex 6: (lat, lon)
                sphereverts.push(new vec4(Math.cos(lon) * Math.sin(lat), Math.cos(lat), Math.sin(lat) * Math.sin(lon), 1.0)); //Position
                sphereverts.push(new vec4(Math.cos(lon) * Math.sin(lat), Math.cos(lat), Math.sin(lat) * Math.sin(lon), 0.0)); //Normal
                sphereverts.push(new vec4(-Math.sin(lon), 0, Math.cos(lon), 0.0)); //Tangent
                sphereverts.push(new vec2(lon/(2*Math.PI), lat/(Math.PI))); //Texture coordinate
            }
        }
        return sphereverts;
    }
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

        // Clamp xAngle to prevent flipping controls
        xAngle = Math.max(-89, Math.min(89, xAngle));
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

//sphere environment objects
let earth = new Sphere();
let clouds = new Sphere();

//Set up events to happen immediately when the page loads
window.onload = function init() {

    anisotropic_ext = gl.getExtension('EXT_texture_filter_anisotropic');

    //allow the user to rotate mesh with the mouse
    canvas.addEventListener("mousedown", mouse_down);
    canvas.addEventListener("mousemove", mouse_drag);
    canvas.addEventListener("mouseup", mouse_up);

    setShaderLocations(program);
    setShaderLocations(cloudProgram);

    //Initialize textures for earth before initializing its buffer
    initTextures();

    // Store each sphere in an array
    let spheres = [earth, clouds];

// sphere placements and scale factors
    for(let i = 0; i < spheres.length; i++) {
        // randomize sign

        // Apply random values to each sphere
        spheres[i].xOffset = 0;
        spheres[i].yOffset = 0;
        spheres[i].zOffset = 0;
        spheres[i].thetaX = 180;
        spheres[0].scaleFactor = 100;
        spheres[1].scaleFactor = 101;
    }

    //Send the data for the spheres to the gpu
    let spheres1 = [earth, clouds];

    for(let i = 0; i < spheres.length; i++) {
        spheres1[i].initBuffer(gl);
    }

    //Listen for keys to change layers and apply camera movements
    window.addEventListener("keydown" ,function(event){
        switch(event.key) {
            case "1":
                //Flip the boolean
                isTextureMap = !isTextureMap;
                gl.useProgram(program);
                if(isTextureMap) {
                    gl.uniform1i(textureMapOn, 1)
                } else {
                    gl.uniform1i(textureMapOn, 0)
                }
                break;
            case "2":
                //Flip the boolean
                isSpecularMap = !isSpecularMap;
                gl.useProgram(program);
                if(isSpecularMap) {
                    gl.uniform1i(specularMapOn, 1)
                } else {
                    gl.uniform1i(specularMapOn, 0)
                }
                break;
            case "3":
                //Flip the boolean
                isNightMap = !isNightMap;
                gl.useProgram(program);
                if(isNightMap) {
                    gl.uniform1i(nightMapOn, 1)
                } else {
                    gl.uniform1i(nightMapOn, 0)
                }
                break;
            case "4":
                //Flip the boolean
                isNormalMap = !isNormalMap;
                gl.useProgram(program);
                if(isNormalMap) {
                    gl.uniform1i(normalMapOn, 1)
                } else {
                    gl.uniform1i(normalMapOn, 0)
                }
                break;
            case "5":
                toggleClouds = !toggleClouds;
                break;
            case "ArrowDown":
                zoomIn = false;
                zoomOut = true;
                break;
            case "ArrowUp":
                zoomIn = true;
                zoomOut = false;
                break;
        }
        //now we need a new frame since we made a change
        requestAnimationFrame(render);
    });

    //Listen when for when user stops zooming
    window.addEventListener("keyup" ,function(event){
        switch(event.key) {
            case "ArrowDown":
                zoomIn = false;
                zoomOut = false;
                break;
            case "ArrowUp":
                zoomIn = false;
                zoomOut = false;
                break;
        }
        });

    //Draw to the entire screen
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    //Sets the background to sky blue
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    //Avoid having objects that are behind other objects show up anyway
    gl.enable(gl.DEPTH_TEST);

    window.setInterval(update, 16); //target 60 frames per second
};

//Store the locations of both the cloud and earth shader's uniforms and attributes
function setShaderLocations(currentProgram: WebGLProgram) {
    //If we are using the earth program
    if (currentProgram == program) {
        //use that parameter program for our rendering
        gl.useProgram(currentProgram);

        //Variables for telling the shader which layers are turned on or off
        textureMapOn = gl.getUniformLocation(currentProgram, "textureMapOn");
        specularMapOn = gl.getUniformLocation(currentProgram, "specularMapOn");
        nightMapOn = gl.getUniformLocation(currentProgram, "nightMapOn");
        normalMapOn = gl.getUniformLocation(currentProgram, "normalMapOn");

        //Initialize all the layers to be on
        gl.uniform1i(specularMapOn, 1)
        gl.uniform1i(nightMapOn, 1)
        gl.uniform1i(textureMapOn, 1)
        gl.uniform1i(normalMapOn, 1)

        //Earth samplers
        uTextureSampler = gl.getUniformLocation(currentProgram, "textureSampler"); //Get reference to samplers in frag shader
        uSpecularSampler = gl.getUniformLocation(currentProgram, "specularSampler");
        uNightSampler = gl.getUniformLocation(currentProgram, "nightSampler");
        uNormalSampler = gl.getUniformLocation(currentProgram, "normalSampler");

        // fetch earth uniform and attribute locations
        umv = gl.getUniformLocation(currentProgram, "model_view");
        uproj = gl.getUniformLocation(currentProgram, "projection");
        vPosition = gl.getAttribLocation(currentProgram, "vPosition");
        vNormal = gl.getAttribLocation(currentProgram, "vNormal");
        vTangent = gl.getAttribLocation(currentProgram, "vTangent");
        vTexCoord = gl.getAttribLocation(currentProgram, "texCoord"); //Texture coordinates
        vSpecularColor = gl.getAttribLocation(currentProgram, "vSpecularColor");
        vSpecularExponent = gl.getAttribLocation(currentProgram, "vSpecularExponent");
        light_position = gl.getUniformLocation(currentProgram, "light_position");
        light_color = gl.getUniformLocation(currentProgram, "light_color");
        light_direction = gl.getUniformLocation(currentProgram, "light_direction");
        spotLight_angle = gl.getUniformLocation(currentProgram, "spotLight_angle");
        ambient_light = gl.getUniformLocation(currentProgram, "ambient_light");

        //If we are using the cloud program
    } if(currentProgram == cloudProgram) {
        gl.useProgram(currentProgram);
        // cloud sampler
        uCloudSampler = gl.getUniformLocation(currentProgram, "cloudSampler");

        // fetch earth uniform and attribute locations
        cloudsUmv = gl.getUniformLocation(currentProgram, "model_view");
        cloudsUproj = gl.getUniformLocation(currentProgram, "projection");
        cloudLight_position = gl.getUniformLocation(currentProgram, "light_position");
        cloudLight_color = gl.getUniformLocation(currentProgram, "light_color");
        cloudLight_direction = gl.getUniformLocation(currentProgram, "light_direction");
        cloudSpotLight_angle = gl.getUniformLocation(currentProgram, "spotLight_angle");
        cloudAmbient_light = gl.getUniformLocation(currentProgram, "ambient_light");

    }
}

//request new frame
function update(){
    let secondsPerFrame = 0.016;
    //Rotate the earth
    earth.thetaY -= 5 * secondsPerFrame;
    //clouds are slower
    clouds.thetaY -= 2 * secondsPerFrame;
    //Zoom in
    if(zoomIn) {
        if(fov > 10){
            fov -= 25 * secondsPerFrame;
        }
    }
    //Zoom out
    if(zoomOut) {
        if(fov < 100){
            fov += 25 * secondsPerFrame;
        }
    }
    requestAnimationFrame(render);
}

//Initialize the textures
function initTextures() {
    // Day texture map
    earthTex = gl.createTexture();
    earthImage = new Image();
    earthImage.onload = function(){ handleTextureLoaded(earthImage, earthTex); }
    earthImage.src = "Earth.png";

    // Specular texture map
    earthSpecTex = gl.createTexture();
    earthSpecImage = new Image();
    earthSpecImage.onload = function(){ handleTextureLoaded(earthSpecImage, earthSpecTex); }
    earthSpecImage.src = "EarthSpec.png";

    //Night texture map
    earthNightTex = gl.createTexture();
    earthNightImage = new Image();
    earthNightImage.onload = function (){ handleTextureLoaded(earthNightImage, earthNightTex); }
    earthNightImage.src = "EarthNight.png";

    //Cloud texture map
    cloudTex = gl.createTexture();
    cloudImage = new Image();
    cloudImage.onload = function (){ handleTextureLoaded(cloudImage, cloudTex); }
    cloudImage.src = "EarthCloud.png";

    //Normal texture map
    normalTex = gl.createTexture();
    normalImage = new Image();
    normalImage.onload = function (){ handleTextureLoaded(normalImage, normalTex); }
    normalImage.src = "EarthNormal.png";
}

//Define a bunch of things for each texture
function handleTextureLoaded(image:HTMLImageElement, texture:WebGLTexture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);  //disagreement over what direction Y axis goes
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
}

//draw a new frame
function render(){
    //clear any previous data for both color and depth
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //set screen projection
    let p:mat4 = perspective(fov, canvas.clientWidth / canvas.clientHeight, 1.0, 1000.0);

    //Set view matrix for light calculations
    let mv:mat4 = lookAt(new vec4(cameraXOffset, cameraYOffset, cameraZOffset, 1), new vec4(cameraLookingAtXOffset, cameraLookingAtYOffset, cameraLookingAtZOffset, 1), (new vec4(0, 1, 0, 0)));

    //Rotate camera around the earth with mouse dragging
    let cameraRadius = 300;
    let xMouseAngleRadians = xAngle * (Math.PI / 180);
    let yMouseAngleRadians = -yAngle * (Math.PI / 180);
    cameraXOffset = cameraRadius * Math.cos(xMouseAngleRadians) * Math.sin(yMouseAngleRadians);
    cameraYOffset = cameraRadius * Math.sin(xMouseAngleRadians);
    cameraZOffset = cameraRadius * Math.cos(xMouseAngleRadians) * Math.cos(yMouseAngleRadians);

    //Render the earth and clouds in separate spheres
    //Pass in the corresponding uniform and attributes in their proper locations
    let spheres = [earth, clouds];

    for(let i = 0; i < spheres.length; ++i) {
        //Render earth
        if(i ==0) {
            gl.useProgram(program);
            //Lighting
            sunColor = new vec4(1.0, 0.95, 0.8, 1.0);
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            //Set the light color and ambient light color
            gl.uniform4fv(ambient_light, [0.3, 0.3, 0.3, 1]);

            // Set all light colors
            colors = [
                sunColor,
            ]
            gl.uniform4fv(light_color, flatten(colors));

            // Set all light positions
            positions = [
                mv.mult(new vec4(-5000, 0, 0, 1)), //Overhead light
            ]
            gl.uniform4fv(light_position, flatten(positions));
            // Set all light directions
            directions = [
                mv.mult(new vec4(1, 0, 0, 0)), //Overhead light
            ]
            gl.uniform4fv(light_direction, flatten(directions));
            //Set all spotlight angles
            angles = [
                -1.0, //overhead light
            ]
            gl.uniform1fv(spotLight_angle, angles);

            // Earth Colors
            gl.uniformMatrix4fv(uproj, false, p.flatten());
            // Render the earth
            spheres[i].render(gl, umv, uproj, i);
        }
        //Render clouds
        if(i == 1 && toggleClouds) {
            gl.useProgram(cloudProgram);

            //Set the light color and ambient light color
            gl.uniform4fv(cloudAmbient_light, [0.3, 0.3, 0.3, 1]);

            sunColor = new vec4(1.0, 0.95, 0.8, 1.0);

            // Set all light colors
            colors = [
                sunColor,
            ]
            gl.uniform4fv(cloudLight_color, flatten(colors));

            // Set all light positions
            positions = [
                mv.mult(new vec4(-5000, 0, 0, 1)), //Overhead light
            ]
            gl.uniform4fv(cloudLight_position, flatten(positions));
            // Set all light directions
            directions = [
                mv.mult(new vec4(1, 0, 0, 0)), //Overhead light
            ]
            gl.uniform4fv(cloudLight_direction, flatten(directions));
            //Set all spotlight angles
            angles = [
                -1.0, //overhead light
            ]
            gl.uniform1fv(cloudSpotLight_angle, angles);
            //Render the earth
            gl.uniformMatrix4fv(cloudsUproj, false, p.flatten());
            spheres[i].render(gl, cloudsUmv, cloudsUproj, i);
        }

    }

}
