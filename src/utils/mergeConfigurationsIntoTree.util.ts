import produce, { Draft } from 'immer';
import { TreeNode, ConfigurationNode, HTMLHudNode } from '..';

export const mergeConfigurationsIntoTree = (
  tree: TreeNode[],
  configurations: ConfigurationNode[]
): Array<TreeNode | HTMLHudNode | ConfigurationNode> => {
  const deep = (draft: Draft<TreeNode>[], config: ConfigurationNode[]) => {
    draft.forEach((node) => {
      if (node.type === 'object-group') {
        const found = config.find((elem) => {
          return elem.key === node.key;
        });

        if (found) {
          if (found.children.length) {
            deep(node.children, found.children);
            const configs = found.children.filter(
              (e) => e.type === 'configuration'
            );

            // Temporary solution for types
            node.children = [...node.children, ...configs] as any;
          }
        }
      }
    });
  };

  return produce(tree, (d) => {
    return deep(d, configurations);
  });
};
