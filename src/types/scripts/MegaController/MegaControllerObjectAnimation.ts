export type MegaControllerObjectAnimation = {
  label: 'Object Animation';
  field: 'objectanimations';
  type: 'object-animation-custom';
  header: 'Object Animation';
  description: 'Drop Object';
  allowed: ['object', 'object-hud'];
  list: true;
  value: {
    file: string;
    aftercamera: boolean;
    animationid: number;
    start: number;
    end: number;
    endTime: number;
    delay: number;
    reverse: boolean;
    speed: number;
  };
};
