#version 300 es
precision highp float;
precision lowp int;

in vec2 vTexCoord;
uniform sampler2D compositeSampler; //Color AND Depth Map

uniform vec2 direction;
uniform vec2 inverseScreenSize;
uniform int filterRadius;
uniform float spatialScale;
uniform float depthFalloff;

//TODO make blur adjust based on world radius
//uniform float worldRadius;
//uniform int maxScreenSpaceRadius;


out vec4 fColor;

void main()
{
    //Store the color and depth of the original texture coordinate
    vec4 compositeSample = texture(compositeSampler, vTexCoord);

    float originalDepth = compositeSample.a;

    //TODO Fix sharp background blur cutoff
//    for(int i = -filterRadius; i <= filterRadius; i++) {
//
//        if(i=0)continue;
//        //Calculate neighbor coordinates using i, scaling by 1/512 so we increment by 1 pixel instead of 100% of the screen size
//        vec2 neighborSampleCoord = vTexCoord + float(i) * direction * inverseScreenSize;
//
//        //Grab the neighbor pixel's depth by sampling its texture
//        vec4 neighborSample = texture(compositeSampler, neighborSampleCoord);
//        float neighborDepth = neighborSample.a;
//    }

    //Skip blurring background
    if(originalDepth > 900.0) {
        fColor = compositeSample;
        return;
    }

    //Sum of the neighbors colors multiplied by how much depth each color has
    // based on its difference in distance and depth from the original pixel
    vec4 colorSum = vec4(0.0, 0.0, 0.0, 0.0);

    //Sum of the total depth influence of all the neighbor pixels that we have looked at
    float weightSum = 0.0;

    //Cycle through pixels starting at the -10 left or -10 bottom pixel in the filter radius and work to the 10 right or 10 top most pixel
    //Depending on if this is the horizontal or vertical blurring pass (filter radius = 10)
    for(int i = -filterRadius; i <= filterRadius; i++) {

        //Calculate neighbor coordinates using i, scaling by 1/512 so we increment by 1 pixel instead of 100% of the screen size
        vec2 neighborSampleCoord = vTexCoord + float(i) * direction * inverseScreenSize;

        //Grab the neighbor pixel's depth by sampling its texture
        vec4 neighborSample = texture(compositeSampler, neighborSampleCoord);
        float neighborDepth = neighborSample.a;

        //Calculate spatial weight using the gaussian bell curve formula w = e^(-distance²)
        //Spatial scale is 0.5, so every pixel move towards the original pixel doubles this neighbor pixels spatial weight (r is negative)
        //All the way to 0, where the spatial weight becomes 1, which is 100% influence
        float spatialDistance = float(i) * spatialScale;
        float spatialWeight = exp(-spatialDistance*spatialDistance);

        //Range weight (Bilateral), calculates difference in original and neighbor pixel depth and multiplies it by a fall off scaler
        //Still using the same gaussian bell curve formula w2 = e^(-depthDiff²)
        float depthDiff = (neighborDepth - originalDepth) * depthFalloff;
        float depthWeight = exp(-depthDiff*depthDiff);

        //Store neighbor weight
        float neighborWeight = spatialWeight * depthWeight;

        //Add depth scaled by weight (influence) for neighbor pixel
        colorSum += neighborSample * neighborWeight;

        //Add to total influence of all neighbor pixels
        weightSum += neighborWeight;

    }

    //Normalize influence for original pixel
    if(weightSum > 0.0) {
        colorSum /= weightSum;
    }

    //Set this pixel to its new bilaterally filtered and gaussian blurred color and depth
    fColor = vec4(colorSum);

}