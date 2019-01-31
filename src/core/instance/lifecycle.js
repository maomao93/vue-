/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import { mark, measure } from '../util/perf'
import { createEmptyVNode } from '../vdom/vnode'
import { updateComponentListeners } from './events'
import { resolveSlots } from './render-helpers/resolve-slots'
import { toggleObserving } from '../observer/index'
import { pushTarget, popTarget } from '../observer/dep'

import {
  warn,
  noop,
  remove,
  handleError,
  emptyObject,
  validateProp
} from '../util/index'

export let activeInstance: any = null
export let isUpdatingChildComponent: boolean = false
/*
  作用: 初始化一些数据，比如$children、$refs、_watcher、$root、
     $parent、_inactive、_directInactive、_isMounted 、_isDestroyed、
      _isBeingDestroyed
*/
export function initLifecycle (vm: Component) {
  //缓存合并处理过后的$options
  const options = vm.$options

  // locate first non-abstract parent
  //缓存当前实例的父组件
  let parent = options.parent
  //父组件存在并且当前实例不是抽象的
  /*
    抽象组件: keep-alive、transition这些
      特点1、一般不渲染真实DOM
      特点2、不会出现在父子关系的路径上
  */
  if (parent && !options.abstract) {
    /*parent是抽象组件并且parent存在父组件*/
    while (parent.$options.abstract && parent.$parent) {
      //将parent的父组件赋值给parent
      parent = parent.$parent
    }
    //直到循环parent不为抽象组件时退出，也就是获取当前实例的第一个非抽象的父组件,
    //将当前实例push进这个父组件的子组件属性$children中
    parent.$children.push(vm)
  }
  //缓存当前实例的第一个非抽象组件
  vm.$parent = parent
  //父组件存在则缓存父组件的根组件 不存在则缓存自身，表示自身就是根组件
  vm.$root = parent ? parent.$root : vm
  //设置当前实例的$children为[]
  vm.$children = []
  //设置当前实例的$refs为{}
  vm.$refs = {}
  //设置当前_watcher为空
  vm._watcher = null
  //设置当前_inactive为空
  vm._inactive = null
  //设置当前_directInactive为false
  vm._directInactive = false
  //设置当前_isMounted为false
  vm._isMounted = false
  //设置当前_isDestroyed为false
  vm._isDestroyed = false
  //设置当前_isBeingDestroyed为false
  vm._isBeingDestroyed = false
}

/*
  为Vue原型添加_update、$forceUpdate、$destroy三个方法
    _update:
    $forceUpdate:
    $destroy:
*/
export function lifecycleMixin (Vue: Class<Component>) {
  Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
    const prevEl = vm.$el
    const prevVnode = vm._vnode
    const prevActiveInstance = activeInstance
    activeInstance = vm
    vm._vnode = vnode
    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    if (!prevVnode) {
      // initial render
      vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */)
    } else {
      // updates
      vm.$el = vm.__patch__(prevVnode, vnode)
    }
    activeInstance = prevActiveInstance
    // update __vue__ reference
    if (prevEl) {
      prevEl.__vue__ = null
    }
    if (vm.$el) {
      vm.$el.__vue__ = vm
    }
    // if parent is an HOC, update its $el as well
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
      vm.$parent.$el = vm.$el
    }
    // updated hook is called by the scheduler to ensure that children are
    // updated in a parent's updated hook.
  }
  /*
    作用: 重新渲染一次该实例
  */
  Vue.prototype.$forceUpdate = function () {
    const vm: Component = this
    if (vm._watcher) {
      vm._watcher.update()
    }
  }
  /*
     作用:
          1、该实例正在销毁时,return
          2、执行销毁前的生命周期函数beforeDestroy
          3、设置_isBeingDestroyed属性为true,表示正在销毁中
          4、存在父组件&&父组件还未销毁时&&父组件不为抽象组件时，将该组件从父组件的子集合中移除
          5、解除该实例观察者对属性的观察
          6、清空该实例中的所有属性观察者
          7、实例序号-1
          8、设置_isDestroyed为true,表示已销毁
          9、调用当前渲染树上的销毁钩子、执行destroyed钩子函数、清空所有实例侦听器、
            设置节点的__vue__为null、清空组件节点的父级(释放循环引用)
  */
  Vue.prototype.$destroy = function () {
    const vm: Component = this
    if (vm._isBeingDestroyed) {
      return
    }
    callHook(vm, 'beforeDestroy')
    vm._isBeingDestroyed = true
    // remove self from parent
    const parent = vm.$parent
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      remove(parent.$children, vm)
    }
    // teardown watchers
    if (vm._watcher) {
      vm._watcher.teardown()
    }
    let i = vm._watchers.length
    while (i--) {
      vm._watchers[i].teardown()
    }
    // remove reference from data ob
    // 从数据ob中删除引用
    // frozen object may not have observer.
    // 被冻结的对象可能没有观察者。
    if (vm._data.__ob__) {
      vm._data.__ob__.vmCount--
    }
    // call the last hook...
    vm._isDestroyed = true
    // invoke destroy hooks on current rendered tree 调用当前渲染树上的销毁钩子
    vm.__patch__(vm._vnode, null)
    // fire destroyed hook 执行destroyed钩子函数
    callHook(vm, 'destroyed')
    // turn off all instance listeners. 清空所有实例侦听器
    vm.$off()
    // remove __vue__ reference 设置节点的__vue__为null
    if (vm.$el) {
      vm.$el.__vue__ = null
    }
    // release circular reference (#6759) 清空组件节点的父级
    if (vm.$vnode) {
      vm.$vnode.parent = null
    }
  }
}
/*
  作用:
        1、设置实例的$el为实例挂载的节点
        2、当$options中没有渲染函数时,设置render函数为一个创建空节点的函数;
           并且提示错误信息'现在使用的vue是运行时,模板编译器不可用,请将模板编译成render函数
           或者使用完整版的vue'(前提存在有template) || 提示'挂载组件失败,没有模板和render函数'
        3、执行beforeMount钩子函数
        4、为该组件的渲染函数生成一个观察实例,并定义了before函数，其中执行beforeUpdate钩子函数
        5、执行mounted钩子函数
*/
export function mountComponent (
  vm: Component,
  el: ?Element,
  hydrating?: boolean
): Component {
  //获取处理过后的节点
  vm.$el = el
  //判断是否有解析成render函数
  if (!vm.$options.render) {
    //将render赋值createEmptyVNode函数(并且在非生产环境下提示警告)
    vm.$options.render = createEmptyVNode
    if (process.env.NODE_ENV !== 'production') {
      /* istanbul ignore if */
      //template属性值并且第一个字符串值不为# || 存在el时报警告
      if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') ||
        vm.$options.el || el) {
        warn(
          'You are using the runtime-only build of Vue where the template ' +
          'compiler is not available. Either pre-compile the templates into ' +
          'render functions, or use the compiler-included build.',
          vm
        )
      } else {
        warn(
          'Failed to mount component: template or render function not defined.',
          vm
        )
      }
    }
  }
  /*执行beforeMount钩子函数*/
  callHook(vm, 'beforeMount')

  let updateComponent
  /* istanbul ignore if */
  //在非生产环境下对这两个标记点进行性能计算
  if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
    //updateComponent函数作用: 把渲染函数生成的虚拟DOM渲染成真正的DOM
    updateComponent = () => {
      const name = vm._name
      const id = vm._uid
      const startTag = `vue-perf-start:${id}`
      const endTag = `vue-perf-end:${id}`

      mark(startTag)
      //调用 vm.$options.render 函数并返回生成的虚拟节点(vnode)
      const vnode = vm._render()
      mark(endTag)
      measure(`vue ${name} render`, startTag, endTag)

      mark(startTag)
      //把 vm._render 函数生成的虚拟节点渲染成真正的 DOM
      vm._update(vnode, hydrating)
      mark(endTag)
      measure(`vue ${name} patch`, startTag, endTag)
    }
  } else {
    updateComponent = () => {
      vm._update(vm._render(), hydrating)
    }
  }
  // we set this to vm._watcher inside the watcher's constructor
  // since the watcher's initial patch may call $forceUpdate (e.g. inside child
  // component's mounted hook), which relies on vm._watcher being already defined
  new Watcher(vm, updateComponent, noop, {
    before () {
      if (vm._isMounted) {
        callHook(vm, 'beforeUpdate')
      }
    }
  }, true /* isRenderWatcher */)
  hydrating = false
  // manually mounted instance, call mounted on self
  // 手动挂载实例，调用挂载在self上
  // mounted is called for render-created child components in its inserted hook
  //在其插入的钩子中为呈现器创建的子组件调用mount
  if (vm.$vnode == null) {
    vm._isMounted = true
    callHook(vm, 'mounted')
  }
  return vm
}

export function updateChildComponent (
  vm: Component,
  propsData: ?Object,
  listeners: ?Object,
  parentVnode: MountedComponentVNode,
  renderChildren: ?Array<VNode>
) {
  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = true
  }

  // determine whether component has slot children
  // we need to do this before overwriting $options._renderChildren
  const hasChildren = !!(
    renderChildren ||               // has new static slots
    vm.$options._renderChildren ||  // has old static slots
    parentVnode.data.scopedSlots || // has new scoped slots
    vm.$scopedSlots !== emptyObject // has old scoped slots
  )

  vm.$options._parentVnode = parentVnode
  vm.$vnode = parentVnode // update vm's placeholder node without re-render

  if (vm._vnode) { // update child tree's parent
    vm._vnode.parent = parentVnode
  }
  vm.$options._renderChildren = renderChildren

  // update $attrs and $listeners hash
  // these are also reactive so they may trigger child update if the child
  // used them during render
  vm.$attrs = parentVnode.data.attrs || emptyObject
  vm.$listeners = listeners || emptyObject

  // update props
  if (propsData && vm.$options.props) {
    toggleObserving(false)
    const props = vm._props
    const propKeys = vm.$options._propKeys || []
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i]
      const propOptions: any = vm.$options.props // wtf flow?
      props[key] = validateProp(key, propOptions, propsData, vm)
    }
    toggleObserving(true)
    // keep a copy of raw propsData
    vm.$options.propsData = propsData
  }

  // update listeners
  listeners = listeners || emptyObject
  const oldListeners = vm.$options._parentListeners
  vm.$options._parentListeners = listeners
  updateComponentListeners(vm, listeners, oldListeners)

  // resolve slots + force update if has children
  if (hasChildren) {
    vm.$slots = resolveSlots(renderChildren, parentVnode.context)
    vm.$forceUpdate()
  }

  if (process.env.NODE_ENV !== 'production') {
    isUpdatingChildComponent = false
  }
}

function isInInactiveTree (vm) {
  while (vm && (vm = vm.$parent)) {
    if (vm._inactive) return true
  }
  return false
}
/*
  作用:
        1、用于改变组件的激活状态
        2、执行组件的activated生命周期函数
*/
export function activateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = false
    if (isInInactiveTree(vm)) {
      return
    }
  } else if (vm._directInactive) {
    return
  }
  if (vm._inactive || vm._inactive === null) {
    vm._inactive = false
    for (let i = 0; i < vm.$children.length; i++) {
      activateChildComponent(vm.$children[i])
    }
    callHook(vm, 'activated')
  }
}

export function deactivateChildComponent (vm: Component, direct?: boolean) {
  if (direct) {
    vm._directInactive = true
    if (isInInactiveTree(vm)) {
      return
    }
  }
  if (!vm._inactive) {
    vm._inactive = true
    for (let i = 0; i < vm.$children.length; i++) {
      deactivateChildComponent(vm.$children[i])
    }
    callHook(vm, 'deactivated')
  }
}

//执行生命周期hook函数
export function callHook (vm: Component, hook: string) {
  // #7573 disable dep collection when invoking lifecycle hooks
  pushTarget()
  const handlers = vm.$options[hook]
  if (handlers) {
    for (let i = 0, j = handlers.length; i < j; i++) {
      try {
        handlers[i].call(vm)
      } catch (e) {
        handleError(e, vm, `${hook} hook`)
      }
    }
  }
  /*_hasHookEvent为true时，向父组件派发hook:+生命周期函数名*/
  /*
    可以这么为子组件添加生命周期钩子的事件侦听器
    <child
      @hook:beforeCreate="handleChildBeforeCreate"
      @hook:created="handleChildCreated"
      @hook:mounted="handleChildMounted"
      @hook:生命周期钩子
    />
  */
  if (vm._hasHookEvent) {
    vm.$emit('hook:' + hook)
  }
  popTarget()
}
