import Phaser from 'phaser';
import { SPECIES } from '../data';
import { configureGbaCamera } from '../display';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    configureGbaCamera(this);
    this.cameras.main.setBackgroundColor('#101810');
    const loading=this.add.graphics();loading.fillStyle(0x243527).fillRect(29,100,182,12);loading.fillStyle(0xdfe8bf).fillRect(31,102,178,8);
    const bar=this.add.rectangle(33,104,0,4,0x6f9d5a).setOrigin(0);
    this.add.text(120,55,'GENERATION\nLEAGUE',{fontFamily:'Arial, "Segoe UI", sans-serif',fontStyle:'bold',fontSize:'15px',align:'center',color:'#dfe8bf',resolution:4}).setOrigin(.5);
    const status=this.add.text(120,118,'PREPARING THE REGION…',{fontFamily:'Arial, "Segoe UI", sans-serif',fontStyle:'bold',fontSize:'7px',color:'#8fa784',resolution:4}).setOrigin(.5);
    this.load.on('progress',(value:number)=>{bar.width=174*value;status.setText(`PREPARING THE REGION… ${Math.floor(value*100)}%`);});
    this.load.setPath('/');
    Object.values(SPECIES).forEach((species) => {
      const spriteRoot = species.spriteSheet.includes('/expansion/') ? 'assets/creatures/expansion/optimized' : 'assets/creatures/optimized';
      this.load.image(`${species.id}-front`,`${spriteRoot}/${species.id}-front.png`);
      this.load.image(`${species.id}-back`,`${spriteRoot}/${species.id}-back.png`);
    });
    this.load.spritesheet('avatar-a','assets/ninja-adventure/characters/avatar-a.png',{frameWidth:16,frameHeight:16});
    this.load.spritesheet('avatar-b','assets/ninja-adventure/characters/avatar-b.png',{frameWidth:16,frameHeight:16});
    this.load.spritesheet('npc-base','assets/ninja-adventure/characters/npc-base.png',{frameWidth:16,frameHeight:16});
    this.load.spritesheet('prop-grass','assets/ninja-adventure/props/grass.png',{frameWidth:16,frameHeight:16});
    this.load.spritesheet('prop-pig','assets/ninja-adventure/characters/pig.png',{frameWidth:16,frameHeight:16});
    this.load.image('prop-crate','assets/ninja-adventure/props/crate.png');
    this.load.image('prop-pot','assets/ninja-adventure/props/pot.png');
    this.load.spritesheet('terrain-sheet','assets/ninja-adventure/tiles/terrain.png',{frameWidth:16,frameHeight:16});
    this.load.spritesheet('interior-sheet','assets/ninja-adventure/tiles/interior.png',{frameWidth:16,frameHeight:16});
    this.load.spritesheet('wall-sheet','assets/ninja-adventure/tiles/walls.png',{frameWidth:16,frameHeight:16});
    this.load.image('vendor-village','assets/ninja-adventure/tiles/village.png');
    this.load.image('vendor-panel','assets/ninja-adventure/ui/panel.png');
    this.load.image('fx-leaf','assets/ninja-adventure/effects/leaf.png');
    this.load.image('fx-fog','assets/ninja-adventure/effects/fog.png');
    this.load.image('title-background','assets/title-roster-background.png');
    this.load.audio('music-village','assets/ninja-adventure/music/theme_lost_village.ogg');
    this.load.audio('music-plain','assets/ninja-adventure/music/theme_plain.ogg');
    this.load.audio('music-swamp','assets/ninja-adventure/music/theme_swamp.ogg');
    this.load.audio('music-dream','assets/ninja-adventure/music/theme_dream.ogg');
  }
  create() {
    document.body.dataset.gameScene='title';
    this.game.canvas.style.imageRendering = 'pixelated';
    const make = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void) => {
      const g = this.add.graphics(); draw(g); g.generateTexture(key,16,16); g.destroy();
    };
    make('tile-grass',(g) => { g.fillStyle(0x79a855).fillRect(0,0,16,16); g.fillStyle(0x8fbd67).fillRect(0,0,16,3); g.fillStyle(0x568b48).fillRect(2,9,1,2).fillRect(11,4,1,2).fillRect(7,13,2,1); });
    make('tile-path',(g) => { g.fillStyle(0xd6bd78).fillRect(0,0,16,16); g.fillStyle(0xe5cf8e).fillRect(0,0,16,2); g.fillStyle(0xb49960).fillRect(3,5,2,1).fillRect(11,11,2,1).fillRect(7,14,1,1); });
    make('tile-tallGrass',(g) => { g.fillStyle(0x659748).fillRect(0,0,16,16); g.lineStyle(1,0x315f38).lineBetween(2,15,4,7).lineBetween(6,15,7,5).lineBetween(11,15,9,6).lineBetween(14,15,13,8); g.fillStyle(0xa6c960).fillRect(4,7,1,3).fillRect(9,6,1,4); });
    make('tile-water',(g) => { g.fillStyle(0x5b9da2).fillRect(0,0,16,16); g.fillStyle(0x8ac5b7).fillRect(1,3,8,2).fillRect(8,10,7,2); g.fillStyle(0x3d7b83).fillRect(5,6,9,1).fillRect(0,14,8,1); });
    make('tile-tree',(g) => { g.fillStyle(0x1f4f37).fillRect(0,0,16,16); g.fillStyle(0x376c3d).fillCircle(4,7,6).fillCircle(11,6,6); g.fillStyle(0x68964c).fillCircle(8,3,5); g.fillStyle(0x173f2e).fillRect(7,9,3,7); });
    make('tile-wall',(g) => { g.fillStyle(0x374034).fillRect(0,0,16,16); g.fillStyle(0x66705a).fillRect(1,1,14,5).fillRect(1,8,14,5); g.fillStyle(0x242a24).fillRect(0,6,16,2).fillRect(0,13,16,3).fillRect(7,1,1,5); });
    make('tile-rock',(g) => { g.fillStyle(0x514b43).fillRect(0,0,16,16); g.fillStyle(0x756957).fillTriangle(1,14,8,2,15,14); g.fillStyle(0x9b8564).fillTriangle(5,9,8,3,10,9); g.fillStyle(0x312f2d).fillRect(2,14,13,2); });
    make('tile-floor',(g) => { g.fillStyle(0xd2bc84).fillRect(0,0,16,16); g.lineStyle(1,0xb09468).strokeRect(0,0,16,16); g.fillStyle(0xe2ce9a).fillRect(1,1,14,2); });
    make('tile-counter',(g) => { g.fillStyle(0x9b7045).fillRect(0,0,16,16); g.fillStyle(0xd0a86b).fillRect(0,0,16,4); g.fillStyle(0x5b4232).fillRect(0,13,16,3); });
    make('tile-door',(g) => { g.fillStyle(0x6f4b35).fillRect(0,0,16,16); g.fillStyle(0xc38b52).fillRect(2,1,12,15); g.fillStyle(0x51342b).fillRect(4,3,8,10); g.fillStyle(0xe6c16d).fillRect(10,8,2,2); });
    make('tile-ledge',(g) => { g.fillStyle(0xc19c62).fillRect(0,0,16,16); g.fillStyle(0x765d45).fillRect(0,10,16,6); g.fillStyle(0xe1c17b).fillTriangle(1,9,5,5,9,9).fillTriangle(8,9,12,5,16,9); });
    make('tile-cave',(g) => { g.fillStyle(0x49473f).fillRect(0,0,16,16); g.fillStyle(0x1a1e1b).fillCircle(8,12,8); g.fillStyle(0x776952).fillRect(0,0,16,3); });
    make('pixel-white',(g) => g.fillStyle(0xffffff).fillRect(0,0,4,4));
    make('pixel-circle',(g) => g.fillStyle(0xffffff).fillCircle(8,8,4));
    make('field-sign',(g) => { g.fillStyle(0x3b2c25).fillRect(7,8,2,8);g.fillStyle(0x7d5639).fillRect(2,2,12,9);g.fillStyle(0xd4a55e).fillRect(3,3,10,6);g.fillStyle(0x4e382a).fillRect(4,4,8,1).fillRect(4,6,6,1); });
    const directionFrames = { down:[0,4,8,12], up:[1,5,9,13], left:[2,6,10,14], right:[3,7,11,15] };
    for (const avatar of ['a','b']) for (const [direction,frames] of Object.entries(directionFrames)) {
      this.anims.create({key:`${avatar}-${direction}`,frames:frames.map((frame)=>({key:`avatar-${avatar}`,frame})),frameRate:8,repeat:-1});
    }
    const village=this.textures.get('vendor-village');
    village.add('tree-spring',0,16,96,32,32);
    village.add('tree-autumn',0,64,96,32,32);
    village.add('tree-deep',0,16,144,32,32);
    village.add('tree-olive',0,64,144,32,32);
    village.add('house-home',0,192,96,64,80);
    village.add('house-hall',0,256,80,64,96);
    village.add('cave-mouth',0,0,0,64,48);
    this.scene.start('Title');
  }
}
