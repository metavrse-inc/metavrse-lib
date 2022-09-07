import { CherryKey, CherryProjectManager, GetterSetterPropertyType, ShaderParameterType } from '../types';

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

  /**
   *
   * @param key
   * @param propertyName
   * @param value
   */
  const removeConfigurationProperty = (
    key: CherryKey,
    propertyName: GetterSetterPropertyType
  ) => {
    try {
      const object = pm.getObject(key);
      object.removeLink(propertyName);
    } catch (error: any) {
      console.log('facade->removeConfigurationProperty:', error.message);
    }
  };

  /**
   *
   * @param key
   * @param ids
   * @param property
   */
  const removeConfigurationMaterial = (
    key: CherryKey,
    ids: number[],
    property: ShaderParameterType
  ) => {
    const object = pm.getObject(key);

    if (!ids.length) {
      return;
    }

    for (const id of ids) {
      object.mesh.remove(id, property);
    }
  };

  return {
    getConfigurationVisibility,
    removeConfigurationProperty,
    removeConfigurationMaterial
  }
}
