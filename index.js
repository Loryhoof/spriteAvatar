import * as THREE from 'three';
import metaversefile from 'metaversefile';
import {SpriteMixer} from './SpriteMixer.js';
import spriteAvatar from '../spriteAvatar/index.js';
const {useApp, useFrame, useLoaders, usePhysics, useCleanup, useLocalPlayer, useCamera} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

class HealthMesh {
  constructor() {
    this.mesh = null;
    this.owner = null;
  }
  create(npcPlayer) {

    let uniforms = {
      hp: {value: 0},
      time: {value: 1}
    }
    
    const vertexShader = () => {
      return `
          varying vec2 vUv;
          varying float rara;
          uniform float width;
          uniform float height;
          uniform float time;
          
          varying vec4 v_foo;
    
          void main() {
              vUv = uv; 
    
              vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
              gl_Position = projectionMatrix * modelViewPosition;
    
              if(gl_Position.x > 0.5) {
                rara = 0.5;
              }
              else {
                rara = 0.;
              }
    
              v_foo = gl_Position;
    
          }
      `;
    }
    
    const fragmentShader = () => {
      return `
          uniform sampler2D texture1; 
          //uniform sampler2D texture2; 
          varying vec2 vUv;
          varying float rara;
          uniform float width;
          uniform float height;
          uniform float time;
          
          uniform float hp;
    
          varying vec4 v_foo;
    
          void main() {
              vec3 colorRed = vec3(247., 0., 0.) / 255.0;
              vec3 colorWhite = vec3(31., 31., 31.) / 255.0;
    
              float pulse = sin(time) + 1.;
              //float letters = 1. - letter(uUv.x / 3. * clamp(1, 1., 2.), 1.) * pulse;
    
              float cut = step(0.01, vUv.x);
              //vec4 finalColor = vec4(colorRed.rgb, 1);
              //vec3 finalColor = vec3(1. - uv.r) * letters;
              //finalColor += vec4(1. - letters) * vec4(1. - cut) * vec4(colorRed.rgb, 1);
    
              if(vUv.x < hp) {
                //colorRed.r *= pulse;
                gl_FragColor = vec4(colorRed, 1);
              }
              else {
                gl_FragColor = vec4(colorWhite, 1);
              }
    
              
              
              //gl_FragColor = vec4(color, 1);
    
              //if(gl_FragColor
          }
      `;
    }

    let material =  new THREE.ShaderMaterial({
      uniforms: uniforms,
      fragmentShader: fragmentShader(),
      vertexShader: vertexShader(),
      side: THREE.DoubleSide
    })
      
    let geom = new THREE.PlaneGeometry(.8,.1);
    this.mesh = new THREE.Mesh(geom, material);
    npcPlayer.add(this.mesh);
    this.owner = npcPlayer;
  }
  delete() {
    if(this.mesh && this.owner) {
      this.owner.remove(this.mesh);

      this.mesh = null;
      this.owner = null;
    }
  }
  update() {
    if(this.mesh && this.owner) {
      let baseHealth = 100;
      let health = this.owner.hitTracker.hp / baseHealth;
      //this.mesh.position.copy(this.owner.position);

      //this.mesh.rotation.copy(useCamera().rotation);

      let offset = new THREE.Vector3(1.25, 0.75, 0);
      this.mesh.position.copy(offset);
      this.mesh.updateMatrixWorld();

      this.mesh.material.uniforms.hp.value = health;
      this.mesh.material.uniformsNeedUpdate = true;
      //console.log(this.mesh.position, this.owner.position)
    }
  }
}

export default () => {
  const app = useApp();
  const physics = usePhysics();
  const localPlayer = useLocalPlayer();
  const camera = useCamera();

  let spriteMixer = SpriteMixer();

  let hpMesh = new HealthMesh();

  // actions
  let idleAction = null;
  let walkAction = null;
  let attackAction = null;
  let hurtAction = null;

  let lastAttackTime = 0;
  let attackDelay = 1500;

  let actions = null;

  let actionSprite = null;

  app.name = 'spriteAvatar';

  let clock = new THREE.Clock();

  let speed = 0;

  let targetSpec = null;
  let died = false;
  let attacking = false;

  let pivotOffset = new THREE.Vector3();

  const shadowGeometry = new THREE.CircleGeometry( 0.25, 32 );
  const shadowMaterial = new THREE.MeshStandardMaterial( { color: 0x000000, transparent: true, opacity: 0.3 } );
  
  let shadow = new THREE.Mesh( shadowGeometry, shadowMaterial );
  //shadow.rotation.x = Math.PI / 2;
  app.add( shadow );

  const getRNG = (min, max) => {
    return Math.random() * (max - min) + min;
  }

  const getDamage = () => {
    if(actionSprite.currentAction) {
      actionSprite.currentAction.stop();
    }

    let a = actions.hurt;
    a.playOnce();
  }

  const attack = () => {
    let a = actions.attack;
    actions.currentAction = a;
    a.playOnce();
  }

  const die = () => {
    if(actionSprite.currentAction !== actions.die && !died) {
      targetSpec = null;
      died = true;
      hpMesh.delete();
      actionSprite.currentAction.stop();
      let a = actions.die;
      a.hideWhenFinished = true;
      a.playOnce();
    }
  }

  const minDistance = 1;
  const _isFar = distance => (distance - minDistance) > 0.01;
  const _isRight = () => {
    // if(targetSpec) {
    //   let temp = new THREE.Vector3().copy(app.position).add(new THREE.Vector3(1.2, -0.5, 0));
    //   //console.log(temp);
    //   if(targetSpec.position.x > temp.x) {
    //     return true;
    //   }
    //   else {
    //     return false;
    //   }
    // }
    if(localPlayer) {
      if(localPlayer.characterPhysics.velocity.x > 0) {
        return true;
      }
      else {
        return false;
      }
    }
  }

  useFrame(({timestamp, timeDiff}) => {

    if(actionSprite) {
      var delta = clock.getDelta();
      let currentAction = actions.currentAction;

      if(localPlayer) {
        // let dist = new THREE.Vector3(app.position.x, 0, 0).distanceTo(new THREE.Vector3(targetSpec.position.x, 0, 0));
        // let dir = new THREE.Vector3();
        // dir.subVectors(targetSpec.position, app.position);
        // dir.y = 0;
        // dir.z = 0;

        // dir.normalize();

       
        

        app.position.copy(localPlayer.position);

        if(actions) {
          if(localPlayer.avatar) {

            localPlayer.avatar.app.visible = false;

            lastAttackTime = 0;
            
            let realVelocity = localPlayer.characterPhysics.velocity.clone();
            let avatarVelocity = localPlayer.characterPhysics.velocity.clone();
            realVelocity.y = 0;

            realVelocity = Math.round(parseFloat(realVelocity.length()).toFixed(3));

            let velX = Math.round(parseFloat(avatarVelocity.x).toFixed(1));
            let velZ = Math.round(parseFloat(avatarVelocity.z).toFixed(1));
            

            //console.log(velX, 0, velZ);

            if(velX > 0) {
              if(actionSprite.currentAction !== actions.walk_right) {
                actions.walk_right.playLoop();
              }
            }
            else if (velX < 0) {
              if(actionSprite.currentAction !== actions.walk_left) {
                actions.walk_left.playLoop();
              }
            }
            else if (velZ > 0) {
              if(actionSprite.currentAction !== actions.walk_down) {
                actions.walk_down.playLoop();
              }
            }
            else if(velZ < 0) {
              if(actionSprite.currentAction !== actions.walk_up) {
                actions.walk_up.playLoop();
              }
            }
            else {
              actionSprite.currentAction = null;
            }

            

            

            //let otherVel = 

            if(actionSprite.currentAction !== actions.walk_left) {
              //actions.walk_left.playLoop();
            }

            if(actionSprite.currentAction) {
              //let rasa = new THREE.Vector3().set(localPlayer.characterPhysics.velocity.x, 0, 0).length();
              //actions.walk.tileDisplayDuration = (100 / (rasa/2.5)) + 50;
              if(realVelocity > 0) {
                if(actionSprite.currentAction !== actions.walk_left) {
                  //actions.walk_left.playLoop();
                }
              }
              else {
                // if(actionSprite.currentAction !== actions.idle) {
                //   //actionSprite.currentAction.stop();
                //   actions.idle.playLoop();
                // }
              }
            }
            else {
              if(actionSprite.paused) {
                //actionSprite.currentAction.stop();
                //actionSprite.currentAction = null;
              }
            }

            
          }
          else {
            if(((timestamp - lastAttackTime) > attackDelay)) {
              lastAttackTime = timestamp;
              //attackDelay = getRNG(1000, 2000);
              //attack();
            }

            if(actionSprite.paused && actionSprite.currentAction !== actions.idle) {
                actionSprite.currentAction.stop();
                actions.idle.playLoop();
            }
          }

          //actionSprite.mirrored = _isRight();
          if(actionSprite.mirrored) {
            pivotOffset.set(0, 0,0); //1.2, 0, 0
            actionSprite.position.copy(pivotOffset.multiplyScalar(2));
            app.updateMatrixWorld();
          }
          else {
            pivotOffset.set(0,0,0);
            actionSprite.position.copy(pivotOffset);
            app.updateMatrixWorld();
          }
        }

        app.updateMatrixWorld();
        if(shadow) {
          //console.log(shadow.position);
          shadow.position.copy(actionSprite.position).sub(new THREE.Vector3(0,0.5,0));
          //shadow.position.y = 0.
          shadow.updateMatrixWorld();
        }
      }
      else {
        if(!died) {
          if(actionSprite.currentAction !== actions.idle) {
            actions.idle.playLoop();
          }
        }
      }

	    spriteMixer.update(delta);
      hpMesh.update();
    }
  });

  let physicsIds = [];
  (async () => {
    const u = `${baseUrl}boy.png`;
    let o = await new Promise((accept, reject) => {
      let textureLoader = new THREE.TextureLoader();
      textureLoader.load(u, accept, function onprogress() {}, reject);
    });
    actionSprite = spriteMixer.ActionSprite( o, 4, 4 );

    // actions = {
    //   idle:  spriteMixer.Action(actionSprite, 0, 7, 100),
    //   walk: spriteMixer.Action(actionSprite, 8, 15, 100),
    //   attack: spriteMixer.Action(actionSprite, 16, 25, 50),
    //   hurt: spriteMixer.Action(actionSprite, 26, 28, 100),
    //   die: spriteMixer.Action(actionSprite, 28, 38, 100),
    //   currentAction: null
    // }

    actions = {
      walk_down: spriteMixer.Action(actionSprite, 0, 3, 100),
      walk_left: spriteMixer.Action(actionSprite, 4, 7, 100),
      walk_right: spriteMixer.Action(actionSprite, 8, 11, 100),
      walk_up: spriteMixer.Action(actionSprite, 12, 15, 100),
      currentAction: null
    }
    
    //actionSprite.scale.set(5/3,3/3,3/3);
    actionSprite.updateMatrixWorld();

    app.add( actionSprite );
    app.updateMatrixWorld();

    let offset = new THREE.Vector3(0,0,0); //1.25, 0.75, 0
    let avatarScale = new THREE.Vector3(0.5, 1, 1);
  })();

  // useCleanup(() => {
  //   for (const physicsId of physicsIds) {
  //     physics.removeGeometry(physicsId);
  //   }
  //   physicsIds.length = 0;
  // });

  return app;
};
