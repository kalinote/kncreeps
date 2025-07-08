// Screeps全局常量
export const WORK = 'work';
export const CARRY = 'carry';
export const MOVE = 'move';
export const ATTACK = 'attack';
export const RANGED_ATTACK = 'ranged_attack';
export const HEAL = 'heal';
export const TOUGH = 'tough';
export const CLAIM = 'claim';

export const FIND_SOURCES = 'FIND_SOURCES';
export const FIND_STRUCTURES = 'FIND_STRUCTURES';
export const FIND_CONSTRUCTION_SITES = 'FIND_CONSTRUCTION_SITES';
export const FIND_HOSTILE_CREEPS = 'FIND_HOSTILE_CREEPS';
export const FIND_HOSTILE_STRUCTURES = 'FIND_HOSTILE_STRUCTURES';
export const FIND_DROPPED_RESOURCES = 'FIND_DROPPED_RESOURCES';

export const LOOK_STRUCTURES = 'LOOK_STRUCTURES';

export const STRUCTURE_WALL = 'constructedWall';
export const STRUCTURE_ROAD = 'road';
export const STRUCTURE_CONTAINER = 'container';
export const STRUCTURE_STORAGE = 'storage';
export const STRUCTURE_EXTENSION = 'extension';
export const STRUCTURE_SPAWN = 'spawn';

export const TERRAIN_MASK_WALL = 1;

export const OK = 0;
export const ERR_NOT_IN_RANGE = -9;
export const ERR_NOT_ENOUGH_RESOURCES = -6;
export const ERR_BUSY = -4;
export const ERR_TIRED = -11;

export const RESOURCE_ENERGY = 'energy';

export const Game: {
  creeps: { [name: string]: any };
  rooms: any;
  spawns: any;
  time: any;
} = {
  creeps: {},
  rooms: [],
  spawns: {},
  time: 12345
};

export const Memory: {
  creeps: { [name: string]: any };
} = {
  creeps: {}
};
