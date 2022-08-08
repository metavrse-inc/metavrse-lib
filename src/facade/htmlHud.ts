import { CherryProjectManager } from '../types';
import * as CSS from 'csstype';

export const htmlFacade = (  pm: CherryProjectManager
                             ) => {
  const removeCssDeclaration = (key: string, selector: string, prop: string) => {
    const obj = pm.getObject(key);
    obj?.mesh.removeProp(selector, prop)
  }

  const updateCssValue = (key: string, selector: string, property: CSS.Properties, value: string) => {
    const obj = pm.getObject(key);
    obj?.mesh.set(selector, property, value)
  }

  const renameCssProperty = (key: string, selector: string, currentProperty: string, newProperty: string) => {
    const obj = pm.getObject(key);
    obj?.mesh.renameOption(selector, currentProperty, newProperty)
  }

  const renameCssSelector = (key: string, selector: string, newSelector: string) => {
    const obj = pm.getObject(key);
    obj?.mesh.renameMesh(selector, newSelector)
  }

  const removeHtmlProp = (key: string, prop: string) => {
    const obj = pm.getObject(key);
    obj?.props.remove(prop)
  }

  const updateHtmlPropValue = (key: string, prop: string, newValue: string) => {
    const obj = pm.getObject(key);
    obj?.props.set(prop, newValue)
  }

  const renameHtmlProp = (key: string, oldProp: string, newProp: string) => {
    const obj = pm.getObject(key);
    obj?.props.rename(oldProp, newProp)
  }

  return {
    removeCssDeclaration,
    updateCssValue,
    renameCssSelector,
    renameCssProperty,
    removeHtmlProp,
    updateHtmlPropValue,
    renameHtmlProp,
  }

}
