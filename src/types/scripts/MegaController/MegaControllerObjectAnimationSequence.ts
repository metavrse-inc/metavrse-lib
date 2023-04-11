export type MegaControllerObjectAnimationSequence = {
  label: 'Object Animation sequence';
  field: 'objectanimationsequence';
  type: 'object-animation-custom';
  header: 'Object Animation sequence';
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
