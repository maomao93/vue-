/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  computed: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  dep: Dep;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component, //组件实例对象 vm
    expOrFn: string | Function, //要观察的表达式 expOrFn
    cb: Function, //当被观察的表达式的值变化时的回调函数 cb
    options?: ?Object, //一些传递给当前观察者对象的选项 option
    isRenderWatcher?: boolean //用来标识该观察者实例是否是渲染函数的观察者
  ) {
    this.vm = vm
    /*
      把vm._watcher赋值为这个实例
        1、computed不会
        2、watch不会
        3、初始渲染组件时会
    */
    if (isRenderWatcher) {
      //将watch实例赋值给Vue实例的_watcher属性
      vm._watcher = this
    }
    //往vm._watcher添加这个实例
    vm._watchers.push(this)
    /*1、computed:{
          computed: true
         }
      2、watch: {
          handler: function (val, oldVal) { /!* ... *!/ },
          deep: true,
          immediate: true
         }
      3、mounted: {
          before () {
            if (vm._isMounted) {
              callHook(vm, 'beforeUpdate')
            }
          }
        }
    */
    if (options) {
      this.deep = !!options.deep //是否深度监听(用于watch的数组)
      this.user = !!options.user //标识当前观察者实例对象是 开发者定义的 还是 内部定义的
      this.computed = !!options.computed //是否是计算属性
      this.sync = !!options.sync //父子组件传递数据时是否存在.sync
      this.before = options.before //这个初始化挂载组件的时候传递的参数
    } else {
      this.deep = this.user = this.computed = this.sync = false
    }
    this.cb = cb //回调
    this.id = ++uid // uid for batching
    this.active = true //标识着该观察者实例对象是否是激活状态
    this.dirty = this.computed // for computed watchers
    /*
      1、newDepIds 属性用来在一次求值中避免收集重复的观察者
      2、每次求值并收集观察者完成之后会清空 newDepIds 和 newDeps 这两个属性的值，
        并且在被清空之前把值分别赋给了 depIds 属性和 deps 属性
      3、depIds 属性用来避免重复求值时收集重复的观察者
    */
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString() //将表达式转换成字符串
      : ''
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn)//解析表达式或字符串并返回一个(方法或undefined)
      /*返回undefined报错*/
      if (!this.getter) {
        this.getter = function () {}
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    //计算属性的watcher实例中的value属性为undefined否则值为this.getter表达式输出的值
    if (this.computed) {
      this.value = undefined
      this.dep = new Dep()
    } else {
      //执行this.get()并将返回值赋值给this.value
      this.value = this.get()
    }
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {
    pushTarget(this) //赋值Dep.target
    let value
    //缓存Vue实例
    const vm = this.vm
    try {
      //判断this.getter执行时是否报错
      value = this.getter.call(vm, vm) //返回表达式的值
    } catch (e) {
      //判断是否是用户定义的
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      //判断是否深度监听
      if (this.deep) {
        //深遍历值
        traverse(value)
      }
      popTarget() //赋值Dep.target
      //清理依赖项收集
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  //添加Dep实例并往Dep实例中添加这个watcher实例，当然不是重复添加
  addDep (dep: Dep) {
    //获取Dep实例的id
    const id = dep.id
    //this.newDepIds不存在唯一标识符id
    if (!this.newDepIds.has(id)) {
      //往this.newDepIds中添加唯一标识符id
      this.newDepIds.add(id)
      //往this.newDepIds中添加Dep实例
      this.newDeps.push(dep)
      /*
        this.depIds中不存在唯一标识符id则执行Dep实例的addSub(),
        这个方法是往Dep实例中添加watcher实例
      */
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  //清理依赖项收集
  cleanupDeps () {
    //获取deps的长度
    let i = this.deps.length
    while (i--) {
      //缓存dep数组中的各项
      const dep = this.deps[i]
      //不存在新的依赖中
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this) //把dep.subs中的这个Watcher实例移除
      }
    }
    //保存旧依赖ID
    let tmp = this.depIds
    //将新依赖ID集合赋值给旧依赖
    this.depIds = this.newDepIds
    //旧依赖id集合赋值给新依赖
    this.newDepIds = tmp
    //清空newDepIds
    this.newDepIds.clear()
    //保存deps
    tmp = this.deps
    //新依赖赋值给旧依赖
    this.deps = this.newDeps
    //旧依赖赋值给新依赖
    this.newDeps = tmp
    //清空新依赖数组
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update () {
    /* istanbul ignore else */
    if (this.computed) {
      // A computed property watcher has two modes: lazy and activated.
      // It initializes as lazy by default, and only becomes activated when
      // it is depended on by at least one subscriber, which is typically
      // another computed property or a component's render function.
      if (this.dep.subs.length === 0) {
        // In lazy mode, we don't want to perform computations until necessary,
        // so we simply mark the watcher as dirty. The actual computation is
        // performed just-in-time in this.evaluate() when the computed property
        // is accessed.
        this.dirty = true
      } else {
        // In activated mode, we want to proactively perform the computation
        // but only notify our subscribers when the value has indeed changed.
        this.getAndInvoke(() => {
          this.dep.notify()
        })
      }
    } else if (this.sync) {
      this.run()
    } else {
      //将实例放入观察者队列中
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {
    if (this.active) {
      this.getAndInvoke(this.cb)
    }
  }

  getAndInvoke (cb: Function) {
    //对于渲染函数的观察者来说就是重新执行渲染函数
    const value = this.get()
    if (
      value !== this.value ||
      // Deep watchers and watchers on Object/Arrays should fire even
      // when the value is the same, because the value may
      // have mutated.
      isObject(value) ||
      this.deep
    ) {
      // set new value
      const oldValue = this.value //获取旧值
      this.value = value //设置新值
      this.dirty = false
      //判断是用户定义还是内部定义
      if (this.user) {
        try {
          cb.call(this.vm, value, oldValue)
        } catch (e) {
          handleError(e, this.vm, `callback for watcher "${this.expression}"`)
        }
      } else {
        cb.call(this.vm, value, oldValue)
      }
    }
  }

  /**
   * Evaluate and return the value of the watcher.
   * This only gets called for computed property watchers.
   */
  evaluate () {
    //计算属性标识表示只有是计算属性才会执行下面代码
    if (this.dirty) {
      //获取最新值
      this.value = this.get()
      //并将标识符设置为false(表示该计算属性只执行这个方法1次)
      this.dirty = false
    }
    //返回计算属性get()返回的值
    return this.value
  }

  /**
   * Depend on this watcher. Only for computed property watchers.
   */
  depend () {
    //计算属性执行get时触发,在watcher实例放入该Dep实例,并将watcher实例放入该Dep实例的subs数组中
    if (this.dep && Dep.target) {
      this.dep.depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      /*如果组件已经在销毁就不做这一步，否则销毁_watchers中的这个实例*/
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
