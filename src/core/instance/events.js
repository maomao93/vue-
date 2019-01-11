/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  handleError,
  formatComponentName
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'
/*
  作用:
        1、初始化_events对象和_hasHookEvent变量
        2、更新父组件传递下来的监听事件，将已经不存在移除,将原不存在的事件函数重写&&赋值fns属性为传递下来的事件
*/
export function initEvents (vm: Component) {
  //当前实例的_events赋值为原型为空的空对象
  vm._events = Object.create(null)
  //当前实例的_hasHookEvent为false
  vm._hasHookEvent = false
  // init parent attached events
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: any
/*
  添加监听事件
*/
function add (event, fn, once) {
  if (once) {
    target.$once(event, fn)
  } else {
    target.$on(event, fn)
  }
}
/*
  移除事件
*/
function remove (event, fn) {
  target.$off(event, fn)
}
/*
   作用: 为实例添加或移除父组件作用在该组件上的监听事件
*/
export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm // 确定需要移除或添加的组件
  updateListeners(listeners, oldListeners || {}, add, remove, vm)
  target = undefined
}

/*
   作用: 为Vue原型添加$on、$once、$off、$emit四个方法
    $on:
    $once:
    $off:
    $emit:
*/
export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/
  /*
    作用:
          1、传入的事件名可以是数组
          2、为实例添加监听事件
          3、监听函数名存在hook:时,将_hasHookEvent设置为true,作用: 监听子组件的生命周期执行情况
  */
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this
    //判断event是否为数组
    if (Array.isArray(event)) {
      //循环执行$on函数
      for (let i = 0, l = event.length; i < l; i++) {
        this.$on(event[i], fn)
      }
    } else {
      //初始化vm._events[event]为[],并将方法push进数组
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      //监听函数名存在hook:时,将_hasHookEvent设置为true,作用: 监听子组件的生命周期执行情况
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }
  /*
    作用:
          1、只执行一次该fn，在执行一次后$off掉在实例中的该函数
  */
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    function on () {
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    on.fn = fn
    vm.$on(event, on)
    return vm
  }
  /*
    作用:
          1、当没传参数时清空该实例的所有监听事件
          2、对传空fn的事件名值设置为null
          3、删除与fn对应的在_events[event]集合中的函数
  */
  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // all 当没传一个参数时清空该实例的监听函数并返回该实例
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }
    // array of events
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$off(event[i], fn)
      }
      return vm
    }
    // specific event 缓存事件
    const cbs = vm._events[event]
    // 不存在时return该实例
    if (!cbs) {
      return vm
    }
    // 当没有传事件函数时, 设置该监听事件名的值为null,return该实例
    if (!fn) {
      vm._events[event] = null
      return vm
    }
    // 传了事件函数时
    if (fn) {
      // specific handler
      let cb
      // 获取该事件名在实例中的集合
      let i = cbs.length
      // 通过遍历的形式找出与在集合中相同的(传入的参数函数),将其删除
      while (i--) {
        cb = cbs[i]
        if (cb === fn || cb.fn === fn) {
          cbs.splice(i, 1)
          break
        }
      }
    }
    return vm
  }
  /*
      作用:
            1、对不规范的写法进行提示
            2、执行该监听函数对应的函数
  */
  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {
      // 将事件名转化成小写
      const lowerCaseEvent = event.toLowerCase()
      // 当转化过的事件名与原先不符时 && 实例中不存在改转换后的事件
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    // 缓存实例中的该监听事件
    let cbs = vm._events[event]
    if (cbs) {
      // 缓存该监听事件集合 || 单个
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      // 截取事件名后面的参数
      const args = toArray(arguments, 1)
      // 循环该事件集合
      for (let i = 0, l = cbs.length; i < l; i++) {
        try {
          // 执行该事件,并传入参数
          cbs[i].apply(vm, args)
        } catch (e) {
          handleError(e, vm, `event handler for "${event}"`)
        }
      }
    }
    return vm
  }
}
