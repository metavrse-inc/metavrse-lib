import { Entity } from './Entity';

type RequiredProperties = 'key' | 'visible' | 'type' | 'data';

type OptionalProperties = 'text' | 'code' | 'props' | 'class';

export type HTMLHudEntity = Pick<
  Required<Entity & { type: keyof HTMLElementTagNameMap }>,
  RequiredProperties
> &
  Pick<Entity, OptionalProperties>;
