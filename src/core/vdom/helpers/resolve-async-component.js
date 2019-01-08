/* @flow */

import {
  warn,
  once,
  isDef,
  isUndef,
  isTrue,
  isObject,
  hasSymbol
} from 'core/util/index'

import { createEmptyVNode } from 'core/vdom/vnode'
/*
  作用:(最后拿到的都是构造函数)
        1、当使用模块语法时,获取模块的默认输出
        2、将对象形式的参数用extend函数转化成构造函数否则直接输出该参数
*/
function ensureCtor (comp: any, base) {
  // 判断为es6语法时,返回模块的默认输出
  if (
    comp.__esModule ||
    (hasSymbol && comp[Symbol.toStringTag] === 'Module')
  ) {
    comp = comp.default
  }
  // 当参数为对象或默认输出为对象时通过extend转换成构造函数否则输出参数
  return isObject(comp)
    ? base.extend(comp)
    : comp
}
/*
    作用:
          1、生成一个空节点。
          2、对空节点设置asyncFactory属性为传入的构造函数
          3、对空节点设置asyncMeta属性为剩余四个参数的对象集合
          4、将该空节点输出
*/
export function createAsyncPlaceholder (
  factory: Function, // 构造函数
  data: ?VNodeData,//class或事件
  context: Component,//当前组件实例
  children: ?Array<VNode>,//子节点集合
  tag: ?string//组件标签名
): VNode {
  // 创建一个空节点
  const node = createEmptyVNode()
  // 设置该空节点的asyncFactory属性为传入的构造函数
  node.asyncFactory = factory
  // 设置该空节点的asyncMeta属性为剩余四个参数的对象集合
  node.asyncMeta = { data, context, children, tag }
  // 将该空节点输出
  return node
}
/*
    作用:(异步或同步加载组件的处理方式)
          1、加载失败返回error组件
          2、加载成功返回成功的组件
          3、加载中返回loading组件
          4、多个地方初始化一个组件时加该组件放入构造函数的contexts数组中(避免多次加载)
          5、只有一个地方初始化时，初始化加载成功和失败函数，并对高级加载异步组件 || es6加载组件函数分别处理,对不同状态进行不同处理，
             最后设置异步标识为false,标识变为同步,返回loading组件||需要加载的组件
*/
export function resolveAsyncComponent (
  factory: Function, // 异步组件函数
  baseCtor: Class<Component>, // 当前组件实例的构造函数
  context: Component// 当前组件实例
): Class<Component> | void {
  // 异步加载组件失败 && 存在error组件时直接返回error组件
  if (isTrue(factory.error) && isDef(factory.errorComp)) {
    return factory.errorComp
  }
  // 异步加载组件成功 && 该组件存在时，直接返回该组件
  if (isDef(factory.resolved)) {
    return factory.resolved
  }
  // 还在加载中 && loading组件存在时,返回loading组件
  if (isTrue(factory.loading) && isDef(factory.loadingComp)) {
    return factory.loadingComp
  }
  // 多个地方初始化一个组件时将该组件放入该数组中
  if (isDef(factory.contexts)) {
    // already pending
    factory.contexts.push(context)
  } else {
    // 初始化contexts为数组保存一项为当前组件实例
    const contexts = factory.contexts = [context]
    // 表示异步
    let sync = true
    // 初始化强制渲染函数
    const forceRender = () => {
      for (let i = 0, l = contexts.length; i < l; i++) {
        contexts[i].$forceUpdate()
      }
    }
    // 初始化加载成功函数
    const resolve = once((res: Object | Class<Component>) => {
      // cache resolved
      // 缓存构造函数
      factory.resolved = ensureCtor(res, baseCtor)
      // invoke callbacks only if this is not a synchronous resolve
      // 只有在这不是同步解析时才调用回调
      // (async resolves are shimmed as synchronous during SSR)
      //(在SSR期间，异步解析被调整为同步)
      // 不为异步时强行执行渲染函数
      if (!sync) {
        forceRender()
      }
    })
    // 初始化加载失败函数
    const reject = once(reason => {
      // 非生产环境下提示信息'未能解析异步组件'并暴露错误信息
      process.env.NODE_ENV !== 'production' && warn(
        `Failed to resolve async component: ${String(factory)}` +
        (reason ? `\nReason: ${reason}` : '')
      )
      // 加载失败的组件存在时,设置异步函数的error属性为true,并强行执行渲染函数进行重新渲染
      if (isDef(factory.errorComp)) {
        factory.error = true
        forceRender()
      }
    })
    // 执行异步组件加载函数
    const res = factory(resolve, reject)
    // 高级加载异步组件 || es6加载组件函数
    if (isObject(res)) {
      // 返回的是Promise对象时
      if (typeof res.then === 'function') {
        // () => Promise
        // 加载成功
        if (isUndef(factory.resolved)) {
          res.then(resolve, reject)
        }
        // 高级加载异步组件的情况&&存在需要加载的组件属性 && 该加载方式是Promise方式时
      } else if (isDef(res.component) && typeof res.component.then === 'function') {
        res.component.then(resolve, reject)
        // 存在加载失败组件时
        if (isDef(res.error)) {
          // 设置构造函数的errorComp属性为失败组件构造函数
          factory.errorComp = ensureCtor(res.error, baseCtor)
        }
        // 存在加载loading组件时
        if (isDef(res.loading)) {
          // 设置loadingComp属性为loading组件构造函数
          factory.loadingComp = ensureCtor(res.loading, baseCtor)
          // 渲染加载中组件前的等待时间为0时,直接设置loading属性为true
          if (res.delay === 0) {
            factory.loading = true
          } else {
            //否则等待指定时间或默认200毫秒时间后,当还未加载成功 && 也未加载失败时,设置loading属性为true,强制渲染视图
            setTimeout(() => {
              if (isUndef(factory.resolved) && isUndef(factory.error)) {
                factory.loading = true
                forceRender()
              }
            }, res.delay || 200)
          }
        }
        // 设置了最长等待时间
        if (isDef(res.timeout)) {
          // 当加载组件时间超出设置值时,在非生产环境下提示超出时间信息
          setTimeout(() => {
            if (isUndef(factory.resolved)) {
              reject(
                process.env.NODE_ENV !== 'production'
                  ? `timeout (${res.timeout}ms)`
                  : null
              )
            }
          }, res.timeout)
        }
      }
    }
    // 设置异步标识为false(表示同步解析)
    sync = false
    // return in case resolved synchronously
    // 在同步解析下,当还在加载中时返回loading构造函数否则返回(加载成功组件的构造函数 || undefined)
    return factory.loading
      ? factory.loadingComp
      : factory.resolved
  }
}
