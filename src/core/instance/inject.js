/* @flow */

import { hasOwn } from 'shared/util'
import { warn, hasSymbol } from '../util/index'
import { defineReactive, toggleObserving } from '../observer/index'

export function initProvide (vm: Component) {
  const provide = vm.$options.provide
  if (provide) {
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}

//将inject的属性添加到实例上
export function initInjections (vm: Component) {
  //缓存这个初始化inject后的新对象
  const result = resolveInject(vm.$options.inject, vm)
  //这个新对象存在
  if (result) {
    /*设置shouldObserve为false(应该是一个是否需要创建拦截器的开关)*/
    toggleObserving(false)
    //循环这个新对象的key名
    Object.keys(result).forEach(key => {
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        //为实例添加新对象的key属性,并在生产环境下重新赋值该属性时提示警告该属性为只读属性
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        //为实例添加新对象的key属性
        defineReactive(vm, key, result[key])
      }
    })
    /*设置shouldObserve为true*/
    toggleObserving(true)
  }
}

//初始化实例的injects生成一个新对象，并将其return出来
export function resolveInject (inject: any, vm: Component): ?Object {
  //实例的$options中有inject属性
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached
    //创建一个原型为空的空对象
    const result = Object.create(null)
    /*
      缓存inject可枚举的key名
        1、支持es6: 获取inject对象的属性名,并过滤出[属性描述符的enumerable为true的key名]生成数组
        2、不支持: 获取对象自身的所有可枚举的属性的键名
    */
    const keys = hasSymbol
      ? Reflect.ownKeys(inject).filter(key => {
        /* istanbul ignore next */
        return Object.getOwnPropertyDescriptor(inject, key).enumerable
      })
      : Object.keys(inject)
    //循环key名
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      //缓存格式化过的inject[key]的from值，也就是父组件的provided中相对应的key名
      const provideKey = inject[key].from
      //缓存实例
      let source = vm
      //实例存在时
      while (source) {
        //判断实例中是否有_provided && 是否与实例中的_provided对象中key名相对应
        if (source._provided && hasOwn(source._provided, provideKey)) {
          //将值赋值给result[key]
          result[key] = source._provided[provideKey]
          break
        }
        //不存在_provided || key名不对应，则将source缓存为实例的父组件
        source = source.$parent
      }
      //如果直到根组件都没有找到_provided或不存在与_provided中相对应的key名
      if (!source) {
        //判断inject[key]是否有设置默认值(默认值在规范化injects时是不设置的,除非用户手动写了)
        if ('default' in inject[key]) {
          //存在则缓存默认值
          const provideDefault = inject[key].default
          //判断是否是函数: 是则缓存函数的值  不是则直接缓存默认值
          result[key] = typeof provideDefault === 'function'
            ? provideDefault.call(vm)
            : provideDefault
        } else if (process.env.NODE_ENV !== 'production') {
          /*没有设置默认值就提示警告*/
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }
    return result
  }
}
