// MIT License

// Copyright (c) [2017] [Karteek Suryadevara||V3ng3nc3]

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.


// Read-only reference extracted from Wallpaper Engine workshop 893418273/main.js.
// Full source SHA-256 (LF normalized): 893ab1ea29cbb23d91afda94a3ee3f71b8b7a6596f53985665ee4265577298cc
// Only trailing whitespace was removed from the original particle definitions; browser globals are supplied by the test.

//deleting particles
Particle.prototype.delete = function(){
	delete particles[this.id];
}
//drawing particles
Particle.prototype.draw = function(){
	this.x += this.vx;
	this.y += this.vy;
	if(this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.heights){
		delete particles[this.id];
	}
	ctx.beginPath();
	ctx.arc(this.x , this.y, this.radius, 0, 2 * Math.PI);
	if(rainbowParticle){
		if(twinkle){
			fromParticle = true;
			ctx.fillStyle = RainBowColor(Math.random()*128, 128);
			fromParticle = false;
		}else{
			ctx.fillStyle = this.colorParticle;
		}
	}else{
		ctx.fillStyle = particleColor;
	}
	ctx.fill();
	this.radius = this.radius * 1.0019;
	if(((audioSample[0] + audioSample[1] + audioSample[2] + audioSample[3] + audioSample[4])) > 0.60){
		this.vx = this.vx * 1.111;
		this.vy = this.vy * 1.111;
	}else if(((audioSample[29] + audioSample[30] + audioSample[31] + audioSample[32] + audioSample[33]) ) > 0.5){
		this.vx = this.vx * 1.0177;
		this.vy = this.vy * 1.0177;
	}else{
		this.vx = this.vx * 1.0059;
		this.vy = this.vy * 1.0059;
	}
}
//creating particle properties
function Particle(){
	this.y = Math.random() * canvas.height;
	this.x = Math.random() * canvas.width;
	this.radius = Math.random() * 2 + userParticleRadius;
	this.vx = 0;
	this.vy = 0;
	this.radians = Math.atan((canvas.height/2-this.y)/(canvas.width/2-this.x));
	this.vx = 1.5 * Math.cos(this.radians);
	this.vy = 1.5 * Math.sin(this.radians);
	fromParticle = true;
	this.colorParticle = RainBowColor(Math.random()*128, 128);
	fromParticle = false;
	if(this.x < canvas.width/2){
		this.vx = -this.vx;
		this.vy = -this.vy;
	}
	particleIndex++;
	particles[particleIndex] = this;
	this.id = particleIndex;
}
//particleStyle2
function ParticlesStyle2(){
	this.x = Math.random() * canvas.width;
	this.y = Math.random() * canvas.height;
	this.z = Math.random() * canvas.width;
	this.opacity = 100;
}
//drawing particles
ParticlesStyle2.prototype.draw = function(){
	var particleZoom = 1;
	var focalLength = canvas.width/particleZoom;
	var particleRadius = 0.5 + userParticleRadius + (particleZoom/10);
	var x = (this.x - canvas.width/2) * (focalLength/this.z);
	x = x + canvas.width/2;

	var y = (this.y - canvas.height/2) * (focalLength/this.z);
	y = y + canvas.height/2;
	var depth = particleRadius *  (focalLength/this.z);

	if(depth >= maxDepth){
		this.opacity = this.opacity -4;
	}
	ctx.beginPath();
	// ctx.fillStyle = "rgba(250, 250, 250," + this.opacity / canvas.width + ")";
	// ctx.fillStyle = "rgba(250, 250, 250," +  this.opacity / 100+ ")";
	ctx.fillStyle = "rgba(" + customParColor + "," + this.opacity / 100 + ")";
	ctx.arc(x, y, depth, 0, 2 * Math.PI);
	ctx.fill();
}
//updating particles
ParticlesStyle2.prototype.update = function(){
	if(((audioSample[0] + audioSample[1] + audioSample[2] + audioSample[3] + audioSample[4])) >2.0){
		if(speed >= 20){
			speed = 20;
		}else{
			speed ++;
		}
		clearOpacity = 0.4;
	}
	else if(((audioSample[0] + audioSample[1] + audioSample[2] + audioSample[3] + audioSample[4])) > 0.5){
		if(speed > 8){
			speed = speed -2;
		}else if(speed<8){
			speed++;
		}else{
			speed = 8;
		}
		clearOpacity = 0.65;
	}
	else{
		speed = 2;
		clearOpacity =1;
	}

	this.z = this.z - speed;
	if(this.z <= 0 || this.z > canvas.width){
		this.z = canvas.width;
		this.opacity = 100;
		this.x = Math.random() * canvas.width;
		this.y = Math.random() * canvas.height;
	}
}
