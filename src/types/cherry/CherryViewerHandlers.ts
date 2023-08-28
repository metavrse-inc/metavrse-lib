export type KeyEvent = { type: string, key: string, code: string, shiftKey: boolean, ctrlKey: boolean, altKey: boolean, metaKey:boolean, repeat:boolean };

export type Handlers = {
  onTap?: (button: number, x: number, y: number) => void;
  onMouseEvent?: (
    event: number,
    button: number,
    x: number,
    y: number
  ) => boolean;
  onScroll?: () => boolean;
  onRender?: () => boolean;
  resetCamera?: () => boolean;
  onKeyEvent?: (event: KeyEvent)=> boolean;
};
