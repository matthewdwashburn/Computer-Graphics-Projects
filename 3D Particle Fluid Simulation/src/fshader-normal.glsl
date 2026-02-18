#version 300 es
precision highp float;
precision lowp int;

in vec2 vTexCoord;
uniform sampler2D blurSampler; //Bilaterally blurred texture and depth map

uniform vec2 inverseScreenSize;
uniform mat4 inverseProjection; //Take objects from clip space to view space
uniform mat4 inverseView; //Take objects from view space to world space

out vec4 fColor;

//Special thanks to Sebastian Lague

//Given a pixel's texture position, use density to calculate it's position in view space
vec3 viewPosition (vec2 texCoord) {
    vec4 depthSample = texture(blurSampler, texCoord);
    float depth = depthSample.a;

    //Convert texture coordinates to screen coordinates
    vec2 normalizedDeviceCoords = texCoord * 2.0 - 1.0;

    //Reconstruct the viewVector pointing from the camera to the object
    //Take the ndc from clip space to view space with the inverse proj matrix
    vec4 viewVector = inverseProjection * vec4(normalizedDeviceCoords, -1.0, 1.0);
    viewVector/=viewVector.a;
    vec3 viewDirection = normalize(viewVector.xyz);
    //Step in the direction of the pixel the same number of times as its depth
    return vec3(viewDirection * depth);
}

void main()
{
    //Store the color and depth of the blurred texture coordinate
    vec4 blurSample = texture(blurSampler, vTexCoord);

    //Get the view space position and depth of the starting center of the texel
    vec3 originalPos = viewPosition(vTexCoord);
    float texDepth = blurSample.a;

    //Skip normalizing texel is in the background
    if(texDepth > 900.0) {
        fColor = vec4(blurSample.xyz, 1000.0);
        return;
    }

    //Calculate the vector change in (derivative of) the view space position when stepping in the x texel direction
    vec3 rightPos = viewPosition(vTexCoord + vec2(inverseScreenSize.x, 0.0));
    vec3 leftPos = viewPosition(vTexCoord - vec2(inverseScreenSize.x, 0.0));
    vec3 ddx1 = (rightPos - originalPos);
    vec3 ddx2 =  (originalPos - leftPos);

    //Choose the x derivative with the smaller change in depth
    if(abs(ddx2.z) < abs(ddx1.z)) {
        ddx1 = ddx2;
    }

    //Calculate the vector change in (derivative of) the view space position when stepping in the y texel direction
    vec3 upPos = viewPosition(vTexCoord + vec2(0.0, inverseScreenSize.y));
    vec3 downPos = viewPosition(vTexCoord - vec2(0.0, inverseScreenSize.y));
    vec3 ddy1 = (upPos - originalPos);
    vec3 ddy2 =  (originalPos - downPos);

    //Choose the y derivative with the smaller change in depth
    if(abs(ddy2.z) < abs(ddy1.z)) {
        ddy1 = ddy2;
    }

    //Calculate the normal by crossing the two derivatives, since their change is based on the distance from the camera,
    // their cross product gives you the vector pointing from the px point in view space to the camera
    vec3 viewNormal = normalize(cross(ddx1, ddy1));

    //Change respecting origin for the view normal vector from the camera to the center of the world using inverse view matrix
    vec3 worldNormal = mat3(inverseView) * viewNormal;

    //Set each frag color channel to its corresponding normalized vector axis value, normalized to values between 0 and 1
    fColor = vec4(worldNormal * 0.5 + 0.5, texDepth);
}