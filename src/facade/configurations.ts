import { CherryKey, CherryProjectManager } from '../types';

export const configurationsFacade = (pm: CherryProjectManager) => {
  const getConfigurationVisibility = (entityKey: CherryKey | undefined) => {
    if (!entityKey) {
      return false
    }

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
