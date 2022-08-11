import { ConfigurationNode } from '..';
import { Asset } from '../assets/Asset';
import { Entity } from '../entities/Entity';
import { HTMLHudNode } from '../nodes/HTMLHudNode';
import { TreeNode } from '../nodes/TreeNode';
import { World } from '../world/World';
import { CherryKey } from './CherryKey';

type Scenes = Record<
  string,
  {
    tree: Array<TreeNode | HTMLHudNode | ConfigurationNode>;
    data: Record<CherryKey, Entity | World>;
  }
>;

export type CherryProjectData = {
  id: string;
  userid: number;
  title: string;
  data: {
    version: string;
    title: string;
    scene: Scenes;
    starting_scene: string;
    assets: {
      data: {};
      tree: Asset[];
    };
    selected_scene: string;
  };
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
};
