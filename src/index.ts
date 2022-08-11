import CherryGLInstance from './cherry/CherryGL';

export * from './assets';
export * from './types';
export * from './constants';

export * from './facade';

export * from './utils/objectsDataSet.util';
export * from './utils/regenerateStructure.util';
export * from './utils/mergeConfigurationsIntoTree.util';

// IMPORTANT: Don't change this line it will automaticlly change the version after build!
export const CherryGLVersion = '[VI]{version}[/VI]';

export default CherryGLInstance;
