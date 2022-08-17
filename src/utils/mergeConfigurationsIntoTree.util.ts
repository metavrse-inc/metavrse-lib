import produce, { Draft } from 'immer';
import { TreeNode, ConfigurationNode, HTMLHudNode, CherryKey } from '..';

const flattenTree = (tree: any[]): any[] => {
  const flatten: any[] = [];

  const deepSearch = (nodes: any[], parentKey: CherryKey) => {
    nodes.forEach((node, index) => {
      let newNode = null;
      let buildNode = null;

      if (node) {
        newNode = {
          ...node,
          children: [],
        };

        buildNode = {
          ...newNode,
          index,
          parent: parentKey,
        };
      }

      flatten.push(buildNode);

      if (node.children.length) {
        deepSearch(node.children, node.key);
      }
    });
  };

  deepSearch(tree, '');

  return flatten;
};

const createTree = (flattenArray: any[], parent = ''): any[] => {
  const newArr: any[] = [];

  flattenArray.forEach((c) => {
    if (parent === c.parent) {
      const { key, skey, title, type, id, visible } = c;
      const newNode = { key, skey, title, type, visible } as any;
      if (id) {
        newNode.id = id;
      }
      newArr.push({
        ...newNode,
        children: [...createTree(flattenArray, c.key)],
      });
    }
  });

  return newArr;
};

export const mergeConfigurationsIntoTree = (
  tree: TreeNode[],
  configurations: ConfigurationNode[]
): Array<TreeNode | HTMLHudNode | ConfigurationNode> => {
  let newFlattenTree = [];
  const flatTree = flattenTree(tree);
  const flatConfs = flattenTree(configurations);

  if (configurations.length) {
    newFlattenTree = flatTree;

    const treeMap = new Map(flatTree.map((c) => [c.key, c]));

    flatConfs.forEach((t) => {
      if (!treeMap.has(t.key)) {
        newFlattenTree.push(t);
      }
    });
  } else {
    newFlattenTree = flatTree;
  }

  return createTree(newFlattenTree);
};
