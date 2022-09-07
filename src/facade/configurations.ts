import { CherryProjectManager } from '../types';

export const configurationsFacade = (pm: CherryProjectManager) => {
  const getConfigurationVisibility = (entityKey: string) => {
    const obj = pm.getObject(entityKey);

    if (!obj) {
      return false
    }

    return obj.parent.parentOpts.visible;
  }

  return {
    getConfigurationVisibility
  }
}
