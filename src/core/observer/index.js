/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that has this object as root $data

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    def(value, '__ob__', this)
    if (Array.isArray(value)) {
      const augment = hasProto
        ? protoAugment
        : copyAugment
      augment(value, arrayMethods, arrayKeys)
      this.observeArray(value)
    } else {
      this.walk(value)
    }
  }

  /**
   * Walk through each property and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object, keys: any) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 * 试图为一个值创建一个观察者实例，
 * 返回新观察者，如果观察成功，
 * 或现有观察者(如果该值已经有一个观察者)。
 */
/*作用: 为值创建一个Observer实例*/
export function observe (value: any, asRootData: ?boolean): Observer | void {
  /*值不为对象或者值是否为VNode的实例*/
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  /*值存在'__ob__'并且value.__ob__ 为 Observer的实例*/
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    //shouldObserve为true && 不为服务端
    // && (值为对象或者数组) && 对象可以被拓展 && 值的_isVue不为true
    ob = new Observer(value)
  }
  //为根组件数据并且存在已经是Observer实例时
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
/*作用: 为obj添加key并且key添加拦截器*/
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  const dep = new Dep()
  //获取指定对象的自身属性描述符
  const property = Object.getOwnPropertyDescriptor(obj, key)
  /*Configurable:表示能否通过delete删除属性从而重新定义属性；
    Enumerable：表示能否通过for-in循环返回属性
    writable：表示能否修改属性的值
    Value：包含这个属性的数据值（个人认为其作用就是赋值）
  */
  //在对象中存在并且该属性不能删除
  if (property && property.configurable === false) {
    return
  }
  //以下是在对象不存在该属性 或者 存在但是可以删除的
  // cater for pre-defined getter/setters
  const getter = property && property.get //存在则读取默认get
  const setter = property && property.set //存在则读取默认set
  //只传了2个参数并且(vm._props不存在该属性或者该属性没有get或者只有set)
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  let childOb = !shallow && observe(val) //值为对象或数组则创建一个Observer实例
  //直接定义属性或修改这个对象的这个属性
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      //如果存在get就直接读取对象中的值，否则读取参数值val
      const value = getter ? getter.call(obj) : val
      //存在watcher实例
      if (Dep.target) {
        dep.depend() //将这个实例存入subs中
        if (childOb) {
          childOb.dep.depend()
          //如果是数组就深度遍历并存储这个watcher实例
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      //读取oldVal
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      /*值没变化直接return*/
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      //set存在更新新值否则将新值赋值旧值
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal) //新值为对象或数组则创建一个Observer实例
      dep.notify() //值更新告诉所有订阅这个变量的更新视图
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  //target目标值为undefined或null或为string、number、symbol、boolean类型报警告
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  /*目标值为数组并且是整数*/
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    //目标值的长度取自身或可以的最大值
    target.length = Math.max(target.length, key)
    //为数组的key项替换
    target.splice(key, 1, val)
    return val
  }
  /*目标为对象并且目标包含key属性但目标原型不包含key*/
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  /*避免向Vue实例或其根$数据添加反应性属性*/
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
