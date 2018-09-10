/* @flow */

import { _Set as Set, isObject } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'

const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
/*对数据进行判断并进行深遍历*/
export function traverse (val: any) {
  _traverse(val, seenObjects)
  //清空数据
  seenObjects.clear()
}

//深度收集依赖项
function _traverse (val: any, seen: SimpleSet) {
  let i, keys
  const isA = Array.isArray(val) //判断是否是数组
  //(不是数组&&不是对象) || 对象不可扩展 || 值是VNode的实例 满足一项直接return
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }
  //值是否存在Observer实例
  if (val.__ob__) {
    const depId = val.__ob__.dep.id //实例代表的id
    if (seen.has(depId)) {
      return
    }
    seen.add(depId) //添加进set结构中
  }
  //数组递归不是获取对象key进行递归
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else {
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
