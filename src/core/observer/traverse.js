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
  //清空数据也就是清除那些标识符dep.id
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
  //值是否存在Observer实例(初始化data的时候属性值为数组或对象时监测数据创建的Observer实例也就是__ob__属性)
  //(这段代码解决死循环的问题   obj1.data = obj2  obj2.data = obj1,如果不做处理就一直会执行下去)
  if (val.__ob__) {
    const depId = val.__ob__.dep.id //Dep实例代表的id(每创建一个Dep实例id都会+1)
    //判断set实例也就是seenObjects变量中是否存在唯一的标识符
    if (seen.has(depId)) {
      return
    }
    seen.add(depId) //添加进set结构中
  }
  //数组递归不是则获取对象key进行递归
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else {
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
