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
/*
  作用:
        1、当data存在 && 该数据是观察者数据 收集警告信息‘避免使用观察到的数据对象作为vnode数据’,并return一个空节点
        2、当data存在 && data.is属性(组件名)存在时，设置组件名为标签名
        3、不存在标签名时,return一个文本为空的注释节点或空节点
        4、非生产环境下 && (data存在) && (data.key存在) && data.key不为string、number、symbol、boolean类型时提示
          'key属性请用string或number类型的值,避免使用非原始值'
        5、子节点为数组形式 && 第一个子节点是函数形式的时,设置data为原data或空对象,设置data.scopedSlot对象中的default属性为第一个子节点,
            初始化children数据为空数组
        6、当时开发者调用$createElement这个api时(可能是jsx、单文件组件等等),生成一个处理过的子节点数组结合;当normalizationType参数为1时,
            生成一个新的children数组或原children数组
        7、当标签名类型为string时,根据为html保留标签 || 组件实例有构造函数 || 二者都不为进行分别处理，生成组件节点
        8、当标签名类型不为string时,通过构造函数生成组件节点
        9、当生成的组件节点为多个时，return 该组件节点集合
        10、单个时对svg进行兼容处理和深度处理class和style的依赖项，并return 该组件节点
        11、不存在组件节点时return空节点
*/
export function _createElement (
  context: Component,//当前组件实例
  tag?: string | Class<Component> | Function | Object,// 标签名 || 组件 || 函数 || 对象
  data?: VNodeData, // undefined || 静态class、事件等等
  children?: any,// 子节点
  normalizationType?: number
): VNode | Array<VNode> {
  // 当data存在 && 该数据是观察者数据 收集警告信息‘避免使用观察到的数据对象作为vnode数据’,
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
  // 当data存在 && data.is属性(组件名)存在时，设置组件名为标签名
  if (isDef(data) && isDef(data.is)) {
    tag = data.is
  }
  // 不存在标签名时,输出一个文本为空的注释节点或空节点
  if (!tag) {
    // in case of component :is set to falsy value
    return createEmptyVNode()
  }
  // warn against non-primitive key
  // 非生产环境下 && (data存在) && (data.key存在) && data.key不为string、number、symbol、boolean类型时
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
    // 当normalizationType参数为1时,生成一个新的children数组或原children数组
  } else if (normalizationType === SIMPLE_NORMALIZE) {
    children = simpleNormalizeChildren(children)
  }
  let vnode, ns
  // 当标签名类型为string时
  if (typeof tag === 'string') {
    let Ctor
    // 当前组件实例的ns属性 || 判断标签是否为svg或math
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag)
    // 判断标签名是否为html保留标签或svg标签
    if (config.isReservedTag(tag)) {
      // platform built-in elements
      // 创建该标签的VNode实例
      vnode = new VNode(
        // weex环境下将标签中的'weex:'去掉,不是则返回原标签
        config.parsePlatformTagName(tag), data, children,
        undefined, undefined, context
      )
      // 读取当前实例中的$options中的components属性中的该组件的注册函数并且不为undefined时
    } else if (isDef(Ctor = resolveAsset(context.$options, 'components', tag))) {
      // component 生成组件节点
      vnode = createComponent(Ctor, data, context, children, tag)
    } else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      // 标签名为字符串 && 不为html保留标签 && 组件实例没有构造函数则直接生成组件节点
      vnode = new VNode(
        tag, data, children,
        undefined, undefined, context
      )
    }
  } else {
    // direct component options / constructor
    // 当标签名不为字符串时直接生成组件节点
    vnode = createComponent(tag, data, context, children)
  }
  // 生成的组件节点为多个时,直接返回该节点集合
  if (Array.isArray(vnode)) {
    return vnode
    // 当生成的组件节点存在&&不为数组时
  } else if (isDef(vnode)) {
    // 存在svg兼容问题时，单独进行处理
    if (isDef(ns)) applyNS(vnode, ns)
    // 当data不为空时,深度处理class和style的依赖项
    if (isDef(data)) registerDeepBindings(data)
    // 将处理过后的组件节点输出
    return vnode
  } else {
    // 创建空节点
    return createEmptyVNode()
  }
}
/*
  作用: 对IE浏览器的svg进行特殊兼容处理
*/
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

/*
  作用:必须确保父元素在深度绑定时重新呈现，比如:style和:class在槽节点上使用
      1、判断绑定的style是否为对象,并且深度收集依赖项
      2、判断绑定的class是否为对象,并且深度收集依赖项
*/
function registerDeepBindings (data) {
  if (isObject(data.style)) {
    traverse(data.style)
  }
  if (isObject(data.class)) {
    traverse(data.class)
  }
}
