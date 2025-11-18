import { CherryKey } from '../cherry/CherryKey';
import { Extensions } from '../common/Extensions';
import { AssetType } from './AssetType';

export type Asset = {
  key: CherryKey;
  title: string; // name will not work! See TreeNodeType
  type: AssetType;
  children: Asset[];
  hidden?: boolean;
  uiVisible?: boolean;
  uiHighlighted?: boolean;
  extension?: Extensions;
  url?: String;
  async?: boolean;
  animations?: string[];
  fileType?: string;
  intrinsics?: {
    originalHeight?: number;
    originalWidth?: number;
    currentHeight?: number;
    currentWidth?: number;
  };
};
