/* @flow */

import VNode from './vnode'
import { resolveConstructorOptions } from 'core/instance/init'
import { queueActivatedComponent } from 'core/observer/scheduler'
import { createFunctionalComponent } from './create-functional-component'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject
} from '../util/index'

import {
  resolveAsyncComponent,
  createAsyncPlaceholder,
  extractPropsFromVNodeData
} from './helpers/index'

import {
  callHook,
  activeInstance,
  updateChildComponent,
  activateChildComponent,
  deactivateChildComponent
} from '../instance/lifecycle'

import {
  isRecyclableComponent,
  renderRecyclableComponentTemplate
} from 'weex/runtime/recycle-list/render-component-template'

// inline hooks to be invoked on component VNodes during patch
const componentVNodeHooks = {
  init (vnode: VNodeWithData, hydrating: boolean): ?boolean {
    if (
      vnode.componentInstance &&
      !vnode.componentInstance._isDestroyed &&
      vnode.data.keepAlive
    ) {
      // kept-alive components, treat as a patch
      const mountedNode: any = vnode // work around flow
      componentVNodeHooks.prepatch(mountedNode, mountedNode)
    } else {
      const child = vnode.componentInstance = createComponentInstanceForVnode(
        vnode,
        activeInstance
      )
      child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    }
  },

  prepatch (oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
    const options = vnode.componentOptions
    const child = vnode.componentInstance = oldVnode.componentInstance
    updateChildComponent(
      child,
      options.propsData, // updated props
      options.listeners, // updated listeners
      vnode, // new parent vnode
      options.children // new children
    )
  },

  insert (vnode: MountedComponentVNode) {
    const { context, componentInstance } = vnode
    if (!componentInstance._isMounted) {
      componentInstance._isMounted = true
      callHook(componentInstance, 'mounted')
    }
    if (vnode.data.keepAlive) {
      if (context._isMounted) {
        // vue-router#1212
        // During updates, a kept-alive component's child components may
        // change, so directly walking the tree here may call activated hooks
        // on incorrect children. Instead we push them into a queue which will
        // be processed after the whole patch process ended.
        queueActivatedComponent(componentInstance)
      } else {
        activateChildComponent(componentInstance, true /* direct */)
      }
    }
  },

  destroy (vnode: MountedComponentVNode) {
    const { componentInstance } = vnode
    if (!componentInstance._isDestroyed) {
      if (!vnode.data.keepAlive) {
        componentInstance.$destroy()
      } else {
        deactivateChildComponent(componentInstance, true /* direct */)
      }
    }
  }
}

const hooksToMerge = Object.keys(componentVNodeHooks)
/*
  作用:
        1、当前组件类Ctor为undefined时return
        2、当前组件类Ctor为对象时,将其变成构造函数并继承当前组件构造函数的一些属性
        3、当前组件类Ctor不为函数时return，并提示无效的组件定义
        4、对异步组件加载方式进行处理，对相应的状态做相应的处理，最后返回相应状态的构造函数,
          如果没有返回值则return空节点，并将参数设置为节点的asyncFactory和asyncMeta属性值
        5、
*/
export function createComponent (
  Ctor: Class<Component> | Function | Object | void,//当前组件类
  data: ?VNodeData,//class或事件
  context: Component,//当前组件实例
  children: ?Array<VNode>,//子节点集合
  tag?: string//组件标签名
): VNode | Array<VNode> | void {
  // 当前组件类为undefined时结束该函数
  if (isUndef(Ctor)) {
    return
  }
  // 获取当前组件的构造函数
  const baseCtor = context.$options._base

  // plain options object: turn it into a constructor
  //对象是否不为null并且类型为object(参数是对象而不是函数)
  if (isObject(Ctor)) {
    // 继承当前组件构造函数的属性并且生成一个创建组件的构造函数
    Ctor = baseCtor.extend(Ctor)
  }

  // if at this stage it's not a constructor or an async component factory,
  //如果在这个阶段它不是构造函数或异步组件工厂
  // reject.
  // 不是构造函数或异步组件工厂则提示无效的组件定义并且return
  if (typeof Ctor !== 'function') {
    if (process.env.NODE_ENV !== 'production') {
      warn(`Invalid Component definition: ${String(Ctor)}`, context)
    }
    return
  }

  // async component
  let asyncFactory
  // 不存在构造函数唯一标识符(异步组件处理: 工厂函数不存在cid)
  if (isUndef(Ctor.cid)) {
    // 缓存该构造函数
    asyncFactory = Ctor
    //对不同的异步加载组件方式进行处理,并返回相应的加载中、加载失败、加载成功状态的组件构造函数
    Ctor = resolveAsyncComponent(asyncFactory, baseCtor, context)
    // 当没有返回值时
    if (Ctor === undefined) {
      // return a placeholder node for async component, which is rendered
      //为已呈现的异步组件返回占位符节点
      // as a comment node but preserves all the raw information for the node.
      //作为注释节点，但保留该节点的所有原始信息。
      // the information will be used for async server-rendering and hydration.
      //这些信息将用于异步服务器呈现和水合作用。

      // 返回一个空节点，并将参数设置到相应的空节点对象属性上
      return createAsyncPlaceholder(
        asyncFactory,//构造函数
        data,//class或事件
        context,//当前组件实例
        children,//子节点集合
        tag//组件标签名
      )
    }
  }

  data = data || {}

  // resolve constructor options in case global mixins are applied after
  //解析构造函数选项，以防在后面应用全局mixin
  // component constructor creation
  //组件构造函数创建

  // 对构造函数的options进行更新,当其存在继承函数时
  resolveConstructorOptions(Ctor)

  // transform component v-model data into props & events
  // 存在model属性值时，处理该属性
  if (isDef(data.model)) {
    transformModel(Ctor.options, data)
  }

  // extract props
  // 将构造函数的options.props中的属性值赋值为(data中的prop或attrs对应的属性值 || undefined)
  const propsData = extractPropsFromVNodeData(data, Ctor, tag)

  // functional component
  if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(Ctor, propsData, data, context, children)
  }

  // extract listeners, since these needs to be treated as
  // child component listeners instead of DOM listeners
  const listeners = data.on
  // replace with listeners with .native modifier
  // so it gets processed during parent component patch.
  data.on = data.nativeOn

  if (isTrue(Ctor.options.abstract)) {
    // abstract components do not keep anything
    // other than props & listeners & slot

    // work around flow
    const slot = data.slot
    data = {}
    if (slot) {
      data.slot = slot
    }
  }

  // install component management hooks onto the placeholder node
  installComponentHooks(data)

  // return a placeholder vnode
  const name = Ctor.options.name || tag
  const vnode = new VNode(
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data, undefined, undefined, undefined, context,
    { Ctor, propsData, listeners, tag, children },
    asyncFactory
  )

  // Weex specific: invoke recycle-list optimized @render function for
  // extracting cell-slot template.
  // https://github.com/Hanks10100/weex-native-directive/tree/master/component
  /* istanbul ignore if */
  if (__WEEX__ && isRecyclableComponent(vnode)) {
    return renderRecyclableComponentTemplate(vnode)
  }

  return vnode
}

export function createComponentInstanceForVnode (
  vnode: any, // we know it's MountedComponentVNode but flow doesn't
  parent: any, // activeInstance in lifecycle state
): Component {
  const options: InternalComponentOptions = {
    _isComponent: true,
    _parentVnode: vnode,
    parent
  }
  // check inline-template render functions
  const inlineTemplate = vnode.data.inlineTemplate
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render
    options.staticRenderFns = inlineTemplate.staticRenderFns
  }
  return new vnode.componentOptions.Ctor(options)
}

function installComponentHooks (data: VNodeData) {
  const hooks = data.hook || (data.hook = {})
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i]
    const existing = hooks[key]
    const toMerge = componentVNodeHooks[key]
    if (existing !== toMerge && !(existing && existing._merged)) {
      hooks[key] = existing ? mergeHook(toMerge, existing) : toMerge
    }
  }
}

function mergeHook (f1: any, f2: any): Function {
  const merged = (a, b) => {
    // flow complains about extra args which is why we use any
    f1(a, b)
    f2(a, b)
  }
  merged._merged = true
  return merged
}

// transform component v-model info (value and callback) into
// prop and event handler respectively.
/*
    作用: 处理参数的model属性
*/
function transformModel (options, data: any) {
  // 缓存设置的需要v-model监听的值 || 默认的value
  const prop = (options.model && options.model.prop) || 'value'
  // 缓存设置的需要v-model监听的事件 || 默认的input事件
  const event = (options.model && options.model.event) || 'input';
  // 设置传入data的props对象中设置相应的model.prop值 || 默认的value
  (data.props || (data.props = {}))[prop] = data.model.value
  const on = data.on || (data.on = {})
  // 存在指定的事件时
  if (isDef(on[event])) {
    // 将指定的事件和原先model的回调事件合并
    on[event] = [data.model.callback].concat(on[event])
  } else {
    // 原先model的回调事件
    on[event] = data.model.callback
  }
}
