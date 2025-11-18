import { CherryKey } from '..';

export type GenericNode<NodeType extends string> = {
  key: CherryKey;
  ikey?: CherryKey;
  type: NodeType;
  title: string;
  visible: boolean;
  children: GenericNode<NodeType>[];
  uiVisible?: boolean;
  uiHighlighted?: boolean;
  id?: CherryKey; // Assets key
  skey?: CherryKey;
  animations?: string[];
};
