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
        5、对构造函数的options进行更新,当其存在继承函数时
        6、存在model属性值时，处理该属性
        7、将构造函数的options.props中的属性值赋值为(data中的prop或attrs对应的属性值 || undefined)
        8、功能型函数生成功能型组件并return该组件实例
        9、对抽象组件只保留props、listeners和slot
        10、往data.hook对象中添加或合并init、prepatch、insert、destroy这四个事件
        11、创建该组件节点,组件名为vue-component-构造函数标识符cid(-名字 || '')
        12、return该组件节点
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

  // functional component 功能型函数比如router-view
  if (isTrue(Ctor.options.functional)) {
    // 生成功能型组件
    return createFunctionalComponent(Ctor, propsData, data, context, children)
  }

  // extract listeners, since these needs to be treated as
  // 提取监听器，因为这些监听器需要被当作
  // child component listeners instead of DOM listeners
  // 子组件监听器而不是DOM监听器

  // 缓存参数传入的监听事件集合
  const listeners = data.on
  // replace with listeners with .native modifier
  // 用.native修饰符替换监听器
  // so it gets processed during parent component patch.
  // 因此它在父组件补丁中被处理。
  data.on = data.nativeOn
  // 判断是否为抽象组件比如keep-alive
  if (isTrue(Ctor.options.abstract)) {
    // abstract components do not keep anything
    // 抽象组件不保存任何东西
    // other than props & listeners & slot
    // 除了props、listeners和slot

    // work around flow
    const slot = data.slot
    data = {}
    if (slot) {
      data.slot = slot
    }
  }

  // install component management hooks onto the placeholder node
  // 往data.hook对象中添加或合并init、prepatch、insert、destroy这四个事件
  installComponentHooks(data)

  // return a placeholder vnode
  // 获取构造函数名或标签名
  const name = Ctor.options.name || tag
  // 创建该组件节点,组件名为vue-component-构造函数标识符cid(-名字 || '')
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
  // 将该组件节点输出
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
  // check inline-template render functions 检查该虚拟节点是否为内联模板渲染函数
  const inlineTemplate = vnode.data.inlineTemplate
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render
    options.staticRenderFns = inlineTemplate.staticRenderFns
  }
  return new vnode.componentOptions.Ctor(options)
}
/*
  作用: 往data.hook对象中添加或合并init、prepatch、insert、destroy这四个事件
*/
function installComponentHooks (data: VNodeData) {
  const hooks = data.hook || (data.hook = {})
  // 循环init、prepatch、insert、destroy这个四个key
  for (let i = 0; i < hooksToMerge.length; i++) {
    // 获取事件名
    const key = hooksToMerge[i]
    // 获取参数中传入的该事件函数
    const existing = hooks[key]
    // 获取componentVNodeHooks变量中该事件函数
    const toMerge = componentVNodeHooks[key]
    // 判断两者是否相同 && 没有合并过时,将两个事件当做参数放入一个新建的函数中执行 || 将componentVNodeHooks变量中该事件函数赋值给data.hook中
    if (existing !== toMerge && !(existing && existing._merged)) {
      hooks[key] = existing ? mergeHook(toMerge, existing) : toMerge
    }
  }
}
/*
  作用: 将2个函数当做参数放入一个新建的函数中执行,并设置_merged为true,然后将这个新函数输出
*/
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
