/* @flow */

import config from '../config'
import VNode, { createEmptyVNode } from './vnode'
import { createComponent } from './create-component'
import { traverse } from '../observer/traverse'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject,
  isPrimitive,
  resolveAsset
} from '../util/index'

import {
  normalizeChildren,
  simpleNormalizeChildren
} from './helpers/index'

const SIMPLE_NORMALIZE = 1
const ALWAYS_NORMALIZE = 2

// wrapper function for providing a more flexible interface
// without getting yelled at by flow
/*
    作用:
          1、将参数错位情况进行处理并重新设置值
          2、将重新设置的值传入_createElement函数中并输出该函数
*/
export function createElement (
  context: Component,//当前组件实例
  tag: any,//标签名
  data: any,//静态class、事件等等
  children: any,//子组件或子节点
  normalizationType: any,
  alwaysNormalize: boolean
): VNode | Array<VNode> {
  // 判断data是否为数组 || string、number、symbol、boolean类型
  // 出现这种情况是将子节点放在了第二个参数
  if (Array.isArray(data) || isPrimitive(data)) {
    // 将子节点赋值给normalizationType
    normalizationType = children
    // 将data赋值给children
    children = data
    // 将data赋值为undefined
    data = undefined
  }
  // 判断alwaysNormalize参数是否为true
  if (isTrue(alwaysNormalize)) {
    // 将normalizationType参数设置为2
    normalizationType = ALWAYS_NORMALIZE
  }
  // 输出_createElement函数并传入处理过的参数
  return _createElement(context, tag, data, children, normalizationType)
}

export function _createElement (
  context: Component,//当前组件实例
  tag?: string | Class<Component> | Function | Object,// 标签名 || 组件 || 函数 || 对象
  data?: VNodeData, // undefined || 静态class、事件等等
  children?: any,// 子节点
  normalizationType?: number
): VNode | Array<VNode> {
  // 当data不为undefined || null && 该数据是观察者数据 收集警告信息‘避免使用观察到的数据对象作为vnode数据’,
  // 输出一个文本为空的注释节点或空节点
  if (isDef(data) && isDef((data: any).__ob__)) {
    process.env.NODE_ENV !== 'production' && warn(
      `Avoid using observed data object as vnode data: ${JSON.stringify(data)}\n` +
      'Always create fresh vnode data objects in each render!',
      context
    )
    return createEmptyVNode()
  }
  // object syntax in v-bind
  // 当data不为undefined || null  && data.is属性(组件名)不为undefined || null时，设置组件名为标签名
  if (isDef(data) && isDef(data.is)) {
    tag = data.is
  }
  // 不存在标签名时,输出一个文本为空的注释节点或空节点
  if (!tag) {
    // in case of component :is set to falsy value
    return createEmptyVNode()
  }
  // warn against non-primitive key
  // 非生产环境下 && (data不为undefined || null) && (data.key不为undefined || null) && data.key不为string、number、symbol、boolean类型时
  if (process.env.NODE_ENV !== 'production' &&
    isDef(data) && isDef(data.key) && !isPrimitive(data.key)
  ) {
    // 在非weex环境下 || @binding属性不在data.key中时提示'key属性请用string或number类型的值,避免使用非原始值'
    if (!__WEEX__ || !('@binding' in data.key)) {
      warn(
        'Avoid using non-primitive value as key, ' +
        'use string/number value instead.',
        context
      )
    }
  }
  // support single function children as default scoped slot
  // 子节点为数组形式 && 第一个子节点是函数形式的时,设置data为原data或空对象,
  // 设置data.scopedSlot对象中的default属性为第一个子节点,初始化children数据为空数组
  if (Array.isArray(children) &&
    typeof children[0] === 'function'
  ) {
    data = data || {}
    data.scopedSlots = { default: children[0] }
    children.length = 0
  }
  // 当时开发者调用$createElement这个api时(可能是jsx、单文件组件等等),生成一个处理过的子节点数组结合
  if (normalizationType === ALWAYS_NORMALIZE) {
    children = normalizeChildren(children)
    //
  } else if (normalizationType === SIMPLE_NORMALIZE) {
    children = simpleNormalizeChildren(children)
  }
  let vnode, ns
  if (typeof tag === 'string') {
    let Ctor
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag)
    if (config.isReservedTag(tag)) {
      // platform built-in elements
      vnode = new VNode(
        config.parsePlatformTagName(tag), data, children,
        undefined, undefined, context
      )
    } else if (isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
      // component
      vnode = createComponent(Ctor, data, context, children, tag)
    } else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      vnode = new VNode(
        tag, data, children,
        undefined, undefined, context
      )
    }
  } else {
    // direct component options / constructor
    vnode = createComponent(tag, data, context, children)
  }
  if (Array.isArray(vnode)) {
    return vnode
  } else if (isDef(vnode)) {
    if (isDef(ns)) applyNS(vnode, ns)
    if (isDef(data)) registerDeepBindings(data)
    return vnode
  } else {
    return createEmptyVNode()
  }
}

function applyNS (vnode, ns, force) {
  vnode.ns = ns
  if (vnode.tag === 'foreignObject') {
    // use default namespace inside foreignObject
    ns = undefined
    force = true
  }
  if (isDef(vnode.children)) {
    for (let i = 0, l = vnode.children.length; i < l; i++) {
      const child = vnode.children[i]
      if (isDef(child.tag) && (
        isUndef(child.ns) || (isTrue(force) && child.tag !== 'svg'))) {
        applyNS(child, ns, force)
      }
    }
  }
}

// ref #5318
// necessary to ensure parent re-render when deep bindings like :style and
// :class are used on slot nodes
function registerDeepBindings (data) {
  if (isObject(data.style)) {
    traverse(data.style)
  }
  if (isObject(data.class)) {
    traverse(data.class)
  }
}
