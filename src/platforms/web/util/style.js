/* @flow */

import { cached, extend, toObject } from 'shared/util'
/*
  作用: 将style样式中的属性和属性值转换成key-value形式的对象并输出
*/
export const parseStyleText = cached(function (cssText) {
  // 初始res空对象
  const res = {}
  // 意思: 用来匹配;后面没有跟非'('字符以及')'字符，总结就是;后面只要跟了')'字符的都不匹配
  const listDelimiter = /;(?![^(]*\))/g
  const propertyDelimiter = /:(.+)/
  // 已分号非分隔符将cssText截成数组
  cssText.split(listDelimiter).forEach(function (item) {
    if (item) {
      // 将以分号分隔开的字符 再以第一个:为分隔符将字符截成数组
      var tmp = item.split(propertyDelimiter)
      // 当数组长度大于1时，将数组的一二项变成res对象的属性和属性值
      tmp.length > 1 && (res[tmp[0].trim()] = tmp[1].trim())
    }
  })
  // 将res对象输出(样式的属性和属性值对象)
  return res
})

// merge static and dynamic style data on the same vnode
function normalizeStyleData (data: VNodeData): ?Object {
  const style = normalizeStyleBinding(data.style)
  // static style is pre-processed into an object during compilation
  // and is always a fresh object, so it's safe to merge into it
  return data.staticStyle
    ? extend(data.staticStyle, style)
    : style
}

// normalize possible array / string values into Object
export function normalizeStyleBinding (bindingStyle: any): ?Object {
  if (Array.isArray(bindingStyle)) {
    return toObject(bindingStyle)
  }
  if (typeof bindingStyle === 'string') {
    return parseStyleText(bindingStyle)
  }
  return bindingStyle
}

/**
 * parent component style should be after child's
 * so that parent component's style could override it
 */
export function getStyle (vnode: VNodeWithData, checkChild: boolean): Object {
  const res = {}
  let styleData

  if (checkChild) {
    let childNode = vnode
    while (childNode.componentInstance) {
      childNode = childNode.componentInstance._vnode
      if (
        childNode && childNode.data &&
        (styleData = normalizeStyleData(childNode.data))
      ) {
        extend(res, styleData)
      }
    }
  }

  if ((styleData = normalizeStyleData(vnode.data))) {
    extend(res, styleData)
  }

  let parentNode = vnode
  while ((parentNode = parentNode.parent)) {
    if (parentNode.data && (styleData = normalizeStyleData(parentNode.data))) {
      extend(res, styleData)
    }
  }
  return res
}

