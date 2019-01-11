/* @flow */

import VNode, { cloneVNode } from './vnode'
import { createElement } from './create-element'
import { resolveInject } from '../instance/inject'
import { normalizeChildren } from '../vdom/helpers/normalize-children'
import { resolveSlots } from '../instance/render-helpers/resolve-slots'
import { installRenderHelpers } from '../instance/render-helpers/index'

import {
  isDef,
  isTrue,
  hasOwn,
  camelize,
  emptyObject,
  validateProp
} from '../util/index'
/*
    作用:
          1、生成功能性组件函数
*/
export function FunctionalRenderContext (
  data: VNodeData,//创建构造函数传入的参数
  props: Object,// 合并attrs和props后的对象
  children: ?Array<VNode>,//子节点集合
  parent: Component,//当前组件实例
  Ctor: Class<Component>//构造函数
) {
  // 缓存构造函数的options
  const options = Ctor.options
  // ensure the createElement function in functional components
  // 确保函数组件中的createElement函数
  // gets a unique context - this is necessary for correct named slot check
  // 获取唯一上下文——这对于正确的命名槽检查是必要的
  let contextVm
  // 当前组件实例非原型对象中存在_uid唯一标识符(表示由实例构造函数生成的)
  if (hasOwn(parent, '_uid')) {
    // 创建已当前组件实例为原型的空对象
    contextVm = Object.create(parent)
    // $flow-disable-line
    // 设置该对象的_original属性为当前组件实例
    contextVm._original = parent
  } else {
    // the context vm passed in is a functional context as well.
    // 传入的上下文vm也是一个功能上下文。
    // in this case we want to make sure we are able to get a hold to the
    //在这种情况下，我们想确定一下我们能否得到
    // real context instance.
    //真实的上下文实例。
    contextVm = parent
    // $flow-disable-line
    parent = parent._original
  }
  // 表示是否已编译过的函数模板
  const isCompiled = isTrue(options._compiled)
  const needNormalization = !isCompiled

  this.data = data //将参数设置为该函数实例的data属性
  this.props = props //将参数设置为该函数实例的props属性
  this.children = children //将参数设置为该函数实例的children属性
  this.parent = parent //将参数设置为该函数实例的parent属性
  this.listeners = data.on || emptyObject //将data中的事件信息设置为该函数实例的listeners属性
  this.injections = resolveInject(options.inject, parent)//处理inject属性添加到该函数实例的injections属性
  this.slots = () => resolveSlots(children, parent)//设置处理好的插糟节点

  // support for compiled functional template 支持编译的函数模板
  if (isCompiled) {
    // exposing $options for renderStatic()
    // 暴露$options为了静态模板渲染
    this.$options = options
    // pre-resolve slots for renderSlot()
    // 设置$slots属性为设置处理好的插糟节点
    this.$slots = this.slots()
    // 将scopedSlots属性设置到该函数实例的$scopedSlots属性上
    this.$scopedSlots = data.scopedSlots || emptyObject
  }
  //设置_c为创建节点函数
  if (options._scopeId) {
    this._c = (a, b, c, d) => {
      const vnode = createElement(contextVm, a, b, c, d, needNormalization)
      if (vnode && !Array.isArray(vnode)) {
        vnode.fnScopeId = options._scopeId
        vnode.fnContext = parent
      }
      return vnode
    }
  } else {
    this._c = (a, b, c, d) => createElement(contextVm, a, b, c, d, needNormalization)
  }
}

installRenderHelpers(FunctionalRenderContext.prototype)
/*
    作用:
          1、创建功能型组件
*/
export function createFunctionalComponent (
  Ctor: Class<Component>,// 构造函数
  propsData: ?Object,// props
  data: VNodeData,//创建构造函数传入的参数
  contextVm: Component,//当前组件实例
  children: ?Array<VNode>//子节点集合
): VNode | Array<VNode> | void {
  // 缓存构造函数中的options
  const options = Ctor.options
  const props = {}
  // 缓存构造函数中的props
  const propOptions = options.props
  // 当构造函数中的props存在时
  if (isDef(propOptions)) {
    // 循环props
    for (const key in propOptions) {
      //对比父子之间的props,并输出相应的值
      props[key] = validateProp(key, propOptions, propsData || emptyObject)
    }
    // 不存在时
  } else {
    // 参数传入的attrs属性存在时,将attrs属性中key和value合并到空对象变量中
    if (isDef(data.attrs)) mergeProps(props, data.attrs)
    // 参数传入的props属性存在时,将props属性中key和value合并到空对象变量中
    if (isDef(data.props)) mergeProps(props, data.props)
  }
  // 缓存生成的功能性组件
  const renderContext = new FunctionalRenderContext(
    data,//创建构造函数传入的参数
    props,//合并attrs和props后的对象
    children, //子节点集合
    contextVm,//当前组件实例
    Ctor//构造函数
  )
  // 生成节点
  const vnode = options.render.call(null, renderContext._c, renderContext)
  // 单个节点
  if (vnode instanceof VNode) {
    //将单个节点克隆并输出
    return cloneAndMarkFunctionalResult(vnode, data, renderContext.parent, options)
    // 多个节点
  } else if (Array.isArray(vnode)) {
    const vnodes = normalizeChildren(vnode) || []
    const res = new Array(vnodes.length)
    for (let i = 0; i < vnodes.length; i++) {
      res[i] = cloneAndMarkFunctionalResult(vnodes[i], data, renderContext.parent, options)
    }
    // 将多个节点克隆并输出
    return res
  }
}
/*
    作用:
          克隆传入的节点
*/
function cloneAndMarkFunctionalResult (vnode, data, contextVm, options) {
  // #7817 clone node before setting fnContext, otherwise if the node is reused
  // (e.g. it was from a cached normal slot) the fnContext causes named slots
  // that should not be matched to match.
  const clone = cloneVNode(vnode)
  clone.fnContext = contextVm
  clone.fnOptions = options
  if (data.slot) {
    (clone.data || (clone.data = {})).slot = data.slot
  }
  return clone
}
/*
  作用:
        1、将form参数中的key和value合并到to对象中,并且key名转换成驼峰形式
*/
function mergeProps (to, from) {
  for (const key in from) {
    to[camelize(key)] = from[key]
  }
}
