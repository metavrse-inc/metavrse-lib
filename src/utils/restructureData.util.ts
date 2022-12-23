import {
  OldTreeNode,
  CherryKey,
  OldData,
  TreeNode,
  Entities,
  HTMLHudNode,
  Entity,
  ConfigurationNode,
} from '..';

const ALLOWED_CONFIGURATION_TYPES = [
  'hud-link',
  'hud-html-link',
  'HTMLElement-link',
  'light-link',
  'object-link',
  'object-hud-link',
  'object-group-link',
  'video-link',
  'configuration',
  'object-group',
];

const ALLOWED_TREE_TYPES = [
  'hud',
  'light',
  'object',
  'object-hud',
  'object-group',
  'video',
  'camera',
  'RigidBody',
  'KinematicCharacterController',
];

const ALLOWED_HTML_HUD_TYPES: string[] = [
  'HTMLElement'
]

export const restructureData = (
  nodes: OldTreeNode[],
  entities: Record<CherryKey, OldData>,
  squarePrimitiveKey: CherryKey
): {
  newTree: TreeNode[];
  newEntities: Entities;
  newHTMLHudTree: HTMLHudNode[];
  lastDataId: number;
  newConfigurationsTree: any;
} => {
  let incrementalId = 0;
  const newEntities: Record<CherryKey, Entity> = {};

  const deepTreeIteration = (data: OldTreeNode[]): any[] => {
    let hasConfig = false;
    let hasHtmlHud = false
    const newTree: TreeNode[] = [];
    const newConfigurationsTree: any[] = [];
    const newHTMLHudTree: any[] = []

    data.forEach((node) => {
      const entity = entities[node.key];
      if (+node.key > incrementalId) {
        incrementalId = +node.key;
      }

      const primitiveKey =
        node.id === 'assets/square.c3b' ? squarePrimitiveKey : node.id;

      const newNode = createNewNode(primitiveKey, node, entity as any);
      const newConfiguration = createNewConfiguration(
        primitiveKey,
        node,
        entity
      );
      const newHtmlHud = createNewHtmlHud(primitiveKey, node, entity)

      if (node.children && node.children?.length > 0) {
        const [tree, configurations, htmlHud, config, _hasHtmlHud] = deepTreeIteration(node.children);

        hasConfig = config;
        hasHtmlHud = _hasHtmlHud
        newNode.children = tree;
        newConfiguration.children = configurations;
        newHtmlHud.children = htmlHud
      }

      if (ALLOWED_HTML_HUD_TYPES.includes(node.type)) {
        hasHtmlHud = node.type === 'HTMLElement'
        newHTMLHudTree.push(newHtmlHud)

        newEntities[node.key] = {
          ...(entity as Entity),
          key: node.key,
          skey: node.skey,
        };
      }

      if (ALLOWED_CONFIGURATION_TYPES.includes(node.type)) {
        hasConfig = node.type === 'configuration';

        if ((node.type === 'object-group' && newConfiguration.children.length > 0) || node.type !== 'object-group'){
          newConfigurationsTree.push(newConfiguration);

          if (node.type == "HTMLElement-link"){
            newEntities[node.key] = {
              ...(entity as Entity),
              key: node.key,
              skey: node.skey,
            };
          } else {
            newEntities[node.key] = {
              ...(entity as Entity),
              key: node.key,
              skey: node.skey,
              type: node.type,
            };
          }
        }
        
        
      }

      if (ALLOWED_TREE_TYPES.includes(node.type)) {
        newTree.push(newNode);

        newEntities[node.key] = {
          ...(entity as Entity),
          key: node.key,
          type: node.type,
        };
      }

      // if (node.type === 'object-group' && hasConfig) {
      //   newConfigurationsTree.push(newConfiguration);
      // }

      if (node.type === 'object-group' && hasHtmlHud) {
        newHTMLHudTree.push(newHtmlHud)
      }
    });

    return [newTree, newConfigurationsTree, newHTMLHudTree, hasConfig, hasHtmlHud];
  };

  const [newTree, newConfigurationsTree, newHTMLHudTree] = deepTreeIteration(nodes);

  return {
    lastDataId: incrementalId,
    newTree,
    newEntities,
    newHTMLHudTree,
    newConfigurationsTree,
  };
};

const createNewConfiguration = (
  primitiveKey: string | undefined,
  node: OldTreeNode,
  entity: OldData
): ConfigurationNode => {
  let newNode = {
    key: node.key,
    type: node.type,
    title: node.title,
    children: [],
    visible: entity && entity.visible !== undefined ? entity.visible : true,
  } as ConfigurationNode;

  if (primitiveKey) {
    newNode = {
      ...newNode,
      id: primitiveKey,
    };
  }

  if (node.skey) {
    newNode = {
      ...newNode,
      skey: node.skey,
    };
  }

  return newNode;
};

const createNewHtmlHud = (
  primitiveKey: string | undefined,
  node: OldTreeNode,
  entity: OldData
): HTMLHudNode => {
  let newNode = {
    key: node.key,
    type: node.type,
    title: node.title,
    children: [],
    visible: entity && entity.visible !== undefined ? entity.visible : true,
  } as HTMLHudNode;

  if (primitiveKey) {
    newNode = {
      ...newNode,
      id: primitiveKey,
    };
  }

  if (node.skey) {
    newNode = {
      ...newNode,
      skey: node.skey,
    };
  }

  return newNode;
}

const createNewNode = (
  primitiveKey: string | undefined,
  node: OldTreeNode,
  entity: OldData
): TreeNode => ({
  id: primitiveKey,
  key: node.key,
  type: node.type,
  title: node.title,
  children: [],
  visible: entity && entity.visible !== undefined ? entity.visible : true,
});
