// Shared tuning numbers for Solmaris. Every other module reads these so the
// feel of the city (speeds, sizes, wanted thresholds) lives in one place.
export const VIEW_W = 1280;
export const VIEW_H = 720;

export const WORLD_W = 3200;
export const WORLD_H = 2400;

// Road network: centre lines of the avenues (vertical) and streets (horizontal).
export const AVENUES = [220, 620, 1020, 1420, 1820, 2220, 2620, 2980];
export const STREETS = [220, 620, 1020, 1420, 1820, 2140];
export const ROAD_W = 96;
export const LANE_OFFSET = 22;

export const STEP = 1 / 60;

export const PLAYER_WALK = 175;
export const PLAYER_RUN = 265;
export const PLAYER_RADIUS = 14;
export const PLAYER_MAX_HEALTH = 100;

export const CAR_LENGTH = 52;
export const CAR_WIDTH = 26;
export const CAR_TOP_SPEED = 560;
export const CAR_ACCEL = 420;
export const CAR_BRAKE = 640;
export const CAR_REVERSE_SPEED = 180;
export const CAR_MAX_HEALTH = 100;

export const TRAFFIC_COUNT = 16;
export const PED_COUNT = 26;

export const WANTED_MAX = 5;
// Heat points: crossing a threshold adds a star. Heat fades while the player
// stays clean and out of sight.
export const WANTED_THRESHOLDS = [0, 40, 110, 200, 320, 460];
export const HEAT_DECAY_PER_SEC = 3.5;
export const HEAT_STEAL_CAR = 45;
export const HEAT_SHOOT = 30;
export const HEAT_HIT_PED = 35;
export const HEAT_KILL_PED = 60;
export const HEAT_RAM_COP = 50;

export const BULLET_SPEED = 900;
export const BULLET_DAMAGE = 34;
export const FIRE_COOLDOWN = 0.18;

export const DAY_LENGTH_SEC = 240; // one full day/night cycle in real seconds
export const SAVE_KEY = 'solmaris-save-v1';
export const GAME_TITLE = 'SOLMARIS';
export const CITY_NAME = 'Solmaris';
