/*global THREE*/
/*global Stats*/
window.addEventListener('load', init, false);

var sceneWidth;
var sceneHeight;
var camera;
var scene;
var renderer;
var dom;
var sun;
var ground;
var orbitControl;
var rollingGroundSphere;
var heroSphere;
var baseSpeed=0.006; // 基础游戏速度
var rollingSpeed=baseSpeed; // 当前实际速度（会被血氧数据调整）
var heroRollingSpeed;
var worldRadius=26;
var heroRadius=0.2;
var sphericalHelper;
var pathAngleValues;
var heroBaseY=1.8;
var bounceValue=0.1;
var gravity=0.005;
var leftLane=-1;
var rightLane=1;
var middleLane=0;
var currentLane;
var clock;
var jumping;
var treeReleaseInterval=1.2; // 增加间隔，让金币分布更稀疏
var lastTreeReleaseTime=0;
var treesInPath;
var treesPool;
var particleGeometry;
var particleCount=20;
var explosionPower =1.06;
var particles;
var stats;

// 全局金币资源（优化性能）
var coinTexture = null;
var coinMaterial = null;
var scoreText;
var score;
var hasCollided;

function init() {
	// set up the scene
	createScene();

	//call game loop
	update();
}

function createScene(){
	console.log("🎮 Game initializing...");
	console.log("📦 THREE.js version:", THREE.REVISION);
	hasCollided=false;
	score=0;
	treesInPath=[];
	treesPool=[];
	clock=new THREE.Clock();
	clock.start();
	heroRollingSpeed=(rollingSpeed*worldRadius/heroRadius)/5;

	// 初始化全局金币资源（优化性能）
	initCoinResources();
	sphericalHelper = new THREE.Spherical();
	pathAngleValues=[1.52,1.57,1.62];
    sceneWidth=window.innerWidth;
    sceneHeight=window.innerHeight;
    scene = new THREE.Scene();//the 3d scene
    // 移除雾效，设置蓝天背景
    camera = new THREE.PerspectiveCamera( 60, sceneWidth / sceneHeight, 0.1, 1000 );//perspective camera
    renderer = new THREE.WebGLRenderer({alpha:true});//renderer with transparent backdrop
    renderer.setClearColor(0x87CEEB, 1); // 天空蓝色 
    renderer.shadowMap.enabled = true;//enable shadow
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize( sceneWidth, sceneHeight );
    dom = document.getElementById('TutContainer');
	dom.appendChild(renderer.domElement);
	// stats = new Stats(); // 隐藏性能统计显示
	// dom.appendChild(stats.dom);
	createTreesPool();
	addWorld();
	addHero();
	addLight();
	addExplosion();
	
	camera.position.z = 6.5;
	camera.position.y = 3.5;
	orbitControl = new THREE.OrbitControls( camera, renderer.domElement );//helper to rotate around in scene
	orbitControl.addEventListener( 'change', render );
	//orbitControl.enableDamping = true;
	//orbitControl.dampingFactor = 0.8;
	orbitControl.noKeys = true;
	orbitControl.noPan = true;
	orbitControl.enableZoom = false;
	orbitControl.minPolarAngle = 1.1;
	orbitControl.maxPolarAngle = 1.1;
	orbitControl.minAzimuthAngle = -0.2;
	orbitControl.maxAzimuthAngle = 0.2;
	
	window.addEventListener('resize', onWindowResize, false);//resize callback

	document.onkeydown = handleKeyDown;
	
	scoreText = document.createElement('div');
	scoreText.style.position = 'absolute';
	//text2.style.zIndex = 1;    // if you still don't see the label, try uncommenting this
	scoreText.style.width = 100;
	scoreText.style.height = 100;
	//scoreText.style.backgroundColor = "blue";
	scoreText.innerHTML = "0";
	scoreText.style.top = 10 + 'px';
	scoreText.style.left = 100 + 'px';
	// document.body.appendChild(scoreText); // 隐藏原生分数显示，使用Vue UI替代

	// 监听父页面Vue组件的消息
	window.addEventListener('message', function(e) {
		if (e.data.type === 'oxygen-data') {
			// 血氧数据影响游戏速度 - 基于设定的基础速度调整
			rollingSpeed = baseSpeed * e.data.speedMultiplier;
			console.log('🧠 血氧数据调整游戏速度:', e.data.speedMultiplier, '新速度:', rollingSpeed);
		}
		if (e.data.type === 'exit-game') {
			// 停止游戏循环
			if (typeof globalRenderID !== 'undefined') {
				cancelAnimationFrame(globalRenderID);
			}
			console.log('🚪 游戏退出');
		}
		if (e.data.type === 'keydown') {
			// 处理转发的键盘事件
			var keyEvent = { keyCode: e.data.keyCode };
			handleKeyDown(keyEvent);
			console.log('⌨️ 收到转发的键盘事件:', e.data.keyCode);
		}
		if (e.data.type === 'speed-change') {
			// 用户手动调整游戏速度
			baseSpeed = e.data.speed;
			rollingSpeed = baseSpeed; // 立即应用新速度
			console.log('⚡ 手动调整游戏速度:', e.data.level, '新速度:', baseSpeed);
		}
	});
}
function addExplosion(){
	particleGeometry = new THREE.Geometry();
	for (var i = 0; i < particleCount; i ++ ) {
		var vertex = new THREE.Vector3();
		particleGeometry.vertices.push( vertex );
	}
	var pMaterial = new THREE.ParticleBasicMaterial({
	  color: 0xFFD700,  // 金色爆炸特效
	  size: 0.3         // 略微增大粒子
	});
	particles = new THREE.Points( particleGeometry, pMaterial );
	scene.add( particles );
	particles.visible=false;
}
function createTreesPool(){
	var maxTreesInPool=150; // 增加金币池容量，支持更长时间游戏
	var newTree;
	for(var i=0; i<maxTreesInPool;i++){
		newTree=createTree();
		treesPool.push(newTree);
	}
}
function handleKeyDown(keyEvent){
	if(jumping)return;
	var validMove=true;
	if ( keyEvent.keyCode === 37) {//left
		if(currentLane==middleLane){
			currentLane=leftLane;
		}else if(currentLane==rightLane){
			currentLane=middleLane;
		}else{
			validMove=false;	
		}
	} else if ( keyEvent.keyCode === 39) {//right
		if(currentLane==middleLane){
			currentLane=rightLane;
		}else if(currentLane==leftLane){
			currentLane=middleLane;
		}else{
			validMove=false;	
		}
	}else{
		if ( keyEvent.keyCode === 38){//up, jump
			bounceValue=0.1;
			jumping=true;
		}
		validMove=false;
	}
	//heroSphere.position.x=currentLane;
	if(validMove){
		jumping=true;
		bounceValue=0.06;
	}
}
function addHero(){
	var sphereGeometry = new THREE.DodecahedronGeometry( heroRadius, 1);
	var sphereMaterial = new THREE.MeshStandardMaterial( { color: 0xe5f2f2 ,shading:THREE.FlatShading} )
	jumping=false;
	heroSphere = new THREE.Mesh( sphereGeometry, sphereMaterial );
	heroSphere.receiveShadow = true;
	heroSphere.castShadow=true;
	scene.add( heroSphere );
	heroSphere.position.y=heroBaseY;
	heroSphere.position.z=4.8;
	currentLane=middleLane;
	heroSphere.position.x=currentLane;
}
function addWorld(){
	var sides=40;
	var tiers=40;
	var sphereGeometry = new THREE.SphereGeometry( worldRadius, sides,tiers);
	var sphereMaterial = new THREE.MeshStandardMaterial( { color: 0xbed742 ,shading:THREE.FlatShading} )  // 草地绿色
	
	var vertexIndex;
	var vertexVector= new THREE.Vector3();
	var nextVertexVector= new THREE.Vector3();
	var firstVertexVector= new THREE.Vector3();
	var offset= new THREE.Vector3();
	var currentTier=1;
	var lerpValue=0.5;
	var heightValue;
	var maxHeight=0.07;
	for(var j=1;j<tiers-2;j++){
		currentTier=j;
		for(var i=0;i<sides;i++){
			vertexIndex=(currentTier*sides)+1;
			vertexVector=sphereGeometry.vertices[i+vertexIndex].clone();
			if(j%2!==0){
				if(i==0){
					firstVertexVector=vertexVector.clone();
				}
				nextVertexVector=sphereGeometry.vertices[i+vertexIndex+1].clone();
				if(i==sides-1){
					nextVertexVector=firstVertexVector;
				}
				lerpValue=(Math.random()*(0.75-0.25))+0.25;
				vertexVector.lerp(nextVertexVector,lerpValue);
			}
			heightValue=(Math.random()*maxHeight)-(maxHeight/2);
			offset=vertexVector.clone().normalize().multiplyScalar(heightValue);
			sphereGeometry.vertices[i+vertexIndex]=(vertexVector.add(offset));
		}
	}
	rollingGroundSphere = new THREE.Mesh( sphereGeometry, sphereMaterial );
	rollingGroundSphere.receiveShadow = true;
	rollingGroundSphere.castShadow=false;
	rollingGroundSphere.rotation.z=-Math.PI/2;
	scene.add( rollingGroundSphere );
	rollingGroundSphere.position.y=-24;
	rollingGroundSphere.position.z=2;
	// addWorldTrees(); // 注释掉侧边金币生成，只保留主道金币
}
function addLight(){
	var hemisphereLight = new THREE.HemisphereLight(0xfffafa,0x000000, .9)
	scene.add(hemisphereLight);
	sun = new THREE.DirectionalLight( 0xcdc1c5, 0.9);
	sun.position.set( 12,6,-7 );
	sun.castShadow = true;
	scene.add(sun);
	//Set up shadow properties for the sun light
	sun.shadow.mapSize.width = 256;
	sun.shadow.mapSize.height = 256;
	sun.shadow.camera.near = 0.5;
	sun.shadow.camera.far = 50 ;
}
function addPathTree(){
	// 限制场景中的金币数量，防止资源消耗过大
	if(treesInPath.length > 20) {
		return; // 最多20个活跃金币
	}

	var options=[0,1,2];
	var lane= Math.floor(Math.random()*3);
	addTree(true,lane);
	options.splice(lane,1);
	if(Math.random()>0.9){ // 降低双金币概率：25% → 10%
		lane= Math.floor(Math.random()*2);
		addTree(true,options[lane]);
	}
}
function addWorldTrees(){
	var numTrees=36;
	var gap=6.28/36;
	for(var i=0;i<numTrees;i++){
		addTree(false,i*gap, true);
		addTree(false,i*gap, false);
	}
}
function addTree(inPath, row, isLeft){
	var newTree;
	if(inPath){
		// 直接创建新金币，无限生成
		newTree=createTree();
		if(!newTree) return; // 材质未就绪则跳过生成
		newTree.visible=true;
		treesInPath.push(newTree);
		sphericalHelper.set( worldRadius+0.18, pathAngleValues[row], -rollingGroundSphere.rotation.x+4 );
	}else{
		newTree=createTree();
		if(!newTree) return; // 材质未就绪则跳过生成
		var forestAreaAngle=0;//[1.52,1.57,1.62];
		if(isLeft){
			forestAreaAngle=1.68+Math.random()*0.1;
		}else{
			forestAreaAngle=1.46-Math.random()*0.1;
		}
		sphericalHelper.set( worldRadius+0.18, forestAreaAngle, row );
	}
	newTree.position.setFromSpherical( sphericalHelper );
	var rollingGroundVector=rollingGroundSphere.position.clone().normalize();
	var treeVector=newTree.position.clone().normalize();
	newTree.quaternion.setFromUnitVectors(treeVector,rollingGroundVector);
	newTree.rotation.x+=(Math.random()*(2*Math.PI/10))+-Math.PI/10;
	
	rollingGroundSphere.add(newTree);
}

// 初始化金币资源（性能优化）
function initCoinResources() {
	console.log("🪙 Initializing shared coin resources...");
	var textureLoader = new THREE.TextureLoader();
	textureLoader.load('assets/coin.png', function(texture) {
		coinTexture = texture;
		coinMaterial = new THREE.SpriteMaterial({
			map: coinTexture,
			color: 0xffffff,
			transparent: true
		});
		console.log("✅ Coin resources loaded successfully");
	}, undefined, function(error) {
		console.error("❌ Failed to load coin texture:", error);
	});
}

// 创建金币代替树木
function createTree(){
	// 确保材质已加载
	if(!coinMaterial) {
		console.warn("⚠️ Coin material not ready yet");
		return null;
	}

	// 克隆材质避免状态污染
	var coin = new THREE.Sprite(coinMaterial.clone());
	coin.scale.set(0.8, 0.8, 1);  // 调整金币大小
	coin.position.y = 0.5;  // 略高于地面，确保可见并可收集

	// 标记属性
	coin.isCoin = true;
	coin.collected = false;

	return coin;
}
// 删除旧的树木函数，已替换为金币

// 金币收集动画
function animateCoinCollection(coin){
	// 向上飘动并消失的动画
	coin.visible = false; // 简单地隐藏金币
	// 可以在这里播放音效等
}

function update(){
	// stats.update(); // 已注释stats，这里也要注释
    //animate
    rollingGroundSphere.rotation.x += rollingSpeed;
    heroSphere.rotation.x -= heroRollingSpeed;
    
    // 旋转所有金币
    for(var i=0; i<treesInPath.length; i++){
    	if(!treesInPath[i].collected && treesInPath[i].isCoin){
    		treesInPath[i].rotation.y += 0.03; // 金币旋转
    	}
    }
    if(heroSphere.position.y<=heroBaseY){
    	jumping=false;
    	bounceValue=(Math.random()*0.04)+0.005;
    }
    heroSphere.position.y+=bounceValue;
    heroSphere.position.x=THREE.Math.lerp(heroSphere.position.x,currentLane, 2*clock.getDelta());//clock.getElapsedTime());
    bounceValue-=gravity;
    if(clock.getElapsedTime()>treeReleaseInterval){
    	clock.start();
    	addPathTree();
    }
    doTreeLogic();
    doExplosionLogic();
    render();
	requestAnimationFrame(update);//request next update
}
function doTreeLogic(){
	var oneTree;
	var treePos = new THREE.Vector3();
	var treesToRemove=[];
	treesInPath.forEach( function ( element, index ) {
		oneTree=treesInPath[ index ];
		treePos.setFromMatrixPosition( oneTree.matrixWorld );
		if(treePos.z>6){//gone out of our view zone (包括被收集的隐藏金币)
			treesToRemove.push(oneTree);
		}else{//check collision
			if(treePos.distanceTo(heroSphere.position)<=0.6){
				if(oneTree.isCoin && !oneTree.collected){
					console.log("💰 Coin collected! +10 points");
					oneTree.collected = true;
					explode();  // 触发金色爆炸特效
					oneTree.visible = false;  // 隐藏金币
					score += 10;

					// 通知父页面Vue组件分数更新
					if (window.parent !== window) {
						window.parent.postMessage({
							type: 'score-update',
							score: score,
							timestamp: Date.now()
						}, '*');
					}

					scoreText.innerHTML = "Score: " + score;
				}
			}
		}
	});
	var fromWhere;
	treesToRemove.forEach( function ( element, index ) {
		oneTree=treesToRemove[ index ];
		fromWhere=treesInPath.indexOf(oneTree);
		treesInPath.splice(fromWhere,1);

		// 从正确的父对象移除金币（关键修复！）
		rollingGroundSphere.remove(oneTree);
	});
}
function doExplosionLogic(){
	if(!particles.visible)return;
	for (var i = 0; i < particleCount; i ++ ) {
		particleGeometry.vertices[i].multiplyScalar(explosionPower);
	}
	if(explosionPower>1.005){
		explosionPower-=0.001;
	}else{
		particles.visible=false;
	}
	particleGeometry.verticesNeedUpdate = true;
}
function explode(){
	particles.position.y=2;
	particles.position.z=4.8;
	particles.position.x=heroSphere.position.x;
	for (var i = 0; i < particleCount; i ++ ) {
		var vertex = new THREE.Vector3();
		vertex.x = -0.2+Math.random() * 0.4;
		vertex.y = -0.2+Math.random() * 0.4 ;
		vertex.z = -0.2+Math.random() * 0.4;
		particleGeometry.vertices[i]=vertex;
	}
	explosionPower=1.07;
	particles.visible=true;
}
function render(){
    renderer.render(scene, camera);//draw
}
function gameOver () {
  //cancelAnimationFrame( globalRenderID );
  //window.clearInterval( powerupSpawnIntervalID );
}
function onWindowResize() {
	//resize & align
	sceneHeight = window.innerHeight;
	sceneWidth = window.innerWidth;
	renderer.setSize(sceneWidth, sceneHeight);
	camera.aspect = sceneWidth/sceneHeight;
	camera.updateProjectionMatrix();
}