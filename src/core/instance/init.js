/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

/*
  为原型添加_init方法
    _init:
*/
export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    vm._uid = uid++ //为每个实例添加个标记
    let startTag, endTag
    /* istanbul ignore if  主要在不是生产环境下为相应的视点做标记*/
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)//mark方法用于为相应的视点做标记
    }

    // a flag to avoid this being observed
    //确定是vue实例
    vm._isVue = true;
    /*merge options 合并options*/
    if (options && options._isComponent) {
      // optimize internal component instantiation //优化内部组件实例化
      // since dynamic options merging is pretty slow, and none of the //因为动态选项合并非常慢，而且没有一个
      // internal component options needs special treatment. //内部组件选项需要特殊处理。
      initInternalComponent(vm, options)//为当前组件实例的$option赋值
    } else {
      //合并默认的一些option,并且格式化option中的一些属性，使其符合要求，并对不合理的警告提示，
      // 比如规范化props、规范化Inject、规范化Directives等等
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    //在非生产环境为vm实例添加代理,并将实例赋值给vm._renderProxy
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    //将实例赋值给vm._self
    vm._self = vm
    // 初始化一些数据比如$refs、_isMounted等等
    initLifecycle(vm)
    // 初始化父组件传递下来的监听事件&&初始化事件收集器_events对象和_hasHookEvent变量
    initEvents(vm)
    //
    initRender(vm)
    callHook(vm, 'beforeCreate') //执行实例的beforeCreate函数或数组中的函数
    initInjections(vm) // resolve injections before data/props
    initState(vm)//初始化参数中的data、methods、props等等
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)//初始化结束
      measure(`vue ${vm._name} init`, startTag, endTag)//对这两个标记点进行性能计算
    }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

/*为当前组件的$option赋值（主要是父子组件的一些通信方法和数据）*/
export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)//缓存将实例的构造函数的options对象作为原型生成的对象
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode //赋值父组件节点
  opts.parent = options.parent //赋值父组件实例
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions //父组件的option数据
  opts.propsData = vnodeComponentOptions.propsData //父组件传递下来的数据
  opts._parentListeners = vnodeComponentOptions.listeners //当前组件往上派发的事件
  opts._renderChildren = vnodeComponentOptions.children //当前组件的子组件
  opts._componentTag = vnodeComponentOptions.tag //当前组件的标记

  if (options.render) {//是否存在render
    opts.render = options.render //option参数中的render()
    opts.staticRenderFns = options.staticRenderFns //option中静态render()集合
  }
}
/*
    作用:
          1、获取构造函数的options对象
          2、存在继承函数时输出处理过后的options对象,该对象进行过更新(如果原先的继承函数的构造函数的options有变动)
*/
export function resolveConstructorOptions (Ctor: Class<Component>) {
  /*Vue.options = {
    components: {
      KeepAlive
      Transition,
      TransitionGroup
    },
    directives:{
      model,
      show
    },
    filters: Object.create(null),
    _base: Vue
  }*/
  // 获取构造函数的options参数
  let options = Ctor.options
  // 当前构造函数有继承函数时
  if (Ctor.super) {
    // 获取构造函数的继承函数的构造函数的options(这个是现在继承函数的构造函数的)
    const superOptions = resolveConstructorOptions(Ctor.super)
    // 缓存构造函数的继承函数构造函数的options(这个是当时创建该构造函数的保存的)
    const cachedSuperOptions = Ctor.superOptions
    // 当两者不一样时,说明继承函数有变化
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      // 设置新的superOptions属性
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      // 对构造函数有变化的options进行处理合并和去掉重复的
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      // 存在options时更新基本扩展选项(生成构造函数时传入的options)
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      // 合并现在继承函数的构造函数的options和现在生成构造函数时传入的options
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      // 存在组件名时,设置options的components[组件名]为当前构造函数
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  // 将options输出
  return options
}
/*
  作用:
        1、对构造函数有变化的options进行处理合并和去掉重复的
*/
function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  // 缓存构造函数当前的options
  const latest = Ctor.options
  // 缓存生成该构造函数是传入的参数
  const extended = Ctor.extendOptions
  // 缓存继承函数的options和生成该构造函数是传入的options合并的options
  const sealed = Ctor.sealedOptions
  // 循环构造函数的options
  for (const key in latest) {
    // options有变化时,对其进行处理合并和去掉重复的
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = dedupe(latest[key], extended[key], sealed[key])
    }
  }
  return modified
}
/*
    作用:
          1、对生命周期函数和其他属性分别处理避免重复叠加属性
*/
function dedupe (latest, extended, sealed) {
  // compare latest and sealed to ensure lifecycle hooks won't be duplicated
  // between merges
  // options中的属性值为数组时(生命周期函数可以多个并存)
  if (Array.isArray(latest)) {
    const res = []
    // 将原先合并的options的生命周期函数变为数组
    sealed = Array.isArray(sealed) ? sealed : [sealed]
    // 将生成构造函数传入的options的生命周期函数变为数组
    extended = Array.isArray(extended) ? extended : [extended]
    // 循环现在的生命周期函数数组
    for (let i = 0; i < latest.length; i++) {
      // push original options and not sealed options to exclude duplicated options
      // 生成构造函数传入的options中存在该函数时 || 原先合并的options不存在时(确保不填加重复的)
      if (extended.indexOf(latest[i]) >= 0 || sealed.indexOf(latest[i]) < 0) {
        res.push(latest[i])
      }
    }
    return res
  } else {
    // 返回当前options中的属性值
    return latest
  }
}
