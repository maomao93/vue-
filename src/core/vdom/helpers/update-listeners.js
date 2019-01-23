/* @flow */

import { warn } from 'core/util/index'
import { cached, isUndef, isPlainObject } from 'shared/util'
/*
  作用: 确定事件以及passive修饰符、capture修饰符、once修饰符是否存在
*/
const normalizeEvent = cached((name: string): {
  name: string,
  once: boolean,
  capture: boolean,
  passive: boolean,
  handler?: Function,
  params?: Array<any>
} => {
  // 判断passive修饰符是否存在
  const passive = name.charAt(0) === '&'
  // 获取事件名
  name = passive ? name.slice(1) : name
  // 判断once修饰符是否存在
  const once = name.charAt(0) === '~' // Prefixed last, checked first
  // 获取事件名
  name = once ? name.slice(1) : name
  // 判断capture修饰符是否存在
  const capture = name.charAt(0) === '!'
  // 获取事件名
  name = capture ? name.slice(1) : name
  return {
    name,
    once,
    capture,
    passive
  }
})
/*
  作用: 将监听函数作为构造函数的属性,在执行构造函数时执行该监听函数,并传递参数
        1、重写父组件传递下来的监听事件函数
        2、将事件函数作为该事件函数的fns属性
*/
export function createFnInvoker (fns: Function | Array<Function>): Function {
  function invoker () {
    const fns = invoker.fns
    if (Array.isArray(fns)) {
      const cloned = fns.slice()
      for (let i = 0; i < cloned.length; i++) {
        cloned[i].apply(null, arguments)
      }
    } else {
      // return handler return value for single handlers
      return fns.apply(null, arguments)
    }
  }
  invoker.fns = fns
  return invoker
}
/*
  作用:  更新父组件传递下来的监听事件
        1、循环新监听事件名
            1、当该事件名不存在任何信息时,收集警告错误无效的函数
            2、当旧事件信息集合中不存在该事件信息时,为当前传递到的组件添加改监听事件信息,当该事件信息不存在fns属性时,为该事件
              替换成invoker函数，该函数的fns属性为原事件信息
            3、旧事件集合和新事件集合都存在该事件名信息时,将新事件信息替换成旧事件信息,其fns属性设置为原新事件信息
        2、循环旧事件信息,当事件名不存在新事件信息集合中时，将该事件从作用的传递到的组件中移除
*/
export function updateListeners (
  on: Object,// 父组件传下来的新监听事件集合
  oldOn: Object,//旧的监听事件集合
  add: Function,//添加方法
  remove: Function,//移除方法
  vm: Component//作用的组件
) {
  let name, def, cur, old, event
  // 循环监听事件
  for (name in on) {
    def = cur = on[name]
    old = oldOn[name]
    // 确定事件名以及修饰符对象
    event = normalizeEvent(name)
    /* istanbul ignore if */
    if (__WEEX__ && isPlainObject(def)) {
      cur = def.handler
      event.params = def.params
    }
    // 判断新监听事件是否不存在该事件信息
    if (isUndef(cur)) {
      // 收集警告信息无效的方法
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid handler for event "${event.name}": got ` + String(cur),
        vm
      )
      // 判断旧监听事件是否不存在该事件信息
    } else if (isUndef(old)) {
      // 当新监听事件的fns属性不存在时,设置事件信息为invoker函数,invoker函数的fns属性为原事件信息
      if (isUndef(cur.fns)) {
        cur = on[name] = createFnInvoker(cur)
      }
      // 为实例添加改监听事件
      add(event.name, cur, event.once, event.capture, event.passive, event.params)
      // 该新监听事件不为空 && 旧监听事件不为空 && 两事件信息不全等时,设置旧事件的fns属性为新监听事件信息,将事件集合中的该事件替换为旧监听事件信息
    } else if (cur !== old) {
      old.fns = cur
      on[name] = old
    }
  }
  // 循环旧监听事件集合
  for (name in oldOn) {
    // 新事件集合中该事件不存在时,获取该事件信息的修饰符以及事件名,将其从作用组件上移除
    if (isUndef(on[name])) {
      event = normalizeEvent(name)
      remove(event.name, oldOn[name], event.capture)
    }
  }
}
